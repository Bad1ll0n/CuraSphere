'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Utilizador } from '@org/shared';
import api from './api';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

interface LoginResult {
  mfaPendente: boolean;
  mfaChallengeToken?: string;
  mfaSetupObrigatorio?: boolean;
  mfaSetupToken?: string;
  passwordExpirada?: boolean;
  passwordExpiredToken?: string;
}

interface AuthContextType {
  utilizador: Utilizador | null;
  loading: boolean;
  login: (numeroFuncionario: string, password: string) => Promise<LoginResult>;
  loginMfa: (mfaChallengeToken: string, code: string) => Promise<void>;
  loginPasskey: (numeroFuncionario?: string) => Promise<void>;
  registerPasskey: (nome?: string) => Promise<void>;
  logout: () => void;
  passwordAviso: { ativo: boolean; diasRestantes: number | null };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordAviso, setPasswordAviso] = useState<{ ativo: boolean; diasRestantes: number | null }>({ ativo: false, diasRestantes: null });
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => setUtilizador(data))
      .catch(() => setUtilizador(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!utilizador) return;
    api.get('/auth/password-status')
      .then(({ data }) => { if (data.aviso) setPasswordAviso({ ativo: true, diasRestantes: data.diasRestantes }); })
      .catch(() => {});
  }, [utilizador?.id]);

  const login = async (numeroFuncionario: string, password: string): Promise<LoginResult> => {
    const { data } = await api.post('/auth/login', { numeroFuncionario, password });
    if (data.mfaPendente) {
      return { mfaPendente: true, mfaChallengeToken: data.mfaChallengeToken };
    }
    if (data.mfaSetupObrigatorio) {
      return { mfaPendente: false, mfaSetupObrigatorio: true, mfaSetupToken: data.mfaSetupToken };
    }
    if (data.passwordExpirada) {
      return { mfaPendente: false, passwordExpirada: true, passwordExpiredToken: data.passwordExpiredToken };
    }
    setUtilizador(data.utilizador);
    if (data.passwordExpiradoAviso) {
      setPasswordAviso({ ativo: true, diasRestantes: data.diasRestantesSenha });
    }
    router.push('/');
    return { mfaPendente: false };
  };

  const loginMfa = async (mfaChallengeToken: string, code: string) => {
    const { data } = await api.post('/auth/mfa/verificar', { mfaChallengeToken, code });
    setUtilizador(data.utilizador);
    router.push('/');
  };

  const loginPasskey = async (numeroFuncionario?: string) => {
    const { data: options } = await api.post('/auth/webauthn/auth/options', { numeroFuncionario });
    const response = await startAuthentication({ optionsJSON: options });
    const { data } = await api.post('/auth/webauthn/auth/verify', { numeroFuncionario, response });
    setUtilizador(data.utilizador);
    router.push('/');
  };

  const registerPasskey = async (nome?: string) => {
    const { data: options } = await api.get('/auth/webauthn/register/options');
    const response = await startRegistration({ optionsJSON: options });
    await api.post('/auth/webauthn/register/verify', { response, nome: nome ?? 'Passkey' });
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    sessionStorage.removeItem('mfaSetupToken');
    sessionStorage.removeItem('pwdExpiredToken');
    queryClient.clear();
    setUtilizador(null);
    setPasswordAviso({ ativo: false, diasRestantes: null });
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ utilizador, loading, login, loginMfa, loginPasskey, registerPasskey, logout, passwordAviso }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
