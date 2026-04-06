'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../../../lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const [numeroFuncionario, setNumeroFuncionario] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(numeroFuncionario, password);
    } catch {
      setErro('Número de funcionário ou password incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo ── */}
      <div className="hidden lg:flex w-[46%] relative bg-[#0a0f1e] flex-col overflow-hidden">
        {/* Blobs decorativos */}
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-100px] right-[-60px] w-[350px] h-[350px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[80px]" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col h-full">

          {/* Logo — topo, com recuo */}
          <div className="flex items-center gap-3" style={{ paddingTop: '48px', paddingLeft: '64px' }}>
            <Image src="/logo.svg" alt="CuraSphere" width={40} height={40} />
            <span className="text-white font-bold text-lg tracking-tight">CuraSphere</span>
          </div>

          {/* Hero text — centro total */}
          <div className="flex-1 flex flex-col items-center justify-center px-16">
            <div className="w-full max-w-xs">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8 w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Sistema em tempo real</span>
              </div>

              <h1 className="text-[2.4rem] font-bold text-white leading-[1.2] mb-5">
                Gestão hospitalar<br />
                <span className="text-blue-400">sem papel.</span>
              </h1>

              <p className="text-slate-400 text-sm leading-relaxed mb-10">
                Passagens de turno, tarefas, medicação e doentes — tudo centralizado e acessível em segundos.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3" style={{ marginTop: '24px' }}>
                {[
                  { value: '100%', label: 'Digital' },
                  { value: '0', label: 'Papel' },
                  { value: '24/7', label: 'Disponível' },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 border border-white/8 rounded-2xl px-4 py-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-bold text-white">{s.value}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer — fundo com recuo */}
          <p className="text-slate-600 text-xs" style={{ paddingLeft: '64px', paddingBottom: '40px' }}>
            © {new Date().getFullYear()} CuraSphere · Gestão Hospitalar
          </p>
        </div>
      </div>

      {/* ── Painel direito ── */}
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc] px-16 xl:px-24">
        <div className="w-full max-w-[400px]">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <Image src="/logo.svg" alt="CuraSphere" width={32} height={32} />
            <span className="text-slate-800 font-bold">CuraSphere</span>
          </div>

          {/* Título */}
          <div style={{ marginBottom: '40px' }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo de volta</h2>
            <p className="text-slate-500 text-sm">Introduza as suas credenciais para continuar</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit}>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Número de Funcionário
              </label>
              <input
                type="text"
                value={numeroFuncionario}
                onChange={(e) => setNumeroFuncionario(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                placeholder="Ex: 00001"
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5" style={{ marginTop: '28px' }}>
              <label className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3" style={{ marginTop: '28px' }}>
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3.5 rounded-lg transition-all shadow-lg shadow-blue-500/25 text-base"
              style={{ marginTop: '36px' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A entrar...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400" style={{ marginTop: '28px' }}>
            Acesso restrito a profissionais autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
