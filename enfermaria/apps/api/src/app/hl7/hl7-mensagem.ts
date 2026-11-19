/**
 * PROD-14 — leitura e escrita de mensagens HL7 v2 (ADT e ORU), sem dependências.
 *
 * Numeração HL7: no MSH, o campo 1 é o próprio separador `|`, por isso MSH-n está na posição
 * n-1 da divisão por `|`; nos outros segmentos, XXX-n está na posição n. O parser anterior lia
 * o MSH com a numeração dos outros segmentos — o tipo de mensagem só aparecia em MSH-9 se a
 * mensagem trouxesse um campo vazio a mais, e mensagens HL7 reais eram ignoradas.
 */
export interface Segmento { id: string; campos: string[] }

export function lerMensagem(raw: string): Segmento[] {
  // MLLP usa \r; num corpo HTTP pode vir \n ou \r\n. Tira os delimitadores MLLP se vierem.
  const VT = String.fromCharCode(0x0b), FS = String.fromCharCode(0x1c);
  let limpo = raw.startsWith(VT) ? raw.slice(1) : raw;
  const fim = limpo.lastIndexOf(FS);
  if (fim >= 0 && limpo.slice(fim + 1).trim() === '') limpo = limpo.slice(0, fim);
  return limpo.replace(/\r\n/g, '\r').replace(/\n/g, '\r').split('\r').filter(Boolean)
    .map((linha) => { const campos = linha.split('|'); return { id: campos[0], campos }; });
}

/** Campo n (numeração HL7) do segmento. */
export function campo(seg: Segmento | undefined, n: number): string {
  if (!seg) return '';
  return seg.campos[seg.id === 'MSH' ? n - 1 : n] ?? '';
}

export const componente = (valor: string, i: number) => valor.split('^')[i] ?? '';
const repeticoes = (valor: string) => valor.split('~').filter(Boolean);

export interface IdentificacaoPid {
  /** Número de processo no HIS (CX tipo PI/MR) — a chave de emparelhamento. */
  identificadorHis: string | null;
  /** Número de utente do SNS (CX tipo NH/SS/SNS, ou autoridade SNS/RNU). */
  numeroSNS: string | null;
  nome: string | null;
  dataNascimento: Date | null;
  sexo: 'masculino' | 'feminino' | 'indeterminado' | null;
}

/** PID-3 (lista de identificadores), PID-5 (nome), PID-7 (nascimento), PID-8 (sexo). */
export function lerPid(pid: Segmento | undefined): IdentificacaoPid {
  let identificadorHis: string | null = null;
  let numeroSNS: string | null = null;
  for (const cx of repeticoes(campo(pid, 3))) {
    const id = componente(cx, 0).trim();
    const autoridade = componente(cx, 3).toUpperCase();
    const tipo = componente(cx, 4).toUpperCase();
    if (!id) continue;
    if (['NH', 'SS', 'SNS', 'NNPRT'].includes(tipo) || /SNS|RNU/.test(autoridade)) numeroSNS ??= id;
    else if (['PI', 'MR', 'PN', ''].includes(tipo)) identificadorHis ??= id;
  }
  const xpn = repeticoes(campo(pid, 5))[0] ?? '';
  const apelido = componente(xpn, 0).trim();
  const proprio = componente(xpn, 1).trim();
  const nome = [proprio, componente(xpn, 2).trim(), apelido].filter(Boolean).join(' ') || null;
  const dn = campo(pid, 7).slice(0, 8);
  const dataNascimento = /^\d{8}$/.test(dn) ? new Date(`${dn.slice(0, 4)}-${dn.slice(4, 6)}-${dn.slice(6, 8)}T00:00:00Z`) : null;
  const s = campo(pid, 8).toUpperCase();
  const sexo = s === 'M' ? 'masculino' : s === 'F' ? 'feminino' : s === 'U' || s === 'O' ? 'indeterminado' : null;
  return { identificadorHis, numeroSNS, nome, dataNascimento, sexo };
}

/** PV1-3 (localização: serviço^quarto^cama) e PV1-19 (número do episódio no HIS). */
export function lerPv1(pv1: Segmento | undefined) {
  const loc = campo(pv1, 3);
  return { servico: componente(loc, 0) || null, quarto: componente(loc, 1) || null, cama: componente(loc, 2) || null, episodioHis: componente(campo(pv1, 19), 0) || null };
}

const dataHl7 = (d: Date) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const esc = (v: string | null | undefined) => (v ?? '').replace(/[|^~\\&\r\n]/g, ' ');

/** ACK (MSA-1: AA aceite, AE erro, AR rejeitada) para a mensagem recebida. */
export function construirAck(segmentos: Segmento[], codigo: 'AA' | 'AE' | 'AR', texto = '', agora = new Date()): string {
  const msh = segmentos.find((s) => s.id === 'MSH');
  const controlo = campo(msh, 10);
  const versao = campo(msh, 12) || '2.5';
  return [
    `MSH|^~\\&|CURASPHERE|HOSPITAL|${esc(campo(msh, 3))}|${esc(campo(msh, 4))}|${dataHl7(agora)}||ACK^${esc(componente(campo(msh, 9), 1))}^ACK|ACK${esc(controlo)}|P|${esc(versao)}`,
    `MSA|${codigo}|${esc(controlo)}|${esc(texto).slice(0, 80)}`,
  ].join('\r');
}

/** ADT de saída (A01 admissão / A03 alta / A08 atualização) para o HIS. */
export function construirAdt(evento: 'A01' | 'A03' | 'A08', d: {
  controlo: string; identificadorHis: string | null; numeroProcesso: string; numeroSNS?: string | null;
  nome: string; dataNascimento: Date | null; sexo: string | null; servico?: string | null; quarto?: string | null; cama?: string | null; quando?: Date;
}, agora = new Date()): string {
  const ids = [
    d.identificadorHis ? `${esc(d.identificadorHis)}^^^HIS^PI` : null,
    `${esc(d.numeroProcesso)}^^^CURASPHERE^MR`,
    d.numeroSNS ? `${esc(d.numeroSNS)}^^^SNS^NH` : null,
  ].filter(Boolean).join('~');
  const partes = d.nome.trim().split(/\s+/);
  const apelido = partes.length > 1 ? partes.pop()! : '';
  const sexo = d.sexo === 'masculino' ? 'M' : d.sexo === 'feminino' ? 'F' : d.sexo ? 'U' : '';
  const dn = d.dataNascimento ? dataHl7(d.dataNascimento).slice(0, 8) : '';
  const quando = dataHl7(d.quando ?? agora);
  return [
    `MSH|^~\\&|CURASPHERE|HOSPITAL|HIS|HOSPITAL|${dataHl7(agora)}||ADT^${evento}^ADT_A01|${esc(d.controlo)}|P|2.5`,
    `EVN|${evento}|${quando}`,
    `PID|1||${ids}||${esc(apelido)}^${esc(partes.join(' '))}||${dn}|${sexo}`,
    segmentoPv1(`${esc(d.servico)}^${esc(d.quarto)}^${esc(d.cama)}`, evento === 'A01' ? quando : '', evento === 'A03' ? quando : ''),
  ].join('\r');
}

/** PV1 com PV1-2 (classe: I internado), PV1-3 (localização), PV1-44 (admissão) e PV1-45 (alta). */
function segmentoPv1(localizacao: string, admissao: string, alta: string): string {
  const c: string[] = Array(46).fill('');
  c[0] = 'PV1'; c[1] = '1'; c[2] = 'I'; c[3] = localizacao; c[44] = admissao; c[45] = alta;
  return c.join('|');
}
