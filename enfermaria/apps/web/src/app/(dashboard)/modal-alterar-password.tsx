'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface Props {
  onClose: () => void;
}

export function ModalAlterarPassword({ onClose }: Props) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const alterar = async () => {
    if (novaSenha !== confirmarSenha) { setErro('As passwords não coincidem'); return; }
    if (novaSenha.length < 6) { setErro('A nova password deve ter pelo menos 6 caracteres'); return; }
    setSalvando(true); setErro('');
    try {
      await api.patch('/auth/alterar-password', { passwordAtual: senhaAtual, novaPassword: novaSenha });
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setSucesso(true);
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao alterar password');
    } finally { setSalvando(false); }
  };

  const fechar = () => { setSucesso(false); onClose(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onKeyDown={e => { if (e.key === 'Escape') fechar(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="modal-pwd-titulo"
        className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-pwd-titulo" className="text-lg font-bold text-slate-900">Alterar Password</h2>
          <button onClick={fechar} aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        {sucesso ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center" style={{ padding: '16px', marginBottom: '16px' }}>
              Password alterada com sucesso!
            </div>
            <button onClick={fechar}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '11px' }}>Fechar</button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="pwd-atual" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Password Atual</label>
              <input id="pwd-atual" type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="pwd-nova" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nova Password</label>
              <input id="pwd-nova" type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="pwd-confirmar" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Confirmar Nova Password</label>
              <input id="pwd-confirmar" type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                aria-describedby={erro ? 'pwd-erro' : undefined}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            {erro && <p id="pwd-erro" role="alert" className="text-red-600 text-sm" style={{ marginBottom: '12px' }}>{erro}</p>}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={fechar}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={alterar} disabled={salvando || !senhaAtual || !novaSenha || !confirmarSenha}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
