/**
 * PERF-09 — seed de volume para os testes de carga (load/).
 *
 * O workflow `load.yml` chamava `node load/seed-volume.mjs`, que nunca existiu: o passo falhava e
 * a carga não corria (ou, corrida à mão, media o planeador do Postgres sobre tabelas vazias).
 * Isto enche a BD com um serviço representativo:
 *  - SEED_DOENTES doentes internados (omissão 500), cada um com cama e episódio, e nome cifrado
 *    com índice cego — passa pelo mesmo cliente com cifragem da API, por isso a pesquisa por nome
 *    custa o que custa em produção;
 *  - 12 sinais vitais por doente (um por cada 4 h nas últimas 48 h);
 *  - a escala do mês e os turnos de hoje, com 12 doentes atribuídos ao enfermeiro (00003) e ao
 *    médico (00002) de teste — a lista dos clínicos passa pelo filtro de atribuição, que é o
 *    caminho real (e o mais caro) da listagem.
 *
 * Idempotente: se já houver doentes de carga, não faz nada.
 * Executar (depois de seed-test-users):  cd apps/api && npx ts-node --transpile-only src/prisma/seed-volume.ts
 */
import './carregar-env'; // QA-27: antes de tudo — a cifragem lê a chave ao ser importada
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { criarClienteComEncriptacao } from '../app/prisma/encryption.middleware';
import { turnoActual } from '../app/doentes/listagem-doentes.service';
import { abrirEpisodiosEmFalta } from './episodios-seed';


const N = Math.max(1, Number(process.env['SEED_DOENTES'] ?? 500));
const SERVICO = 'Medicina Carga';
const PREFIXO = 'CARGA-';
const NOMES = ['Maria', 'José', 'Ana', 'João', 'Manuel', 'Rosa', 'António', 'Fernanda', 'Carlos', 'Isabel', 'Rui', 'Zulmira'];
const APELIDOS = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Gomes'];
const DIAGNOSTICOS = ['Pneumonia adquirida na comunidade', 'Insuficiência cardíaca descompensada', 'Celulite', 'DPOC agudizada', 'Pielonefrite', 'AVC isquémico'];

async function main() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const base = new PrismaClient({ adapter: new PrismaPg(pool) });
  const prisma: any = criarClienteComEncriptacao(base);

  const ja = await prisma.doente.count({ where: { numeroProcesso: { startsWith: PREFIXO } } });
  if (ja > 0) { console.log(`seed-volume: já existem ${ja} doentes de carga — nada a fazer`); await base.$disconnect(); await pool.end(); return; }

  const utilizador = async (num: string) => {
    const u = await base.utilizador.findFirst({ where: { numeroFuncionario: num }, select: { id: true } });
    if (!u) throw new Error(`seed-volume: falta o utilizador ${num} — correr seed-test-users primeiro`);
    return u.id;
  };
  const [admin, enfermeiro, medico] = await Promise.all([utilizador('00007'), utilizador('00003'), utilizador('00002')]);

  const camas = Array.from({ length: N }, (_, i) => ({
    id: randomUUID(), numero: `${PREFIXO}${String(i + 1).padStart(4, '0')}`, quarto: `C${Math.floor(i / 4) + 1}`, servico: SERVICO, estado: 'ocupada' as any,
  }));
  await base.cama.createMany({ data: camas });

  const agora = Date.now();
  const doentes = camas.map((c, i) => ({
    id: randomUUID(),
    nome: `${NOMES[i % NOMES.length]} ${APELIDOS[(i * 7) % APELIDOS.length]} ${APELIDOS[(i * 3 + 1) % APELIDOS.length]} ${i + 1}`,
    numeroProcesso: `${PREFIXO}${String(i + 1).padStart(6, '0')}`,
    dataNascimento: new Date(1930 + (i % 70), i % 12, 1 + (i % 28)),
    diagnosticoPrincipal: DIAGNOSTICOS[i % DIAGNOSTICOS.length],
    estadoRegisto: 'internado' as any,
    camaId: c.id,
    administrativoAdmissaoId: admin,
    dataAdmissao: new Date(agora - (i % 10) * 24 * 3600_000),
  }));
  // createMany pelo cliente com cifragem: o nome vai cifrado e com o índice cego (nomeBusca).
  for (let i = 0; i < doentes.length; i += 200) await prisma.doente.createMany({ data: doentes.slice(i, i + 200) });
  await abrirEpisodiosEmFalta(base);

  const vitais = doentes.flatMap((d, i) => Array.from({ length: 12 }, (_, k) => ({
    doenteId: d.id, registadoPorId: enfermeiro, data: new Date(agora - k * 4 * 3600_000),
    pressaoSistolica: 105 + ((i + k) % 50), pressaoDiastolica: 60 + ((i * 3 + k) % 30), pulso: 65 + ((i + 2 * k) % 45),
    temperatura: 36.4 + ((i + k) % 20) / 10, saturacaoO2: 91 + ((i + k) % 9), frequenciaRespiratoria: 14 + ((i + k) % 10),
    avpu: 'A', o2Suplementar: false,
  })));
  for (let i = 0; i < vitais.length; i += 2000) await base.sinalVital.createMany({ data: vitais.slice(i, i + 2000) });

  // Turnos de hoje (manhã, tarde, noite) e da noite anterior, com atribuições aos clínicos de teste.
  const hoje = new Date();
  const escala = await base.escala.upsert({
    where: { mes_ano_servico: { mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), servico: SERVICO } },
    update: {},
    create: { mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), servico: SERVICO, criadaPorId: admin },
  });
  const atribuidos = doentes.slice(0, 12);
  for (const hora of [10, 17, 23, 2]) {
    const t = turnoActual(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), hora));
    const turno = await base.horarioTurno.create({ data: { tipo: t.tipo, data: t.data.gte, escalId: escala.id } });
    await base.atribuicaoHorarioTurno.createMany({
      data: atribuidos.flatMap((d) => [enfermeiro, medico].map((u) => ({ horarioTurnoId: turno.id, doenteId: d.id, utilizadorId: u, atribuidoPorId: admin }))),
    });
  }

  console.log(`seed-volume: ${N} doentes, ${vitais.length} sinais vitais, 12 atribuídos por turno a 00003/00002`);
  await base.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
