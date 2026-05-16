import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DoenteService } from './doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EstadoDoente } from '../common/enums';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doentes')
export class DoenteController {
  constructor(
    private readonly doenteService: DoenteService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  listar(
    @Request() req: any,
    @Query('todos') todos?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const ignorarFiltro = todos === 'true';
    return this.doenteService.listar(
      req.user.sub,
      ignorarFiltro ? 'todos' : req.user.role,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.doenteService.buscarPorId(id);
  }

  @Get(':id/historico')
  historico(@Param('id') id: string) {
    return this.doenteService.historico(id);
  }

  @Roles('administrativo')
  @Get('registos-administrativos')
  listarRegistosAdministrativos(@Query('search') search?: string) {
    return this.doenteService.listarRegistosAdministrativos(search);
  }

  @Roles('administrativo')
  @Post('registro-rapido')
  registroRapido(
    @Body() body: {
      nome: string;
      tipoVisita?: string;
      dataNascimento?: string;
      nif?: string;
      numeroSNS?: string;
      telefone?: string;
      email?: string;
      tipoCobertura?: string;
      morada?: string;
      codigoPostal?: string;
      localidade?: string;
      entidadeSeguradora?: string;
      numeroApolice?: string;
    },
    @Request() req: any,
  ) {
    return this.doenteService.registroRapido(body, req.user.sub);
  }

  @Roles('administrativo', 'enfermeiro')
  @Post('admitir')
  admitir(@Body() body: {
    nome: string;
    dataNascimento: Date;
    diagnosticoPrincipal: string;
    camaId: string;
    dataAltaPrevista?: Date;
  }, @Request() req: any) {
    return this.doenteService.admitir({ ...body, administrativoAdmissaoId: req.user.sub });
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Patch(':id')
  editar(@Param('id') id: string, @Body() body: { diagnosticoPrincipal?: string; dataAltaPrevista?: Date | null; numeroProcesso?: string }) {
    return this.doenteService.editar(id, body);
  }

  @Roles('enfermeiro', 'medico')
  @Patch(':id/estado')
  atualizarEstado(@Param('id') id: string, @Body() body: { estado: EstadoDoente }) {
    return this.doenteService.atualizarEstado(id, body.estado);
  }

  @Roles('administrativo', 'enfermeiro')
  @Patch(':id/alta')
  darAlta(@Param('id') id: string, @Request() req: any) {
    return this.doenteService.darAlta(id, req.user.sub);
  }

  @Post(':id/nota')
  adicionarNota(
    @Param('id') doenteId: string,
    @Body() body: { texto: string },
    @Request() req: any,
  ) {
    return this.doenteService.adicionarNota(doenteId, req.user.sub, body.texto);
  }

  @Patch(':id/nota/:notaId')
  editarNota(
    @Param('id') _doenteId: string,
    @Param('notaId') notaId: string,
    @Body() body: { texto: string },
    @Request() req: any,
  ) {
    return this.doenteService.editarNota(notaId, req.user.sub, body.texto);
  }

  @Delete(':id/nota/:notaId')
  apagarNota(
    @Param('id') _doenteId: string,
    @Param('notaId') notaId: string,
    @Request() req: any,
  ) {
    return this.doenteService.apagarNota(notaId, req.user.sub);
  }

  @Post(':id/alta-estruturada')
  altaEstruturada(
    @Param('id') doenteId: string,
    @Body() body: Record<string, any>,
    @Request() req: any,
  ) {
    return this.doenteService.altaEstruturada(doenteId, req.user.sub, req.user.role, body);
  }

  @Get(':id/sumario-alta')
  getSumarioAlta(@Param('id') doenteId: string) {
    return this.doenteService.getSumarioAlta(doenteId);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') doenteId: string) {
    return this.doenteService.timeline(doenteId);
  }

  @Get(':id/alta/pdf')
  async pdfAlta(@Param('id') doenteId: string, @Res() res: Response) {
    const buffer = await this.pdfService.gerarSumarioAlta(doenteId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="alta-${doenteId}.pdf"` });
    res.send(buffer);
  }

  @Post(':id/tarefa')
  criarTarefa(
    @Param('id') doenteId: string,
    @Body() body: {
      descricao: string;
      tipo: string;
      prioridade: string;
      grupoResponsavel: string;
      prazo?: Date;
    },
    @Request() req: any,
  ) {
    return this.doenteService.criarTarefa(doenteId, req.user.sub, body);
  }

  @Get('iacs/isolados')
  listarIsolados() {
    return this.doenteService.listarIsolados();
  }

  @Patch(':id/isolamento')
  @Roles('medico', 'enfermeiro')
  atualizarIsolamento(
    @Param('id') id: string,
    @Body('emIsolamento') emIsolamento: boolean,
    @Body('motivoIsolamento') motivoIsolamento?: string,
  ) {
    return this.doenteService.atualizarIsolamento(id, emIsolamento, motivoIsolamento);
  }

  @Get(':id/ficha-pessoal')
  @Roles('administrativo')
  buscarFicheiroPessoal(@Param('id') id: string) {
    return this.doenteService.buscarFicheiroPessoal(id);
  }

  @Patch(':id/ficha-pessoal')
  @Roles('administrativo')
  atualizarFicheiroPessoal(
    @Param('id') id: string,
    @Body() body: {
      nif?: string;
      numeroSNS?: string;
      morada?: string;
      codigoPostal?: string;
      localidade?: string;
      telefone?: string;
      email?: string;
      entidadeSeguradora?: string;
      numeroApolice?: string;
      tipoCobertura?: string;
    },
    @Request() req: any,
  ) {
    return this.doenteService.atualizarFicheiroPessoal(id, body, req.user.sub);
  }

  // ─── Problemas Clínicos ─────────────────────────────────────────────────────

  @Get(':id/problemas')
  @Roles('medico', 'enfermeiro', 'administrativo')
  listarProblemas(@Param('id') id: string) {
    return this.doenteService.listarProblemas(id);
  }

  @Post(':id/problemas')
  @Roles('medico', 'enfermeiro')
  criarProblema(
    @Param('id') id: string,
    @Body() body: { descricao: string; tipo?: string; estado?: string; dataInicio?: string },
    @Request() req: any,
  ) {
    return this.doenteService.criarProblema(id, body, req.user.sub);
  }

  @Patch(':id/problemas/:problemaId')
  @Roles('medico', 'enfermeiro')
  atualizarProblema(
    @Param('id') _doenteId: string,
    @Param('problemaId') problemaId: string,
    @Body() body: { estado?: string; descricao?: string; dataFim?: string },
  ) {
    return this.doenteService.atualizarProblema(problemaId, body);
  }
}
