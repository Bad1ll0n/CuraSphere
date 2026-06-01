'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function AlterarPasswordExpiradaPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [novaPassword, setNovaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = sessionStorage.getItem('passwordExpiredToken');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaPassword !== confirmar) { setErro('As passwords não coincidem.'); return; }
    if (novaPassword.length < 8) { setErro('Mínimo 8 caracteres.'); return; }
    setErro('');
    setLoading(true);
    try {
      await api.patch(
        '/auth/alterar-password',
        { passwordAtual: '', novaPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      sessionStorage.removeItem('passwordExpiredToken');
      router.push('/login?mensagem=Password alterada com sucesso');
    } catch {
      setErro('Não foi possível alterar a password. Contacte o administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold mb-2">Password Expirada</h1>
        <p className="text-slate-400 text-sm mb-6">
          A sua password expirou. Por favor defina uma nova password para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={novaPassword}
            onChange={(e) => setNovaPassword(e.target.value)}
            placeholder="Nova password"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Confirmar password"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={loading || !novaPassword || !confirmar}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 font-medium transition-colors"
          >
            {loading ? 'A alterar...' : 'Alterar Password'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full text-sm text-slate-500 hover:text-slate-400 transition mt-4"
        >
          ← Voltar ao login
        </button>
      </div>
    </div>
  );
}
