import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RhService } from './rh.service';
import { CriarAusenciaDto } from './dto/criar-ausencia.dto';
import { RegistarFormacaoDto } from './dto/registar-formacao.dto';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { CriarContratoDto } from './dto/criar-contrato.dto';

const RH_ROLES = ['hr_specialist', 'hr_director', 'direcao', 'administrativo'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rh')
export class RhController {
  constructor(private readonly rh: RhService) {}

  @Get('dashboard')
  @Roles(...RH_ROLES)
  dashboard() {
    return this.rh.dashboard();
  }

  // ── Ausências ─────────────────────────────────────────────────────────────

  @Post('ausencias')
  criarAusencia(@Body() dto: CriarAusenciaDto, @Request() req: any) {
    return this.rh.criarAusencia(req.user.sub, dto);
  }

  @Get('ausencias')
  @Roles(...RH_ROLES)
  listarAusencias(
    @Query('utilizadorId') utilizadorId?: string,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.rh.listarAusencias({ utilizadorId, estado, tipo });
  }

  @Get('ausencias/minhas')
  minhasAusencias(@Request() req: any) {
    return this.rh.minhasAusencias(req.user.sub);
  }

  @Get('ausencias/para-aprovar')
  ausenciasParaAprovar(@Request() req: any) {
    return this.rh.ausenciasParaAprovar(req.user.sub);
  }

  @Patch('ausencias/:id/aprovar')
  aprovarAusencia(@Param('id') id: string, @Request() req: any) {
    return this.rh.aprovarAusencia(id, req.user.sub);
  }

  @Patch('ausencias/:id/rejeitar')
  rejeitarAusencia(@Param('id') id: string, @Request() req: any) {
    return this.rh.rejeitarAusencia(id, req.user.sub);
  }

  @Delete('ausencias/:id')
  cancelarAusencia(@Param('id') id: string, @Request() req: any) {
    return this.rh.cancelarAusencia(id, req.user.sub);
  }

  @Get('ausencias/:id/saldo-ferias')
  saldoFerias(@Param('id') id: string) {
    return this.rh.calcularSaldoFerias(id);
  }

  @Get('saldo-ferias')
  meuSaldoFerias(@Request() req: any) {
    return this.rh.calcularSaldoFerias(req.user.sub);
  }

  // ── Formações ─────────────────────────────────────────────────────────────

  @Post('formacoes')
  @Roles(...RH_ROLES)
  registarFormacao(@Body() dto: RegistarFormacaoDto) {
    return this.rh.registarFormacao(dto);
  }

  @Get('formacoes')
  @Roles(...RH_ROLES)
  listarFormacoes(
    @Query('utilizadorId') utilizadorId?: string,
    @Query('obrigatoria') obrigatoria?: string,
  ) {
    return this.rh.listarFormacoes({
      utilizadorId,
      obrigatoria: obrigatoria !== undefined ? obrigatoria === 'true' : undefined,
    });
  }

  @Get('formacoes/minhas')
  minhasFormacoes(@Request() req: any) {
    return this.rh.minhasFormacoes(req.user.sub);
  }

  @Delete('formacoes/:id')
  @Roles(...RH_ROLES)
  apagarFormacao(@Param('id') id: string) {
    return this.rh.apagarFormacao(id);
  }

  // ── Avaliações de Desempenho ───────────────────────────────────────────────

  @Get('avaliacoes')
  @Roles(...RH_ROLES)
  listarAvaliacoes(
    @Query('utilizadorId') utilizadorId?: string,
    @Query('periodo') periodo?: string,
    @Query('estado') estado?: string,
  ) {
    return this.rh.listarAvaliacoes({ utilizadorId, periodo, estado });
  }

  @Post('avaliacoes')
  @Roles(...RH_ROLES)
  criarAvaliacao(@Body() dto: CriarAvaliacaoDto, @Request() req: any) {
    return this.rh.criarAvaliacao(req.user.sub, dto);
  }

  @Patch('avaliacoes/:id')
  @Roles(...RH_ROLES)
  atualizarAvaliacao(@Param('id') id: string, @Body() dto: AtualizarAvaliacaoDto) {
    return this.rh.atualizarAvaliacao(id, dto);
  }

  // ── Pessoal + Contratos ────────────────────────────────────────────────────

  @Get('pessoal')
  @Roles(...RH_ROLES)
  listarPessoal() {
    return this.rh.listarPessoal();
  }

  @Post('pessoal/:id/contrato')
  @Roles(...RH_ROLES)
  criarContrato(@Param('id') id: string, @Body() dto: CriarContratoDto) {
    return this.rh.criarOuAtualizarContrato(id, dto);
  }

  // ── Trocas de Folga ───────────────────────────────────────────────────────

  @Post('trocas-folga')
  criarTrocaFolga(@Body() body: any, @Request() req: any) {
    return this.rh.criarTrocaFolga(req.user.sub, body);
  }

  @Get('trocas-folga/minhas')
  minhasTrocasFolga(@Request() req: any) {
    return this.rh.minhasTrocasFolga(req.user.sub);
  }

  @Get('trocas-folga/para-aprovar')
  trocasFolgaParaAprovar(@Request() req: any) {
    return this.rh.trocasFolgaParaAprovar(req.user.sub);
  }

  @Patch('trocas-folga/:id/aceitar')
  aceitarTrocaFolga(@Param('id') id: string, @Request() req: any) {
    return this.rh.aceitarTrocaFolga(id, req.user.sub);
  }

  @Patch('trocas-folga/:id/recusar')
  recusarTrocaFolga(@Param('id') id: string, @Request() req: any) {
    return this.rh.recusarTrocaFolga(id, req.user.sub);
  }

  @Patch('trocas-folga/:id/aprovar')
  aprovarTrocaFolga(@Param('id') id: string, @Request() req: any) {
    return this.rh.aprovarTrocaFolga(id, req.user.sub);
  }

  @Patch('trocas-folga/:id/cancelar')
  cancelarTrocaFolga(@Param('id') id: string, @Request() req: any) {
    return this.rh.cancelarTrocaFolga(id, req.user.sub);
  }
}
