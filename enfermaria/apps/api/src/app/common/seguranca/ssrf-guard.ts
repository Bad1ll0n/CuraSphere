import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * Verifica se um endereço IP (v4 ou v6, já resolvido, sem colchetes) pertence
 * a um intervalo privado, loopback, link-local ou reservado — usado para
 * bloquear pedidos SSRF (ex.: metadata da cloud, Redis local, rede interna do
 * hospital) feitos a partir de destinos configuráveis por utilizadores
 * (webhooks, integrações externas).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const partes = ip.split('.').map(Number);
    const [a, b] = partes;
    if (partes.some((n) => Number.isNaN(n))) return true;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmarking)
    if (a >= 224) return true; // 224.0.0.0/4 multicast e 240.0.0.0/4 reservado (inclui 255.255.255.255)
    return false;
  }

  if (version === 6) {
    // SEC-10: o parser de URL normaliza `[::ffff:127.0.0.1]` para `[::ffff:7f00:1]` (hexadecimal),
    // e a verificação antiga só reconhecia a forma com pontos — o loopback passava. Expande-se o
    // endereço para os 8 grupos e decide-se pelos bits, não pela forma escrita.
    const g = expandirIpv6(ip);
    if (!g) return true;
    const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
    const v4 = (alto: number, baixo: number) => `${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`;
    if (g.every((x) => x === 0)) return true; // :: (unspecified)
    if (g.slice(0, 7).every((x) => x === 0) && g7 === 1) return true; // ::1 (loopback)
    if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return isPrivateOrReservedIp(v4(g6, g7)); // ::ffff:a.b.c.d (IPv4-mapped)
    if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPrivateOrReservedIp(v4(g6, g7)); // ::a.b.c.d (IPv4-compatible, obsoleto)
    if (g0 === 0x64 && g1 === 0xff9b) return isPrivateOrReservedIp(v4(g6, g7)); // 64:ff9b::/96 (NAT64)
    if (g0 === 0x2002) return isPrivateOrReservedIp(v4(g1, g2)); // 2002::/16 (6to4: o IPv4 está nos bits 16–47)
    if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
    if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 (unique local)
    if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
    if (g0 === 0x2001 && g1 === 0x0db8) return true; // 2001:db8::/32 (documentação)
    return false;
  }

  // Não é um literal IP válido (ex.: falha de resolução) — trata como não seguro
  return true;
}

/** Expande um IPv6 (com ou sem IPv4 embebido no fim) para 8 grupos de 16 bits; null se inválido. */
function expandirIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0];
  const ipv4 = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b, c, d] = ipv4.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    s = s.slice(0, ipv4.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const partes = s.split('::');
  if (partes.length > 2) return null;
  const esq = partes[0] ? partes[0].split(':') : [];
  const dir = partes.length === 2 && partes[1] ? partes[1].split(':') : [];
  const falta = 8 - esq.length - dir.length;
  if (partes.length === 1 ? esq.length !== 8 : falta < 1) return null;
  const grupos = [...esq, ...Array(partes.length === 2 ? falta : 0).fill('0'), ...dir].map((h) => parseInt(h, 16));
  return grupos.length === 8 && grupos.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? grupos : null;
}

/**
 * SEC-10: opções para TODO o fetch com destino configurado por um utilizador. Sem seguir
 * redireccionamentos — um destino público que responde 302 para http://169.254.169.254/ levava o
 * pedido (e os cabeçalhos de autenticação) para dentro, depois de a validação já ter passado.
 */
export const SEM_REDIRECCIONAMENTOS = { redirect: 'manual' as const };

/** Um 3xx num pedido com `redirect: 'manual'` é tratado como falha — não se segue. */
export function exigirSemRedireccionamento(res: { status: number; type?: string }): void {
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
    throw new BadRequestException('O destino respondeu com um redireccionamento — não é seguido por segurança.');
  }
}

function semColchetes(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * Valida que um URL fornecido por um utilizador (webhook, integração, etc.)
 * não aponta — direta ou indiretamente via DNS — para um endereço interno.
 * Deve ser chamado tanto na criação (validação preventiva) como, de forma
 * crítica, em cada utilização/dispatch, porque a resolução DNS de um hostname
 * pode mudar entre o registo e o disparo (DNS rebinding).
 *
 * Lança BadRequestException se o destino não for seguro.
 */
export async function assertUrlDestinoPublico(urlStr: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new BadRequestException('URL inválido');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Apenas são permitidos URLs http/https');
  }

  const hostname = semColchetes(url.hostname);

  if (hostname.toLowerCase() === 'localhost') {
    throw new BadRequestException('Destino não permitido: aponta para um endereço interno');
  }

  const literalVersion = isIP(hostname);
  if (literalVersion) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new BadRequestException('Destino não permitido: aponta para um endereço interno');
    }
    return;
  }

  let enderecos: { address: string; family: number }[];
  try {
    enderecos = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestException('Não foi possível resolver o destino do URL');
  }

  if (!enderecos.length) {
    throw new BadRequestException('Não foi possível resolver o destino do URL');
  }

  for (const { address } of enderecos) {
    if (isPrivateOrReservedIp(address)) {
      throw new BadRequestException('Destino não permitido: aponta para um endereço interno');
    }
  }
}
