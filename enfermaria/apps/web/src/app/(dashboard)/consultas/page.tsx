'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Consulta {
  id: string;
  especialidade: string;
  dataHora: string;
  duracao: number;
  estado: string;
  notas?: string;
  diagnostico?: string;
  proximaConsulta?: string;
  nomeDoente?: string;
  doente?: { id: string; nome: string };
  medico: { id: string; nome: string };
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  agendada:  { label: 'Agendada',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  realizada: { label: 'Realizada', bg: 'bg-green-50',  text: 'text-green-700' },
  faltou:    { label: 'Faltou',    bg: 'bg-red-50',    text: 'text-red-700' },
  cancelada: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function ConsultasPage() {
  const { utilizador } = useAuth();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ especialidade: '', dataHora: '', duracao: 30, nomeDoente: '', doenteId: '' });
  const [salvando, setSalvando] = useState(false);
  const [realizarModal, setRealizarModal] = useState<Consulta | null>(null);
  const [realizarForm, setRealizarForm] = useState({ notas: '', diagnostico: '', proximaConsulta: '' });

  const carregar = async () => {
    try {
      const { data } = await api.get('/consultas', { params: { data: dataFiltro } });
      setConsultas(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [dataFiltro]);

  const agendar = async () => {
    if (!form.especialidade.trim() || !form.dataHora) return;
    setSalvando(true);
    try {
      await api.post('/consultas', form);
      setModal(false);
      setForm({ especialidade: '', dataHora: '', duracao: 30, nomeDoente: '', doenteId: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const realizar = async () => {
    if (!realizarModal) return;
    setSalvando(true);
    try {
      await api.patch(`/consultas/${realizarModal.id}/realizar`, realizarForm);
      setRealizarModal(null);
      setRealizarForm({ notas: '', diagnostico: '', proximaConsulta: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const atualizarEstado = async (id: string, estado: string) => {
    await api.patch(`/consultas/${id}/estado`, { estado });
    carregar();
  };

  const podeAgendar = ['medico', 'secretaria', 'administrativo', 'chefe_medicos'].includes(utilizador?.role ?? '');

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consultas Externas</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Agenda de consultas por especialidade</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dataFiltro} onChange={e => setDataFiltro(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '9px 14px' }} />
          {podeAgendar && (
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 20px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Consulta
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : consultas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '80px 40px' }}>
          <p className="text-slate-700 font-semibold text-lg">Sem consultas para este dia</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '6px' }}>Nenhuma consulta agendada para {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {consultas.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()).map(c => {
            const cfg = ESTADO_CONFIG[c.estado] ?? ESTADO_CONFIG.agendada;
            const hora = new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="text-center shrink-0" style={{ minWidth: '48px' }}>
                    <p className="text-lg font-bold text-slate-900">{hora}</p>
                    <p className="text-xs text-slate-400">{c.duracao}min</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{c.doente?.nome ?? c.nomeDoente ?? 'Doente externo'}</p>
                    <p className="text-slate-500 text-xs capitalize" style={{ marginTop: '2px' }}>{c.especialidade}</p>
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '8px' }}>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400">Dr. {c.medico?.nome}</span>
                    </div>
                    {c.diagnostico && (
                      <p className="text-slate-600 text-xs" style={{ marginTop: '6px' }}>Diagnóstico: {c.diagnostico}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {c.estado === 'agendada' && (
                    <>
                      <button onClick={() => { setRealizarModal(c); setRealizarForm({ notas: c.notas ?? '', diagnostico: c.diagnostico ?? '', proximaConsulta: '' }); }}
                        className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        style={{ padding: '7px 14px' }}>
                        Realizar
                      </button>
                      <button onClick={() => atualizarEstado(c.id, 'faltou')}
                        className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        style={{ padding: '7px 14px' }}>
                        Faltou
                      </button>
                    </>
                  )}
                </div>
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
              <h2 className="text-lg font-bold text-slate-900">Nova Consulta</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'Especialidade *', key: 'especialidade', type: 'text', placeholder: 'Ex: Cardiologia' },
              { label: 'Nome do Doente', key: 'nomeDoente', type: 'text', placeholder: 'Se não tiver registo no sistema' },
              { label: 'Data e Hora *', key: 'dataHora', type: 'datetime-local', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Duração (min)</label>
              <input type="number" value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} min={15} step={15} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={agendar} disabled={salvando || !form.especialidade.trim() || !form.dataHora}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A agendar...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Realizar */}
      {realizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Consulta Realizada</h2>
              <button onClick={() => setRealizarModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>
              {realizarModal.doente?.nome ?? realizarModal.nomeDoente} — {realizarModal.especialidade}
            </p>
            {[
              { label: 'Notas', key: 'notas', rows: 3, placeholder: 'Observações da consulta...' },
              { label: 'Diagnóstico', key: 'diagnostico', rows: 2, placeholder: 'Diagnóstico registado...' },
            ].map(({ label, key, rows, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <textarea value={(realizarForm as any)[key]} onChange={e => setRealizarForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={rows} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Próxima Consulta</label>
              <input type="datetime-local" value={realizarForm.proximaConsulta} onChange={e => setRealizarForm(f => ({ ...f, proximaConsulta: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRealizarModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={realizar} disabled={salvando}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Guardar Consulta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
