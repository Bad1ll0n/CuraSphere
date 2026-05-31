import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DoenteService } from './doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EstadoDoente } from '../common/enums';
import { AtualizarEstadoDto } from './dto/atualizar-estado.dto';
import { AtualizarFichaPessoalDto } from './dto/atualizar-ficha-pessoal.dto';
import { CriarProblemaDto } from './dto/criar-problema.dto';
import { AtualizarProblemaDto } from './dto/atualizar-problema.dto';
import { AtualizarIsolamentoDto } from './dto/atualizar-isolamento.dto';
import { RegistroRapidoDto } from './dto/registro-rapido.dto';
import { AdmitirDoenteDto } from './dto/admitir-doente.dto';
import { EditarDoenteDto } from './dto/editar-doente.dto';
import { NotaDoenteDto } from './dto/nota-doente.dto';
import { AltaEstruturadaDto } from './dto/alta-estruturada.dto';
import { TarefaDoenteDto } from './dto/tarefa-doente.dto';

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
    @Body() dto: RegistroRapidoDto,
    @Request() req: any,
  ) {
    return this.doenteService.registroRapido(dto, req.user.sub);
  }

  @Roles('administrativo', 'enfermeiro')
  @Post('admitir')
  admitir(@Body() dto: AdmitirDoenteDto, @Request() req: any) {
    return this.doenteService.admitir({ ...dto, administrativoAdmissaoId: req.user.sub });
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: EditarDoenteDto) {
    return this.doenteService.editar(id, dto);
  }

  @Roles('enfermeiro', 'medico')
  @Patch(':id/estado')
  atualizarEstado(@Param('id') id: string, @Body() dto: AtualizarEstadoDto) {
    return this.doenteService.atualizarEstado(id, dto.estado);
  }

  @Roles('administrativo', 'enfermeiro')
  @Patch(':id/alta')
  darAlta(@Param('id') id: string, @Request() req: any) {
    return this.doenteService.darAlta(id, req.user.sub);
  }

  @Post(':id/nota')
  adicionarNota(
    @Param('id') doenteId: string,
    @Body() dto: NotaDoenteDto,
    @Request() req: any,
  ) {
    return this.doenteService.adicionarNota(doenteId, req.user.sub, dto.texto);
  }

  @Patch(':id/nota/:notaId')
  editarNota(
    @Param('id') _doenteId: string,
    @Param('notaId') notaId: string,
    @Body() dto: NotaDoenteDto,
    @Request() req: any,
  ) {
    return this.doenteService.editarNota(notaId, req.user.sub, dto.texto);
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
    @Body() dto: AltaEstruturadaDto,
    @Request() req: any,
  ) {
    return this.doenteService.altaEstruturada(doenteId, req.user.sub, req.user.role, dto);
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
    @Body() dto: TarefaDoenteDto,
    @Request() req: any,
  ) {
    return this.doenteService.criarTarefa(doenteId, req.user.sub, dto);
  }

  @Get('iacs/isolados')
  listarIsolados() {
    return this.doenteService.listarIsolados();
  }

  @Patch(':id/isolamento')
  @Roles('medico', 'enfermeiro')
  atualizarIsolamento(
    @Param('id') id: string,
    @Body() dto: AtualizarIsolamentoDto,
  ) {
    return this.doenteService.atualizarIsolamento(id, dto.emIsolamento, dto.motivoIsolamento);
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
    @Body() dto: AtualizarFichaPessoalDto,
    @Request() req: any,
  ) {
    return this.doenteService.atualizarFicheiroPessoal(id, dto, req.user.sub);
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
    @Body() dto: CriarProblemaDto,
    @Request() req: any,
  ) {
    return this.doenteService.criarProblema(id, dto, req.user.sub);
  }

  @Patch(':id/problemas/:problemaId')
  @Roles('medico', 'enfermeiro')
  atualizarProblema(
    @Param('id') _doenteId: string,
    @Param('problemaId') problemaId: string,
    @Body() dto: AtualizarProblemaDto,
  ) {
    return this.doenteService.atualizarProblema(problemaId, dto);
  }
}
