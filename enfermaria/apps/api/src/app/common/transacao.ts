import { Logger } from '@nestjs/common';
import { randomInt } from 'crypto';

/**
 * F4: havia 15 transacções `Serializable` e zero tratamento de conflito de serialização.
 *
 * Quando duas transacções `Serializable` concorrem, o Postgres aborta uma delas com 40001
 * (`P2034` no Prisma). Não é um erro do pedido — é o preço do isolamento, e a resposta certa
 * é repetir. Sem isto, um conflito legítimo (duas enfermeiras a dispensar do mesmo stock ao
 * mesmo tempo, duas reservas da mesma bolsa de sangue) chegava ao ecrã como um 500 opaco.
 */
const CODIGOS_DE_CONFLITO = new Set(['P2034', '40001', '40P01']);
const logger = new Logger('Transacao');

export function eConflitoDeSerializacao(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  if (e?.code && CODIGOS_DE_CONFLITO.has(e.code)) return true;
  const mensagem = e?.message ?? '';
  return (
    mensagem.includes('40001') ||
    mensagem.includes('could not serialize access') ||
    mensagem.includes('deadlock detected')
  );
}

export async function comRetentativas<T>(
  executar: () => Promise<T>,
  opcoes: { tentativas?: number; rotulo?: string } = {},
): Promise<T> {
  const tentativas = opcoes.tentativas ?? 3;
  const rotulo = opcoes.rotulo ?? 'transacção';

  for (let n = 1; ; n++) {
    try {
      return await executar();
    } catch (erro) {
      if (n >= tentativas || !eConflitoDeSerializacao(erro)) throw erro;
      // Espera curta e dispersa: duas transacções que colidiram não podem voltar a tentar
      // exactamente no mesmo instante. `randomInt` e não `Math.random` — ver estrutura.spec.
      const espera = 20 * 2 ** (n - 1) + randomInt(20);
      logger.warn(
        `${rotulo}: conflito de serialização — nova tentativa em ${espera}ms (${n}/${tentativas - 1})`,
      );
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
}
