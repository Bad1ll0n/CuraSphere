import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PortalJwtGuard } from './portal-jwt.guard';
import { PortalDoenteService } from './portal-doente.service';
import {
  PortalLoginDto, CriarAcessoPortalDto, MensagemPortalDto,
  SubmeterProDto, CriarTemplateProDto,
} from './dto/portal.dto';

/**
 * Tem de acompanhar o `expiresIn: '8h'` com que o token do portal é assinado
 * (`portal-doente.service.ts`). Um cookie que sobreviva ao token deixa o portal a
 * enviar credenciais mortas e a receber 401 sem explicação.
 */
const PORTAL_COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

@Controller('portal')
export class PortalDoenteController {
  constructor(private readonly service: PortalDoenteService) {}

  // SEC-06: tentativas por IP em 10 min. Complementa o bloqueio por conta (5 falhas /
  // 15 min) feito no serviço — o throttle trava um IP a martelar muitas contas, o
  // bloqueio de conta trava muitos IP a martelar uma conta.
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: PortalLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.service.login(dto.email, dto.senha);

    // SEC-07: o token do portal passa a viajar em cookie `httpOnly`, como o do pessoal.
    // Enquanto vivia em `localStorage` bastava um XSS no portal para o ler; aqui o
    // JavaScript da página não lhe toca. O `accessToken` continua no corpo apenas
    // durante a transição do cliente — assim que o portal deixar de o ler, retirar daqui.
    res.cookie('portal_token', resultado.accessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: PORTAL_COOKIE_MAX_AGE,
    });

    return resultado;
  }

  /**
   * SEC-07: sem isto, terminar sessão no portal deixava o cookie válido no browser
   * durante 8 h. O cookie é `httpOnly`, por isso só o servidor o pode apagar.
   */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('portal_token', { path: '/', httpOnly: true, sameSite: 'strict' });
    return { ok: true };
  }

  @Post('criar-acesso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  criarAcesso(
    @Body() dto: CriarAcessoPortalDto,
    @Request() req: any,
  ) {
    return this.service.criarAcesso(dto.doenteId, dto.email, dto.senha, req.user.sub);
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
  mensagem(@Body() dto: MensagemPortalDto, @Request() req: any) {
    return this.service.enviarMensagem(req.user.doenteId, dto.conteudo);
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
    @Body() dto: SubmeterProDto,
    @Request() req: any,
  ) {
    return this.service.submeterPRO(req.user.doenteId, dto.templateId, dto.respostas);
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
  criarTemplate(@Body() dto: CriarTemplateProDto) {
    return this.service.criarTemplatePRO(dto.nome, dto.campos);
  }

  @Get('pro/doente/:doenteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros')
  historicoPRODoente(@Param('doenteId') doenteId: string) {
    return this.service.historicoPRODoente(doenteId);
  }
}
