import { Controller, Get, Post, Body, UseGuards, Request, Res, Header } from '@nestjs/common';
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
}
