import { hash as bcryptHash, verify as bcryptVerify } from '@node-rs/bcrypt';

// Hashing de passwords com bcrypt executado em THREADS (implementação napi/Rust) — não bloqueia o
// event loop e paraleliza pelos núcleos do CPU. Substitui o `bcryptjs` (JS puro, 1 núcleo) que
// serializava as rajadas de login (ex.: troca de turno → dezenas de logins em simultâneo): ~9x mais
// rápido em concorrência. Os hashes são compatíveis com os do bcrypt existentes na BD ($2a/$2b),
// por isso NÃO há migração de passwords nem risco de lockout.
//
// Afinação: o número de threads paralelas segue UV_THREADPOOL_SIZE (ver .env.example) — em produção,
// definir ~= nº de núcleos disponíveis.

/** Gera o hash bcrypt de uma password (custo por omissão 12). */
export function hashPassword(password: string, cost = 12): Promise<string> {
  return bcryptHash(password, cost);
}

/** Verifica uma password contra um hash bcrypt ($2a/$2b). */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptVerify(password, hash);
}
