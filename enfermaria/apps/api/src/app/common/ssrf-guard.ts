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
    return false;
  }

  if (version === 6) {
    const n = ip.toLowerCase();
    if (n === '::1' || n === '::') return true; // loopback / unspecified
    if (/^fe[89ab][0-9a-f]:/.test(n)) return true; // fe80::/10 (link-local)
    if (/^f[cd][0-9a-f]{2}:/.test(n)) return true; // fc00::/7 (unique local)
    const mapeado = n.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return isPrivateOrReservedIp(mapeado[1]); // IPv4-mapped IPv6
    return false;
  }

  // Não é um literal IP válido (ex.: falha de resolução) — trata como não seguro
  return true;
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
