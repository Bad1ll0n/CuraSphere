import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistarBalancoDto } from './dto/registar-balanco.dto';
import {
  chaveDiaClinico, inicioDoDiaClinico, inicioDoDiaClinicoHaDias, somarDiasClinicos,
} from '../common/dia-clinico.helper';

const ROLES_PODEM_REGISTAR = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros'];

@Injectable()
export class BalancoHidricoService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async registar(doenteId: string, dto: RegistarBalancoDto, userId: string, role: string) {
    if (!ROLES_PODEM_REGISTAR.includes(role)) {
      throw new ForbiddenException('Sem permissão para registar balanço hídrico');
    }
    await this.assertDoente(doenteId);

    return this.prisma.balancoHidrico.create({
      data: {
        doenteId,
        registadoPorId: userId,
        tipo: dto.tipo,
        categoria: dto.categoria,
        quantidade: dto.quantidade,
        descricao: dto.descricao,
        data: dto.data ? new Date(dto.data) : undefined,
      },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listar(doenteId: string, data?: string) {
    await this.assertDoente(doenteId);
    // BE-03: as fronteiras do dia são as do hospital, não as do relógio do servidor.
    const dia = data ? new Date(`${data}T12:00:00Z`) : new Date();
    const inicio = inicioDoDiaClinico(dia);
    const fim = new Date(somarDiasClinicos(inicio, 1).getTime() - 1);

    const registos = await this.prisma.balancoHidrico.findMany({
      where: { doenteId, data: { gte: inicio, lte: fim } },
      orderBy: { data: 'asc' },
      include: { registadoPor: { select: { id: true, nome: true } } },
    });

    const resumo = this.calcularResumo(registos);
    return { registos, resumo, data: chaveDiaClinico(inicio) };
  }

  async historico(doenteId: string, dias = 7) {
    await this.assertDoente(doenteId);
    const diasSeguro = Math.min(Math.max(dias, 1), 30);
    const inicio = inicioDoDiaClinicoHaDias(diasSeguro - 1);

    const registos = await this.prisma.balancoHidrico.findMany({
      where: { doenteId, data: { gte: inicio } },
      orderBy: { data: 'asc' },
    });

    // Agrupar por dia
    const porDia: Record<string, { entradas: number; saidas: number; balanco: number }> = {};
    for (let i = 0; i < diasSeguro; i++) {
      const chave = chaveDiaClinico(somarDiasClinicos(inicio, i));
      porDia[chave] = { entradas: 0, saidas: 0, balanco: 0 };
    }

    for (const r of registos) {
      const chave = chaveDiaClinico(r.data);
      if (!porDia[chave]) porDia[chave] = { entradas: 0, saidas: 0, balanco: 0 };
      if (r.tipo === 'entrada') porDia[chave].entradas += r.quantidade;
      else porDia[chave].saidas += r.quantidade;
      porDia[chave].balanco = porDia[chave].entradas - porDia[chave].saidas;
    }

    return Object.entries(porDia).map(([data, v]) => ({ data, ...v }));
  }

  async apagar(id: string, userId: string, role: string) {
    const registo = await this.prisma.balancoHidrico.findUnique({ where: { id } });
    if (!registo) throw new NotFoundException('Registo não encontrado');
    if (registo.registadoPorId !== userId && !['medico', 'chefe_enfermeiros', 'chefe_turno'].includes(role)) {
      throw new ForbiddenException('Só pode apagar os seus próprios registos');
    }
    return this.prisma.balancoHidrico.delete({ where: { id } });
  }

  private calcularResumo(registos: { tipo: string; categoria: string; quantidade: number }[]) {
    const porCategoria: Record<string, number> = {};
    let entradas = 0;
    let saidas = 0;

    for (const r of registos) {
      if (r.tipo === 'entrada') entradas += r.quantidade;
      else saidas += r.quantidade;
      porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + r.quantidade;
    }

    return { entradas, saidas, balanco: entradas - saidas, porCategoria };
  }

  private async assertDoente(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException(`Doente não encontrado`);
  }
}
