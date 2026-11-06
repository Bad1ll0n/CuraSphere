/**
 * OPS-06 — healthcheck do contentor web. Antes era `wget http://localhost:3000`, que renderizava
 * a página inicial completa a cada 30 s. Isto só confirma que o servidor Next responde.
 * Fora do middleware (o matcher exclui /api), por isso não exige sessão.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
