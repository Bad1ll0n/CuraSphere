import { BlockList, isIPv4, isIPv6 } from 'net';

/**
 * SEC-22 — lista de origens permitidas (IPs e redes CIDR, IPv4 e IPv6) para integrações máquina a
 * máquina, como o motor HL7 do hospital. Antes, quem tivesse o token HL7 criava doentes e
 * resultados de qualquer sítio; agora o pedido também tem de vir de uma origem conhecida.
 *
 * Formato: "10.20.0.5, 10.30.0.0/16, fd00::/8". O IP é o `req.ip` (com o `trust proxy`, o do
 * cliente real e não o do nginx). Endereços IPv4 mapeados em IPv6 (`::ffff:10.20.0.5`) contam
 * como o IPv4 — é o mesmo cuidado do guard de SSRF (SEC-10).
 */
export class OrigensPermitidas {
  private readonly lista = new BlockList();
  readonly vazia: boolean;

  constructor(texto: string | undefined) {
    const entradas = (texto ?? '').split(',').map((e) => e.trim()).filter(Boolean);
    for (const e of entradas) {
      const [ip, prefixo] = e.split('/');
      const tipo = isIPv4(ip) ? 'ipv4' : isIPv6(ip) ? 'ipv6' : null;
      if (!tipo) throw new Error(`Origem inválida: "${e}" (esperado IP ou rede CIDR)`);
      if (prefixo === undefined) this.lista.addAddress(ip, tipo);
      else {
        const n = Number(prefixo);
        if (!Number.isInteger(n) || n < 0 || n > (tipo === 'ipv4' ? 32 : 128)) throw new Error(`Prefixo inválido em "${e}"`);
        this.lista.addSubnet(ip, n, tipo);
      }
    }
    this.vazia = entradas.length === 0;
  }

  permite(ip: string | undefined): boolean {
    if (!ip) return false;
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    const alvo = mapeado ? mapeado[1] : ip;
    if (isIPv4(alvo)) return this.lista.check(alvo, 'ipv4');
    if (isIPv6(alvo)) return this.lista.check(alvo, 'ipv6');
    return false;
  }
}

/** Valida o formato (para a configuração): devolve a mensagem de erro, ou `null`. */
export function erroOrigens(texto: string | undefined): string | null {
  try { new OrigensPermitidas(texto); return null; } catch (e) { return (e as Error).message; }
}
