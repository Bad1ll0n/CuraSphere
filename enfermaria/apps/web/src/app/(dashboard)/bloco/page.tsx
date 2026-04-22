'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Checklist {
  signInEm: string | null;
  signInPor?: { nome: string } | null;
  timeOutEm: string | null;
  timeOutPor?: { nome: string } | null;
  signOutEm: string | null;
  signOutPor?: { nome: string } | null;
  signInDados?: Record<string, boolean> | null;
  timeOutDados?: Record<string, boolean> | null;
  signOutDados?: Record<string, boolean> | null;
}

interface CirurgiaProgramada {
  id: string;
  designacao: string;
  dataHora: string;
  duracaoPrevista: number;
  sala: string;
  estado: string;
  notasPreOperatorio?: string;
  notasPosOperatorio?: string;
  doente: { id: string; nome: string };
  cirurgiao: { id: string; nome: string };
  anestesista?: { id: string; nome: string };
  checklist?: { signInEm: string | null; timeOutEm: string | null; signOutEm: string | null } | null;
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  agendada:  { label: 'Agendada',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  em_curso:  { label: 'Em Curso',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  concluida: { label: 'Concluída', bg: 'bg-green-50',  text: 'text-green-700' },
  cancelada: { label: 'Cancelada', bg: 'bg-red-50',    text: 'text-red-700' },
  adiada:    { label: 'Adiada',    bg: 'bg-slate-100', text: 'text-slate-600' },
};

const WHO_FASES = {
  signIn: {
    label: 'Sign In',
    sublabel: 'Antes da indução da anestesia',
    cor: 'blue',
    itens: [
      { key: 'identidade', label: 'Doente confirmou identidade, local e procedimento' },
      { key: 'consentimento', label: 'Consentimento informado assinado' },
      { key: 'marcacaoSitio', label: 'Local cirúrgico marcado / Não aplicável' },
      { key: 'verificacaoAnestesia', label: 'Verificação de segurança da anestesia completa' },
      { key: 'pulsoOximetro', label: 'Oxímetro de pulso a funcionar corretamente' },
      { key: 'alergias', label: 'Alergias conhecidas identificadas / Sem alergias conhecidas' },
      { key: 'viaAerea', label: 'Risco de via aérea difícil avaliado / Sem risco' },
      { key: 'hemorragia', label: 'Risco de hemorragia >500ml avaliado / Sem risco' },
    ],
  },
  timeOut: {
    label: 'Time Out',
    sublabel: 'Antes da incisão cutânea',
    cor: 'amber',
    itens: [
      { key: 'confirmacaoEquipa', label: 'Toda a equipa confirmou nome e função' },
      { key: 'confirmacaoProcedimento', label: 'Confirmação: doente, local e procedimento' },
      { key: 'antibioticoprofilaxia', label: 'Profilaxia antibiótica dada (<60min) / Não aplicável' },
      { key: 'passosCriticos', label: 'Cirurgião: passos críticos ou inesperados revistos' },
      { key: 'duracao', label: 'Cirurgião: duração prevista confirmada' },
      { key: 'anestesiaCritica', label: 'Anestesista: preocupações específicas revistas' },
      { key: 'equipamento', label: 'Enfermeira: esterilidade e equipamento confirmados' },
      { key: 'imagiologia', label: 'Imagiologia essencial disponível / Não aplicável' },
    ],
  },
  signOut: {
    label: 'Sign Out',
    sublabel: 'Antes de qualquer elemento sair do bloco',
    cor: 'green',
    itens: [
      { key: 'procedimentoConfirmado', label: 'Procedimento realizado confirmado' },
      { key: 'contagemInstrumentos', label: 'Contagem de instrumentos, compressas e agulhas correta / Não aplicável' },
      { key: 'especimes', label: 'Amostras etiquetadas corretamente / Não aplicável' },
      { key: 'problemasEquipamento', label: 'Problemas de equipamento a resolver identificados' },
      { key: 'cirurgiaoRecuperacao', label: 'Cirurgião: preocupações para a recuperação' },
      { key: 'anestesistaRecuperacao', label: 'Anestesista: preocupações para a recuperação' },
      { key: 'enfermeiraRecuperacao', label: 'Enfermeira: preocupações para a recuperação' },
    ],
  },
} as const;

type Fase = keyof typeof WHO_FASES;

export default function BlocoPage() {
  const { utilizador } = useAuth();
  const [cirurgias, setCirurgias] = useState<CirurgiaProgramada[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ designacao: '', dataHora: '', duracaoPrevista: 60, sala: 'Bloco 1', doenteId: '', notasPreOperatorio: '' });
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<CirurgiaProgramada | null>(null);
  const [notasPos, setNotasPos] = useState('');
  const [salvandoNotas, setSalvandoNotas] = useState(false);

  // WHO Checklist state
  const [checklistCirurgia, setChecklistCirurgia] = useState<CirurgiaProgramada | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [checklistFase, setChecklistFase] = useState<Fase | null>(null);
  const [dadosFase, setDadosFase] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    try {
      const { data } = await api.get('/bloco/agenda', { params: { data: dataFiltro } });
      setCirurgias(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [dataFiltro]);

  const agendar = async () => {
    if (!form.designacao.trim() || !form.dataHora || !form.doenteId.trim()) return;
    setSalvando(true);
    try {
      await api.post('/bloco/cirurgia', form);
      setModal(false);
      setForm({ designacao: '', dataHora: '', duracaoPrevista: 60, sala: 'Bloco 1', doenteId: '', notasPreOperatorio: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const avancarEstado = async (id: string, estado: string) => {
    await api.patch(`/bloco/cirurgia/${id}/estado`, { estado });
    carregar();
  };

  const guardarNotasPos = async () => {
    if (!detalhe) return;
    setSalvandoNotas(true);
    try {
      await api.patch(`/bloco/cirurgia/${detalhe.id}/notas-pos`, { notasPosOperatorio: notasPos });
      setDetalhe(null);
      carregar();
    } finally { setSalvandoNotas(false); }
  };

  const abrirChecklist = async (c: CirurgiaProgramada) => {
    setChecklistCirurgia(c);
    const { data } = await api.get(`/bloco/cirurgia/${c.id}/checklist`);
    setChecklist(data);
    setChecklistFase(null);
    setDadosFase({});
  };

  const iniciarFase = (fase: Fase) => {
    const itens = WHO_FASES[fase].itens;
    const defaults: Record<string, boolean> = {};
    itens.forEach(i => { defaults[i.key] = false; });
    setDadosFase(defaults);
    setChecklistFase(fase);
  };

  const submeterFase = async () => {
    if (!checklistCirurgia || !checklistFase) return;
    setEnviando(true);
    try {
      const { data } = await api.post(`/bloco/cirurgia/${checklistCirurgia.id}/checklist/${checklistFase === 'signIn' ? 'sign-in' : checklistFase === 'timeOut' ? 'time-out' : 'sign-out'}`, dadosFase);
      setChecklist(data);
      setChecklistFase(null);
      carregar();
    } finally { setEnviando(false); }
  };

  const podeAgendar = ['medico', 'administrativo'].includes(utilizador?.role ?? '');
  const podeChecklist = ['medico', 'enfermeiro'].includes(utilizador?.role ?? '');
  const salas = [...new Set(cirurgias.map(c => c.sala))].sort();

  const corFase = (fase: Fase) => {
    const c = WHO_FASES[fase].cor;
    return c === 'blue' ? 'text-blue-600 bg-blue-50' : c === 'amber' ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bloco Operatório</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Agenda cirúrgica por data e sala</p>
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
              Agendar Cirurgia
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
      ) : cirurgias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '80px 40px' }}>
          <p className="text-slate-700 font-semibold text-lg">Sem cirurgias para este dia</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '6px' }}>Nenhuma cirurgia programada para {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(salas.length > 0 ? salas : ['Bloco 1']).map(sala => {
            const grupo = cirurgias.filter(c => c.sala === sala);
            if (grupo.length === 0) return null;
            return (
              <div key={sala}>
                <h2 className="font-semibold text-slate-600 text-sm" style={{ marginBottom: '12px' }}>{sala}</h2>
                <div className="grid gap-3">
                  {grupo.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()).map(c => {
                    const cfg = ESTADO_CONFIG[c.estado] ?? ESTADO_CONFIG.agendada;
                    const hora = new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                    const cl = c.checklist;
                    const fasesDone = [cl?.signInEm, cl?.timeOutEm, cl?.signOutEm].filter(Boolean).length;
                    return (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-4" style={{ padding: '20px 24px' }}>
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="text-center shrink-0" style={{ minWidth: '48px' }}>
                            <p className="text-lg font-bold text-slate-900">{hora}</p>
                            <p className="text-xs text-slate-400">{c.duracaoPrevista}min</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{c.designacao}</p>
                            <p className="text-slate-500 text-sm" style={{ marginTop: '2px' }}>{c.doente?.nome}</p>
                            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '8px' }}>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                              <span className="text-xs text-slate-400">Cirurgião: {c.cirurgiao?.nome}</span>
                              {c.anestesista && <span className="text-xs text-slate-400">Anestesista: {c.anestesista.nome}</span>}
                              {cl && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${fasesDone === 3 ? 'bg-green-50 text-green-700' : fasesDone > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                  WHO {fasesDone}/3
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {c.estado === 'agendada' && (
                            <button onClick={() => avancarEstado(c.id, 'em_curso')}
                              className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              Iniciar
                            </button>
                          )}
                          {c.estado === 'em_curso' && (
                            <button onClick={() => { setDetalhe(c); setNotasPos(c.notasPosOperatorio ?? ''); }}
                              className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              Concluir
                            </button>
                          )}
                          {podeChecklist && c.estado !== 'cancelada' && (
                            <button onClick={() => abrirChecklist(c)}
                              className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              WHO Checklist
                            </button>
                          )}
                          {c.estado === 'agendada' && (
                            <button onClick={() => avancarEstado(c.id, 'cancelada')}
                              className="text-xs font-semibold border border-red-100 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Agendar Cirurgia */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Agendar Cirurgia</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'Designação *', key: 'designacao', type: 'text', placeholder: 'Ex: Colecistectomia laparoscópica' },
              { label: 'ID do Doente *', key: 'doenteId', type: 'text', placeholder: 'UUID do doente' },
              { label: 'Data e Hora *', key: 'dataHora', type: 'datetime-local', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Duração (min)</label>
              <input type="number" value={form.duracaoPrevista} onChange={e => setForm(f => ({ ...f, duracaoPrevista: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} min={15} step={15} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Sala</label>
              <select value={form.sala} onChange={e => setForm(f => ({ ...f, sala: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                {['Bloco 1', 'Bloco 2', 'Bloco 3', 'Bloco 4'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas Pré-Operatório</label>
              <textarea value={form.notasPreOperatorio} onChange={e => setForm(f => ({ ...f, notasPreOperatorio: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={agendar} disabled={salvando || !form.designacao.trim() || !form.dataHora || !form.doenteId.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A agendar...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Notas Pós-Operatório */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Concluir Cirurgia</h2>
              <button onClick={() => setDetalhe(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>{detalhe.designacao} — {detalhe.doente?.nome}</p>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas Pós-Operatório</label>
              <textarea value={notasPos} onChange={e => setNotasPos(e.target.value)}
                rows={5} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva o resultado da cirurgia, intercorrências, estado do doente..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDetalhe(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={guardarNotasPos} disabled={salvandoNotas}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoNotas ? 'A guardar...' : 'Concluir Cirurgia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: WHO Surgical Safety Checklist */}
      {checklistCirurgia && checklist !== null && !checklistFase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">WHO Surgical Safety Checklist</h2>
                <p className="text-sm text-slate-500">{checklistCirurgia.designacao} — {checklistCirurgia.doente?.nome}</p>
              </div>
              <button onClick={() => setChecklistCirurgia(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold" style={{ marginLeft: '16px' }}>✕</button>
            </div>

            <div className="flex flex-col gap-3" style={{ marginTop: '24px' }}>
              {(Object.entries(WHO_FASES) as [Fase, typeof WHO_FASES[Fase]][]).map(([fase, cfg]) => {
                const feito = fase === 'signIn' ? checklist.signInEm : fase === 'timeOut' ? checklist.timeOutEm : checklist.signOutEm;
                const por = fase === 'signIn' ? checklist.signInPor : fase === 'timeOut' ? checklist.timeOutPor : checklist.signOutPor;
                const corBg = cfg.cor === 'blue' ? 'border-blue-100 bg-blue-50' : cfg.cor === 'amber' ? 'border-amber-100 bg-amber-50' : 'border-green-100 bg-green-50';
                const corText = cfg.cor === 'blue' ? 'text-blue-700' : cfg.cor === 'amber' ? 'text-amber-700' : 'text-green-700';
                return (
                  <div key={fase} className={`rounded-xl border p-4 ${corBg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold text-sm ${corText}`}>{cfg.label}</p>
                        <p className="text-xs text-slate-500">{cfg.sublabel}</p>
                        {feito && (
                          <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                            ✓ {new Date(feito).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            {por ? ` por ${por.nome}` : ''}
                          </p>
                        )}
                      </div>
                      {feito ? (
                        <span className="text-green-600 font-bold text-lg">✓</span>
                      ) : podeChecklist ? (
                        <button onClick={() => iniciarFase(fase)}
                          className={`text-xs font-semibold text-white rounded-lg transition-colors ${cfg.cor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : cfg.cor === 'amber' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
                          style={{ padding: '7px 16px' }}>
                          Preencher
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Pendente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preencher fase WHO */}
      {checklistCirurgia && checklistFase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">WHO — {WHO_FASES[checklistFase].label}</h2>
                <p className="text-sm text-slate-500">{WHO_FASES[checklistFase].sublabel}</p>
              </div>
              <button onClick={() => setChecklistFase(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold" style={{ marginLeft: '16px' }}>✕</button>
            </div>

            <div className="flex flex-col gap-3" style={{ margin: '20px 0 24px' }}>
              {WHO_FASES[checklistFase].itens.map(item => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dadosFase[item.key] ?? false}
                    onChange={e => setDadosFase(d => ({ ...d, [item.key]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600 shrink-0"
                  />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setChecklistFase(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Voltar</button>
              <button onClick={submeterFase} disabled={enviando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {enviando ? 'A registar...' : 'Confirmar ' + WHO_FASES[checklistFase].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
