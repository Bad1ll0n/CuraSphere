'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface DoenteIsolado {
  id: string; nome: string; emIsolamento: boolean;
  motivoIsolamento: string | null;
  cama: { numero: string; quarto: string };
  diagnosticoPrincipal: string; estado: string;
}

interface CulturaMicrobiologica {
  id: string; doenteId: string; dataColheita: string;
  tipoAmostra: string; agente: string | null;
  antibiograma: Record<string, string> | null;
  resultado: 'pendente' | 'positivo' | 'negativo' | 'contaminado';
  servico: string | null; observacoes: string | null; criadoEm: string;
  doente: { id: string; nome: string };
  registadoPor: { id: string; nome: string };
}

interface SurtoIACS {
  id: string; agente: string; servico: string; dataInicio: string;
  dataFim: string | null; estado: 'activo' | 'controlado' | 'encerrado';
  numCasos: number; medidas: Record<string, boolean> | null;
  observacoes: string | null; criadoEm: string;
  registadoPor: { id: string; nome: string };
}

const MOTIVOS_PRESET = [
  'MRSA (Staphylococcus aureus resistente à meticilina)',
  'VRE (Enterococcus resistente à vancomicina)',
  'ESBL (Enterobactérias produtoras de ESBL)',
  'Clostridioides difficile',
  'Acinetobacter baumannii multirresistente',
  'Pseudomonas aeruginosa multirresistente',
  'Tuberculose pulmonar ativa',
  'Precauções de contacto — outro motivo',
  'Precauções de gotículas',
  'Precauções de via aérea',
];

const TIPO_AMOSTRA_LABELS: Record<string, string> = {
  sangue: 'Sangue (Hemocultura)', urina: 'Urina (Urocultura)',
  expectoracao: 'Expectoração', ferida: 'Zaragatoa de ferida',
  swab_nasal: 'Swab Nasal', swab_rectal: 'Swab Rectal',
  lcr: 'LCR (Líquido cefalorraquidiano)', outro: 'Outro',
};

const RESULTADO_CONFIG: Record<CulturaMicrobiologica['resultado'], { label: string; bg: string; text: string }> = {
  pendente:    { label: 'Pendente',    bg: 'bg-slate-100',   text: 'text-slate-600' },
  positivo:    { label: 'Positivo',    bg: 'bg-red-50',      text: 'text-red-700' },
  negativo:    { label: 'Negativo',    bg: 'bg-green-50',    text: 'text-green-700' },
  contaminado: { label: 'Contaminado', bg: 'bg-amber-50',    text: 'text-amber-700' },
};

