import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async internamento(inicio: Date, fim: Date) {
    const doentes = await this.prisma.doente.findMany({
      where: {
        dataAdmissao: { gte: inicio, lte: fim },
        dataAlta: { not: null },
      },
      select: {
        id: true,
        nome: true,
        dataAdmissao: true,
        dataAlta: true,
        diagnosticoPrincipal: true,
        cama: { select: { servico: true } },
      },
    });

    const porServico: Record<string, { total: number; somaHoras: number }> = {};
    for (const d of doentes) {
      const servico = d.cama?.servico ?? 'sem_servico';
      const horas = d.dataAlta
        ? (d.dataAlta.getTime() - d.dataAdmissao.getTime()) / (1000 * 60 * 60)
        : 0;
      if (!porServico[servico]) porServico[servico] = { total: 0, somaHoras: 0 };
      porServico[servico].total++;
      porServico[servico].somaHoras += horas;
    }

    const resumo = Object.entries(porServico).map(([servico, { total, somaHoras }]) => ({
      servico,
      totalInternamentos: total,
      demoraMediaDias: parseFloat((somaHoras / 24 / total).toFixed(1)),
    }));

    return {
      periodo: { inicio, fim },
      totalInternamentos: doentes.length,
      resumoPorServico: resumo,
    };
  }

  async ocupacao(inicio: Date, fim: Date) {
    const totalCamas = await this.prisma.cama.count();
    const diasPeriodo = Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));

    const ocupadas = await this.prisma.doente.count({
      where: {
        dataAdmissao: { lte: fim },
        OR: [{ dataAlta: null }, { dataAlta: { gte: inicio } }],
        ativo: true,
      },
    });

    const estadoAtual = await this.prisma.cama.groupBy({
      by: ['estado'],
      _count: { estado: true },
    });

    return {
      periodo: { inicio, fim },
      totalCamas,
      diasPeriodo,
      internamentosAtivos: ocupadas,
      taxaOcupacaoAtual: totalCamas > 0 ? parseFloat(((ocupadas / totalCamas) * 100).toFixed(1)) : 0,
      estadoAtualCamas: estadoAtual.map((e) => ({ estado: e.estado, count: e._count.estado })),
    };
  }

  async diagnosticos(inicio: Date, fim: Date) {
    const doentes = await this.prisma.doente.findMany({
      where: {
        dataAdmissao: { gte: inicio, lte: fim },
        diagnosticoPrincipal: { not: null },
      },
      select: { diagnosticoPrincipal: true },
    });

    const contagem: Record<string, number> = {};
    for (const d of doentes) {
      const diag = d.diagnosticoPrincipal ?? 'Não especificado';
      contagem[diag] = (contagem[diag] ?? 0) + 1;
    }

    const top20 = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([diagnostico, total]) => ({ diagnostico, total }));

    return { periodo: { inicio, fim }, totalDoentes: doentes.length, top20 };
  }

  async medicamentos(inicio: Date, fim: Date) {
    const registos = await this.prisma.registoMedicacao.findMany({
      where: {
        administradoEm: { gte: inicio, lte: fim },
        naoAdministrada: false,
      },
      include: { medicacao: { select: { nome: true } } },
    });

    const contagem: Record<string, number> = {};
    for (const r of registos) {
      const nome = r.medicacao.nome;
      contagem[nome] = (contagem[nome] ?? 0) + 1;
    }

    const top20 = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([medicamento, administracoes]) => ({ medicamento, administracoes }));

    return { periodo: { inicio, fim }, totalAdministracoes: registos.length, top20 };
  }

  async urgencia(inicio: Date, fim: Date) {
    const episodios = await this.prisma.episodioUrgencia.findMany({
      where: { criadoEm: { gte: inicio, lte: fim } },
      select: {
        id: true,
        motivoEntrada: true,
        triagem: true,
        criadoEm: true,
        estado: true,
      },
    });

    const porTriagem: Record<string, number> = {};
    for (const e of episodios) {
      const t = e.triagem ?? 'sem_triagem';
      porTriagem[t] = (porTriagem[t] ?? 0) + 1;
    }

    return {
      periodo: { inicio, fim },
      totalEpisodios: episodios.length,
      distribuicaoPorTriagem: Object.entries(porTriagem).map(([triagem, total]) => ({ triagem, total })),
    };
  }

  toCSV(data: Record<string, any>[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }
}
