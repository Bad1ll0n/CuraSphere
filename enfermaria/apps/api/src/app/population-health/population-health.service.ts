import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PopulationHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async criarCoorte(criadoPorId: string, dto: { nome: string; filtros: Record<string, any> }) {
    return this.prisma.cohortDefinition.create({
      data: {
        nome: dto.nome,
        filtros: dto.filtros,
        criadoPorId,
      },
      include: { criadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listarCoortes() {
    return this.prisma.cohortDefinition.findMany({
      include: { criadoPor: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async apagarCoorte(id: string) {
    const c = await this.prisma.cohortDefinition.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Coorte (ID ${id}) não encontrada`);
    return this.prisma.cohortDefinition.delete({ where: { id } });
  }

  async analisarCoorte(id: string) {
    const coorte = await this.prisma.cohortDefinition.findUnique({ where: { id } });
    if (!coorte) throw new NotFoundException(`Coorte (ID ${id}) não encontrada`);

    const filtros = (coorte.filtros ?? {}) as Record<string, any>;

    // Build dynamic where clause
    const where: Record<string, any> = {};

    if (filtros['diagnostico']) {
      where['diagnosticoPrincipal'] = { contains: filtros['diagnostico'], mode: 'insensitive' };
    }

    if (filtros['icd10Code']) {
      where['icd10Code'] = { contains: filtros['icd10Code'], mode: 'insensitive' };
    }

    // Age filter — computed from dataNascimento
    const agora = new Date();
    if (filtros['idadeMin'] != null || filtros['idadeMax'] != null) {
      const dateFilter: Record<string, Date> = {};
      if (filtros['idadeMax'] != null) {
        const minBirth = new Date(agora);
        minBirth.setFullYear(minBirth.getFullYear() - Number(filtros['idadeMax']) - 1);
        dateFilter['gte'] = minBirth;
      }
      if (filtros['idadeMin'] != null) {
        const maxBirth = new Date(agora);
        maxBirth.setFullYear(maxBirth.getFullYear() - Number(filtros['idadeMin']));
        dateFilter['lte'] = maxBirth;
      }
      where['dataNascimento'] = dateFilter;
    }

    const doentes = await this.prisma.doente.findMany({
      where,
      select: {
        id: true,
        dataNascimento: true,
        estado: true,
        dataAdmissao: true,
        dataAlta: true,
        sinaisVitais: {
          orderBy: { data: 'desc' },
          take: 1,
          select: { news2: true },
        },
        sumarioAlta: {
          select: { riscReadmissao: true },
        },
      },
    });

    const total = doentes.length;
    if (total === 0) {
      return {
        total: 0,
        mediaIdade: null,
        mediaDiasInternamento: null,
        estadoDistribuicao: {},
        mediaNews2: null,
        taxaReadmissao30d: null,
      };
    }

    // mediaIdade
    const idades = doentes
      .filter(d => d.dataNascimento != null)
      .map(d => {
        const nasc = new Date(d.dataNascimento as Date);
        let age = agora.getFullYear() - nasc.getFullYear();
        const m = agora.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && agora.getDate() < nasc.getDate())) age--;
        return age;
      });
    const mediaIdade = idades.length > 0 ? idades.reduce((a, b) => a + b, 0) / idades.length : null;

    // mediaDiasInternamento — using dataAdmissao and dataAlta on the Doente itself
    const diasInternamento = doentes.map(d => {
      const saida = d.dataAlta ? new Date(d.dataAlta) : agora;
      const entrada = new Date(d.dataAdmissao);
      return Math.max(0, Math.floor((saida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24)));
    });
    const mediaDiasInternamento =
      diasInternamento.length > 0
        ? diasInternamento.reduce((a, b) => a + b, 0) / diasInternamento.length
        : null;

    // estadoDistribuicao — group by doente.estado
    const estadoDistribuicao: Record<string, number> = {};
    for (const d of doentes) {
      const estado = d.estado ?? 'desconhecido';
      estadoDistribuicao[estado] = (estadoDistribuicao[estado] ?? 0) + 1;
    }

    // mediaNews2 — last sinalVital.news2 per patient
    const news2Values = doentes
      .filter(d => d.sinaisVitais.length > 0 && d.sinaisVitais[0].news2 != null)
      .map(d => d.sinaisVitais[0].news2 as number);
    const mediaNews2 =
      news2Values.length > 0
        ? news2Values.reduce((a, b) => a + b, 0) / news2Values.length
        : null;

    // taxaReadmissao30d — patients with sumarioAlta.riscReadmissao = 'alto'
    const comRiscoAlto = doentes.filter(
      d => (d.sumarioAlta as any)?.riscReadmissao === 'alto',
    ).length;
    const taxaReadmissao30d = total > 0 ? (comRiscoAlto / total) * 100 : null;

    return {
      total,
      mediaIdade: mediaIdade != null ? Math.round(mediaIdade * 10) / 10 : null,
      mediaDiasInternamento: mediaDiasInternamento != null ? Math.round(mediaDiasInternamento * 10) / 10 : null,
      estadoDistribuicao,
      mediaNews2: mediaNews2 != null ? Math.round(mediaNews2 * 10) / 10 : null,
      taxaReadmissao30d: taxaReadmissao30d != null ? Math.round(taxaReadmissao30d * 10) / 10 : null,
    };
  }
}
