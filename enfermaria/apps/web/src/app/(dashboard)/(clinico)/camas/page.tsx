'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import type { Cama as SharedCama } from '@org/shared';

interface Cama extends SharedCama {
  doente?: { id: string; nome: string; estado: string; diagnosticoPrincipal: string } | null;
}

const estadoCor: Record<string, { card: string; dot: string }> = {
  livre:      { card: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  ocupada:    { card: 'bg-red-50 border-red-200',         dot: 'bg-red-500' },
  em_limpeza: { card: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-500' },
  reservada:  { card: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-500' },
};

const estadoBadge: Record<string, string> = {
  livre:      'bg-emerald-100 text-emerald-700',
  ocupada:    'bg-red-100 text-red-700',
  em_limpeza: 'bg-amber-100 text-amber-700',
  reservada:  'bg-blue-100 text-blue-700',
};

const estadoLabel: Record<string, string> = {
  livre: 'Livre', ocupada: 'Ocupada', em_limpeza: 'Em Limpeza', reservada: 'Reservada',
};

const estadoDoenteLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const estadoDoenteCor: Record<string, string> = {
  estavel: 'text-emerald-600', grave: 'text-amber-600', critico: 'text-red-600', alta_prevista: 'text-blue-600',
};

export default function CamasPagina() {
  const { utilizador } = useAuth();
  const [camas, setCamas] = useState<Cama[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [mostrarFormCama, setMostrarFormCama] = useState(false);
  const [novaCama, setNovaCama] = useState({ numero: '', quarto: '' });
  const [qrCama, setQrCama] = useState<Cama | null>(null);
  const [filtroQuarto, setFiltroQuarto] = useState('');

  const podeGerir = ['administrativo', 'enfermeiro'].includes(utilizador?.role ?? '');
  const podeCriar = utilizador?.role === 'administrativo';

  const [sseConectado, setSseConectado] = useState(false);

  const carregar = async () => {
    const r = await api.get('/camas');
    setCamas(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    const es = new EventSource(`${apiUrl}/v1/camas/eventos`, { withCredentials: true });

    es.addEventListener('cama_atualizada', (e: MessageEvent) => {
      const cama: Cama = JSON.parse(e.data);
      setCamas(prev => prev.map(c => c.id === cama.id ? cama : c));
    });

    es.onopen = () => setSseConectado(true);
    es.onerror = () => setSseConectado(false);

    return () => {
      es.close();
      setSseConectado(false);
    };
  }, []);

  const alterarEstado = async (id: string, estado: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/camas/${id}/estado`, { estado });
      await carregar();
    } finally {
      setAtualizando(null);
    }
  };

  const criarCama = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/camas', novaCama);
    setNovaCama({ numero: '', quarto: '' });
    setMostrarFormCama(false);
    await carregar();
  };

  const quartos = [...new Set(camas.map((c) => c.quarto))].sort();
  const ocupadas = camas.filter((c) => c.estado === 'ocupada').length;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">Mapa de Camas</h1>
            {sseConectado && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Em directo
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {ocupadas} de {camas.length} camas ocupadas
          </p>
        </div>
        {podeCriar && (
          <button
            onClick={() => setMostrarFormCama(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            + Adicionar Cama
          </button>
        )}
      </div>

      {/* Legenda + Filtro */}
      <div className="flex items-center gap-6 bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '16px 24px', marginBottom: '32px' }}>
        {Object.entries(estadoLabel).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${estadoCor[k].dot}`} />
            <span className="text-sm text-slate-600">{v}</span>
          </div>
        ))}
        <div className="ml-auto">
          <select value={filtroQuarto} onChange={e => setFiltroQuarto(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '7px 12px' }}>
            <option value="">Todos os quartos</option>
            {quartos.map(q => <option key={q} value={q}>Quarto {q}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400" style={{ paddingTop: '60px', justifyContent: 'center' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : camas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px' }}>
          <p className="text-slate-400 text-sm">Sem camas registadas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {quartos.filter(q => !filtroQuarto || q === filtroQuarto).map((quarto) => (
            <div key={quarto}>
              <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Quarto {quarto}</h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">{camas.filter((c) => c.quarto === quarto).length} camas</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {camas.filter((c) => c.quarto === quarto).map((cama) => (
                  <div key={cama.id} className={`border-2 rounded-2xl ${estadoCor[cama.estado].card}`} style={{ padding: '18px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${estadoCor[cama.estado].dot}`} />
                        <span className="font-bold text-slate-700 text-sm">Cama {cama.numero}</span>
                      </div>
                      <span className={`text-xs badge-pad py-0.5 rounded-full font-medium ${estadoBadge[cama.estado]}`}>
                        {estadoLabel[cama.estado]}
                      </span>
                    </div>

                    {cama.doente ? (
                      <div style={{ marginTop: '10px' }}>
                        <p className="text-sm font-semibold text-slate-800 truncate">{cama.doente.nome}</p>
                        <p className={`text-xs font-medium ${estadoDoenteCor[cama.doente.estado]}`} style={{ marginTop: '2px' }}>
                          {estadoDoenteLabel[cama.doente.estado]}
                        </p>
                        <p className="text-xs text-slate-400 truncate" style={{ marginTop: '2px' }}>{cama.doente.diagnosticoPrincipal}</p>
                        <button
                          onClick={() => setQrCama(cama)}
                          title="Gerar QR do doente"
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          style={{ marginTop: '10px', padding: '4px 8px' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A7.5 7.5 0 116.5 9M9 3H5a2 2 0 00-2 2v4m6-6h4m6 6v4m-6 0h4" />
                          </svg>
                          QR Doente
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>Sem doente</p>
                    )}

                    {podeGerir && cama.estado !== 'ocupada' && (
                      <select
                        value={cama.estado}
                        disabled={atualizando === cama.id}
                        onChange={(e) => alterarEstado(cama.id, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        style={{ marginTop: '12px', padding: '6px 8px' }}
                      >
                        <option value="livre">Livre</option>
                        <option value="em_limpeza">Em Limpeza</option>
                        <option value="reservada">Reservada</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova cama */}
      {mostrarFormCama && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ padding: '32px' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '24px' }}>Nova Cama</h2>
            <form onSubmit={criarCama}>
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Número</label>
                <input
                  required
                  value={novaCama.numero}
                  onChange={(e) => setNovaCama((n) => ({ ...n, numero: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Quarto</label>
                <input
                  required
                  value={novaCama.quarto}
                  onChange={(e) => setNovaCama((n) => ({ ...n, quarto: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarFormCama(false)}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Criar Cama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Doente */}
      {qrCama && qrCama.doente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl" style={{ padding: '32px', textAlign: 'center', maxWidth: '320px', width: '100%', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">QR — Doente</h2>
              <button aria-label="Fechar" onClick={() => setQrCama(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '4px' }}>{qrCama.doente.nome}</p>
            <p className="text-xs text-slate-400" style={{ marginBottom: '20px' }}>Quarto {qrCama.quarto} · Cama {qrCama.numero}</p>
            {/* QR gerado com API pública */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${qrCama.doente.id}&size=200x200&margin=10`}
              alt="QR Code do doente"
              width={200}
              height={200}
              style={{ margin: '0 auto 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            />
            <p className="text-xs text-slate-400" style={{ marginBottom: '20px' }}>Aponta a câmara da app mobile para aceder à ficha do doente</p>
            <button
              onClick={() => window.print()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '11px' }}
            >
              Imprimir QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
