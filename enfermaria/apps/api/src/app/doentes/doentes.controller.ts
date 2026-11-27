import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res, Header, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DoenteService } from './doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { temPapel } from '../common/roles.util';
import { AtualizarEstadoDto } from './dto/atualizar-estado.dto';
import { AtualizarFichaPessoalDto } from './dto/atualizar-ficha-pessoal.dto';
import { CriarProblemaDto } from './dto/criar-problema.dto';
import { AtualizarProblemaDto } from './dto/atualizar-problema.dto';
import { AtualizarIsolamentoDto } from './dto/atualizar-isolamento.dto';
import { RegistroRapidoDto } from './dto/registro-rapido.dto';
import { AdmitirDoenteDto } from './dto/admitir-doente.dto';
import { AtribuirCamaDto } from './dto/atribuir-cama.dto';
import { AssinarCartaAltaDto, ReverCartaAltaDto } from './dto/carta-alta.dto';
import { CartaAltaService } from './carta-alta.service';
import { AcessoLeituraService } from '../common/acesso-leitura.service';
import { EditarDoenteDto } from './dto/editar-doente.dto';
import { NotaDoenteDto } from './dto/nota-doente.dto';
import { AltaEstruturadaDto } from './dto/alta-estruturada.dto';
import { TarefaDoenteDto } from './dto/tarefa-doente.dto';
import { MotivoRemocaoDto } from '../common/dto/motivo-remocao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doentes')
export class DoenteController {
  constructor(
    private readonly doenteService: DoenteService,
    private readonly pdfService: PdfService,
    private readonly cartaAlta: CartaAltaService,
    private readonly leituras: AcessoLeituraService,
  ) {}

  @Get()
  listar(
    @Request() req: any,
    @Query('todos') todos?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // O bypass `todos=true` só é permitido para roles de supervisão.
    // Antes qualquer utilizador autenticado podia ignorar o filtro de atribuição via querystring.
    // temPapel() considera o sub-papel, para a chefia de enfermagem (role=enfermeiro,
    // subRole=chefe_enfermeiros) poder supervisionar toda a ala como se pretendia.
    const rolesPodemVerTodos = ['direcao', 'qualidade', 'ti', 'chefe_enfermeiros', 'administrativo'];
    const ignorarFiltro = todos === 'true' && temPapel(req.user, rolesPodemVerTodos);

    const pageNum = Math.max(1, page ? parseInt(page, 10) || 1 : 1);
    // Limite máximo defensivo — evita DoS com listagens gigantes
    const limitNum = Math.min(100, Math.max(1, limit ? parseInt(limit, 10) || 25 : 25));

    return this.doenteService.listar(
      req.user.sub,
      ignorarFiltro ? 'todos' : req.user.role,
      pageNum,
      limitNum,
    );
  }

  // SEC-09: trilho de acessos ao processo de um doente (DPO / auditoria interna).
  @Roles('qualidade', 'direcao', 'ti')
  @Get(':id/acessos')
  listarAcessos(@Param('id') id: string, @Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.leituras.listarPorDoente(id, { pagina: Number(pagina) || 1, limite: Number(limite) || 50 });
  }

  @Roles('direcao', 'chefe_enfermeiros', 'qualidade')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="doentes.csv"')
  @Get('export')
  async exportarCsv(@Res() res: Response, @Request() req: any) {
    // SEC-09: exportação de TODOS os doentes — o acesso mais amplo que existe; fica registado.
    this.leituras.registar({
      utilizadorId: req.user.sub, utilizadorNome: req.user.nome ?? null, utilizadorRole: req.user.role ?? null,
      entidadeTipo: 'doentes', entidadeId: null, rota: 'GET /doentes/export (todos os doentes)',
      ip: req.ip ?? null, correlationId: (req.headers?.['x-correlation-id'] as string) ?? null, resultado: 'concedido',
    });
    const csv = await this.doenteService.exportarCsv();
    res.send(csv);
  }

  // Rotas de caminho estático (ex.: 'registos-administrativos', 'risco-clinico') têm de ser
  // declaradas antes de ':id' — caso contrário o Express interpreta-as como o valor do
  // parâmetro dinâmico e nunca chegam ao handler certo (ver também 'risco-clinico' abaixo).
  @Roles('administrativo')
  @Get('registos-administrativos')
  listarRegistosAdministrativos(@Query('search') search?: string) {
    return this.doenteService.listarRegistosAdministrativos(search);
  }

