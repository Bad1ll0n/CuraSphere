'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface SessaoFisioterapia {
  id: string;
  data: string;
  duracao: number;
  descricao: string;
  evolucao?: string;
  estado: string;
  doente: { id: string; nome: string };
  fisioterapeuta: { id: string; nome: string };
  plano?: { id: string; objetivos: string };
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  agendada:   { label: 'Agendada',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  realizada:  { label: 'Realizada',  bg: 'bg-green-50',  text: 'text-green-700' },
  cancelada:  { label: 'Cancelada',  bg: 'bg-slate-100', text: 'text-slate-600' },
  faltou:     { label: 'Faltou',     bg: 'bg-red-50',    text: 'text-red-700' },
};

export default function FisioterapiaPage() {
  useAuth();
  const [sessoes, setSessoes] = useState<SessaoFisioterapia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ doenteId: '', data: '', duracao: 45, descricao: '', planoId: '' });
  const [salvando, setSalvando] = useState(false);
  const [realizarModal, setRealizarModal] = useState<SessaoFisioterapia | null>(null);
  const [evolucao, setEvolucao] = useState('');

  const carregar = async () => {
    try {
      const { data } = await api.get('/fisioterapia/agenda');
      setSessoes(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const filtradas = sessoes.filter(s => s.data.startsWith(dataFiltro));

  const agendarSessao = async () => {
    if (!form.doenteId.trim() || !form.data || !form.descricao.trim()) return;
    setSalvando(true);
    try {
      await api.post('/fisioterapia/sessao', form);
      setModal(false);
      setForm({ doenteId: '', data: '', duracao: 45, descricao: '', planoId: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const realizarSessao = async () => {
    if (!realizarModal) return;
    setSalvando(true);
    try {
      await api.patch(`/fisioterapia/sessao/${realizarModal.id}/realizar`, { evolucao });
      setRealizarModal(null);
      setEvolucao('');
      carregar();
    } finally { setSalvando(false); }
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fisioterapia</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Agenda de sessões de reabilitação</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '9px 14px' }} />
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Sessão
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '80px 40px' }}>
          <p className="text-slate-700 font-semibold text-lg">Sem sessões para este dia</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '6px' }}>Nenhuma sessão agendada para {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtradas.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map(s => {
            const cfg = ESTADO_CONFIG[s.estado] ?? ESTADO_CONFIG.agendada;
            const hora = new Date(s.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="text-center shrink-0" style={{ minWidth: '48px' }}>
                    <p className="text-lg font-bold text-slate-900">{hora}</p>
                    <p className="text-xs text-slate-400">{s.duracao}min</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{s.doente?.nome}</p>
                    <p className="text-slate-500 text-sm" style={{ marginTop: '2px' }}>{s.descricao}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                      <span className={`text-xs font-medium badge-pad py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    {s.evolucao && <p className="text-slate-600 text-xs" style={{ marginTop: '6px' }}>Evolução: {s.evolucao}</p>}
                  </div>
                </div>
                {s.estado === 'agendada' && (
                  <button onClick={() => { setRealizarModal(s); setEvolucao(''); }}
                    className="text-xs font-semibold bg-lime-600 hover:bg-lime-700 text-white rounded-lg transition-colors shrink-0"
                    style={{ padding: '7px 14px' }}>
                    Realizar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Agendar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Sessão</h2>
              <button aria-label="Fechar" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'ID do Doente *', key: 'doenteId', type: 'text', placeholder: 'UUID do doente' },
              { label: 'Data e Hora *', key: 'data', type: 'datetime-local', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input id="fpage-0" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-500"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Duração (min)</label>
              <input id="fpage-1" type="number" value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-500"
                style={{ padding: '10px 14px' }} min={15} step={15} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
              <textarea id="fpage-2" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva os exercícios ou técnicas previstos..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={agendarSessao} disabled={salvando || !form.doenteId.trim() || !form.data || !form.descricao.trim()}
                className="flex-1 bg-lime-600 hover:bg-lime-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A agendar...' : 'Agendar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Realizar */}
      {realizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Sessão Realizada</h2>
              <button aria-label="Fechar" onClick={() => setRealizarModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>{realizarModal.doente?.nome} — {realizarModal.descricao}</p>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Evolução / Observações</label>
              <textarea id="fpage-3" value={evolucao} onChange={e => setEvolucao(e.target.value)}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva a evolução observada durante a sessão..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRealizarModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={realizarSessao} disabled={salvando}
                className="flex-1 bg-lime-600 hover:bg-lime-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Guardar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
