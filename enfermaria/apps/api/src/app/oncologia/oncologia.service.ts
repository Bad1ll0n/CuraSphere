import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { Prisma } from '../../generated/prisma';
import { superficieCorporal, doseQuimio, toxicidadeAcionavel } from '../common/oncologia.helper';
import { CriarPlanoDto } from './dto/criar-plano.dto';
import { AgendarCicloDto } from './dto/agendar-ciclo.dto';
import { AdministrarCicloDto } from './dto/administrar-ciclo.dto';

interface Farmaco { nome: string; mgPorM2: number; doseMaximaMg: number | null; }

@Injectable()
export class OncologiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  private normalizarFarmacos(input: unknown): Farmaco[] {
    return (Array.isArray(input) ? input : [])
      .filter((f) => f && typeof f.nome === 'string' && Number(f.mgPorM2) > 0)
      .map((f) => ({ nome: String(f.nome), mgPorM2: Number(f.mgPorM2), doseMaximaMg: f.doseMaximaMg != null ? Number(f.doseMaximaMg) : null }));
  }

  private dosesDoPlano(plano: { farmacos: unknown; superficieCorporalM2: number | null }) {
    const bsa = plano.superficieCorporalM2;
    return this.normalizarFarmacos(plano.farmacos).map((f) => ({
      nome: f.nome,
      mgPorM2: f.mgPorM2,
      ...(bsa ? doseQuimio(f.mgPorM2, bsa, f.doseMaximaMg) : { doseMg: null, limitada: false }),
    }));
  }

  /** Cria um plano de quimioterapia. Calcula a BSA (Mosteller) se vierem peso e altura. */
  async criarPlano(doenteId: string, dto: CriarPlanoDto, criadoPorId: string) {
    const farmacos = this.normalizarFarmacos(dto.farmacos);
    if (farmacos.length === 0) throw new BadRequestException('Indique pelo menos um fármaco (nome + mg/m²).');
    const bsa = dto.pesoKg && dto.alturaCm ? superficieCorporal(dto.pesoKg, dto.alturaCm) : null;
    return this.prisma.planoQuimioterapia.create({
      data: {
        doenteId,
        protocoloNome: dto.protocoloNome,
        ciclosPrevistos: dto.ciclosPrevistos,
        intervaloDias: dto.intervaloDias ?? 21,
        alturaCm: dto.alturaCm ?? null,
        pesoKg: dto.pesoKg ?? null,
        superficieCorporalM2: bsa,
        farmacos: farmacos as unknown as Prisma.InputJsonValue,
        criadoPorId,
      },
    });
  }

  /** Plano ativo do doente + ciclos + doses calculadas por m². */
  async planoAtivo(doenteId: string) {
    const plano = await this.prisma.planoQuimioterapia.findFirst({
      where: { doenteId, estado: 'ativo' },
      orderBy: { criadoEm: 'desc' },
      include: { ciclos: { orderBy: { numero: 'asc' } } },
    });
    if (!plano) return null;
    return { ...plano, doses: this.dosesDoPlano(plano) };
  }

  private async planoOuFalha(planoId: string) {
    const p = await this.prisma.planoQuimioterapia.findUnique({
      where: { id: planoId },
      select: { id: true, doenteId: true, intervaloDias: true, superficieCorporalM2: true, farmacos: true },
    });
    if (!p) throw new NotFoundException('Plano de quimioterapia não encontrado.');
    return p;
  }

  async doses(planoId: string) {
    return this.dosesDoPlano(await this.planoOuFalha(planoId));
  }

  async agendarCiclo(planoId: string, dto: AgendarCicloDto) {
    await this.planoOuFalha(planoId);
    const numero = dto.numero ?? (await this.prisma.cicloQuimioterapia.count({ where: { planoId } })) + 1;
    return this.prisma.cicloQuimioterapia.create({
      data: { planoId, numero, dataPrevista: dto.dataPrevista ? new Date(dto.dataPrevista) : null },
    });
  }

  /** Regista a administração de um ciclo. Avisa se o intervalo foi curto; alerta se toxicidade ≥3. */
  async administrarCiclo(cicloId: string, dto: AdministrarCicloDto, registadoPorId: string) {
    const ciclo = await this.prisma.cicloQuimioterapia.findUnique({
      where: { id: cicloId },
      include: { plano: { select: { id: true, doenteId: true, intervaloDias: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const ultimo = await this.prisma.cicloQuimioterapia.findFirst({
      where: { planoId: ciclo.planoId, estado: 'administrado', dataAdministracao: { not: null } },
      orderBy: { dataAdministracao: 'desc' },
      select: { dataAdministracao: true },
    });
    let aviso: string | null = null;
    if (ultimo?.dataAdministracao) {
      const dias = Math.floor((Date.now() - ultimo.dataAdministracao.getTime()) / 86_400_000);
      if (dias < ciclo.plano.intervaloDias) {
        aviso = `Ciclo administrado ${dias}d após o anterior (intervalo do protocolo: ${ciclo.plano.intervaloDias}d).`;
      }
    }

    const atualizado = await this.prisma.cicloQuimioterapia.update({
      where: { id: cicloId },
      data: { estado: 'administrado', dataAdministracao: new Date(), toxicidadeGrau: dto.toxicidadeGrau ?? null, notas: dto.notas ?? null, registadoPorId },
    });

    if (toxicidadeAcionavel(dto.toxicidadeGrau)) {
      await this.alertas.criarAlerta(
        ciclo.plano.doenteId,
        'quimioterapia',
        `Toxicidade grau ${dto.toxicidadeGrau} (CTCAE) no ciclo ${ciclo.numero}. Reavaliar dose/protocolo.`,
      );
    }
    return { ...atualizado, aviso };
  }

  async doenteIdDoPlano(planoId: string): Promise<string> {
    return (await this.planoOuFalha(planoId)).doenteId;
  }

  async doenteIdDoCiclo(cicloId: string): Promise<string> {
    const c = await this.prisma.cicloQuimioterapia.findUnique({
      where: { id: cicloId },
      select: { plano: { select: { doenteId: true } } },
    });
    if (!c) throw new NotFoundException('Ciclo não encontrado.');
    return c.plano.doenteId;
  }
}
