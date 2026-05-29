'use client';

import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onAlterarPassword: () => void;
}

export function ModalConfiguracoes({ onClose, onAlterarPassword }: Props) {
  const [tema, setTema] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('curasphere-theme') as 'light' | 'dark' | null;
    if (saved) setTema(saved);
  }, []);

  const aplicarTema = (t: 'light' | 'dark') => {
    setTema(t);
    localStorage.setItem('curasphere-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="modal-config-titulo"
        className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '28px', margin: '0 16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-config-titulo" className="text-lg font-bold text-slate-900">Configurações</h2>
          <button onClick={onClose} aria-label="Fechar configurações" className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
        </div>

        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Tema</p>
        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '28px' }}>
          <button
            onClick={() => aplicarTema('light')}
            className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'light' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
            style={{ padding: '16px 12px' }}
          >
            <svg className={`w-6 h-6 ${tema === 'light' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
            <span className={`text-sm font-semibold ${tema === 'light' ? 'text-blue-600' : 'text-slate-500'}`}>Claro</span>
          </button>
          <button
            onClick={() => aplicarTema('dark')}
            className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
            style={{ padding: '16px 12px' }}
          >
            <svg className={`w-6 h-6 ${tema === 'dark' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span className={`text-sm font-semibold ${tema === 'dark' ? 'text-blue-600' : 'text-slate-500'}`}>Escuro</span>
          </button>
        </div>

        <div className="border-t border-slate-100" style={{ paddingTop: '20px' }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Conta</p>
          <button
            onClick={() => { onClose(); onAlterarPassword(); }}
            className="w-full flex items-center gap-3 text-sm text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            style={{ padding: '10px 14px' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Alterar Password
            <svg className="w-4 h-4 ml-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
