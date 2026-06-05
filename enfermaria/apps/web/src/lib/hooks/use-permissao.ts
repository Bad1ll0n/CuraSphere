'use client';
import { useAuth } from '@/lib/auth-context';

export function usePermissao() {
  const { utilizador } = useAuth();

  const temPermissao = (roles: string | string[]) => {
    const lista = Array.isArray(roles) ? roles : [roles];
    return lista.includes(utilizador?.role ?? '');
  };

  const temSubRole = (sub: string) => utilizador?.subRole === sub;

  return { temPermissao, temSubRole, role: utilizador?.role, subRole: utilizador?.subRole };
}
