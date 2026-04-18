'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';

interface Registo {
  id: string;
  administradoEm: string;
  administradoPor: { nome: string };
  observacoes?: string;
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  estadoValidacao?: string;
  doente: { id: string; nome: string; cama: { numero: string; quarto: string } };
  prescritoPor: { nome: string };
  registos: Registo[];
}

const viaCor: Record<string, string> = {
  oral: 'bg-blue-50 text-blue-700',
  ev: 'bg-purple-50 text-purple-700',
  im: 'bg-orange-50 text-orange-700',
  sc: 'bg-teal-50 text-teal-700',
  sl: 'bg-green-50 text-green-700',
  topica: 'bg-yellow-50 text-yellow-700',
  inalatoria: 'bg-sky-50 text-sky-700',
};

const validacaoCor: Record<string, string> = {
  aprovada: 'text-green-600',
  rejeitada: 'text-red-500',
};

export default function MarPage() {
  const [medicacoes, setMedicacoes] = useState<Medicacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [administrando, setAdministrando] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [modalId, setModalId] = useState<string | null>(null);

  const carregar = () => {
    setLoading(true);
    api.get('/medicacao/mar')
      .then((r) => setMedicacoes(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const administrar = async () => {
    if (!modalId) return;
    setAdministrando(modalId);
    try {
      await api.post(`/medicacao/${modalId}/administrar`, { observacoes: obs });
      setModalId(null);
      setObs('');
      carregar();
    } finally { setAdministrando(null); }
  };

  // Agrupar por doente
  const porDoente = medicacoes.reduce<Record<string, { doente: Medicacao['doente']; meds: Medicacao[] }>>((acc, m) => {
    const did = m.doente.id;
    if (!acc[did]) acc[did] = { doente: m.doente, meds: [] };
    acc[did].meds.push(m);
    return acc;
  }, {});

  const horaAtual = new Date().getHours();
  const turnoLabel = horaAtual >= 8 && horaAtual < 16 ? 'Manhã (08:00–16:00)'
    : horaAtual >= 16 && horaAtual < 23 ? 'Tarde (16:00–23:00)' : 'Noite (23:00–08:00)';

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">MAR — Registo de Administração</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Turno atual: {turnoLabel}</p>
        </div>
        <button onClick={carregar} className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2" style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar MAR...</span>
        </div>
      ) : Object.keys(porDoente).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium" style={{ marginBottom: '4px' }}>Sem medicações para este turno</p>
          <p className="text-slate-400 text-sm">Não tens doentes atribuídos com medicações ativas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.values(porDoente).map(({ doente, meds }) => (
            <div key={doente.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{doente.cama.numero}</span>
                </div>
                <div>
                  <Link href={`/doentes/${doente.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {doente.nome}
                  </Link>
                  <p className="text-xs text-slate-400">Quarto {doente.cama.quarto} · Cama {doente.cama.numero}</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">{meds.length} medicação{meds.length !== 1 ? 'ões' : ''}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {meds.map((m) => {
                  const ultimaAdmin = m.registos[0];
                  const validacao = m.estadoValidacao;
                  return (
                    <div key={m.id} className="flex items-center gap-4" style={{ padding: '14px 24px' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{m.nome}</span>
                          <span className="text-xs text-slate-500">{m.dose}</span>
                          <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${viaCor[m.via] ?? 'bg-slate-100 text-slate-600'}`}>{m.via.toUpperCase()}</span>
                          {validacao && (
                            <span className={`text-xs font-medium ${validacaoCor[validacao] ?? 'text-slate-400'}`}>
                              {validacao === 'aprovada' ? '✓ Validada' : '✗ Rejeitada'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-400">{m.frequencia}</span>
                          {ultimaAdmin && (
                            <span className="text-xs text-slate-400">
                              Última: {new Date(ultimaAdmin.administradoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} por {ultimaAdmin.administradoPor.nome}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setModalId(m.id); setObs(''); }}
                        disabled={validacao === 'rejeitada'}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ padding: '8px 16px' }}>
                        Administrar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar administração */}
      {modalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '8px' }}>Confirmar Administração</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>
              {medicacoes.find((m) => m.id === modalId)?.nome} — {medicacoes.find((m) => m.id === modalId)?.dose}
            </p>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
              Observações (opcional)
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Administrado com alimento, doente com dificuldade..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '20px' }}
              rows={3}
            />
            <div className="flex gap-3">
              <button onClick={() => setModalId(null)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={administrar} disabled={!!administrando}
                className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}>
                {administrando ? 'A registar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
