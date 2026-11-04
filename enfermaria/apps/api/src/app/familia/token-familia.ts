import { createHash, randomBytes } from 'crypto';

/**
 * S-15: o token do portal da família é uma credencial ao portador — quem o tem vê o estado
 * do doente, sem mais nenhuma verificação. Era um `cuid()`, que não é aleatório
 * criptográfico (leva carimbo temporal e contador), e ficava em claro na base de dados:
 * qualquer leitura da tabela dava entrada no portal de todas as famílias.
 *
 * Passa a ter 256 bits de `randomBytes`, e só se guarda o SHA-256. Com esta entropia o hash
 * simples chega — não há dicionário que o ataque, e o bcrypt não acrescentaria nada.
 *
 * Ficheiro sem dependências de propósito: o seed de utilizadores de teste emite acessos pela
 * mesma regra, sem arrastar o Nest nem o PrismaService.
 */
export function gerarTokenFamilia(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTokenFamilia(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
