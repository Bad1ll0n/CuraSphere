import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { verify } from 'otplib';
import * as crypto from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';

// Janela do otplib (30 s + 1 passo de tolerância). 90 s cobre-a com margem.
const JANELA_MS = 90_000;

/**
 * Confirma a identidade de quem assina um documento clínico com o código TOTP do seu
 * autenticador, e garante que o código só serve uma vez.
 *
 * Antes, as assinaturas de notas clínicas e de medicação chamavam `authenticator.verify`
 * do otplib, que deixou de existir na v13: `authenticator` era `undefined` e qualquer
 * assinatura acabava em erro 500. O anti-replay da medicação vivia no Redis (fail-closed:
 * com o Redis em baixo ninguém assinava); passa a ser durável em Postgres, na mesma tabela
 * `totp_consumidos` do login (ver `AuthService.consumirTotpUmaVez`).
 *
 * @param ambito separa o anti-replay por tipo de documento (ex.: 'nota', 'medicacao', 'carta-alta').
 */
export async function verificarTotpAssinatura(
  prisma: PrismaService,
  utilizadorId: string,
  totpCode: string,
  ambito: string,
): Promise<void> {
  const utilizador = await prisma.utilizador.findUnique({
    where: { id: utilizadorId },
    select: { mfaAtivo: true, mfaSecret: true },
  });
  if (!utilizador) throw new NotFoundException('Utilizador não encontrado');
  if (!utilizador.mfaAtivo || !utilizador.mfaSecret) {
    throw new ForbiddenException('MFA não configurado. Configure o autenticador antes de assinar.');
  }

  const { valid } = await verify({ token: totpCode, secret: utilizador.mfaSecret });
  if (!valid) throw new ForbiddenException('Código TOTP inválido');

  // Hash de âmbito+utilizador+segredo+código — nunca persiste o segredo nem o código.
  const chave = crypto
    .createHash('sha256')
    .update(`assinatura:${ambito}:${utilizadorId}:${utilizador.mfaSecret}:${totpCode}`)
    .digest('hex');
  // Comparação com Date parametrizada (não `now()`) — ver a nota em `consumirTotpUmaVez`.
  const agora = new Date();
  const ativos = await prisma.$queryRaw<Array<{ existe: number }>>`
    SELECT 1 AS existe FROM totp_consumidos WHERE chave = ${chave} AND "expiraEm" > ${agora} LIMIT 1`;
  if (ativos.length > 0) {
    throw new ForbiddenException('Código TOTP já utilizado. Aguarde o próximo código.');
  }
  await prisma.$executeRaw`
    INSERT INTO totp_consumidos (chave, "expiraEm") VALUES (${chave}, ${new Date(Date.now() + JANELA_MS)})
    ON CONFLICT (chave) DO UPDATE SET "expiraEm" = EXCLUDED."expiraEm"`;
}
