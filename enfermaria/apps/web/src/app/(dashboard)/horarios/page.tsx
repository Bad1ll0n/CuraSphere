'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface HorarioTurno {
  id: string;
  tipo: string;
  data: string;
  profissionais: { utilizadorId: string; utilizador: { id: string; nome: string; role: string; ordemExperiencia?: number; equipa?: string } }[];
}

interface Escala {
  id: string;
  mes: number;
  ano: number;
  turnos: HorarioTurno[];
}

interface Utilizador {
  id: string;
  nome: string;
  role: string;
  equipa?: string;
  ordemExperiencia?: number;
}

const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const tipoCor: Record<string, { pill: string; cal: string }> = {
  manha: { pill: 'bg-amber-100 text-amber-700',   cal: 'bg-amber-50 text-amber-700 border border-amber-200' },
  tarde: { pill: 'bg-orange-100 text-orange-700', cal: 'bg-orange-50 text-orange-700 border border-orange-200' },
  noite: { pill: 'bg-indigo-100 text-indigo-700', cal: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
};

const roleLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function HorariosPagina() {
  const { utilizador } = useAuth();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [escala, setEscala] = useState<Escala | null>(null);
  const [_meuHorario, setMeuHorario] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<Utilizador[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Modal novo turno
  const [modalDia, setModalDia] = useState<string | null>(null);
  const [novoTurno, setNovoTurno] = useState({ tipo: 'manha', profissionaisIds: [] as string[] });
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  // Modal ver turno (enfermeiro)
  const [turnoVendo, setTurnoVendo] = useState<HorarioTurno | null>(null);

  // Modal editar turno
  const [turnoEditando, setTurnoEditando] = useState<HorarioTurno | null>(null);
  const [editTurno, setEditTurno] = useState({ tipo: 'manha', profissionaisIds: [] as string[] });
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroEdit, setErroEdit] = useState('');

  const [gerandoAuto, setGerandoAuto] = useState(false);
  const [resultadoAuto, setResultadoAuto] = useState<{ turnosCriados: number; profissionaisUsados: number; diasGerados: number } | null>(null);

  const isChefe = ['enfermeiro', 'medico', 'administrativo'].includes(utilizador?.role ?? '');
  const verApenasSeus = ['enfermeiro', 'auxiliar', 'medico', 'tecnico_saude', 'farmaceutico'].includes(utilizador?.role ?? '');

  const grupoDoChefe = utilizador?.role === 'medico'
    ? ['medico']
    : ['enfermeiro', 'auxiliar'];

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const [escalR, meuR] = await Promise.all([
        api.get(`/horarios/mes?mes=${mes}&ano=${ano}`).catch(() => ({ data: null })),
        api.get(`/horarios/meu?mes=${mes}&ano=${ano}`),
      ]);
      setEscala(escalR.data);
      setMeuHorario(meuR.data);
    } catch {
      setErro('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [mes, ano]);

  useEffect(() => {
    if (isChefe) {
      api.get('/utilizadores').then((r) => {
        const todos: Utilizador[] = r.data;
        // chefe_medicos vê só médicos; chefe_enfermeiros vê enfermeiros/auxiliares
        setProfissionais(todos.filter((u) => grupoDoChefe.includes(u.role)));
      }).catch(() => {});
    }
  }, [isChefe]);

  const turnosPorDia = escala?.turnos.reduce<Record<string, HorarioTurno[]>>((acc, t) => {
    if (verApenasSeus && !t.profissionais.some((p) => p.utilizador.id === utilizador?.id)) return acc;
    // Para chefers: só mostrar turnos que contenham profissionais do seu grupo (ou vazios para o placeholder)
    if (isChefe && t.profissionais.length > 0 && !t.profissionais.some((p) => grupoDoChefe.includes(p.utilizador.role))) return acc;
    const dia = new Date(t.data).toISOString().split('T')[0];
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(t);
    return acc;
  }, {}) ?? {};

  const diasDoMes = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => {
    const d = new Date(ano, mes - 1, i + 1);
    return d.toISOString().split('T')[0];
  });

  const hojeStr = hoje.toISOString().split('T')[0];

  const toggleProfissional = (id: string) => {
    setNovoTurno((prev) => ({
      ...prev,
      profissionaisIds: prev.profissionaisIds.includes(id)
        ? prev.profissionaisIds.filter((x) => x !== id)
        : [...prev.profissionaisIds, id],
    }));
  };

  const submeterTurno = async () => {
    if (!escala || !modalDia) return;
    if (novoTurno.profissionaisIds.length === 0) { setErroModal('Selecione pelo menos um profissional.'); return; }

    // Detectar conflitos: profissionais já com turno neste dia
    const turnosDoDia = turnosPorDia[modalDia] ?? [];
    const profissionaisComTurno = new Set(turnosDoDia.flatMap(t => t.profissionais.map(p => p.utilizadorId)));
    const conflitos = novoTurno.profissionaisIds.filter(id => profissionaisComTurno.has(id));
    if (conflitos.length > 0) {
      const nomes = conflitos.map(id => profissionais.find(p => p.id === id)?.nome ?? id).join(', ');
      setErroModal(`Conflito: ${nomes} já ${conflitos.length === 1 ? 'tem' : 'têm'} turno neste dia. Confirme para continuar.`);
      if (!window.confirm(`${nomes} já ${conflitos.length === 1 ? 'tem' : 'têm'} turno em ${modalDia}. Deseja continuar mesmo assim?`)) return;
      setErroModal('');
    }

    setSalvando(true);
    setErroModal('');
    try {
      await api.post(`/horarios/${escala.id}/turno`, {
        tipo: novoTurno.tipo,
        data: modalDia,
        profissionaisIds: novoTurno.profissionaisIds,
      });
      setModalDia(null);
      setNovoTurno({ tipo: 'manha', profissionaisIds: [] });
      await carregar();
    } catch (err: any) {
      setErroModal(err.response?.data?.message ?? 'Erro ao criar turno');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEditar = (t: HorarioTurno, e: React.MouseEvent) => {
    e.stopPropagation();
    setTurnoEditando(t);
    setEditTurno({ tipo: t.tipo, profissionaisIds: t.profissionais.map((p) => p.utilizador.id) });
    setErroEdit('');
  };

  const guardarEdicaoTurno = async () => {
    if (!turnoEditando) return;
    if (editTurno.profissionaisIds.length === 0) { setErroEdit('Selecione pelo menos um profissional.'); return; }
    setSalvandoEdit(true);
    setErroEdit('');
    try {
      await api.patch(`/horarios/turno/${turnoEditando.id}`, {
        tipo: editTurno.tipo,
        profissionaisIds: editTurno.profissionaisIds,
      });
      setTurnoEditando(null);
      await carregar();
    } catch (err: any) {
      setErroEdit(err.response?.data?.message ?? 'Erro ao guardar');
    } finally {
      setSalvandoEdit(false);
    }
  };

  const apagarTurno = async () => {
    if (!turnoEditando) return;
    if (!confirm('Apagar este turno?')) return;
    try {
      await api.delete(`/horarios/turno/${turnoEditando.id}`);
      setTurnoEditando(null);
      await carregar();
    } catch { /* silencioso */ }
  };

  const gerarAutomatico = async () => {
    setGerandoAuto(true);
    setResultadoAuto(null);
    try {
      const r = await api.post('/horarios/gerar-automatico', { mes, ano });
      setResultadoAuto(r.data);
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao gerar escala automática');
    } finally {
      setGerandoAuto(false);
    }
  };

  const toggleEditProfissional = (id: string) => {
    setEditTurno((prev) => ({
      ...prev,
      profissionaisIds: prev.profissionaisIds.includes(id)
        ? prev.profissionaisIds.filter((x) => x !== id)
        : [...prev.profissionaisIds, id],
    }));
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Horários</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Escala de {meses[mes - 1]} {ano}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
            style={{ padding: '10px 14px' }}>
            {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
            style={{ padding: '10px 14px' }}>
            {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>


      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '60px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : erro ? (
        <div className="text-slate-400 text-sm text-center" style={{ paddingTop: '60px' }}>{erro}</div>
      ) : !escala ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px' }}>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium" style={{ marginBottom: '6px' }}>Sem escala para {meses[mes - 1]} {ano}</p>
          <p className="text-slate-400 text-sm" style={{ marginBottom: '24px' }}>Ainda não foi criada uma escala para este mês</p>
          {isChefe && (
            <div className="flex gap-3">
              <button onClick={async () => { await api.post('/horarios', { mes, ano }); carregar(); }}
                className="border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '10px 24px', fontSize: '14px' }}>
                Criar Escala Vazia
              </button>
              <button onClick={gerarAutomatico} disabled={gerandoAuto}
                className="bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2"
                style={{ padding: '10px 24px', fontSize: '14px' }}>
                {gerandoAuto ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A gerar...
                  </>
                ) : 'Gerar Automaticamente'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {isChefe && (
            <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl flex-1" style={{ padding: '12px 16px' }}>
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-blue-700 text-sm">Clique num dia do calendário para adicionar um turno.</p>
              </div>
              <button onClick={gerarAutomatico} disabled={gerandoAuto}
                className="bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
                style={{ padding: '10px 18px' }}>
                {gerandoAuto ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A gerar...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Gerar Turnos Automáticos
                  </>
                )}
              </button>
            </div>
          )}

          {resultadoAuto && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-700 text-sm flex-1">
                Escala gerada: <strong>{resultadoAuto.turnosCriados} turnos</strong> criados para {resultadoAuto.diasGerados} dias,
                com <strong>{resultadoAuto.profissionaisUsados} profissionais</strong>.
              </p>
              <button onClick={() => setResultadoAuto(null)} className="text-green-400 hover:text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100">
              {diasSemana.map((d) => (
                <div key={d} className="text-center text-xs text-slate-400 font-semibold uppercase tracking-wide" style={{ padding: '14px 0' }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: new Date(ano, mes - 1, 1).getDay() }).map((_, i) => (
                <div key={`off-${i}`} className="border-r border-b border-slate-50 bg-slate-50/50" style={{ minHeight: '100px' }} />
              ))}
              {diasDoMes.map((dia) => {
                const turnos = turnosPorDia[dia] ?? [];
                const diaNum = new Date(dia).getDate();
                const ehHoje = dia === hojeStr;
                return (
                  <div
                    key={dia}
                    onClick={() => {
                  if (!isChefe) return;
                  const existentes = (turnosPorDia[dia] ?? []).map((t) => t.tipo);
                  const primeiroDisponivel = (['manha','tarde','noite'] as const).find((t) => !existentes.includes(t));
                  if (!primeiroDisponivel) return; // todos os turnos já existem
                  setNovoTurno({ tipo: primeiroDisponivel, profissionaisIds: [] });
                  setModalDia(dia);
                }}
                    className={`border-r border-b border-slate-100 ${isChefe ? 'cursor-pointer hover:bg-blue-50/40 transition-colors' : ''}`}
                    style={{ minHeight: '100px', padding: '10px 8px' }}
                  >
                    <div style={{ marginBottom: '6px' }}>
                      <span className={`text-xs font-semibold flex items-center justify-center rounded-full ${ehHoje ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                        style={{ width: '24px', height: '24px' }}>
                        {diaNum}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {(['manha', 'tarde', 'noite'] as const).map((tipo) => {
                        const t = turnos.find((x) => x.tipo === tipo);
                        if (t) {
                          return (
                            <div key={t.id}
                              className={`text-xs font-medium rounded-lg truncate cursor-pointer hover:opacity-75 ${tipoCor[tipo].cal}`}
                              style={{ padding: '3px 6px' }}
                              title={t.profissionais.map((p) => p.utilizador.nome).join(', ')}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isChefe) abrirEditar(t, e);
                                else setTurnoVendo(t);
                              }}>
                              {tipoLabel[tipo]} · {t.profissionais.length}
                            </div>
                          );
                        }
                        if (!isChefe) return null;
                        return (
                          <div key={tipo}
                            className="text-xs font-medium rounded-lg truncate cursor-pointer border border-dashed border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400 transition-colors"
                            style={{ padding: '3px 6px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNovoTurno({ tipo, profissionaisIds: [] });
                              setModalDia(dia);
                            }}>
                            {tipoLabel[tipo]} +
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal adicionar turno */}
      {modalDia && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Adicionar Turno</h2>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
                {new Date(modalDia).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Tipo de turno */}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '10px' }}>Tipo de Turno</label>
              <div className="grid grid-cols-3 gap-3">
                {(['manha', 'tarde', 'noite'] as const).map((t) => {
                  const jaExiste = modalDia ? (turnosPorDia[modalDia] ?? []).some((x) => x.tipo === t) : false;
                  return (
                  <button
                    key={t}
                    onClick={() => !jaExiste && setNovoTurno((p) => ({ ...p, tipo: t }))}
                    disabled={jaExiste}
                    className={`rounded-xl text-sm font-semibold transition-all border-2 ${
                      jaExiste
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : novoTurno.tipo === t
                          ? t === 'manha' ? 'border-amber-400 bg-amber-50 text-amber-700'
                            : t === 'tarde' ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    style={{ padding: '10px' }}
                  >
                    {tipoLabel[t]}{jaExiste ? ' ✓' : ''}
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Profissionais */}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '10px' }}>
                Profissionais
                {novoTurno.profissionaisIds.length > 0 && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '16px' }}>
                    {novoTurno.profissionaisIds.length} selecionados
                  </span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {profissionais.sort((a, b) => (a.equipa ?? '').localeCompare(b.equipa ?? '') || (a.ordemExperiencia ?? 999) - (b.ordemExperiencia ?? 999)).map((p, i, arr) => {
                  const selected = novoTurno.profissionaisIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProfissional(p.id)}
                      className={`flex items-center justify-between cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.nome}</p>
                        <p className="text-xs text-slate-400">{roleLabel[p.role] ?? p.role}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {erroModal && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                {erroModal}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setModalDia(null); setNovoTurno({ tipo: 'manha', profissionaisIds: [] }); setErroModal(''); }}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}
              >
                Cancelar
              </button>
              <button
                onClick={submeterTurno}
                disabled={salvando}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}
              >
                {salvando ? 'A guardar...' : 'Adicionar Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar turno */}
      {turnoEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Editar Turno</h2>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
                {new Date(turnoEditando.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '10px' }}>Tipo de Turno</label>
              <div className="grid grid-cols-3 gap-3">
                {(['manha', 'tarde', 'noite'] as const).map((t) => (
                  <button key={t}
                    onClick={() => setEditTurno((p) => ({ ...p, tipo: t }))}
                    className={`rounded-xl text-sm font-semibold transition-all border-2 ${
                      editTurno.tipo === t
                        ? t === 'manha' ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : t === 'tarde' ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                    style={{ padding: '10px' }}>
                    {tipoLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Profissionais */}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '10px' }}>
                Profissionais
                {editTurno.profissionaisIds.length > 0 && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '16px' }}>
                    {editTurno.profissionaisIds.length} selecionados
                  </span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {profissionais.sort((a, b) => (a.equipa ?? '').localeCompare(b.equipa ?? '') || (a.ordemExperiencia ?? 999) - (b.ordemExperiencia ?? 999)).map((p, i, arr) => {
                  const selected = editTurno.profissionaisIds.includes(p.id);
                  return (
                    <div key={p.id}
                      onClick={() => toggleEditProfissional(p.id)}
                      className={`flex items-center justify-between cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                      style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.nome}</p>
                        <p className="text-xs text-slate-400">Enfermeiro{p.equipa ? ` · Equipa ${p.equipa}` : ''}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {erroEdit && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                {erroEdit}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={apagarTurno}
                className="border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
                style={{ padding: '11px 16px' }}>
                Apagar
              </button>
              <button
                onClick={() => setTurnoEditando(null)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button
                onClick={guardarEdicaoTurno}
                disabled={salvandoEdit}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}>
                {salvandoEdit ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver turno (enfermeiro) */}
      {turnoVendo && (() => {
        const membros = turnoVendo.profissionais
          .filter((p) => grupoDoChefe.includes(p.utilizador.role))
          .sort((a, b) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999));
        const chefe = membros[0]?.utilizador;
        const outros = membros.slice(1);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <div className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg ${tipoCor[turnoVendo.tipo].cal}`} style={{ marginBottom: '12px' }}>
                  {tipoLabel[turnoVendo.tipo]}
                </div>
                <h2 className="text-xl font-bold text-slate-900">Equipa do Turno</h2>
                <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
                  {new Date(turnoVendo.data).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              {/* Chefe */}
              {chefe && (
                <div style={{ marginBottom: '20px' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                    Chefe de Turno
                  </p>
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl" style={{ padding: '12px 16px' }}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {chefe.nome.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{chefe.nome}</p>
                      <p className="text-xs text-blue-600 font-medium" style={{ marginTop: '2px' }}>
                        Chefe de Turno
                      </p>
                    </div>
                    {chefe.id === utilizador?.id && (
                      <span className="ml-auto text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Tu</span>
                    )}
                  </div>
                </div>
              )}

              {/* Restantes */}
              {outros.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                    {utilizador?.role === 'medico' ? 'Médicos' : 'Enfermeiros'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {outros.map((p) => {
                      return (
                        <div key={p.utilizador.id} className="flex items-center gap-3 bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {p.utilizador.nome.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{p.utilizador.nome}</p>
                            {p.utilizador.equipa && <p className="text-xs text-slate-400" style={{ marginTop: '1px' }}>Equipa {p.utilizador.equipa}</p>}
                          </div>
                          {p.utilizador.id === utilizador?.id && (
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">Tu</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => setTurnoVendo(null)}
                className="w-full border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Fechar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
