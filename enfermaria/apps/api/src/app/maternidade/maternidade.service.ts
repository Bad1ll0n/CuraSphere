import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { calcularDPP, semanasGestacao, fcFetalAnormal } from '../common/obstetricia.helper';
import { CriarGravidezDto } from './dto/criar-gravidez.dto';
import { RegistoPartogramaDto } from './dto/registo-partograma.dto';
import { RegistarPartoDto } from './dto/registar-parto.dto';

@Injectable()
export class MaternidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  /** Cria um registo de gravidez. Se a DPP não vier mas a DUM sim, calcula-a (Naegele). */
  async criarGravidez(doenteId: string, dto: CriarGravidezDto, criadoPorId: string) {
    const dum = dto.dataUltimaMenstruacao ? new Date(dto.dataUltimaMenstruacao) : null;
    const dpp = dto.dataPrevistaParto ? new Date(dto.dataPrevistaParto) : dum ? calcularDPP(dum) : null;
    return this.prisma.gravidez.create({
      data: {
        doenteId,
        dataUltimaMenstruacao: dum,
        dataPrevistaParto: dpp,
        gravida: dto.gravida ?? null,
        para: dto.para ?? null,
        grupoSanguineo: dto.grupoSanguineo ?? null,
        fatoresRisco: dto.fatoresRisco ?? null,
        criadoPorId,
      },
    });
  }

  /** Gravidez ativa do doente + idade gestacional calculada + parto (se já registado). */
  async gravidezAtiva(doenteId: string) {
    const g = await this.prisma.gravidez.findFirst({
      where: { doenteId, estado: 'ativa' },
      orderBy: { criadoEm: 'desc' },
      include: { parto: true },
    });
    if (!g) return null;
    const idadeGestacional = g.dataUltimaMenstruacao ? semanasGestacao(g.dataUltimaMenstruacao) : null;
    return { ...g, idadeGestacional };
  }

  private async gravidezOuFalha(gravidezId: string) {
    const g = await this.prisma.gravidez.findUnique({
      where: { id: gravidezId },
      select: { id: true, doenteId: true },
    });
    if (!g) throw new NotFoundException('Gravidez não encontrada.');
    return g;
  }

  /** Adiciona um ponto ao partograma. FC fetal fora de 110–160 bpm gera alerta clínico. */
  async adicionarPartograma(gravidezId: string, dto: RegistoPartogramaDto, registadoPorId: string) {
    const g = await this.gravidezOuFalha(gravidezId);
    const registo = await this.prisma.registoPartograma.create({
      data: {
        gravidezId,
        dilatacaoCm: dto.dilatacaoCm ?? null,
        fcFetal: dto.fcFetal ?? null,
        contracoes10min: dto.contracoes10min ?? null,
        descidaApresentacao: dto.descidaApresentacao ?? null,
        notas: dto.notas ?? null,
        registadoPorId,
      },
    });
    if (dto.fcFetal != null) {
      const anomalia = fcFetalAnormal(dto.fcFetal);
      if (anomalia) {
        await this.alertas.criarAlerta(
          g.doenteId,
          'partograma',
          `FC fetal ${dto.fcFetal} bpm — ${anomalia}. Avaliar bem-estar fetal.`,
        );
      }
    }
    return registo;
  }

  /** Registos do partograma por ordem cronológica (para o gráfico). */
  async listarPartograma(gravidezId: string) {
    return this.prisma.registoPartograma.findMany({
      where: { gravidezId },
      orderBy: { momento: 'asc' },
    });
  }

  /** Regista/atualiza o parto e conclui a gravidez. */
  async registarParto(gravidezId: string, dto: RegistarPartoDto, registadoPorId: string) {
    await this.gravidezOuFalha(gravidezId);
    const dados = {
      tipo: dto.tipo,
      dataHora: dto.dataHora ? new Date(dto.dataHora) : new Date(),
      complicacoes: dto.complicacoes ?? null,
      apgar1: dto.apgar1 ?? null,
      apgar5: dto.apgar5 ?? null,
      pesoRN: dto.pesoRN ?? null,
      sexoRN: dto.sexoRN ?? null,
    };
    const parto = await this.prisma.parto.upsert({
      where: { gravidezId },
      create: { gravidezId, registadoPorId, ...dados },
      update: dados,
    });
    await this.prisma.gravidez.update({ where: { id: gravidezId }, data: { estado: 'concluida' } });
    return parto;
  }

  /** doenteId de uma gravidez — usado pelo guard de acesso no controller. */
  async doenteIdDaGravidez(gravidezId: string): Promise<string> {
    const g = await this.gravidezOuFalha(gravidezId);
    return g.doenteId;
  }
}
