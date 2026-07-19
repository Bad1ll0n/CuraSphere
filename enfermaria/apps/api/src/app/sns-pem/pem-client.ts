/**
 * Cliente do PEM (Prescrição Eletrónica Médica / SPMS) — interface plugável.
 *
 * A implementação real liga-se aos endpoints da SPMS (ambiente de qualidade/produção) e
 * exige registo + certificados. Enquanto isso não existe, usa-se o MockPemClient, que
 * simula a resposta do PEM. Trocar de implementação é só configuração (SNS_PEM_MODE).
 */
export interface PemItem {
  nome: string;
  dose?: string;
  via?: string;
  frequencia?: string;
  quantidade?: number;
}

export interface PemReceitaInput {
  doenteId: string;
  numeroUtenteSNS?: string;
  medicamentos: PemItem[];
}

export interface PemResultado {
  numeroReceita: string;
  codigoDispensa: string;
  estado: 'emitida';
}

export interface PemClient {
  readonly ambiente: 'sandbox' | 'producao';
  emitir(input: PemReceitaInput): Promise<PemResultado>;
}

/** Simulador — gera nº de receita e código de dispensa plausíveis, sem chamar a SPMS. */
export class MockPemClient implements PemClient {
  readonly ambiente = 'sandbox' as const;
  async emitir(input: PemReceitaInput): Promise<PemResultado> {
    if (!input.medicamentos?.length) throw new Error('Receita sem medicamentos');
    const rnd = (n: number) => Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
    // Formato aproximado ao do PEM (nº de receita de 19 dígitos + código de dispensa).
    const numeroReceita = `${rnd(4)} ${rnd(4)} ${rnd(4)} ${rnd(4)} ${rnd(3)}`;
    const codigoDispensa = rnd(6);
    // Latência simulada.
    await new Promise((r) => setTimeout(r, 40));
    return { numeroReceita, codigoDispensa, estado: 'emitida' };
  }
}

/**
 * Esqueleto do cliente real da SPMS. Fica pronto para receber endpoint + certificados por
 * configuração; enquanto não estiverem definidos, lança um erro claro (em vez de falhar
 * silenciosamente), para que o operador saiba que falta a configuração nacional.
 */
export class SpmsPemClient implements PemClient {
  readonly ambiente = 'producao' as const;
  constructor(private readonly endpoint?: string) {}
  async emitir(_input: PemReceitaInput): Promise<PemResultado> {
    if (!this.endpoint) {
      throw new Error('Integração SPMS/PEM real não configurada (defina SNS_PEM_ENDPOINT e os certificados).');
    }
    // TODO(real): construir o pedido FHIR-PT / SOAP para a SPMS, assinar com o certificado,
    // enviar e mapear a resposta para PemResultado. Requer credenciais SPMS.
    throw new Error('Cliente SPMS/PEM real ainda não implementado — use o modo sandbox.');
  }
}

export function criarPemClient(): PemClient {
  const modo = process.env['SNS_PEM_MODE'] ?? 'sandbox';
  if (modo === 'producao') return new SpmsPemClient(process.env['SNS_PEM_ENDPOINT']);
  return new MockPemClient();
}
