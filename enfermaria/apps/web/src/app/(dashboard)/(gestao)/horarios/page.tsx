'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface HorarioTurno {
  id: string;
  tipo: string;
  data: string;
  profissionais: { utilizadorId: string; utilizador: { id: string; nome: string; role: string; subRole?: string; servico?: string; ordemExperiencia?: number; equipa?: string } }[];
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
  servico?: string;
  equipa?: string;
  ordemExperiencia?: number;
}

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  estado: string;
  utilizador: { id: string; nome: string };
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
  const [, setMeuHorario] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<Utilizador[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
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

  // Painel de dia
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [consultasDia, setConsultasDia] = useState<any[]>([]);
  const [loadingConsultas, setLoadingConsultas] = useState(false);

  const [gerandoAuto, setGerandoAuto] = useState(false);
  const [resultadoAuto, setResultadoAuto] = useState<{ turnosCriados: number; profissionaisUsados: number; diasGerados: number } | null>(null);

  // Gestão de folgas
  const [minhasFolgas, setMinhasFolgas] = useState<Array<{ id: string; dataInicio: string; dataFim: string; estado: string; tipo: string }>>([]);
  const [folgasPendentes, setFolgasPendentes] = useState<Array<Ausencia & { tipo: string }>>([]);
  const [pedindoFolga, setPedindoFolga] = useState(false);
  const [aprovandoFolga, setAprovandoFolga] = useState<string | null>(null);

  // Trocas de folga
  interface TrocaFolga {
    id: string; estado: string; dataOrigem: string; dataDestino: string; motivo?: string; criadoEm: string;
    solicitante: { id: string; nome: string; role: string };
    destinatario: { id: string; nome: string; role: string };
    aprovadoPor?: { id: string; nome: string } | null;
  }
  const [minhasTrocas, setMinhasTrocas] = useState<TrocaFolga[]>([]);
  const [trocasParaAprovar, setTrocasParaAprovar] = useState<TrocaFolga[]>([]);
  const [modalTroca, setModalTroca] = useState<{ diaOrigem: string } | null>(null);
  const [trocaDestId, setTrocaDestId] = useState('');
  const [trocaDiaDest, setTrocaDiaDest] = useState('');
  const [trocaMotivo, setTrocaMotivo] = useState('');
  const [submittingTroca, setSubmittingTroca] = useState(false);
  const [respondendoTroca, setRespondendoTroca] = useState<string | null>(null);

  const SUBROLES_CHEFE_ENF = ['supervisor_enfermagem', 'head_nurse'];
  const isChefe =
    (utilizador?.role === 'enfermeiro' && SUBROLES_CHEFE_ENF.includes(utilizador?.subRole ?? '')) ||
    utilizador?.role === 'administrativo';
  const verApenasSeus = !isChefe;
  const grupoDoChefe = utilizador?.role === 'administrativo'
    ? ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'farmaceutico']
    : ['enfermeiro', 'auxiliar'];

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const [escalR, meuR, ausenciasR, minhasFolgasR, minhasTrocasR] = await Promise.all([
        api.get(`/horarios/mes?mes=${mes}&ano=${ano}`).catch(() => ({ data: null })),
        api.get(`/horarios/meu?mes=${mes}&ano=${ano}`),
        api.get(`/horarios/ausencias?mes=${mes}&ano=${ano}`).catch(() => ({ data: [] })),
        api.get('/rh/ausencias/minhas').catch(() => ({ data: [] })),
        api.get('/rh/trocas-folga/minhas').catch(() => ({ data: [] })),
      ]);
      setEscala(escalR.data);
      setMeuHorario(meuR.data);
      setAusencias(ausenciasR.data ?? []);
      setMinhasFolgas((minhasFolgasR.data ?? []).filter((a: any) => a.tipo === 'folga'));
      setMinhasTrocas(minhasTrocasR.data ?? []);
    } catch {
      setErro('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [mes, ano]);

  useEffect(() => {
    if (!diaSelecionado || utilizador?.role !== 'medico') { setConsultasDia([]); return; }
    setLoadingConsultas(true);
    api.get(`/consultas?medicoId=${utilizador.id}&data=${diaSelecionado}`)
      .then((r) => setConsultasDia(r.data ?? []))
      .catch(() => setConsultasDia([]))
      .finally(() => setLoadingConsultas(false));
  }, [diaSelecionado]);

  useEffect(() => {
    if (isChefe) {
      api.get('/utilizadores').then((r) => {
        const todos: Utilizador[] = r.data?.data ?? r.data ?? [];
        setProfissionais(todos.filter((u) =>
          grupoDoChefe.includes(u.role) &&
          (utilizador?.role === 'administrativo' || u.servico === utilizador?.servico)
        ));
      }).catch(() => {});
    }
  }, [isChefe]);

  useEffect(() => {
    if (!isChefe) return;
    Promise.all([
      api.get('/rh/ausencias/para-aprovar').catch(() => ({ data: [] })),
      api.get('/rh/trocas-folga/para-aprovar').catch(() => ({ data: [] })),
    ]).then(([ausR, trocR]) => {
      setFolgasPendentes((ausR.data ?? []).filter((a: any) => a.tipo === 'folga'));
      setTrocasParaAprovar(trocR.data ?? []);
    });
  }, [isChefe, mes, ano]);

  const mensagemSemTurnos: Record<string, string> = {
    medico: 'O seu horário é gerido pela agenda de consultas.',
    farmaceutico: 'O seu horário é fixo — consulte o responsável de serviço.',
    tecnico_saude: 'O seu horário depende das sessões agendadas.',
  };

  const turnosPorDia = escala?.turnos.reduce<Record<string, HorarioTurno[]>>((acc, t) => {
    // Não-chefes: ver turnos do seu role+serviço OU turnos onde está pessoalmente (fallback)
    if (verApenasSeus) {
      const euEstou = t.profissionais.some((p) => p.utilizador.id === utilizador?.id);
      const grupoOk  = t.profissionais.some((p) =>
        p.utilizador.role === utilizador?.role &&
        (!utilizador?.servico || p.utilizador.servico === utilizador?.servico)
      );
      if (!euEstou && !grupoOk) return acc;
    }
    // Chefe enfermeiro supervisor: ver só turnos do seu grupo+serviço
    if (isChefe && utilizador?.role !== 'administrativo' && t.profissionais.length > 0 &&
      !t.profissionais.some((p) =>
        grupoDoChefe.includes(p.utilizador.role) && p.utilizador.servico === utilizador?.servico
      )
    ) return acc;
    // Administrativo: ver turnos do grupo de roles (sem filtro de serviço)
    if (isChefe && utilizador?.role === 'administrativo' && t.profissionais.length > 0 &&
      !t.profissionais.some((p) => grupoDoChefe.includes(p.utilizador.role))
    ) return acc;
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

  const isAusenteNoDia = (profId: string, diaStr: string) => {
    const dia = new Date(diaStr + 'T12:00:00Z');
    return ausencias.some(a =>
      a.utilizador.id === profId &&
      new Date(a.dataInicio) <= dia &&
      new Date(a.dataFim) >= dia
    );
  };

  const minhaFolgaNoDia = (diaStr: string) => {
    const dia = new Date(diaStr + 'T12:00:00Z');
    return minhasFolgas.find(f =>
      new Date(f.dataInicio) <= dia && new Date(f.dataFim) >= dia
    );
  };

  const pedirFolga = async (diaStr: string) => {
    setPedindoFolga(true);
    try {
      await api.post('/rh/ausencias', { tipo: 'folga', dataInicio: diaStr, dataFim: diaStr });
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao pedir folga');
    } finally {
      setPedindoFolga(false);
    }
  };

  const cancelarFolga = async (folgaId: string) => {
    if (!confirm('Cancelar este pedido de folga?')) return;
    try {
      await api.delete(`/rh/ausencias/${folgaId}`);
      await carregar();
    } catch { /* silencioso */ }
  };

  const aprovarFolga = async (id: string) => {
    setAprovandoFolga(id);
    try {
      await api.patch(`/rh/ausencias/${id}/aprovar`);
      setFolgasPendentes(prev => prev.filter(f => f.id !== id));
      await carregar();
    } finally { setAprovandoFolga(null); }
  };

  const rejeitarFolga = async (id: string) => {
    setAprovandoFolga(id);
    try {
      await api.patch(`/rh/ausencias/${id}/rejeitar`);
      setFolgasPendentes(prev => prev.filter(f => f.id !== id));
    } finally { setAprovandoFolga(null); }
  };

  const pedirTrocaFolga = async () => {
    if (!modalTroca || !trocaDestId || !trocaDiaDest) return;
    setSubmittingTroca(true);
    try {
      await api.post('/rh/trocas-folga', {
        destinatarioId: trocaDestId,
        dataOrigem: modalTroca.diaOrigem,
        dataDestino: trocaDiaDest,
        motivo: trocaMotivo || undefined,
      });
      setModalTroca(null);
      setTrocaDestId('');
      setTrocaDiaDest('');
      setTrocaMotivo('');
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao pedir troca de folga');
    } finally {
      setSubmittingTroca(false);
    }
  };

  const aceitarTrocaFolga = async (id: string) => {
    setRespondendoTroca(id);
    try {
      await api.patch(`/rh/trocas-folga/${id}/aceitar`);
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro');
    } finally { setRespondendoTroca(null); }
  };

  const recusarTrocaFolga = async (id: string) => {
    setRespondendoTroca(id);
    try {
      await api.patch(`/rh/trocas-folga/${id}/recusar`);
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro');
    } finally { setRespondendoTroca(null); }
  };

  const aprovarTrocaFolga = async (id: string) => {
    setRespondendoTroca(id);
    try {
      await api.patch(`/rh/trocas-folga/${id}/aprovar`);
      setTrocasParaAprovar(prev => prev.filter(t => t.id !== id));
      await carregar();
    } finally { setRespondendoTroca(null); }
  };

  const cancelarTrocaFolga = async (id: string) => {
    if (!confirm('Cancelar este pedido de troca de folga?')) return;
    try {
      await api.patch(`/rh/trocas-folga/${id}/cancelar`);
      await carregar();
    } catch { /* silencioso */ }
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
      ) : !escala && isChefe ? (
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
          {verApenasSeus && mensagemSemTurnos[utilizador?.role ?? ''] && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-500 text-sm">{mensagemSemTurnos[utilizador?.role ?? '']}</p>
            </div>
          )}

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

          {/* Pedidos de Folga Pendentes (chefe) */}
          {isChefe && folgasPendentes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px', marginBottom: '20px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                <div className="w-6 h-6 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Pedidos de Folga Pendentes</h3>
                <span className="text-xs font-bold text-yellow-700 bg-yellow-100 rounded-full w-5 h-5 flex items-center justify-center">{folgasPendentes.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {folgasPendentes.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{f.utilizador.nome}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(f.dataInicio).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {f.dataInicio !== f.dataFim && ` – ${new Date(f.dataFim).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => rejeitarFolga(f.id)}
                        disabled={aprovandoFolga === f.id}
                        className="text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        style={{ padding: '5px 12px' }}>
                        Rejeitar
                      </button>
                      <button
                        onClick={() => aprovarFolga(f.id)}
                        disabled={aprovandoFolga === f.id}
                        className="text-xs font-semibold bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                        style={{ padding: '5px 12px' }}>
                        {aprovandoFolga === f.id ? '...' : 'Aprovar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trocas de Folga para Aprovar (chefe) */}
          {isChefe && trocasParaAprovar.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px', marginBottom: '20px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Trocas de Folga para Aprovar</h3>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full w-5 h-5 flex items-center justify-center">{trocasParaAprovar.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trocasParaAprovar.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {t.solicitante.nome} ↔ {t.destinatario.nome}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(t.dataOrigem).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} →{' '}
                        {new Date(t.dataDestino).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <button
                      onClick={() => aprovarTrocaFolga(t.id)}
                      disabled={respondendoTroca === t.id}
                      className="text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                      style={{ padding: '5px 14px' }}>
                      {respondendoTroca === t.id ? '...' : 'Aprovar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* As minhas trocas de folga pendentes/recebidas */}
          {minhasTrocas.filter(t => ['pendente', 'aceite'].includes(t.estado)).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px', marginBottom: '20px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700">Trocas de Folga</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {minhasTrocas.filter(t => ['pendente', 'aceite'].includes(t.estado)).map(t => {
                  const euSouSolicitante = t.solicitante.id === utilizador?.id;
                  const euSouDestinatario = t.destinatario.id === utilizador?.id;
                  const estadoCor = t.estado === 'aceite' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200';
                  return (
                    <div key={t.id} className="bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {euSouSolicitante ? `→ ${t.destinatario.nome}` : `← ${t.solicitante.nome}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            Minha folga {new Date(euSouSolicitante ? t.dataOrigem : t.dataDestino).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                            {' ↔ '}
                            folga de {euSouSolicitante ? t.destinatario.nome.split(' ')[0] : t.solicitante.nome.split(' ')[0]}{' '}
                            {new Date(euSouSolicitante ? t.dataDestino : t.dataOrigem).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${estadoCor}`}>
                          {t.estado === 'aceite' ? 'Aceite — aguarda chefe' : 'Pendente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                        {euSouDestinatario && t.estado === 'pendente' && (
                          <>
                            <button
                              onClick={() => recusarTrocaFolga(t.id)}
                              disabled={respondendoTroca === t.id}
                              className="text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              style={{ padding: '4px 10px' }}>
                              Recusar
                            </button>
                            <button
                              onClick={() => aceitarTrocaFolga(t.id)}
                              disabled={respondendoTroca === t.id}
                              className="text-xs font-semibold bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                              style={{ padding: '4px 10px' }}>
                              {respondendoTroca === t.id ? '...' : 'Aceitar'}
                            </button>
                          </>
                        )}
                        {euSouSolicitante && t.estado === 'pendente' && (
                          <button
                            onClick={() => cancelarTrocaFolga(t.id)}
                            className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                            style={{ padding: '4px 10px' }}>
                            Cancelar pedido
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                    onClick={() => setDiaSelecionado(dia)}
                    className="border-r border-b border-slate-100 cursor-pointer hover:bg-blue-50/30 transition-colors"
                    style={{ minHeight: '100px', padding: '10px 8px' }}
                  >
                    <div style={{ marginBottom: '6px' }}>
                      <span className={`text-xs font-semibold flex items-center justify-center rounded-full ${ehHoje ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                        style={{ width: '24px', height: '24px' }}>
                        {diaNum}
                      </span>
                    </div>
                    {utilizador && isAusenteNoDia(utilizador.id, dia) && (
                      <div className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-md text-center" style={{ padding: '2px 4px', marginBottom: '3px' }}>
                        Ausência
                      </div>
                    )}
                    {(() => {
                      const f = minhaFolgaNoDia(dia);
                      if (!f) return null;
                      const aprovada = f.estado === 'aprovada';
                      return (
                        <div className={`text-[10px] font-semibold rounded-md text-center ${aprovada ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}
                          style={{ padding: '2px 4px', marginBottom: '3px' }}>
                          {aprovada ? 'Folga ✓' : 'Folga ⟳'}
                        </div>
                      );
                    })()}
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
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '16px' }}>
                    {novoTurno.profissionaisIds.length} selecionados
                  </span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {profissionais.sort((a, b) => (a.equipa ?? '').localeCompare(b.equipa ?? '') || (a.ordemExperiencia ?? 999) - (b.ordemExperiencia ?? 999)).map((p, i, arr) => {
                  const selected = novoTurno.profissionaisIds.includes(p.id);
                  const ausente = modalDia ? isAusenteNoDia(p.id, modalDia) : false;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !ausente && toggleProfissional(p.id)}
                      className={`flex items-center justify-between transition-colors ${ausente ? 'opacity-50 cursor-not-allowed bg-slate-50' : selected ? 'bg-blue-50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'}`}
                      style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                    >
                      <div>
                        <p className={`text-sm font-medium ${ausente ? 'text-slate-400' : 'text-slate-800'}`}>{p.nome}</p>
                        <p className="text-xs text-slate-400">
                          {roleLabel[p.role] ?? p.role}
                          {ausente && <span className="ml-1 text-amber-500 font-semibold">(em férias)</span>}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ausente ? 'border-slate-200 bg-slate-100' : selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && !ausente && (
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
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '16px' }}>
                    {editTurno.profissionaisIds.length} selecionados
                  </span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {profissionais.sort((a, b) => (a.equipa ?? '').localeCompare(b.equipa ?? '') || (a.ordemExperiencia ?? 999) - (b.ordemExperiencia ?? 999)).map((p, i, arr) => {
                  const selected = editTurno.profissionaisIds.includes(p.id);
                  const diaTurno = turnoEditando ? turnoEditando.data.split('T')[0] : null;
                  const ausente = diaTurno ? isAusenteNoDia(p.id, diaTurno) : false;
                  return (
                    <div key={p.id}
                      onClick={() => !ausente && toggleEditProfissional(p.id)}
                      className={`flex items-center justify-between transition-colors ${ausente ? 'opacity-50 cursor-not-allowed bg-slate-50' : selected ? 'bg-blue-50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'}`}
                      style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div>
                        <p className={`text-sm font-medium ${ausente ? 'text-slate-400' : 'text-slate-800'}`}>{p.nome}</p>
                        <p className="text-xs text-slate-400">
                          {roleLabel[p.role] ?? p.role}{p.equipa ? ` · Equipa ${p.equipa}` : ''}
                          {ausente && <span className="ml-1 text-amber-500 font-semibold">(em férias)</span>}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ausente ? 'border-slate-200 bg-slate-100' : selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && !ausente && (
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
        const rankMembro = (p: typeof turnoVendo.profissionais[0]) => {
          if (p.utilizador.role === 'enfermeiro' && SUBROLES_CHEFE_ENF.includes(p.utilizador.subRole ?? '')) return 0;
          if (p.utilizador.role === 'enfermeiro') return 1;
          return 2;
        };
        const membros = turnoVendo.profissionais
          .filter((p) => !isChefe || grupoDoChefe.includes(p.utilizador.role))
          .sort((a, b) => {
            const diff = rankMembro(a) - rankMembro(b);
            if (diff !== 0) return diff;
            return (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999);
          });
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
                      <span className="ml-auto text-xs font-semibold text-blue-600 bg-blue-100 badge-pad py-0.5 rounded-full">Tu</span>
                    )}
                  </div>
                </div>
              )}

              {/* Restantes */}
              {outros.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                    Equipa
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
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200 badge-pad py-0.5 rounded-full">Tu</span>
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
      {/* Modal pedir troca de folga */}
      {modalTroca && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Pedir Troca de Folga</h2>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
                A sua folga: <strong>{new Date(modalTroca.diaOrigem).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Com quem quer trocar?</label>
              <select
                value={trocaDestId}
                onChange={e => setTrocaDestId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                style={{ padding: '10px 14px' }}>
                <option value="">Selecionar colega...</option>
                {profissionais.filter(p => p.id !== utilizador?.id).map(p => (
                  <option key={p.id} value={p.id}>{p.nome} ({roleLabel[p.role] ?? p.role})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Dia da folga do colega (a receber)</label>
              <input
                type="date"
                value={trocaDiaDest}
                onChange={e => setTrocaDiaDest(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Motivo (opcional)</label>
              <input
                type="text"
                value={trocaMotivo}
                onChange={e => setTrocaMotivo(e.target.value)}
                placeholder="ex: compromisso familiar"
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setModalTroca(null); setTrocaDestId(''); setTrocaDiaDest(''); setTrocaMotivo(''); }}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button
                onClick={pedirTrocaFolga}
                disabled={submittingTroca || !trocaDestId || !trocaDiaDest}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}>
                {submittingTroca ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painel lateral — vista de dia */}
      {diaSelecionado && (() => {
        const turnosDia = turnosPorDia[diaSelecionado] ?? [];
        const dataObj = new Date(diaSelecionado + 'T12:00:00');
        const horasLabel: Record<string, string> = {
          manha: '08:00 – 16:00',
          tarde: '16:00 – 00:00',
          noite: '00:00 – 08:00',
        };
        return (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" style={{ backdropFilter: 'blur(2px)' }} onClick={() => setDiaSelecionado(null)} />
            <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col" style={{ width: '420px' }}>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 shrink-0" style={{ padding: '24px 24px 20px' }}>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '2px' }}>
                    {diasSemana[dataObj.getDay()]}
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">
                    {dataObj.getDate()} de {meses[mes - 1]} {ano}
                  </h2>
                </div>
                <button onClick={() => setDiaSelecionado(null)}
                  className="text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                  style={{ padding: '8px' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Aviso férias/ausência */}
              {utilizador && isAusenteNoDia(utilizador.id, diaSelecionado) && (
                <div className="bg-amber-50 border-b border-amber-100 shrink-0" style={{ padding: '10px 24px' }}>
                  <span className="text-xs font-semibold text-amber-700">Ausência aprovada neste dia</span>
                </div>
              )}
              {/* Aviso folga */}
              {(() => {
                const f = minhaFolgaNoDia(diaSelecionado);
                if (!f) return null;
                return (
                  <div className={`border-b shrink-0 flex items-center justify-between ${f.estado === 'aprovada' ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}
                    style={{ padding: '10px 24px' }}>
                    <span className={`text-xs font-semibold ${f.estado === 'aprovada' ? 'text-green-700' : 'text-yellow-700'}`}>
                      {f.estado === 'aprovada' ? 'Folga aprovada neste dia' : 'Pedido de folga pendente'}
                    </span>
                    {f.estado === 'pendente' && (
                      <button onClick={() => cancelarFolga(f.id)}
                        className="text-xs text-yellow-600 hover:text-yellow-800 font-semibold underline">
                        Cancelar
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Corpo */}
              <div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>

                {/* Botão adicionar turno (chefe) */}
                {isChefe && (
                  <button
                    onClick={() => {
                      const existentes = turnosDia.map((t) => t.tipo);
                      const primeiroDisponivel = (['manha','tarde','noite'] as const).find((t) => !existentes.includes(t));
                      if (!primeiroDisponivel) return;
                      setNovoTurno({ tipo: primeiroDisponivel, profissionaisIds: [] });
                      setModalDia(diaSelecionado);
                    }}
                    disabled={turnosDia.length >= 3}
                    className="w-full bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{ padding: '10px', marginBottom: '20px' }}>
                    {turnosDia.length >= 3 ? 'Todos os turnos preenchidos' : '+ Adicionar Turno'}
                  </button>
                )}

                {/* Blocos de turno — só para profissionais com turnos rotativos */}
                {!mensagemSemTurnos[utilizador?.role ?? ''] && <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(['manha', 'tarde', 'noite'] as const).map((tipo) => {
                    const turno = turnosDia.find((t) => t.tipo === tipo);
                    return (
                      <div key={tipo}
                        className={`rounded-2xl border ${turno ? tipoCor[tipo].cal : 'border-slate-100 bg-slate-50/50'}`}
                        style={{ padding: '16px' }}>

                        {/* Cabeçalho do bloco */}
                        <div className="flex items-center justify-between" style={{ marginBottom: turno ? '14px' : '0' }}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold rounded-lg ${turno ? tipoCor[tipo].cal : 'bg-slate-100 text-slate-400'}`}
                              style={{ padding: '3px 10px' }}>
                              {tipoLabel[tipo]}
                            </span>
                            <span className="text-xs text-slate-400">{horasLabel[tipo]}</span>
                          </div>
                          {turno && isChefe && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setTurnoEditando(turno);
                                  setEditTurno({ tipo: turno.tipo, profissionaisIds: turno.profissionais.map((p) => p.utilizador.id) });
                                  setErroEdit('');
                                }}
                                className="text-xs text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                style={{ padding: '3px 8px' }}>
                                Editar
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('Apagar este turno?')) return;
                                  await api.delete(`/horarios/turno/${turno.id}`);
                                  await carregar();
                                }}
                                className="text-xs text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                style={{ padding: '3px 8px' }}>
                                Apagar
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Profissionais */}
                        {turno ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {turno.profissionais
                              .slice()
                              .sort((a, b) => {
                                const rank = (p: typeof a) => {
                                  if (p.utilizador.role === 'enfermeiro' && SUBROLES_CHEFE_ENF.includes(p.utilizador.subRole ?? '')) return 0;
                                  if (p.utilizador.role === 'enfermeiro') return 1;
                                  return 2;
                                };
                                const diff = rank(a) - rank(b);
                                if (diff !== 0) return diff;
                                return (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999);
                              })
                              .map((p) => (
                                <div key={p.utilizadorId} className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {p.utilizador.nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{p.utilizador.nome}</p>
                                    <p className="text-xs text-slate-400">{roleLabel[p.utilizador.role] ?? p.utilizador.role}</p>
                                  </div>
                                  {p.utilizador.id === utilizador?.id && (
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 rounded-full badge-pad py-0.5 shrink-0">Tu</span>
                                  )}
                                </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Sem turno atribuído</p>
                        )}
                      </div>
                    );
                  })}
                </div>}

                {/* Pedir Folga (non-chefes) */}
                {!isChefe && (() => {
                  const f = minhaFolgaNoDia(diaSelecionado);
                  const isPassado = new Date(diaSelecionado) < new Date(hojeStr);
                  if (isPassado) return null;
                  return (
                    <div style={{ marginTop: '20px' }}>
                      <div className="border-t border-slate-100" style={{ paddingTop: '20px' }}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '10px' }}>Folga</p>
                        {!f ? (
                          <button
                            onClick={() => pedirFolga(diaSelecionado)}
                            disabled={pedindoFolga}
                            className="w-full border border-dashed border-slate-300 text-slate-600 text-sm font-medium rounded-xl hover:border-yellow-400 hover:text-yellow-700 hover:bg-yellow-50 disabled:opacity-50 transition-colors"
                            style={{ padding: '10px' }}>
                            {pedindoFolga ? 'A enviar pedido...' : '+ Pedir folga neste dia'}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setModalTroca({ diaOrigem: diaSelecionado }); setDiaSelecionado(null); }}
                            className="w-full border border-dashed border-indigo-300 text-indigo-600 text-sm font-medium rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                            style={{ padding: '10px', marginTop: '6px' }}>
                            ↔ Pedir troca de folga neste dia
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Consultas do dia (médicos) */}
                {utilizador?.role === 'medico' && (
                  <div style={{ marginTop: '24px' }}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>
                      Consultas
                    </p>
                    {loadingConsultas ? (
                      <p className="text-xs text-slate-400">A carregar...</p>
                    ) : consultasDia.length === 0 ? (
                      <p className="text-xs text-slate-400">Sem consultas agendadas neste dia</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {consultasDia.map((c: any) => {
                          const hora = new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                          const estadoCor: Record<string, string> = {
                            agendada:  'bg-blue-50 text-blue-700 border-blue-200',
                            realizada: 'bg-green-50 text-green-700 border-green-200',
                            cancelada: 'bg-red-50 text-red-500 border-red-200',
                          };
                          const estadoLabel: Record<string, string> = {
                            agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada',
                          };
                          return (
                            <div key={c.id} className="flex items-start gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm" style={{ padding: '14px' }}>
                              <div className="text-center shrink-0" style={{ minWidth: '44px' }}>
                                <p className="text-sm font-bold text-slate-800">{hora}</p>
                                <p className="text-xs text-slate-400">{c.duracao}min</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {c.doente?.nome ?? c.nomeDoente ?? 'Doente externo'}
                                </p>
                                <p className="text-xs text-slate-400">{c.especialidade}</p>
                              </div>
                              <span className={`text-xs font-semibold border rounded-lg shrink-0 ${estadoCor[c.estado] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                style={{ padding: '2px 8px' }}>
                                {estadoLabel[c.estado] ?? c.estado}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