  @Roles('medico', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get('risco-clinico')
  listarRiscoClinoco() {
    return this.doenteService.listarRiscoClinoco();
  }

  @Roles('medico', 'enfermeiro', 'administrativo', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get(':id')
  async buscarPorId(@Param('id') id: string, @Request() req: any) {
    // Endpoint de entrada principal do doente — único ponto que activa break-glass a partir do header;
    // uma vez concedido, assertAcessoDoente reconhece o acesso em todos os restantes endpoints deste doente.
    const motivoHeader = req.headers['x-break-glass-reason'];
    const motivoBreakGlass = motivoHeader ? decodeURIComponent(motivoHeader) : undefined;
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id, motivoBreakGlass);
    return this.doenteService.buscarPorId(id);
  }

  @Roles('medico', 'enfermeiro', 'administrativo', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get(':id/historico')
  async historico(@Param('id') id: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.historico(id);
  }

  @Roles('administrativo')
  @Post('registro-rapido')
  registroRapido(
    @Body() dto: RegistroRapidoDto,
    @Request() req: any,
  ) {
    return this.doenteService.registroRapido(dto as any, req.user.sub);
  }

  @Roles('administrativo', 'enfermeiro')
  @Post('admitir')
  admitir(@Body() dto: AdmitirDoenteDto, @Request() req: any) {
    return this.doenteService.admitir({ ...dto, dataNascimento: new Date(dto.dataNascimento), dataAltaPrevista: dto.dataAltaPrevista ? new Date(dto.dataAltaPrevista) : undefined, administrativoAdmissaoId: req.user.sub } as any);
  }

  // PROD-01: doente registado para internamento (`pendente_cama`) → cama → `internado`.
  // Mesmos papéis que a admissão; o doente ainda não tem equipa atribuída.
  @Roles('administrativo', 'enfermeiro')
  @Post(':id/atribuir-cama')
  atribuirCama(@Param('id') id: string, @Body() dto: AtribuirCamaDto) {
    return this.doenteService.atribuirCama(id, dto.camaId);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Patch(':id')
  async editar(@Param('id') id: string, @Body() dto: EditarDoenteDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.editar(id, { ...dto, dataAltaPrevista: dto.dataAltaPrevista ? new Date(dto.dataAltaPrevista) : undefined } as any);
  }

  @Roles('enfermeiro', 'medico')
  @Patch(':id/estado')
  async atualizarEstado(@Param('id') id: string, @Body() dto: AtualizarEstadoDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.atualizarEstado(id, dto.estado);
  }

  @Roles('administrativo', 'enfermeiro')
  @Patch(':id/alta')
  async darAlta(@Param('id') id: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.darAlta(id, req.user.sub);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':id/nota')
  async adicionarNota(
    @Param('id') doenteId: string,
    @Body() dto: NotaDoenteDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.adicionarNota(doenteId, req.user.sub, dto.texto);
  }

  @Roles('medico', 'enfermeiro')
  @Patch(':id/nota/:notaId')
  editarNota(
    @Param('id') _doenteId: string,
    @Param('notaId') notaId: string,
    @Body() dto: NotaDoenteDto,
    @Request() req: any,
  ) {
    return this.doenteService.editarNota(notaId, req.user.sub, dto.texto);
  }

  @Roles('medico', 'enfermeiro')
  @Delete(':id/nota/:notaId')
  apagarNota(
    @Param('id') _doenteId: string,
    @Param('notaId') notaId: string,
    @Body() dto: MotivoRemocaoDto,
    @Request() req: any,
  ) {
    return this.doenteService.apagarNota(notaId, req.user.sub, dto.motivo);
  }

  @Roles('medico', 'enfermeiro', 'administrativo')
  @Post(':id/alta-estruturada')
  async altaEstruturada(
    @Param('id') doenteId: string,
    @Body() dto: AltaEstruturadaDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.altaEstruturada(doenteId, req.user.sub, req.user.role, dto);
  }

  @Roles('medico', 'enfermeiro', 'administrativo', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get(':id/sumario-alta')
  async getSumarioAlta(@Param('id') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.getSumarioAlta(doenteId);
  }

  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  @Get(':id/resumo-alta')
  async gerarResumoAlta(@Param('id') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.gerarResumoAlta(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'administrativo', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get(':id/timeline')
  async getTimeline(@Param('id') doenteId: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.timeline(doenteId);
  }

  @Roles('medico', 'enfermeiro', 'administrativo', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get(':id/alta/pdf')
  async pdfAlta(@Param('id') doenteId: string, @Request() req: any, @Res() res: Response) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    // Sanitiza doenteId para Content-Disposition (anti-CRLF / anti-injection)
    const safeId = doenteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const buffer = await this.pdfService.gerarSumarioAlta(doenteId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="alta-${safeId}.pdf"` });
    res.send(buffer);
  }

  // PROD-11: o médico revê (edita ou aceita) o rascunho da IA…
  @Roles('medico')
  @Patch(':id/carta-alta')
  async reverCartaAlta(@Param('id') doenteId: string, @Body() dto: ReverCartaAltaDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.cartaAlta.rever(doenteId, req.user.sub, dto.texto);
  }

  // …e assina-o com o TOTP. Só a carta assinada sai em PDF.
  @Roles('medico')
  @Post(':id/carta-alta/assinar')
  async assinarCartaAlta(@Param('id') doenteId: string, @Body() dto: AssinarCartaAltaDto, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.cartaAlta.assinar(doenteId, req.user.sub, dto.totpCode);
  }

  @Roles('medico', 'chefe_enfermeiros', 'direcao')
  @Get(':id/carta-alta/pdf')
  async pdfCartaAlta(@Param('id') doenteId: string, @Request() req: any, @Res() res: Response) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    await this.cartaAlta.garantirAssinada(doenteId);
    const safeId = doenteId.replace(/[^a-zA-Z0-9_-]/g, '');
    const buffer = await this.pdfService.gerarCartaAltaPdf(doenteId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="carta-alta-${safeId}.pdf"` });
    res.send(buffer);
  }

  @Roles('medico', 'enfermeiro')
  @Post(':id/tarefa')
  async criarTarefa(
    @Param('id') doenteId: string,
    @Body() dto: TarefaDoenteDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.criarTarefa(doenteId, req.user.sub, dto as any);
  }

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao', 'qualidade')
  @Get('iacs/isolados')
  listarIsolados() {
    return this.doenteService.listarIsolados();
  }

  @Patch(':id/isolamento')
  @Roles('medico', 'enfermeiro')
  async atualizarIsolamento(
    @Param('id') id: string,
    @Body() dto: AtualizarIsolamentoDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
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
  async listarProblemas(@Param('id') id: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.listarProblemas(id);
  }

  @Post(':id/problemas')
  @Roles('medico', 'enfermeiro')
  async criarProblema(
    @Param('id') id: string,
    @Body() dto: CriarProblemaDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.criarProblema(id, dto, req.user.sub);
  }

  @Patch(':id/problemas/:problemaId')
  @Roles('medico', 'enfermeiro')
  async atualizarProblema(
    @Param('id') doenteId: string,
    @Param('problemaId') problemaId: string,
    @Body() dto: AtualizarProblemaDto,
    @Request() req: any,
  ) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, doenteId);
    return this.doenteService.atualizarProblema(doenteId, problemaId, dto);
  }

  @Get(':id/followups')
  @Roles('medico', 'enfermeiro', 'administrativo')
  async listarFollowUps(@Param('id') id: string, @Request() req: any) {
    await this.doenteService.assertAcessoDoente(req.user.sub, req.user.role, id);
    return this.doenteService.listarFollowUps(id);
  }

  @Patch('followup/:followUpId/concluir')
  @Roles('medico', 'enfermeiro')
  async concluirFollowUp(@Param('followUpId') followUpId: string, @Request() req: any) {
    return this.doenteService.concluirFollowUp(followUpId, req.user.sub);
  }

  @Patch(':id/foto')
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  @UseInterceptors(FileInterceptor('foto'))
  async uploadFoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.doenteService.uploadFoto(id, file, req.user.sub, req.user.role);
  }
}
