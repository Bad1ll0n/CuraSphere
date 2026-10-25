/**
 * Duplo do cliente HTTP. Regista cada chamada (incluindo o cabeçalho
 * `Idempotency-Key`) para os testes poderem afirmar quantas vezes cada operação
 * chegou ao servidor — que é a pergunta que interessa numa fila de actos clínicos.
 */
export interface ChamadaRegistada {
  metodo: string;
  url: string;
  body?: unknown;
  idempotencyKey?: string;
}

export const chamadas: ChamadaRegistada[] = [];
let proximoErro: ((url: string) => unknown) | null = null;

function registar(metodo: string) {
  return async (url: string, a?: unknown, b?: unknown) => {
    const config: any = metodo === 'delete' ? a : b;
    chamadas.push({
      metodo,
      url,
      body: metodo === 'delete' ? undefined : a,
      idempotencyKey: config?.headers?.['Idempotency-Key'],
    });
    if (proximoErro) {
      const erro = proximoErro(url);
      if (erro) throw erro;
    }
    return { data: {} };
  };
}

export function falharCom(fn: ((url: string) => unknown) | null): void {
  proximoErro = fn;
}

export function limpar(): void {
  chamadas.length = 0;
  proximoErro = null;
}

export default {
  post: registar('post'),
  patch: registar('patch'),
  put: registar('put'),
  delete: registar('delete'),
};
