/**
 * Seed fixture para testes Playwright.
 * Usa chamadas HTTP à API para criar dados mínimos necessários.
 * Correr antes dos testes E2E: ts-node apps/web-e2e/fixtures/seed.ts
 */
import axios, { AxiosInstance } from 'axios';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3333';
const TEST_USER = process.env['TEST_USER'] ?? '00001';
const TEST_PASSWORD = process.env['TEST_PASSWORD'] ?? 'Admin1234!';

async function getToken(api: AxiosInstance): Promise<string> {
  const { data } = await api.post('/v1/auth/login', {
    numeroFuncionario: TEST_USER,
    password: TEST_PASSWORD,
  });
  return data.accessToken;
}

export async function seedTestData() {
  const api = axios.create({ baseURL: BASE });

  let token: string;
  try {
    token = await getToken(api);
  } catch {
    console.warn('[seed] Não foi possível autenticar — verificar que a API está a correr em', BASE);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Verificar se já existem doentes
  let doenteId: string | null = null;
  try {
    const { data } = await api.get('/v1/doentes?pagina=1&limite=1', { headers });
    const lista = data?.data ?? data ?? [];
    if (lista.length > 0) {
      doenteId = lista[0].id;
      console.log('[seed] Doente existente:', doenteId);
    }
  } catch { /* ignorar */ }

  // Verificar se já existe médico
  let medicoId: string | null = null;
  try {
    const { data } = await api.get('/v1/utilizadores?role=medico&pagina=1&limite=1', { headers });
    const lista = data?.data ?? data ?? [];
    if (lista.length > 0) {
      medicoId = lista[0].id;
      console.log('[seed] Médico existente:', medicoId);
    }
  } catch { /* ignorar */ }

  // Criar consulta teleconsulta para testes de vídeo (se tiver doente e médico)
  if (doenteId && medicoId) {
    try {
      const dataAmanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await api.post('/v1/consultas', {
        doenteId,
        medicoId,
        especialidade: 'clinico_geral',
        dataHora: dataAmanha,
        duracao: 30,
        tipo: 'teleconsulta',
        notas: '[SEED] Teleconsulta de teste E2E',
      }, { headers });
      console.log('[seed] Teleconsulta criada para testes E2E');
    } catch (err: any) {
      console.warn('[seed] Não criou teleconsulta:', err?.response?.data?.message ?? err?.message);
    }
  }

  console.log('[seed] Seed concluído.');
}

// Executar directamente: ts-node fixtures/seed.ts
if (require.main === module) {
  seedTestData().catch(console.error);
}
