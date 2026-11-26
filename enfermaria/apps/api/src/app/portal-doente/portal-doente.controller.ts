import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PortalJwtGuard } from './portal-jwt.guard';
import { PortalDoenteService } from './portal-doente.service';
import { PortalRecuperacaoService } from './portal-recuperacao.service';
import { RgpdService } from '../rgpd/rgpd.service';
import { AcessoLeituraService } from '../common/auditoria/acesso-leitura.service';
import { ConsentimentosTratamentoService } from '../consentimentos-tratamento/consentimentos-tratamento.service';
import { RegistarConsentimentoTratamentoDto } from '../consentimentos-tratamento/consentimentos-tratamento.dto';
import type { PedidoPortal } from '../auth/pedido-autenticado';
import {
  PortalLoginDto, CriarAcessoPortalDto, MensagemPortalDto, PortalRecuperarDto, PortalRedefinirDto,
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
  constructor(
    private readonly service: PortalDoenteService,
    private readonly leituras: AcessoLeituraService,
    private readonly consentimentos: ConsentimentosTratamentoService,
    private readonly rgpd: RgpdService,
    private readonly recuperacao: PortalRecuperacaoService,
  ) {}

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
    // JavaScript da página não lhe toca. QA-28: o token já não vai no corpo — o portal só usa
    // o cookie; com ele no corpo, um XSS voltava a conseguir lê-lo e anulava o SEC-07.
    const { accessToken, ...publico } = resultado;
    res.cookie('portal_token', accessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: PORTAL_COOKIE_MAX_AGE,
    });

    return publico;
  }

  /**
   * SEC-07: sem isto, terminar sessão no portal deixava o cookie válido no browser
   * durante 8 h. O cookie é `httpOnly`, por isso só o servidor o pode apagar.
   */
  /**
   * UX-28: "esqueci-me da password". Público; resposta sempre igual (não revela se o email tem
   * conta). O link aponta para PORTAL_URL (ou a 1.ª origem permitida) — nunca para o Host do
   * pedido, que um atacante controla.
   */
  @Throttle({ default: { ttl: 900000, limit: 3 } })
  @Post('recuperar')
  recuperar(@Body() dto: PortalRecuperarDto) {
    const origem = process.env['PORTAL_URL'] ?? (process.env['ALLOWED_ORIGINS'] ?? '').split(',')[0]?.trim() ?? '';
    return this.recuperacao.pedir(dto.email, origem || 'http://localhost:3000');
  }

  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @Post('redefinir')
  redefinir(@Body() dto: PortalRedefinirDto) {
    return this.recuperacao.redefinir(dto.token, dto.senha);
  }

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
    @Request() req: PedidoPortal,
  ) {
    return this.service.criarAcesso(dto.doenteId, dto.email, dto.senha, req.user.sub);
  }

  @Get('me')
  @UseGuards(PortalJwtGuard)
  me(@Request() req: PedidoPortal) {
    return this.service.me(req.user.doenteId);
  }

  @Get('documentos')
  @UseGuards(PortalJwtGuard)
  documentos(@Request() req: PedidoPortal) {
    return this.service.meusDocumentos(req.user.doenteId);
  }

  @Get('medicacao')
  @UseGuards(PortalJwtGuard)
  medicacao(@Request() req: PedidoPortal) {
    return this.service.minhaMedicacao(req.user.doenteId);
  }

  @Get('plano-alta')
  @UseGuards(PortalJwtGuard)
  planoAlta(@Request() req: PedidoPortal) {
    return this.service.meuPlanoAlta(req.user.doenteId);
  }

  @Post('mensagem')
  @UseGuards(PortalJwtGuard)
  mensagem(@Body() dto: MensagemPortalDto, @Request() req: PedidoPortal) {
    return this.service.enviarMensagem(req.user.doenteId, dto.conteudo);
  }

  @Get('exportar/pdf')
  @UseGuards(PortalJwtGuard)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="meus-dados-clinicos.pdf"')
  async exportarPdf(@Request() req: PedidoPortal, @Res() res: Response) {
    const buffer = await this.service.exportarDados(req.user.doenteId);
    res.send(buffer);
  }

  // SEC-09 / art. 15.º RGPD: o titular vê quem consultou o seu processo.
  @Get('acessos')
  @UseGuards(PortalJwtGuard)
  acessos(@Request() req: PedidoPortal) {
    return this.leituras.listarPorDoente(req.user.doenteId, { paraTitular: true, limite: 100 });
  }

  @Get('exportar/json')
  @UseGuards(PortalJwtGuard)
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  exportarJson(@Request() req: PedidoPortal) {
    // SEC-20: a exportação completa (todas as tabelas do titular + quem consultou o processo).
    return this.rgpd.exportar(req.user.doenteId, { via: 'portal' });
  }

  @Get('teleconsultas')
  @UseGuards(PortalJwtGuard)
  teleconsultas(@Request() req: PedidoPortal) {
    return this.service.teleconsultas(req.user.sub);
  }

  @Get('teleconsultas/:id/video')
  @UseGuards(PortalJwtGuard)
  entrarVideoPortal(@Param('id') id: string, @Request() req: PedidoPortal) {
    return this.service.entrarVideoPortal(id, req.user.sub);
  }

  // ── SEC-19: o doente vê e gere as suas decisões de tratamento de dados ─────

  @Get('consentimentos')
  @UseGuards(PortalJwtGuard)
  consentimentosDoente(@Request() req: PedidoPortal) {
    return this.consentimentos.estado(req.user.doenteId);
  }

  @Post('consentimentos')
  @UseGuards(PortalJwtGuard)
  registarConsentimento(@Body() dto: RegistarConsentimentoTratamentoDto, @Request() req: PedidoPortal) {
    return this.consentimentos.registar(req.user.doenteId, dto, 'portal', null);
  }

  @Post('consentimentos/:finalidade/revogar')
  @UseGuards(PortalJwtGuard)
  revogarConsentimento(@Param('finalidade') finalidade: string, @Request() req: PedidoPortal) {
    return this.consentimentos.revogar(req.user.doenteId, finalidade, 'portal', null);
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
    @Request() req: PedidoPortal,
  ) {
    return this.service.submeterPRO(req.user.doenteId, dto.templateId, dto.respostas);
  }

  @Get('pro/historico')
  @UseGuards(PortalJwtGuard)
  historicoPRO(@Request() req: PedidoPortal, @Query('templateId') templateId?: string) {
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
