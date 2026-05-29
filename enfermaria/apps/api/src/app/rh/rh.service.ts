import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RhService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ausências ─────────────────────────────────────────────────────────────

  async criarAusencia(utilizadorId: string, dto: {
    tipo: string; dataInicio: string; dataFim: string; observacoes?: string;
  }) {
    const ausencia = await this.prisma.ausencia.create({
      data: {
        utilizadorId,
        tipo: dto.tipo,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        observacoes: dto.observacoes ?? null,
      },
      include: { utilizador: { select: { id: true, nome: true, role: true, servico: true } } },
    });

    return ausencia;
  }

  async listarAusencias(filtros: { utilizadorId?: string; estado?: string; tipo?: string }) {
    return this.prisma.ausencia.findMany({
      where: {
        ...(filtros.utilizadorId ? { utilizadorId: filtros.utilizadorId } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      },
      include: {
        utilizador: { select: { id: true, nome: true, role: true, servico: true } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async minhasAusencias(utilizadorId: string) {
    return this.prisma.ausencia.findMany({
      where: { utilizadorId },
      include: { aprovadoPor: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async ausenciasParaAprovar(chefeId: string) {
    const subordinados = await this.prisma.utilizador.findMany({
      where: { chefeId },
      select: { id: true },
    });
    const ids = subordinados.map(s => s.id);
    return this.prisma.ausencia.findMany({
      where: { utilizadorId: { in: ids }, estado: 'pendente' },
      include: {
        utilizador: { select: { id: true, nome: true, role: true, servico: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async aprovarAusencia(id: string, aprovadoPorId: string) {
    await this.buscarAusencia(id);
    return this.prisma.ausencia.update({
      where: { id },
      data: { estado: 'aprovada', aprovadoPorId },
      include: { utilizador: { select: { id: true, nome: true } } },
    });
  }

  async rejeitarAusencia(id: string, aprovadoPorId: string) {
    await this.buscarAusencia(id);
    return this.prisma.ausencia.update({
      where: { id },
      data: { estado: 'rejeitada', aprovadoPorId },
      include: { utilizador: { select: { id: true, nome: true } } },
    });
  }

  async cancelarAusencia(id: string, utilizadorId: string) {
    const ausencia = await this.buscarAusencia(id);
    if (ausencia.utilizadorId !== utilizadorId) throw new ForbiddenException('Sem permissão');
    if (ausencia.estado !== 'pendente') throw new ForbiddenException('Só é possível cancelar ausências pendentes');
    return this.prisma.ausencia.delete({ where: { id } });
  }

  async calcularSaldoFerias(utilizadorId: string) {
    const anoAtual = new Date().getFullYear();
    const inicio = new Date(`${anoAtual}-01-01`);
    const fim    = new Date(`${anoAtual}-12-31`);

    const [contrato, ausenciasAprovadas] = await Promise.all([
      this.prisma.dadosContratuais.findUnique({ where: { utilizadorId } }),
      this.prisma.ausencia.findMany({
        where: { utilizadorId, tipo: 'ferias', estado: 'aprovada', dataInicio: { gte: inicio }, dataFim: { lte: fim } },
      }),
    ]);

    const direitoAnual = contrato?.diasFeriasAnuais ?? 22;
    const diasUsados = ausenciasAprovadas.reduce((acc, a) => {
      const diff = Math.ceil((new Date(a.dataFim).getTime() - new Date(a.dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return acc + diff;
    }, 0);

    return { direitoAnual, diasUsados, diasRestantes: direitoAnual - diasUsados, anoAtual };
  }

  // ── Formações ─────────────────────────────────────────────────────────────

  async registarFormacao(dto: {
    utilizadorId: string; nome: string; dataRealizacao: string;
    dataExpiracao?: string; entidade?: string; obrigatoria?: boolean;
  }) {
    return this.prisma.formacaoUtilizador.create({
      data: {
        utilizadorId: dto.utilizadorId,
        nome: dto.nome,
        dataRealizacao: new Date(dto.dataRealizacao),
        dataExpiracao: dto.dataExpiracao ? new Date(dto.dataExpiracao) : null,
        entidade: dto.entidade ?? null,
        obrigatoria: dto.obrigatoria ?? false,
      },
      include: { utilizador: { select: { id: true, nome: true, role: true } } },
    });
  }

  async listarFormacoes(filtros: { utilizadorId?: string; obrigatoria?: boolean }) {
    return this.prisma.formacaoUtilizador.findMany({
      where: {
        ...(filtros.utilizadorId ? { utilizadorId: filtros.utilizadorId } : {}),
        ...(filtros.obrigatoria !== undefined ? { obrigatoria: filtros.obrigatoria } : {}),
      },
      include: { utilizador: { select: { id: true, nome: true, role: true, servico: true } } },
      orderBy: { dataRealizacao: 'desc' },
    });
  }

  async minhasFormacoes(utilizadorId: string) {
    return this.prisma.formacaoUtilizador.findMany({
      where: { utilizadorId },
      orderBy: { dataRealizacao: 'desc' },
    });
  }

  async apagarFormacao(id: string) {
    const f = await this.prisma.formacaoUtilizador.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`Formação (ID ${id}) não encontrada`);
    return this.prisma.formacaoUtilizador.delete({ where: { id } });
  }

  // ── Avaliações de Desempenho ───────────────────────────────────────────────

  async listarAvaliacoes(filtros: { utilizadorId?: string; periodo?: string; estado?: string }) {
    return this.prisma.avaliacaoDesempenho.findMany({
      where: {
        ...(filtros.utilizadorId ? { utilizadorId: filtros.utilizadorId } : {}),
        ...(filtros.periodo ? { periodo: filtros.periodo } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
      },
      include: {
        utilizador: { select: { id: true, nome: true, role: true, servico: true } },
        avaliador:  { select: { id: true, nome: true } },
      },
      orderBy: { dataAvaliacao: 'desc' },
    });
  }

  async criarAvaliacao(avaliadorId: string, dto: {
    utilizadorId: string; periodo: string; dataAvaliacao: string;
    pontuacaoGeral: number; pontosFortes?: string; areasMelhoria?: string; observacoes?: string;
  }) {
    return this.prisma.avaliacaoDesempenho.create({
      data: {
        utilizadorId: dto.utilizadorId,
        avaliadorId,
        periodo: dto.periodo,
        dataAvaliacao: new Date(dto.dataAvaliacao),
        pontuacaoGeral: dto.pontuacaoGeral,
        pontosFortes: dto.pontosFortes ?? null,
        areasMelhoria: dto.areasMelhoria ?? null,
        observacoes: dto.observacoes ?? null,
        estado: 'rascunho',
      },
      include: {
        utilizador: { select: { id: true, nome: true } },
        avaliador:  { select: { id: true, nome: true } },
      },
    });
  }

  async atualizarAvaliacao(id: string, dto: {
    pontuacaoGeral?: number; pontosFortes?: string; areasMelhoria?: string;
    observacoes?: string; estado?: string;
  }) {
    const aval = await this.prisma.avaliacaoDesempenho.findUnique({ where: { id } });
    if (!aval) throw new NotFoundException(`Avaliação de desempenho (ID ${id}) não encontrada`);
    return this.prisma.avaliacaoDesempenho.update({
      where: { id },
      data: { ...dto },
      include: {
        utilizador: { select: { id: true, nome: true } },
        avaliador:  { select: { id: true, nome: true } },
      },
    });
  }

  // ── Pessoal + Contratos ────────────────────────────────────────────────────

  async listarPessoal() {
    const utilizadores = await this.prisma.utilizador.findMany({
      where: { ativo: true },
      select: {
        id: true, nome: true, role: true, subRole: true, servico: true,
        dadosContratuais: true,
        chefe: { select: { id: true, nome: true } },
      },
      orderBy: { nome: 'asc' },
    });

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const inicio = new Date(`${anoAtual}-01-01`);
    const fim    = new Date(`${anoAtual}-12-31`);

    const ausenciasFerias = await this.prisma.ausencia.findMany({
      where: { tipo: 'ferias', estado: 'aprovada', dataInicio: { gte: inicio }, dataFim: { lte: fim } },
      select: { utilizadorId: true, dataInicio: true, dataFim: true },
    });

    const diasPorUtilizador: Record<string, number> = {};
    for (const a of ausenciasFerias) {
      const diff = Math.ceil((new Date(a.dataFim).getTime() - new Date(a.dataInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      diasPorUtilizador[a.utilizadorId] = (diasPorUtilizador[a.utilizadorId] ?? 0) + diff;
    }

    return utilizadores.map(u => ({
      ...u,
      saldoFerias: {
        direitoAnual: u.dadosContratuais?.diasFeriasAnuais ?? 22,
        diasUsados: diasPorUtilizador[u.id] ?? 0,
      },
    }));
  }

  async criarOuAtualizarContrato(utilizadorId: string, dto: {
    tipoVinculo: string; dataInicio: string; dataFimPrevista?: string; diasFeriasAnuais?: number;
  }) {
    return this.prisma.dadosContratuais.upsert({
      where: { utilizadorId },
      create: {
        utilizadorId,
        tipoVinculo: dto.tipoVinculo,
        dataInicio: new Date(dto.dataInicio),
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : null,
        diasFeriasAnuais: dto.diasFeriasAnuais ?? 22,
      },
      update: {
        tipoVinculo: dto.tipoVinculo,
        dataInicio: new Date(dto.dataInicio),
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : null,
        diasFeriasAnuais: dto.diasFeriasAnuais ?? 22,
      },
    });
  }

  // ── Dashboard RH ──────────────────────────────────────────────────────────

  async dashboard() {
    const agora = new Date();
    const em60dias = new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000);
    const em30dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [ausenciasPendentes, ausenciasAtivas, formacoesAExpirar, staff, contratosAExpirar, avaliacoesPendentes] = await Promise.all([
      this.prisma.ausencia.count({ where: { estado: 'pendente' } }),
      this.prisma.ausencia.count({
        where: { estado: 'aprovada', dataInicio: { lte: agora }, dataFim: { gte: agora } },
      }),
      this.prisma.formacaoUtilizador.count({
        where: { obrigatoria: true, dataExpiracao: { gte: agora, lte: em30dias } },
      }),
      this.prisma.utilizador.count({ where: { ativo: true } }),
      this.prisma.dadosContratuais.count({
        where: { dataFimPrevista: { gte: agora, lte: em60dias } },
      }),
      this.prisma.avaliacaoDesempenho.count({ where: { estado: 'rascunho' } }),
    ]);

    return { ausenciasPendentes, ausenciasAtivas, formacoesAExpirar, totalStaff: staff, contratosAExpirar, avaliacoesPendentes };
  }

  private async buscarAusencia(id: string) {
    const a = await this.prisma.ausencia.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Ausência (ID ${id}) não encontrada`);
    return a;
  }

  // ── Trocas de Folga ───────────────────────────────────────────────────────

  private readonly TROCA_INCLUDE = {
    solicitante:  { select: { id: true, nome: true, role: true, servico: true } },
    destinatario: { select: { id: true, nome: true, role: true, servico: true } },
    aprovadoPor:  { select: { id: true, nome: true } },
  };

  async criarTrocaFolga(solicitanteId: string, dto: {
    destinatarioId: string;
    dataOrigem: string;
    dataDestino: string;
    motivo?: string;
  }) {
    return this.prisma.trocaFolga.create({
      data: {
        solicitanteId,
        destinatarioId: dto.destinatarioId,
        dataOrigem:  new Date(dto.dataOrigem),
        dataDestino: new Date(dto.dataDestino),
        motivo: dto.motivo ?? null,
      },
      include: this.TROCA_INCLUDE,
    });
  }

  async minhasTrocasFolga(utilizadorId: string) {
    return this.prisma.trocaFolga.findMany({
      where: {
        OR: [{ solicitanteId: utilizadorId }, { destinatarioId: utilizadorId }],
      },
      include: this.TROCA_INCLUDE,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async trocasFolgaParaAprovar(chefeId: string) {
    const subordinados = await this.prisma.utilizador.findMany({
      where: { chefeId },
      select: { id: true },
    });
    const ids = subordinados.map(s => s.id);
    return this.prisma.trocaFolga.findMany({
      where: {
        estado: 'aceite',
        OR: [{ solicitanteId: { in: ids } }, { destinatarioId: { in: ids } }],
      },
      include: this.TROCA_INCLUDE,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async aceitarTrocaFolga(id: string, utilizadorId: string) {
    const troca = await this.prisma.trocaFolga.findUnique({ where: { id } });
    if (!troca) throw new NotFoundException('Troca não encontrada');
    if (troca.destinatarioId !== utilizadorId) throw new ForbiddenException('Só o destinatário pode aceitar');
    if (troca.estado !== 'pendente') throw new ForbiddenException('Troca já respondida');
    return this.prisma.trocaFolga.update({
      where: { id },
      data: { estado: 'aceite' },
      include: this.TROCA_INCLUDE,
    });
  }

  async recusarTrocaFolga(id: string, utilizadorId: string) {
    const troca = await this.prisma.trocaFolga.findUnique({ where: { id } });
    if (!troca) throw new NotFoundException('Troca não encontrada');
    if (troca.destinatarioId !== utilizadorId) throw new ForbiddenException('Só o destinatário pode recusar');
    if (troca.estado !== 'pendente') throw new ForbiddenException('Troca já respondida');
    return this.prisma.trocaFolga.update({
      where: { id },
      data: { estado: 'recusado' },
      include: this.TROCA_INCLUDE,
    });
  }

  async aprovarTrocaFolga(id: string, aprovadoPorId: string) {
    const troca = await this.prisma.trocaFolga.findUnique({ where: { id } });
    if (!troca) throw new NotFoundException('Troca não encontrada');
    if (troca.estado !== 'aceite') throw new ForbiddenException('A troca ainda não foi aceite pelas duas partes');
    return this.prisma.trocaFolga.update({
      where: { id },
      data: { estado: 'aprovado', aprovadoPorId },
      include: this.TROCA_INCLUDE,
    });
  }

  async cancelarTrocaFolga(id: string, utilizadorId: string) {
    const troca = await this.prisma.trocaFolga.findUnique({ where: { id } });
    if (!troca) throw new NotFoundException('Troca não encontrada');
    if (troca.solicitanteId !== utilizadorId) throw new ForbiddenException('Só o solicitante pode cancelar');
    if (!['pendente', 'aceite'].includes(troca.estado)) throw new ForbiddenException('Troca não pode ser cancelada');
    return this.prisma.trocaFolga.update({
      where: { id },
      data: { estado: 'cancelado' },
      include: this.TROCA_INCLUDE,
    });
  }
}
