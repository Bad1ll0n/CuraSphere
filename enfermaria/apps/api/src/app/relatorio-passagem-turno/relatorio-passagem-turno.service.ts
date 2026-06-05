import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, MaxLength, IsEnum, IsOptional } from 'class-validator';

export class GerarRelatorioDto {
  @IsEnum(['manha', 'tarde', 'noite'])
  turno: 'manha' | 'tarde' | 'noite';

  @IsString()
  @MaxLength(100)
  servico: string;
}

export class ConfirmarRelatorioDto {
  @IsString()
  @MaxLength(20000)
  conteudo: string;
}

@Injectable()
export class RelatorioPassagemTurnoService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarRascunho(dto: GerarRelatorioDto, criadaPorId: string) {
    const doentes = await this.prisma.doente.findMany({
      where: { servico: dto.servico as any, ativo: true },
      select: {
        id: true, nome: true, dataAdmissao: true, diagnosticoPrincipal: true,
        cama: { select: { numero: true } },
        sinaisVitais: {
          orderBy: { data: 'desc' },
          take: 1,
          select: { news2: true, data: true, pulso: true, pressaoSistolica: true, saturacaoO2: true, temperatura: true },
        },
        sinalizacoes: {
          where: { resolvida: false },
          select: { motivo: true, nivelUrgencia: true, criadaEm: true },
          orderBy: { criadaEm: 'desc' },
          take: 1,
        },
        alertasSepsis: {
          where: { resolvido: false },
          select: { criterio: true, score: true, criadoEm: true },
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
        alertasClinicos: {
          where: { lido: false },
          select: { mensagem: true, urgencia: true },
          orderBy: { criadoEm: 'desc' },
          take: 3,
        },
        tarefas: {
          where: { estado: { not: 'concluida' } },
          select: { descricao: true, prioridade: true },
          orderBy: { prioridade: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ cama: { numero: 'asc' } }],
    });

    // Ordenar por criticidade: sépsis > sinalizado urgente > news2 alto > normal
    const ordenados = doentes.sort((a, b) => {
      const scoreA = (a.alertasSepsis.length > 0 ? 100 : 0)
        + (a.sinalizacoes.some(s => s.nivelUrgencia === 'urgente') ? 50 : 0)
        + (a.sinalizacoes.length > 0 ? 20 : 0)
        + ((a.sinaisVitais[0]?.news2 ?? 0));
      const scoreB = (b.alertasSepsis.length > 0 ? 100 : 0)
        + (b.sinalizacoes.some(s => s.nivelUrgencia === 'urgente') ? 50 : 0)
        + (b.sinalizacoes.length > 0 ? 20 : 0)
        + ((b.sinaisVitais[0]?.news2 ?? 0));
      return scoreB - scoreA;
    });

    const fmt = (d: Date | string | null) => d ? new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—';
    const turnoLabel = { manha: 'Manhã (08h-16h)', tarde: 'Tarde (16h-00h)', noite: 'Noite (00h-08h)' }[dto.turno];

    const linhas: string[] = [
      `=== PASSAGEM DE TURNO — ${turnoLabel} ===`,
      `Serviço: ${dto.servico} | ${new Date().toLocaleDateString('pt-PT')}`,
      `Total de doentes activos: ${doentes.length}`,
      '',
    ];

    for (const d of ordenados) {
      const sv = d.sinaisVitais[0];
      const sepsis = d.alertasSepsis[0];
      const sinal = d.sinalizacoes[0];
      const prefixo = sepsis ? '🔴 SÉPSIS' : sinal?.nivelUrgencia === 'urgente' ? '🟠 URGENTE' : sinal ? '🟡 PREOCUPANTE' : '🟢';

      linhas.push(`${prefixo} Cama ${d.cama?.numero ?? '?'} — ${d.nome}`);
      linhas.push(`   Diagnóstico: ${d.diagnosticoPrincipal ?? '—'}`);
      if (sv) {
        linhas.push(`   SV (${fmt(sv.data)}): TA ${sv.pressaoSistolica ?? '?'}/${sv.pressaoSistolica ?? '?'} FC ${sv.pulso ?? '?'} SpO₂ ${sv.saturacaoO2 ?? '?'}% Temp ${sv.temperatura ?? '?'}°C NEWS2 ${sv.news2 ?? '?'}`);
      }
      if (sepsis) linhas.push(`   ⚠ ALERTA SÉPSIS (${sepsis.criterio.toUpperCase()} score ${sepsis.score}) desde ${fmt(sepsis.criadoEm)}`);
      if (sinal) linhas.push(`   ⚠ Sinalizado: ${sinal.motivo}`);
      for (const a of d.alertasClinicos) {
        linhas.push(`   ${a.urgencia ? '🚨' : '•'} ${a.mensagem}`);
      }
      for (const t of d.tarefas) {
        linhas.push(`   [ ] ${t.prioridade === 'urgente' ? '[URGENTE] ' : ''}${t.descricao}`);
      }
      linhas.push('');
    }

    const rascunho = linhas.join('\n');

    return this.prisma.relatorioPassagemTurno.create({
      data: {
        turno: dto.turno,
        servico: dto.servico,
        criadaPorId,
        rascunho,
        conteudo: rascunho,
      },
      include: { criadaPor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async confirmar(id: string, dto: ConfirmarRelatorioDto, confirmadaPorId: string) {
    const rel = await this.prisma.relatorioPassagemTurno.findUnique({ where: { id } });
    if (!rel) throw new NotFoundException('Relatório não encontrado');
    return this.prisma.relatorioPassagemTurno.update({
      where: { id },
      data: { conteudo: dto.conteudo, confirmadaEm: new Date(), confirmadaPorId },
    });
  }

  historico(servico: string) {
    return this.prisma.relatorioPassagemTurno.findMany({
      where: { servico },
      orderBy: { criadaEm: 'desc' },
      take: 30,
      include: {
        criadaPor: { select: { id: true, nome: true, role: true } },
        confirmadaPor: { select: { id: true, nome: true } },
      },
    });
  }
}
