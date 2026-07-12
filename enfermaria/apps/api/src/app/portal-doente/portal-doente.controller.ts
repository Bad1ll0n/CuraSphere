import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Header, Query } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PortalJwtGuard } from './portal-jwt.guard';
import { PortalDoenteService } from './portal-doente.service';

@Controller('portal')
export class PortalDoenteController {
  constructor(private readonly service: PortalDoenteService) {}

  @Post('login')
  login(@Body() body: { email: string; senha: string }) {
    return this.service.login(body.email, body.senha);
  }

  @Post('criar-acesso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  criarAcesso(
    @Body() body: { doenteId: string; email: string; senha: string },
    @Request() req: any,
  ) {
    return this.service.criarAcesso(body.doenteId, body.email, body.senha, req.user.sub);
  }

  @Get('me')
  @UseGuards(PortalJwtGuard)
  me(@Request() req: any) {
    return this.service.me(req.user.doenteId);
  }

  @Get('documentos')
  @UseGuards(PortalJwtGuard)
  documentos(@Request() req: any) {
    return this.service.meusDocumentos(req.user.doenteId);
  }

  @Get('medicacao')
  @UseGuards(PortalJwtGuard)
  medicacao(@Request() req: any) {
    return this.service.minhaMedicacao(req.user.doenteId);
  }

  @Get('plano-alta')
  @UseGuards(PortalJwtGuard)
  planoAlta(@Request() req: any) {
    return this.service.meuPlanoAlta(req.user.doenteId);
  }

  @Post('mensagem')
  @UseGuards(PortalJwtGuard)
  mensagem(@Body() body: { conteudo: string }, @Request() req: any) {
    return this.service.enviarMensagem(req.user.doenteId, body.conteudo);
  }

  @Get('exportar/pdf')
  @UseGuards(PortalJwtGuard)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="meus-dados-clinicos.pdf"')
  async exportarPdf(@Request() req: any, @Res() res: Response) {
    const buffer = await this.service.exportarDados(req.user.doenteId);
    res.send(buffer);
  }

  @Get('exportar/json')
  @UseGuards(PortalJwtGuard)
  exportarJson(@Request() req: any) {
    return this.service.exportarJson(req.user.doenteId);
  }

  @Get('teleconsultas')
  @UseGuards(PortalJwtGuard)
  teleconsultas(@Request() req: any) {
    return this.service.teleconsultas(req.user.sub);
  }

  @Get('teleconsultas/:id/video')
  @UseGuards(PortalJwtGuard)
  entrarVideoPortal(@Param('id') id: string, @Request() req: any) {
    return this.service.entrarVideoPortal(id, req.user.sub);
  }

  // ── PRO endpoints (portal) ────────────────────────────────────────────────

  @Get('pro/templates')
  @UseGuards(PortalJwtGuard)
  listarTemplates() {
    return this.service.listarTemplatesPRO();
  }

  @Post('pro/submeter')
  @UseGuards(PortalJwtGuard)
  submeterPRO(
    @Body() body: { templateId: string; respostas: Record<string, unknown> },
    @Request() req: any,
  ) {
    return this.service.submeterPRO(req.user.doenteId, body.templateId, body.respostas);
  }

  @Get('pro/historico')
  @UseGuards(PortalJwtGuard)
  historicoPRO(@Request() req: any, @Query('templateId') templateId?: string) {
    return this.service.historicoPRO(req.user.doenteId, templateId);
  }

  // ── PRO admin endpoints (clinical staff) ──────────────────────────────────

  @Post('pro/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao')
  criarTemplate(@Body() body: { nome: string; campos: object[] }) {
    return this.service.criarTemplatePRO(body.nome, body.campos);
  }

  @Get('pro/doente/:doenteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  historicoPRODoente(@Param('doenteId') doenteId: string) {
    return this.service.historicoPRODoente(doenteId);
  }
}