const SURTO_CONFIG: Record<SurtoIACS['estado'], { label: string; bg: string; text: string; dot: string }> = {
  activo:     { label: 'Activo',     bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  controlado: { label: 'Controlado', bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  encerrado:  { label: 'Encerrado',  bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
};

const estadoCor: Record<string, string> = {
  estavel: 'bg-green-50 text-green-700', grave: 'bg-amber-50 text-amber-700',
  critico: 'bg-red-50 text-red-700', alta_prevista: 'bg-blue-50 text-blue-700',
};

type Tab = 'isolamentos' | 'culturas' | 'surtos';

export default function IacsPage() {
  const { utilizador } = useAuth();
  const [tab, setTab] = useState<Tab>('isolamentos');

  // Isolamentos
  const [isolados, setIsolados] = useState<DoenteIsolado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalIsolamento, setModalIsolamento] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Culturas
  const [culturas, setCulturas] = useState<CulturaMicrobiologica[]>([]);
  const [loadingCulturas, setLoadingCulturas] = useState(false);
  const [filtroCultura, setFiltroCultura] = useState('');
  const [modalCultura, setModalCultura] = useState(false);
  const [formCultura, setFormCultura] = useState({ doenteId: '', dataColheita: new Date().toISOString().split('T')[0], tipoAmostra: 'sangue', agente: '', observacoes: '' });
  const [salvandoCultura, setSalvandoCultura] = useState(false);
  const [editCultura, setEditCultura] = useState<CulturaMicrobiologica | null>(null);
  const [formEditCultura, setFormEditCultura] = useState({ agente: '', resultado: 'positivo', observacoes: '' });

  // Surtos
  const [surtos, setSurtos] = useState<SurtoIACS[]>([]);
  const [loadingSurtos, setLoadingSurtos] = useState(false);
  const [modalSurto, setModalSurto] = useState(false);
  const [formSurto, setFormSurto] = useState({ agente: '', servico: '', dataInicio: new Date().toISOString().split('T')[0], numCasos: 1, observacoes: '' });
  const [salvandoSurto, setSalvandoSurto] = useState(false);
  const [editSurto, setEditSurto] = useState<SurtoIACS | null>(null);
  const [formEditSurto, setFormEditSurto] = useState({ estado: 'activo', numCasos: 1, observacoes: '' });

  const podeEditar = ['medico', 'enfermeiro', 'tecnico_saude', 'qualidade'].includes(utilizador?.role ?? '');

  const carregarIsolados = () => {
    setLoading(true);
    api.get('/doentes/iacs/isolados').then(r => setIsolados(r.data)).finally(() => setLoading(false));
  };

  const carregarCulturas = () => {
    setLoadingCulturas(true);
    api.get('/iacs/culturas').then(r => setCulturas(r.data)).finally(() => setLoadingCulturas(false));
  };

  const carregarSurtos = () => {
    setLoadingSurtos(true);
    api.get('/iacs/surtos').then(r => setSurtos(r.data)).finally(() => setLoadingSurtos(false));
  };

  useEffect(() => { carregarIsolados(); }, []);
  useEffect(() => { if (tab === 'culturas') carregarCulturas(); }, [tab]);
  useEffect(() => { if (tab === 'surtos') carregarSurtos(); }, [tab]);

  const confirmarIsolamento = async () => {
    if (!modalIsolamento) return;
    setSalvando(true);
    try {
      await api.patch(`/doentes/${modalIsolamento.id}/isolamento`, { emIsolamento: true, motivoIsolamento: motivo || undefined });
      setModalIsolamento(null);
      carregarIsolados();
    } finally { setSalvando(false); }
  };

  const levantarIsolamento = async (id: string) => {
    await api.patch(`/doentes/${id}/isolamento`, { emIsolamento: false });
    carregarIsolados();
  };

  const registarCultura = async () => {
    if (!formCultura.doenteId.trim() || !formCultura.dataColheita) return;
    setSalvandoCultura(true);
    try {
      await api.post('/iacs/cultura', { ...formCultura, agente: formCultura.agente || undefined });
      setModalCultura(false);
      setFormCultura({ doenteId: '', dataColheita: new Date().toISOString().split('T')[0], tipoAmostra: 'sangue', agente: '', observacoes: '' });
      carregarCulturas();
    } finally { setSalvandoCultura(false); }
  };

  const guardarResultadoCultura = async () => {
    if (!editCultura) return;
    setSalvandoCultura(true);
    try {
      await api.patch(`/iacs/cultura/${editCultura.id}`, formEditCultura);
      setEditCultura(null);
      carregarCulturas();
    } finally { setSalvandoCultura(false); }
  };

  const registarSurto = async () => {
    if (!formSurto.agente.trim() || !formSurto.servico.trim()) return;
    setSalvandoSurto(true);
    try {
      await api.post('/iacs/surto', formSurto);
      setModalSurto(false);
      setFormSurto({ agente: '', servico: '', dataInicio: new Date().toISOString().split('T')[0], numCasos: 1, observacoes: '' });
      carregarSurtos();
    } finally { setSalvandoSurto(false); }
  };

  const guardarSurto = async () => {
    if (!editSurto) return;
    setSalvandoSurto(true);
    try {
      await api.patch(`/iacs/surto/${editSurto.id}`, formEditSurto);
      setEditSurto(null);
      carregarSurtos();
    } finally { setSalvandoSurto(false); }
  };

  const culturasFiltradas = culturas.filter(c =>
    !filtroCultura || c.resultado === filtroCultura || (c.agente ?? '').toLowerCase().includes(filtroCultura.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controlo IACS</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Infecções Associadas aos Cuidados de Saúde</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '28px', width: 'fit-content' }}>
        {(['isolamentos', 'culturas', 'surtos'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm font-semibold rounded-lg transition-colors capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 20px' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Tab Isolamentos ─────────────────────────────────────────────────── */}
      {tab === 'isolamentos' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3" style={{ padding: '16px 20px', marginBottom: '24px' }}>
            <svg className="w-5 h-5 text-amber-600 shrink-0" style={{ marginTop: '1px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">EPI obrigatório em quartos de isolamento</p>
              <p className="text-xs text-amber-700" style={{ marginTop: '2px' }}>Luvas, bata e máscara. Higienizar mãos antes e após contacto.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : isolados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center text-center" style={{ padding: '80px' }}>
              <p className="text-slate-700 font-semibold">Nenhum doente em isolamento</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Sem casos IACS activos de momento</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isolados.map(d => (
                <div key={d.id} className="bg-white rounded-2xl border-2 border-orange-200" style={{ padding: '20px 24px' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/doentes/${d.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-sm">{d.nome}</Link>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoCor[d.estado] ?? 'bg-slate-100 text-slate-600'}`}>{d.estado.replace('_', ' ')}</span>
                          <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">ISOLAMENTO</span>
                        </div>
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Quarto {d.cama.quarto} · Cama {d.cama.numero} · {d.diagnosticoPrincipal}</p>
                        {d.motivoIsolamento && <p className="text-sm text-orange-700 font-medium" style={{ marginTop: '8px' }}>{d.motivoIsolamento}</p>}
                      </div>
                    </div>
                    {podeEditar && (
                      <button onClick={() => levantarIsolamento(d.id)}
                        className="shrink-0 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                        style={{ padding: '8px 14px' }}>
                        Levantar isolamento
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '24px' }}>
            <p className="text-xs text-slate-400 text-center">
              Para colocar um doente em isolamento, aceda à sua{' '}
              <Link href="/doentes" className="text-blue-500 hover:underline">ficha individual</Link> e utilize a opção "Isolamento IACS".
            </p>
          </div>
        </>
      )}

      {/* ─── Tab Culturas ────────────────────────────────────────────────────── */}
      {tab === 'culturas' && (
        <>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <div className="flex items-center gap-3">
              <select value={filtroCultura} onChange={e => setFiltroCultura(e.target.value)}
                className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '9px 14px' }}>
                <option value="">Todos os resultados</option>
                <option value="pendente">Pendente</option>
                <option value="positivo">Positivo</option>
                <option value="negativo">Negativo</option>
                <option value="contaminado">Contaminado</option>
              </select>
              <input type="text" value={filtroCultura} onChange={e => setFiltroCultura(e.target.value)}
                placeholder="Pesquisar por agente..."
                className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '9px 14px', width: '220px' }} />
            </div>
            {podeEditar && (
              <button onClick={() => setModalCultura(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
                style={{ padding: '10px 20px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nova Cultura
              </button>
            )}
          </div>

          {loadingCulturas ? (
            <div className="flex items-center justify-center" style={{ padding: '60px' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : culturasFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 text-center" style={{ padding: '60px' }}>
              <p className="text-slate-600 font-semibold">Sem culturas registadas</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Registe a primeira colheita microbiológica.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {culturasFiltradas.map(c => {
                const res = RESULTADO_CONFIG[c.resultado];
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200" style={{ padding: '18px 24px' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
                          <Link href={`/doentes/${c.doente.id}`} className="font-semibold text-slate-900 hover:text-blue-600 text-sm">{c.doente.nome}</Link>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${res.bg} ${res.text}`}>{res.label}</span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{TIPO_AMOSTRA_LABELS[c.tipoAmostra] ?? c.tipoAmostra}</span>
                        </div>
                        {c.agente && <p className="text-sm font-semibold text-red-700" style={{ marginBottom: '2px' }}>Agente: {c.agente}</p>}
                        <p className="text-xs text-slate-400">
                          Colheita: {new Date(c.dataColheita).toLocaleDateString('pt-PT')} · Registado por {c.registadoPor.nome}
                          {c.servico && ` · ${c.servico}`}
                        </p>
                        {c.antibiograma && Object.keys(c.antibiograma).length > 0 && (
                          <div className="flex gap-2 flex-wrap" style={{ marginTop: '8px' }}>
                            {Object.entries(c.antibiograma).map(([ab, res]) => (
                              <span key={ab} className={`text-xs px-2 py-0.5 rounded-full font-medium ${res === 'R' ? 'bg-red-50 text-red-700' : res === 'S' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                {ab}: {res}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.observacoes && <p className="text-xs text-slate-500 italic" style={{ marginTop: '6px' }}>{c.observacoes}</p>}
                      </div>
                      {podeEditar && c.resultado === 'pendente' && (
                        <button onClick={() => { setEditCultura(c); setFormEditCultura({ agente: c.agente ?? '', resultado: 'positivo', observacoes: c.observacoes ?? '' }); }}
                          className="shrink-0 border border-blue-100 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-50 transition-colors"
                          style={{ padding: '8px 14px' }}>
                          Registar Resultado
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Tab Surtos ─────────────────────────────────────────────────────── */}
      {tab === 'surtos' && (
        <>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <p className="text-sm text-slate-500">{surtos.filter(s => s.estado === 'activo').length} surtos activos · {surtos.length} total</p>
            {podeEditar && (
              <button onClick={() => setModalSurto(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm"
                style={{ padding: '10px 20px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Registar Surto
              </button>
            )}
          </div>

          {loadingSurtos ? (
            <div className="flex items-center justify-center" style={{ padding: '60px' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : surtos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 text-center" style={{ padding: '60px' }}>
              <p className="text-slate-600 font-semibold">Sem surtos registados</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Nenhum episódio de surto IACS registado.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {surtos.map(s => {
                const cfg = SURTO_CONFIG[s.estado];
                return (
                  <div key={s.id} className={`rounded-2xl border-2 ${s.estado === 'activo' ? 'border-red-200 bg-red-50' : 'bg-white border-slate-200'}`} style={{ padding: '20px 24px' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
                          <p className="font-bold text-slate-900 text-sm">{s.agente}</p>
                          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${s.estado === 'activo' ? 'animate-pulse' : ''}`} />
                            {cfg.label}
                          </span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{s.numCasos} {s.numCasos === 1 ? 'caso' : 'casos'}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Serviço: <span className="font-medium text-slate-700">{s.servico}</span> ·
                          Início: {new Date(s.dataInicio).toLocaleDateString('pt-PT')}
                          {s.dataFim ? ` · Fim: ${new Date(s.dataFim).toLocaleDateString('pt-PT')}` : ''}
                          {' '}· Registado por {s.registadoPor.nome}
                        </p>
                        {s.medidas && Object.keys(s.medidas).length > 0 && (
                          <div className="flex gap-2 flex-wrap" style={{ marginTop: '8px' }}>
                            {Object.entries(s.medidas).filter(([, v]) => v).map(([m]) => (
                              <span key={m} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{m}</span>
                            ))}
                          </div>
                        )}
                        {s.observacoes && <p className="text-xs text-slate-500 italic" style={{ marginTop: '6px' }}>{s.observacoes}</p>}
                      </div>
                      {podeEditar && s.estado !== 'encerrado' && (
                        <button onClick={() => { setEditSurto(s); setFormEditSurto({ estado: s.estado, numCasos: s.numCasos, observacoes: s.observacoes ?? '' }); }}
                          className="shrink-0 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                          style={{ padding: '8px 14px' }}>
                          Actualizar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Modal: Ativar Isolamento ─────────────────────────────────────────── */}
      {modalIsolamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '4px' }}>Ativar Isolamento IACS</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{modalIsolamento.nome}</p>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo de Isolamento</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ padding: '10px 14px', marginBottom: '10px' }}>
              <option value="">Selecionar motivo...</option>
              {MOTIVOS_PRESET.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ou escrever motivo personalizado..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ padding: '10px 14px', marginBottom: '24px' }} />
            <div className="flex gap-3">
              <button onClick={() => setModalIsolamento(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={confirmarIsolamento} disabled={salvando} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvando ? 'A ativar...' : 'Ativar Isolamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Nova Cultura ─────────────────────────────────────────────── */}
      {modalCultura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '460px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Colheita Microbiológica</h2>
              <button onClick={() => setModalCultura(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'ID do Doente *', key: 'doenteId', type: 'text', placeholder: 'UUID do doente' },
              { label: 'Data da Colheita *', key: 'dataColheita', type: 'date', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type={type} value={(formCultura as any)[key]} onChange={e => setFormCultura(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo de Amostra *</label>
              <select value={formCultura.tipoAmostra} onChange={e => setFormCultura(f => ({ ...f, tipoAmostra: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }}>
                {Object.entries(TIPO_AMOSTRA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Agente suspeito (opcional)</label>
              <input type="text" value={formCultura.agente} onChange={e => setFormCultura(f => ({ ...f, agente: e.target.value }))}
                placeholder="Ex: MRSA, Klebsiella pneumoniae..."
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea value={formCultura.observacoes} onChange={e => setFormCultura(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalCultura(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarCultura} disabled={salvandoCultura || !formCultura.doenteId.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoCultura ? 'A registar...' : 'Registar Colheita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Registar Resultado Cultura ──────────────────────────────── */}
      {editCultura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
              <button onClick={() => setEditCultura(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{editCultura.doente.nome} · {TIPO_AMOSTRA_LABELS[editCultura.tipoAmostra] ?? editCultura.tipoAmostra}</p>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resultado *</label>
              <select value={formEditCultura.resultado} onChange={e => setFormEditCultura(f => ({ ...f, resultado: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }}>
                <option value="positivo">Positivo</option>
                <option value="negativo">Negativo</option>
                <option value="contaminado">Contaminado</option>
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Agente identificado</label>
              <input type="text" value={formEditCultura.agente} onChange={e => setFormEditCultura(f => ({ ...f, agente: e.target.value }))}
                placeholder="Ex: MRSA, E. coli ESBL..."
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea value={formEditCultura.observacoes} onChange={e => setFormEditCultura(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditCultura(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={guardarResultadoCultura} disabled={salvandoCultura} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoCultura ? 'A guardar...' : 'Guardar Resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Registar Surto ───────────────────────────────────────────── */}
      {modalSurto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Surto IACS</h2>
              <button onClick={() => setModalSurto(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'Agente *', key: 'agente', placeholder: 'Ex: MRSA, Clostridioides difficile...' },
              { label: 'Serviço *', key: 'servico', placeholder: 'Ex: Internamento, UCI, Cirurgia...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type="text" value={(formSurto as any)[key]} onChange={e => setFormSurto(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500" style={{ padding: '10px 14px' }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data Início *</label>
                <input type="date" value={formSurto.dataInicio} onChange={e => setFormSurto(f => ({ ...f, dataInicio: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500" style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nº de Casos</label>
                <input type="number" min={1} value={formSurto.numCasos} onChange={e => setFormSurto(f => ({ ...f, numCasos: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500" style={{ padding: '10px 14px' }} />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea value={formSurto.observacoes} onChange={e => setFormSurto(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSurto(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarSurto} disabled={salvandoSurto || !formSurto.agente.trim() || !formSurto.servico.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoSurto ? 'A registar...' : 'Registar Surto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Actualizar Surto ─────────────────────────────────────────── */}
      {editSurto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <h2 className="text-lg font-bold text-slate-900">Actualizar Surto</h2>
              <button onClick={() => setEditSurto(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{editSurto.agente} · {editSurto.servico}</p>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Estado</label>
              <select value={formEditSurto.estado} onChange={e => setFormEditSurto(f => ({ ...f, estado: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }}>
                <option value="activo">Activo</option>
                <option value="controlado">Controlado</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nº de Casos</label>
              <input type="number" min={1} value={formEditSurto.numCasos} onChange={e => setFormEditSurto(f => ({ ...f, numCasos: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea value={formEditSurto.observacoes} onChange={e => setFormEditSurto(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditSurto(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={guardarSurto} disabled={salvandoSurto} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoSurto ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
