// S-15: migra os tokens do portal da família para hash, sem invalidar os links já enviados.
//
// O token era guardado em claro, por isso o hash de cada um pode ser calculado aqui: quem já
// tem um link continua a entrar até ao fim da validade (no máximo 7 dias). A partir daí só
// existem tokens novos, de 256 bits.
//
// Ordem, em qualquer ambiente:
//   1. node --env-file=.env scripts/migrar-tokens-familia.mjs             (ensaio: só conta)
//   2. node --env-file=.env scripts/migrar-tokens-familia.mjs --aplicar
//   3. prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
//      (ler o SQL: deve apenas remover "accessToken" e tornar "accessTokenHash" obrigatório)
//   4. prisma db push
//
// Correr o passo 4 sem os passos 1-2 apaga os tokens existentes: as famílias com um link
// activo deixam de entrar e é preciso criar-lhes um acesso novo.
//
// Idempotente: pode correr mais do que uma vez.
import pg from 'pg';

const aplicar = process.argv.includes('--aplicar');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const colunas = (
    await pool.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'acessos_familiares'`,
    )
  ).rows.map((r) => r.column_name);

  const temAntiga = colunas.includes('accessToken');
  const temHash = colunas.includes('accessTokenHash');

  if (!temAntiga) {
    console.log('Nada a fazer: a coluna "accessToken" já não existe.');
  } else {
    const {
      rows: [{ total, pormigrar }],
    } = await pool.query(
      `select count(*)::int as total,
              count(*) filter (where "accessToken" is not null
                               ${temHash ? 'and "accessTokenHash" is null' : ''})::int as pormigrar
         from acessos_familiares`,
    );
    console.log(`acessos_familiares: ${total} registos, ${pormigrar} por migrar.`);

    if (!aplicar) {
      console.log('Ensaio: nada foi escrito. Correr com --aplicar para migrar.');
    } else {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        await cliente.query('alter table acessos_familiares add column if not exists "accessTokenHash" text');
        // sha256() do Postgres sobre os bytes UTF-8 dá o mesmo hex que createHash('sha256') no
        // Node — verificado contra o Postgres 17 antes de escrever este script.
        const { rowCount } = await cliente.query(
          `update acessos_familiares
              set "accessTokenHash" = encode(sha256(convert_to("accessToken", 'UTF8')), 'hex')
            where "accessToken" is not null and "accessTokenHash" is null`,
        );
        await cliente.query('commit');
        console.log(`Migrados ${rowCount} registos. Seguinte: ler o SQL do migrate diff e fazer db push.`);
      } catch (err) {
        await cliente.query('rollback');
        throw err;
      } finally {
        cliente.release();
      }
    }
  }
} finally {
  await pool.end();
}
