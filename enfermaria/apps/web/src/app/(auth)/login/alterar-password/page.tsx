'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui';

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
    if ([...novaPassword].length < 12) { setErro('Mínimo 12 caracteres (uma frase curta serve).'); return; } // SEC-25
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
        <p className="text-slate-500 text-sm mb-6">
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
          <Button variant="primary" fullWidth
            type="submit"
            disabled={loading || !novaPassword || !confirmar}
          >
            {loading ? 'A alterar...' : 'Alterar Password'}
          </Button>
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
