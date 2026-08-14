'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Guarda de rota (camada 2 do controlo de acessos).
 *
 * Renderiza os filhos apenas se o papel — ou sub-papel — do utilizador constar em `allow`.
 * Caso contrário, redireciona para `redirectTo`. Espelha a lógica do RolesGuard do backend
 * (papel OU sub-papel) e complementa o filtro da barra lateral: esconder o menu não impede
 * a navegação direta pelo URL; esta guarda impede.
 */
export function RoleGuard({
  allow,
  children,
  redirectTo = '/dashboard',
}: {
  allow: string[];
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { utilizador, loading } = useAuth();
  const router = useRouter();

  const permitido =
    !!utilizador &&
    (allow.includes(utilizador.role) ||
      (!!utilizador.subRole && allow.includes(utilizador.subRole)));

  useEffect(() => {
    if (!loading && utilizador && !permitido) router.replace(redirectTo);
  }, [loading, utilizador, permitido, redirectTo, router]);

  if (loading || !utilizador || !permitido) return null;
  return <>{children}</>;
}
