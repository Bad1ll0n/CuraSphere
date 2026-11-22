/**
 * UX-26 — letras das senhas do quiosque, numa só fonte (api e web).
 *
 * Eram "R" para a Farmácia (porque o F era da Faturação) e "G" para Informações: ninguém as
 * adivinha ao ouvir a chamada. Agora: F = Farmácia, I = Informações, P = Pagamentos (faturação).
 * A numeração conta por tipo e por dia, por isso mudar a letra não repete números.
 */
export const LETRA_SENHA: Record<string, string> = {
  admissao: 'A',
  consulta: 'C',
  faturacao: 'P',
  farmacia: 'F',
  exames: 'E',
  urgencia: 'U',
  geral: 'I',
};

/** Texto para anunciar uma chamada por voz: "Senha F 12, balcão 3." */
export function textoChamadaSenha(numero: string, balcao?: string | null, idioma: 'pt' | 'en' = 'pt'): string {
  const m = /^([A-Z])-?0*(\d+)$/i.exec(numero.trim());
  const senha = m ? `${m[1].toUpperCase()} ${Number(m[2])}` : numero;
  if (idioma === 'en') return `Ticket ${senha}${balcao ? `, desk ${balcao}` : ''}.`;
  return `Senha ${senha}${balcao ? `, balcão ${balcao}` : ''}.`;
}
