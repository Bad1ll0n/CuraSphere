/**
 * Verifica se um utilizador tem um dos papéis pedidos, considerando papel base E sub-papel.
 *
 * Espelha a semântica do RolesGuard: um sub-papel de liderança (ex.: 'chefe_enfermeiros',
 * cujo utilizador tem role='enfermeiro') conta como se fosse esse papel para efeitos de
 * autorização. Usar este helper em verificações inline em vez de `roles.includes(user.role)`,
 * que ignora silenciosamente o sub-papel e bloqueia a chefia.
 */
export function temPapel(
  user: { role?: string | null; subRole?: string | null } | null | undefined,
  papeis: readonly string[],
): boolean {
  if (!user) return false;
  if (user.role && papeis.includes(user.role)) return true;
  if (user.subRole && papeis.includes(user.subRole)) return true;
  return false;
}
