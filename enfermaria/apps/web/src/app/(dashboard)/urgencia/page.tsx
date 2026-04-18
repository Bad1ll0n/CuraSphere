'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface EpisodioUrgencia {
  id: string;
  nomeTemporario?: string;
  queixaPrincipal: string;
  triagem: string;
  estadoEpisodio: string;
  dataEntrada: string;
  notas?: string;
  doente?: { id: string; nome: string };
  triadoPor?: { id: string; nome: string };
  medicoResponsavel?: string;
}

const CORES_TRIAGEM: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  vermelho: { label: 'Vermelho',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  laranja:  { label: 'Laranja',   bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  amarelo:  { label: 'Amarelo',   bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  verde:    { label: 'Verde',     bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
  azul:     { label: 'Azul',      bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
};

const ESTADO_LABELS: Record<string, string> = {
  triagem:         'Triagem',
  sala_espera:     'Sala de Espera',
  em_atendimento:  'Em Atendimento',
  alta_urgencia:   'Alta',
  internado:       'Internado',
  transferido:     'Transferido',
};

function tempoEspera(dataEntrada: string) {
  const diff = Math.floor((Date.now() - new Date(dataEntrada).getTime()) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
}

export default function UrgenciaPage() {
  const { utilizador } = useAuth();
  const [episodios, setEpisodios] = useState<EpisodioUrgencia[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ queixaPrincipal: '', triagem: 'verde', nomeTemporario: '', notas: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const [lista, dash] = await Promise.all([
        api.get('/urgencia/lista'),
        api.get('/urgencia/dashboard'),
      ]);
      setEpisodios(lista.data);
      setDashboard(dash.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const registarEntrada = async () => {
    if (!form.queixaPrincipal.trim()) return;
    setSalvando(true);
    try {
      await api.post('/urgencia/episodio', form);
      setModal(false);
      setForm({ queixaPrincipal: '', triagem: 'verde', nomeTemporario: '', notas: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const avancarEstado = async (id: string, estado: string) => {
    await api.patch(`/urgencia/${id}/estado`, { estado });
    carregar();
  };

  const ORDEM_CORES = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  const ativos = episodios.filter(e => !['alta_urgencia', 'internado', 'transferido'].includes(e.estadoEpisodio));

  const podeRegistar = ['triador', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'].includes(utilizador?.role ?? '');

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Urgência</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Lista de espera e triagem de Manchester</p>
        </div>
        {podeRegistar && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Entrada
          </button>
        )}
      </div>

      {/* Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6" style={{ marginBottom: '32px' }}>
          <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '20px' }}>
            <p className="text-3xl font-bold text-slate-900">{dashboard.totalEspera ?? 0}</p>
            <p className="text-xs text-slate-500 font-medium" style={{ marginTop: '4px' }}>Em Espera</p>
          </div>
          {ORDEM_CORES.map(cor => {
            const cfg = CORES_TRIAGEM[cor];
            const count = dashboard.porCor?.[cor] ?? 0;
            return (
              <div key={cor} className={`bg-white rounded-2xl border text-center ${cfg.border}`} style={{ padding: '20px' }}>
                <p className={`text-3xl font-bold ${cfg.text}`}>{count}</p>
                <p className="text-xs text-slate-500 font-medium" style={{ marginTop: '4px' }}>{cfg.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista por cor */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar...</span>
          </div>
        </div>
      ) : ativos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '80px 40px' }}>
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold text-lg">Urgência sem doentes em espera</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '6px' }}>Não existem episódios activos de urgência.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ORDEM_CORES.map(cor => {
            const grupo = ativos.filter(e => e.triagem === cor);
            if (grupo.length === 0) return null;
            const cfg = CORES_TRIAGEM[cor];
            return (
              <div key={cor}>
                <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
                  <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                  <h2 className={`font-semibold text-sm ${cfg.text}`}>{cfg.label} — {grupo.length} doente{grupo.length > 1 ? 's' : ''}</h2>
                </div>
                <div className="grid gap-3">
                  {grupo.map(ep => (
                    <div key={ep.id} className={`bg-white rounded-2xl border ${cfg.border} flex items-start justify-between gap-4`} style={{ padding: '20px 24px' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                          <p className="font-semibold text-slate-900 text-sm">
                            {ep.doente?.nome ?? ep.nomeTemporario ?? 'Doente desconhecido'}
                          </p>
                          <span className="text-xs text-slate-400 ml-auto shrink-0">⏱ {tempoEspera(ep.dataEntrada)}</span>
                        </div>
                        <p className="text-slate-600 text-sm" style={{ marginBottom: '8px' }}>{ep.queixaPrincipal}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                            {ESTADO_LABELS[ep.estadoEpisodio] ?? ep.estadoEpisodio}
                          </span>
                          {ep.triadoPor && (
                            <span className="text-xs text-slate-400">Triado por {ep.triadoPor.nome}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {ep.estadoEpisodio === 'sala_espera' && (
                          <button onClick={() => avancarEstado(ep.id, 'em_atendimento')}
                            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            style={{ padding: '7px 14px' }}>
                            Iniciar atendimento
                          </button>
                        )}
                        {ep.estadoEpisodio === 'em_atendimento' && (
                          <button onClick={() => avancarEstado(ep.id, 'alta_urgencia')}
                            className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            style={{ padding: '7px 14px' }}>
                            Dar alta
                          </button>
                        )}
                        {ep.estadoEpisodio === 'triagem' && (
                          <button onClick={() => avancarEstado(ep.id, 'sala_espera')}
                            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                            style={{ padding: '7px 14px' }}>
                            Enviar p/ espera
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Entrada */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Entrada — Urgência</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Queixa Principal *
              </label>
              <textarea value={form.queixaPrincipal} onChange={e => setForm(f => ({ ...f, queixaPrincipal: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva a queixa principal..." />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Triagem de Manchester *
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ORDEM_CORES.map(cor => {
                  const cfg = CORES_TRIAGEM[cor];
                  return (
                    <button key={cor} onClick={() => setForm(f => ({ ...f, triagem: cor }))}
                      className={`rounded-xl border-2 font-semibold text-xs transition-all ${cfg.bg} ${cfg.text} ${form.triagem === cor ? `${cfg.border} ring-2 ring-offset-1` : 'border-transparent opacity-50'}`}
                      style={{ padding: '10px 4px' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Nome do Doente (se desconhecido)
              </label>
              <input value={form.nomeTemporario} onChange={e => setForm(f => ({ ...f, nomeTemporario: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ padding: '10px 14px' }} placeholder="Nome temporário ou 'Desconhecido'" />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Notas
              </label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Notas adicionais..." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarEntrada} disabled={salvando || !form.queixaPrincipal.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A registar...' : 'Registar Entrada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
