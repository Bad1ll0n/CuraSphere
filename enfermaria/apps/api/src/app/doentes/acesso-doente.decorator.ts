import { SetMetadata } from '@nestjs/common';

export const ACESSO_DOENTE_POR = 'acessoDoentePor';
export const ACESSO_DOENTE_ISENTO = 'acessoDoenteIsento';

export interface AcessoDoentePorMeta {
  /** Delegate do Prisma da entidade (ex.: `medicacao`, `contactoEmergencia`). */
  modelo: string;
  /** Parâmetro do caminho com o id da entidade. */
  parametro: string;
  /** Caminho até ao doente na entidade: `doenteId` ou, numa relação, `avaliacao.doenteId`. */
  campo: string;
}

/**
 * A rota identifica uma entidade clínica pelo seu id (`/medicacao/:id/administrar`) e não pelo
 * doente. O `AcessoDoenteInterceptor` resolve a entidade até ao doente e aplica-lhe a mesma
 * verificação de acesso que às rotas com `:doenteId`.
 *
 * Pode ir na classe (todas as rotas com esse parâmetro) ou no método. Se o parâmetro não
 * vier no pedido, a rota não é afetada — por isso é seguro na classe de um controlador que
 * também tem rotas sem `:id`.
 */
export const AcessoDoentePor = (modelo: string, parametro = 'id', campo = 'doenteId') =>
  SetMetadata(ACESSO_DOENTE_POR, { modelo, parametro, campo } satisfies AcessoDoentePorMeta);

/**
 * A rota recebe `doenteId` no corpo num fluxo em que a relação com o doente ainda não existe
 * (admissão, auto-atribuição, ativação de break-glass, entrada na urgência). Fica isenta da
 * verificação do corpo — e só dela. O motivo é obrigatório porque é isso que fica visível em
 * revisão de código.
 */
export const AcessoDoenteIsento = (motivo: string) => SetMetadata(ACESSO_DOENTE_ISENTO, motivo);
