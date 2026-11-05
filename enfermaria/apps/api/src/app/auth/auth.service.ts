import {
  Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnomalyDetectionService } from '../common/anomaly-detection.service';
import { hashPassword, verifyPassword } from '../common/password';
import * as crypto from 'crypto';
import {
  AUD_MFA_CHALLENGE, AUD_MFA_SETUP, AUD_PASSWORD_EXPIRADA, AUD_SOCKET, JWT_ISSUER,
} from './token-audiences';
import { generateSecret, generateURI, verify } from 'otplib';
import { toDataURL } from 'qrcode';
import { invalidarCacheSessao } from './sessao-cache';

// Hash bcrypt fixo (cost 12) usado para equalizar o tempo de resposta
// quando o utilizador não existe. Evita user-enumeration timing attack.
const DUMMY_BCRYPT_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8L1z/Bm5wQq6zP2N5p8m7rUcD3xK2C';

/** Papéis que não podem ter sessão sem 2.º factor (login, refresh e desactivação do MFA). */
export const ROLES_CLINICOS_MFA = ['medico', 'enfermeiro', 'farmaceutico', 'tecnico_saude', 'auxiliar'];

// QA-19: tentativas de código por desafio MFA, e falhas por conta numa janela.
export const MAX_TENTATIVAS_DESAFIO_MFA = 5;
export const MAX_FALHAS_MFA_CONTA = 10;
const JANELA_FALHAS_MFA_MS = 15 * 60 * 1000;
const VALIDADE_DESAFIO_MFA_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly anomaly: AnomalyDetectionService,
  ) {}

  // Janela do otplib (30 s + 1 step de tolerância). 90 s cobre-a com margem.
  private static readonly TOTP_JANELA_MS = 90_000;

  /**
   * Anti-replay de um código TOTP, DURÁVEL em Postgres (antes vivia no Redis).
   * Devolve `true` na primeira utilização do código dentro da janela; `false` se for replay.
   *
   * Racional (ver análise da Sessão 74): o Postgres já é dependência dura do login — lê o
   * utilizador e grava o refresh token — por isso ancorar aqui NÃO cria ponto único de falha
   * novo. O Redis, esse, era um SPOF: em baixo, o `setIfNotExists` devolvia `null` e o método
   * negava (fail-closed) TODOS os códigos → bloqueava por completo o login de staff clínico.
   *
   * Semântica atómica "usar-uma-vez": INSERT; em conflito, só re-atribui (permite) se a linha
   * anterior já EXPIROU — caso contrário 0 linhas afetadas = replay dentro da janela. Um erro
   * real de BD propaga (sem Postgres o login já é impossível), em vez de negar um código válido.
   */
  private async consumirTotpUmaVez(scope: string, secret: string, code: string): Promise<boolean> {
    // Hash do scope+secret+code — nunca persiste o secret/código em claro.
    const chave = crypto.createHash('sha256').update(`${scope}:${secret}:${code}`).digest('hex');
    const expiraEm = new Date(Date.now() + AuthService.TOTP_JANELA_MS);
    // Decisão de replay por LEITURA (o único caminho 100% fiável no query-engine do Prisma+adapter:
    // a semântica de `ON CONFLICT … RETURNING`/contagem diverge no bundle, e apanhar a exceção de
    // constraint não é opção porque o bundler parte a classe de erro do Prisma). Existe uma linha
    // AINDA ATIVA para esta chave? → replay.
    // IMPORTANTE: comparar com uma Date PARAMETRIZADA, não com `now()` do SQL — via $queryRaw+adapter
    // o `now()` (timestamptz) compara mal com a coluna `timestamp` e dá o resultado errado; a Date
    // parametrizada usa a mesma serialização da gravação (comprovado empiricamente).
    const agora = new Date();
    const ativos = await this.prisma.$queryRaw<Array<{ existe: number }>>`
      SELECT 1 AS existe FROM totp_consumidos WHERE chave = ${chave} AND "expiraEm" > ${agora} LIMIT 1`;
    if (ativos.length > 0) return false;
    // Regista (durável). O upsert sobrescreve uma eventual linha já expirada da mesma chave, o que
    // permite a reutilização legítima de um código que só volte a coincidir fora da janela.
    await this.prisma.$executeRaw`
      INSERT INTO totp_consumidos (chave, "expiraEm") VALUES (${chave}, ${expiraEm})
      ON CONFLICT (chave) DO UPDATE SET "expiraEm" = EXCLUDED."expiraEm"`;
    return true;
  }

  /** Housekeeping: remove os TOTP já expirados (mantém `totp_consumidos` minúscula). */
  @Cron('*/10 * * * *')
  async limparTotpExpirados(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('totp-limpeza', 480_000))) return; // 8min < 10min
    try {
      // Date parametrizada (não `now()`) — ver nota em consumirTotpUmaVez sobre a comparação de tipos.
      await this.prisma.$executeRaw`DELETE FROM totp_consumidos WHERE "expiraEm" < ${new Date()}`;
    } catch (e) {
      this.logger.warn(`Limpeza de TOTP expirados falhou: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  async login(numeroFuncionario: string, password: string, ip?: string) {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { numeroFuncionario },
    });

    // Equalizar tempo de resposta — corre bcrypt mesmo quando o utilizador não existe
    if (!utilizador || !utilizador.ativo) {
      await verifyPassword(password, DUMMY_BCRYPT_HASH).catch(() => false);
      this.logger.warn(`Tentativa de login falhada para funcionário: ${numeroFuncionario}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const lockKey = `login:lock:${utilizador.id}`;
    const failKey = `login:fail:${utilizador.id}`;
    const lockAtivo = await this.redis.get<string>(lockKey);
    if (lockAtivo) {
      throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
    }

    const passwordValida = await verifyPassword(password, utilizador.passwordHash);
    if (!passwordValida) {
      const falhas = (await this.redis.get<number>(failKey) ?? 0) + 1;
      if (falhas >= 5) {
        await this.redis.set(lockKey, '1', 900);
        await this.redis.del(failKey);
        this.logger.warn(`Conta bloqueada por excesso de falhas: ${utilizador.numeroFuncionario}`);
        throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
      }
      await this.redis.set(failKey, falhas, 900);
      this.logger.warn(`Password incorreta para funcionário: ${utilizador.numeroFuncionario} (${falhas}/5)`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.redis.del(failKey);

    this.anomaly.verificarIpLogin(utilizador.id, ip);

    if (utilizador.mfaAtivo) {
      // SEC-03: audiência e `tipo` próprios — este token NÃO é uma sessão. A
      // `JwtStrategy` do pessoal nem sequer o descodifica (audiência fora da
      // allowlist), pelo que já não dá para saltar o 2.º factor apresentando-o
      // como access token.
      // QA-19: o desafio tem `jti` gravado em BD — uso único e tentativas contadas.
      const jti = crypto.randomUUID();
      await this.prisma.desafioMfa.create({
        data: { jti, utilizadorId: utilizador.id, expiraEm: new Date(Date.now() + VALIDADE_DESAFIO_MFA_MS) },
      });
      const mfaChallengeToken = this.jwtService.sign(
        { sub: utilizador.id, tipo: 'mfa_challenge', mfaChallenge: true },
        { expiresIn: '5m', audience: AUD_MFA_CHALLENGE, jwtid: jti },
      );
      return { mfaPendente: true as const, mfaChallengeToken };
    }

    if (ROLES_CLINICOS_MFA.includes(utilizador.role) && !utilizador.mfaAtivo) {
      // SEC-03: só aceite em GET /auth/mfa/setup e POST /auth/mfa/ativar
      // (ver `@TiposToken('pessoal', 'mfa_setup')` no AuthController).
      const mfaSetupToken = this.jwtService.sign(
        { sub: utilizador.id, tipo: 'mfa_setup', mfaSetup: true },
        { expiresIn: '30m', audience: AUD_MFA_SETUP },
      );
      return { mfaPendente: false as const, mfaSetupObrigatorio: true as const, mfaSetupToken };
    }

    const expirada = this.respostaPasswordExpirada(utilizador);
    if (expirada) {
      return { mfaPendente: false as const, passwordExpirada: true as const, passwordExpiredToken: expirada.passwordExpiredToken };
    }

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    const diasRestantes = utilizador.passwordExpiresAt
      ? Math.ceil((utilizador.passwordExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const passwordExpiradoAviso = diasRestantes !== null && diasRestantes <= 10;
    return { mfaPendente: false as const, accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador), passwordExpiradoAviso, diasRestantesSenha: diasRestantes };
  }

  async verificarMfaLogin(mfaChallengeToken: string, code: string) {
    let payload: { sub: string; tipo?: string; mfaChallenge?: boolean; jti?: string };
    try {
      // A audiência é explícita: um access token de pessoal (aud 'curasphere') ou um
      // token do portal apresentado aqui falha a verificação, em vez de ser aceite
      // como desafio válido só por partilhar o segredo.
      payload = this.jwtService.verify(mfaChallengeToken, {
        audience: AUD_MFA_CHALLENGE,
        issuer: JWT_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Desafio MFA expirado ou inválido. Faça login novamente.');
    }
    if (payload.tipo !== 'mfa_challenge' || !payload.mfaChallenge || !payload.jti) {
      throw new UnauthorizedException('Token inválido');
    }
    const jti = payload.jti;

    // QA-19: limite por conta — somadas as tentativas falhadas dos desafios recentes.
    const recentes = await this.prisma.desafioMfa.aggregate({
      where: { utilizadorId: payload.sub, consumidoEm: null, criadoEm: { gt: new Date(Date.now() - JANELA_FALHAS_MFA_MS) } },
      _sum: { tentativas: true },
    });
    if ((recentes._sum.tentativas ?? 0) >= MAX_FALHAS_MFA_CONTA) {
      this.logger.warn(`MFA bloqueado por excesso de falhas para utilizador ${payload.sub}`);
      throw new UnauthorizedException('Demasiados códigos MFA errados. Tente novamente em 15 minutos.');
    }

    // Reserva uma tentativa de forma atómica: só conta se o desafio existe, é deste
    // utilizador, não foi consumido, não expirou e ainda tem tentativas.
    const reservada = await this.prisma.desafioMfa.updateMany({
      where: {
        jti,
        utilizadorId: payload.sub,
        consumidoEm: null,
        expiraEm: { gt: new Date() },
        tentativas: { lt: MAX_TENTATIVAS_DESAFIO_MFA },
      },
      data: { tentativas: { increment: 1 } },
    });
    if (reservada.count !== 1) {
      throw new UnauthorizedException('Desafio MFA expirado ou já utilizado. Faça login novamente.');
    }

    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: payload.sub } });
    if (!utilizador || !utilizador.ativo || !utilizador.mfaAtivo || !utilizador.mfaSecret) {
      throw new UnauthorizedException('MFA não configurado para este utilizador');
    }

    const { valid: isValid } = await verify({ token: code, secret: utilizador.mfaSecret });
    if (!isValid) throw new UnauthorizedException('Código MFA inválido');

    // Anti-replay: cada código TOTP só pode ser usado uma vez na janela de 90 s
    const primeiraVez = await this.consumirTotpUmaVez(`mfa:${utilizador.id}`, utilizador.mfaSecret, code);
    if (!primeiraVez) {
      this.logger.warn(`Replay de código TOTP detectado para utilizador ${utilizador.id}`);
      throw new UnauthorizedException('Código MFA já utilizado. Aguarde o próximo código.');
    }

    // Consome o desafio: só um pedido concorrente o consegue marcar.
    const consumido = await this.prisma.desafioMfa.updateMany({
      where: { jti, consumidoEm: null },
      data: { consumidoEm: new Date() },
    });
    if (consumido.count !== 1) {
      throw new UnauthorizedException('Desafio MFA já utilizado. Faça login novamente.');
    }

    // A verificação da validade da password não pode ser saltada por ter MFA activo.
    const expirada = this.respostaPasswordExpirada(utilizador);
    if (expirada) return expirada;

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  /** Housekeeping: remove desafios MFA expirados há mais de 1 dia. */
  @Cron('17 * * * *')
  async limparDesafiosMfa(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('mfa-desafios-limpeza', 3_000_000))) return;
    try {
      await this.prisma.desafioMfa.deleteMany({ where: { expiraEm: { lt: new Date(Date.now() - 86_400_000) } } });
    } catch (e) {
      this.logger.warn(`Limpeza de desafios MFA falhou: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  /** Token para `PATCH /auth/alterar-password` quando a password expirou; `null` se não expirou. */
  private respostaPasswordExpirada(u: { id: string; passwordExpiresAt: Date | null }) {
    if (!u.passwordExpiresAt || u.passwordExpiresAt >= new Date()) return null;
    // SEC-03: só aceite em PATCH /auth/alterar-password.
    const passwordExpiredToken = this.jwtService.sign(
      { sub: u.id, tipo: 'password_expirada', passwordExpired: true },
      { expiresIn: '15m', audience: AUD_PASSWORD_EXPIRADA },
    );
    return { passwordExpirada: true as const, passwordExpiredToken };
  }

  /**
   * SEC-04: invalida já todos os access tokens emitidos ao utilizador (claim `sv`) e
   * revoga os refresh tokens. Usado no logout, desactivação e mudança de papel/password/MFA.
   */
  async terminarSessoes(utilizadorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.utilizador.update({ where: { id: utilizadorId }, data: { versaoSessao: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { utilizadorId, revogado: false }, data: { revogado: true } }),
    ]);
    invalidarCacheSessao(utilizadorId);
  }

  async setupMfa(utilizadorId: string, setupToken?: string) {
    // If a setupToken is provided, check if it has already been used to prevent replay
    if (setupToken) {
      const jaUsado = await this.redis.get<string>(`mfaSetup:used:${utilizadorId}`);
      if (jaUsado) {
        throw new BadRequestException('MFA setup já utilizado. Faça login novamente.');
      }
    }

    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { numeroFuncionario: true, mfaAtivo: true },
    });
    if (!utilizador) throw new UnauthorizedException('Utilizador não encontrado');
    if (utilizador.mfaAtivo) throw new BadRequestException('MFA já está ativo. Desative primeiro.');

    const secret = generateSecret();
    // SEC-02: o segredo proposto fica no servidor; `ativarMfa` só aceita este.
    await this.prisma.utilizador.update({ where: { id: utilizadorId }, data: { mfaSecretPendente: secret } });
    const otpAuthUrl = generateURI({ issuer: 'CuraSphere', label: utilizador.numeroFuncionario, secret });
    const qrCodeDataUrl = await toDataURL(otpAuthUrl);
    return { secret, qrCodeDataUrl };
  }

  /**
   * SEC-02: activa o MFA com o segredo que o próprio servidor gerou em `setupMfa`. O cliente
   * já não escolhe o segredo, e com o MFA activo isto recusa — antes, quem tivesse a sessão
   * trocava o 2.º factor da vítima por um seu sem saber o código actual.
   */
  async ativarMfa(utilizadorId: string, code: string, setupToken?: string) {
    const atual = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { mfaAtivo: true, mfaSecretPendente: true },
    });
    if (!atual) throw new UnauthorizedException('Utilizador não encontrado');
    if (atual.mfaAtivo) throw new ConflictException('MFA já está ativo. Desative primeiro.');
    const secret = atual.mfaSecretPendente;
    if (!secret) throw new BadRequestException('Inicie primeiro a configuração do MFA.');

    const { valid: isValid } = await verify({ token: code, secret });
    if (!isValid) throw new BadRequestException('Código inválido. Verifique a aplicação autenticadora.');

    const primeiraVez = await this.consumirTotpUmaVez(`mfa-ativar:${utilizadorId}`, secret, code);
    if (!primeiraVez) {
      throw new BadRequestException('Código já utilizado. Aguarde o próximo código.');
    }

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: secret, mfaAtivo: true, mfaSecretPendente: null },
    });

    // Invalidate the mfaSetupToken so it cannot be replayed to trigger another setup
    if (setupToken) {
      await this.redis.set(`mfaSetup:used:${utilizadorId}`, '1', 1800);
    }

    return { mensagem: 'Autenticação em 2 passos ativada com sucesso' };
  }

  async desativarMfa(utilizadorId: string, code: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador?.mfaAtivo || !utilizador?.mfaSecret) {
      throw new BadRequestException('MFA não está ativo');
    }
    if (ROLES_CLINICOS_MFA.includes(utilizador.role)) {
      throw new ForbiddenException('O MFA é obrigatório para o seu perfil e não pode ser desativado.');
    }
    const { valid: isValid } = await verify({ token: code, secret: utilizador.mfaSecret });
    if (!isValid) throw new BadRequestException('Código inválido');

    const primeiraVez = await this.consumirTotpUmaVez(`mfa-desativar:${utilizadorId}`, utilizador.mfaSecret, code);
    if (!primeiraVez) {
      throw new BadRequestException('Código já utilizado. Aguarde o próximo código.');
    }

    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: { mfaSecret: null, mfaAtivo: false },
    });
    await this.terminarSessoes(utilizadorId);
    return { mensagem: 'Autenticação em 2 passos desativada' };
  }

  async refresh(token: string) {
    const registro = await this.prisma.refreshToken.findUnique({ where: { token } });

    // Token inexistente OU expirado → recusa normal
    if (!registro || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Reuse-detection: um refresh-token já revogado a ser reapresentado significa que
    // alguém o capturou. Revogamos TODAS as sessões do utilizador (token theft).
    if (registro.revogado) {
      this.logger.warn(`Refresh-token reuse detectado para utilizador ${registro.utilizadorId} — revogando todas as sessões`);
      await this.terminarSessoes(registro.utilizadorId);
      throw new UnauthorizedException('Sessão comprometida. Faça login novamente.');
    }

    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: registro.utilizadorId } });
    if (!utilizador || !utilizador.ativo) throw new UnauthorizedException('Utilizador inativo');
    // SEC-03: a renovação não pode manter viva uma sessão clínica sem 2.º factor.
    if (ROLES_CLINICOS_MFA.includes(utilizador.role) && !utilizador.mfaAtivo) {
      await this.prisma.refreshToken.update({ where: { token }, data: { revogado: true } });
      throw new UnauthorizedException('MFA obrigatório. Faça login novamente.');
    }

    await this.prisma.refreshToken.update({ where: { token }, data: { revogado: true } });

    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const novoRefreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken: novoRefreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  /**
   * SEC-04: o logout termina TODAS as sessões do utilizador (access tokens incluídos, via
   * `versaoSessao`). Sem `utilizadorId` (cookie de acesso já expirado), chega o refresh token.
   */
  async logout(token: string | undefined, utilizadorId?: string) {
    let id = utilizadorId;
    if (!id && token) {
      const registo = await this.prisma.refreshToken.findUnique({ where: { token }, select: { utilizadorId: true } });
      id = registo?.utilizadorId;
    }
    if (id) await this.terminarSessoes(id);
    return { mensagem: 'Sessão terminada' };
  }

  async getMe(id: string) {
    return this.prisma.utilizador.findUnique({
      where: { id },
      select: { id: true, nome: true, numeroFuncionario: true, role: true, subRole: true, servico: true, mfaAtivo: true },
    });
  }

  async alterarPassword(utilizadorId: string, passwordAtual: string, novaPassword: string) {
    const utilizador = await this.prisma.utilizador.findUnique({ where: { id: utilizadorId } });
    if (!utilizador) throw new UnauthorizedException('Utilizador não encontrado');

    const passwordValida = await verifyPassword(passwordAtual, utilizador.passwordHash);
    if (!passwordValida) throw new UnauthorizedException('Password atual incorreta');

    const novaPasswordHash = await hashPassword(novaPassword, 12);
    await this.prisma.utilizador.update({
      where: { id: utilizadorId },
      data: {
        passwordHash: novaPasswordHash,
        passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    await this.terminarSessoes(utilizadorId);
    return { mensagem: 'Password alterada com sucesso' };
  }

  async passwordStatus(userId: string) {
    const u = await this.prisma.utilizador.findUnique({ where: { id: userId }, select: { passwordExpiresAt: true } });
    if (!u?.passwordExpiresAt) return { expira: false, diasRestantes: null };
    const dias = Math.ceil((u.passwordExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { expira: dias <= 0, diasRestantes: dias, aviso: dias <= 10 };
  }

  private buildPayload(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string; tenantId?: string | null; versaoSessao: number }) {
    // `tipo: 'pessoal'` — obrigatório: a `JwtStrategy` recusa qualquer token sem ele.
    // `sv` — versão da sessão (SEC-04): a estratégia recusa tokens de versão antiga.
    return { sub: u.id, tipo: 'pessoal' as const, sv: u.versaoSessao, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico, tenantId: u.tenantId ?? 'default' };
  }

  /**
   * Emite um bilhete de curta duração para o handshake do websocket clínico.
   *
   * Chamado com uma sessão de pessoal já validada (cookie `httpOnly`), devolve um JWT com
   * audiência própria (`AUD_SOCKET`) que o `EventsGateway` é o único a aceitar. Não é uma
   * sessão: não abre rotas HTTP, expira em 60 s e não é renovável — o cliente pede um novo
   * a cada tentativa de ligação, incluindo reconexões.
   */
  emitirBilheteSocket(u: {
    sub: string; nome?: string; role: string; servico: string; tenantId?: string | null;
  }) {
    return this.jwtService.sign(
      {
        sub: u.sub,
        tipo: 'socket' as const,
        nome: u.nome,
        role: u.role,
        servico: u.servico,
        tenantId: u.tenantId ?? 'default',
      },
      { expiresIn: '60s', audience: AUD_SOCKET },
    );
  }

  /**
   * Emite uma sessão (access + refresh token) usando exactamente o mesmo mecanismo
   * do login por password: access token JWT curto + refresh token opaco persistido
   * em BD (revogável, com reuse-detection). Deve ser usado por QUALQUER via de
   * autenticação alternativa (WebAuthn, SSO, etc.) para não contornar a
   * infraestrutura de revogação/expiração de sessões.
   */
  async emitirSessaoExterna(utilizador: {
    id: string; nome: string; numeroFuncionario: string; role: string;
    subRole?: string | null; servico: string; tenantId?: string | null; versaoSessao: number; ativo?: boolean;
  }) {
    if (utilizador.ativo === false) throw new UnauthorizedException('Utilizador inativo');
    const accessToken = this.jwtService.sign(this.buildPayload(utilizador));
    const refreshToken = await this.criarRefreshToken(utilizador.id);
    return { accessToken, refreshToken, utilizador: this.buildUtilizadorDto(utilizador) };
  }

  private buildUtilizadorDto(u: { id: string; nome: string; numeroFuncionario: string; role: string; subRole?: string | null; servico: string; tenantId?: string | null }) {
    return { id: u.id, nome: u.nome, numeroFuncionario: u.numeroFuncionario, role: u.role, subRole: u.subRole ?? undefined, servico: u.servico, tenantId: u.tenantId ?? 'default' };
  }

  private async criarRefreshToken(utilizadorId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const dias = parseInt(raw) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);
    await this.prisma.refreshToken.create({ data: { token, utilizadorId, expiresAt } });
    return token;
  }
}
