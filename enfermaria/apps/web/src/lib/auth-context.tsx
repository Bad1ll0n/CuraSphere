'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  role: string;
}

interface AuthContextType {
  utilizador: Utilizador | null;
  loading: boolean;
  login: (numeroFuncionario: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('utilizador');
    const token = localStorage.getItem('token');
    if (stored && token) setUtilizador(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (numeroFuncionario: string, password: string) => {
    const { data } = await api.post('/auth/login', { numeroFuncionario, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('utilizador', JSON.stringify(data.utilizador));
    setUtilizador(data.utilizador);
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('utilizador');
    setUtilizador(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ utilizador, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
