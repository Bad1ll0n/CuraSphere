'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  dataAlta?: string;
  ativo: boolean;
  cama: { numero: string; quarto: string };
  atribuicoes: { enfermeiro: { id: string; nome: string; role: string } }[];
  atribuicoesHorario: { utilizador: { id: string; nome: string; role: string }; horarioTurno: { tipo: string; data: string } }[];
  tarefas: Tarefa[];
  medicacoes: Medicacao[];
  notasTurno: NotaTurno[];
}

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  criadaEm: string;
  concluidaEm?: string;
  grupoResponsavel?: string;
  responsavel?: { id: string; nome: string; role: string };
  criadoPor?: { id: string; nome: string; role: string };
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  terminadoEm?: string;
  ativo: boolean;
  prescritoPor?: { id: string; nome: string };
}

interface NotaTurno {
  id: string;
  texto: string;
  criadaEm: string;
  autor: { id: string; nome: string; role: string };
}


const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:       { badge: 'bg-green-50 text-green-700 border border-green-200',    dot: 'bg-green-500' },
  grave:         { badge: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  critico:       { badge: 'bg-red-50 text-red-700 border border-red-200',           dot: 'bg-red-500' },
  alta_prevista: { badge: 'bg-blue-50 text-blue-700 border border-blue-200',        dot: 'bg-blue-500' },
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const prioridadeCor: Record<string, string> = {
  baixa:   'bg-slate-100 text-slate-500',
  media:   'bg-blue-50 text-blue-600',
  alta:    'bg-orange-50 text-orange-600',
  urgente: 'bg-red-50 text-red-600',
};
const prioridadeLabel: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar', medico: 'Médico',
  chefe_turno: 'Chefe Turno', chefe_enfermeiros: 'Chefe Enfermeiros', administrativo: 'Administrativo',
};

function calcIdade(dataNascimento: string) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function BtnAdd({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
      style={{ marginLeft: 'auto' }}>
      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

export default function DoenteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { utilizador } = useAuth();
  const [doente, setDoente] = useState<Doente | null>(null);
  const [loading, setLoading] = useState(true);
  const [alterandoEstado, setAlterandoEstado] = useState(false);
  const [confirmandoAlta, setConfirmandoAlta] = useState(false);
  const [salvandoAlta, setSalvandoAlta] = useState(false);

  // Modals
  const [modalNota, setModalNota] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<Tarefa[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [medHistorico, setMedHistorico] = useState<Medicacao[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  // Nota form
  const [notaTexto, setNotaTexto] = useState('');

  // Edição inline de notas
  const [notaEditandoId, setNotaEditandoId] = useState<string | null>(null);
  const [notaEditTexto, setNotaEditTexto] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  // Turno ativo do utilizador
  const [emTurno, setEmTurno] = useState(false);

  // Tarefa form
  const [tarefaDesc, setTarefaDesc] = useState('');
  const [tarefaTipo, setTarefaTipo] = useState('clinica');
  const [tarefaPrioridade, setTarefaPrioridade] = useState('media');
  const [tarefaGrupo, setTarefaGrupo] = useState('');
  const [tarefaPrazo, setTarefaPrazo] = useState('');

  // Medicação form
  const [medNome, setMedNome] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medVia, setMedVia] = useState('');
  const [medFreq, setMedFreq] = useState('');

  const podeAlterarEstado = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeDarAlta = ['administrativo', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'].includes(utilizador?.role ?? '');
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos', 'auxiliar'].includes(utilizador?.role ?? '');
  const podePrescreveMed = ['medico', 'chefe_medicos'].includes(utilizador?.role ?? '');

  // Grupo de role: médicos vêem só médicos; enfermagem vê só enfermagem
  const grupoMedico = ['medico', 'chefe_medicos'];
  const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
  const meuGrupo = grupoMedico.includes(utilizador?.role ?? '') ? grupoMedico : grupoEnfermagem;

  // Chave do grupo para filtrar tarefas por grupoResponsavel
  const meuGrupoChave = (() => {
    const role = utilizador?.role ?? '';
    if (['medico', 'chefe_medicos'].includes(role)) return 'medico';
    if (role === 'auxiliar') return 'auxiliar';
    return 'enfermeiro';
  })();

  // Grupos que cada role pode escolher ao criar tarefa
  const gruposDisponiveis = (() => {
    const role = utilizador?.role ?? '';
    if (['medico', 'chefe_medicos'].includes(role)) return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const grupoLabel: Record<string, string> = {
    medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  };

  const concluirMedicacao = async (medId: string) => {
    if (!confirm('Confirmar conclusão desta medicação?')) return;
    try {
      await api.patch(`/medicacao/${medId}/descontinuar`);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao concluir medicação');
    }
  };

  const abrirHistoricoMed = async () => {
    setLoadingHistoricoMed(true);
    setModalHistoricoMed(true);
    try {
      const r = await api.get(`/medicacao/doente/${id}`);
      setMedHistorico(r.data.filter((m: Medicacao) => !m.ativo));
    } catch { setMedHistorico([]); }
    finally { setLoadingHistoricoMed(false); }
  };

  const abrirHistorico = async () => {
    setLoadingHistorico(true);
    setModalHistorico(true);
    try {
      const r = await api.get(`/tarefas/doente/${id}`);
      const concluidas = r.data.filter((t: Tarefa) => t.estado === 'concluida');
      setTarefasHistorico(concluidas);
    } catch { setTarefasHistorico([]); }
    finally { setLoadingHistorico(false); }
  };

  const carregar = () => {
    setLoading(true);
    api.get(`/doentes/${id}`)
      .then((r) => setDoente(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
    verificarTurnoAtivo();
  }, [id]);

  const verificarTurnoAtivo = async () => {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60)       { tipo = 'manha'; }
    else if (min >= 16 * 60 && min < 23 * 60) { tipo = 'tarde'; }
    else if (min >= 23 * 60)                   { tipo = 'noite'; }
    else                                        { tipo = 'noite'; dataRef.setDate(dataRef.getDate() - 1); }

    try {
      const r = await api.get(`/horarios/meu?mes=${dataRef.getMonth() + 1}&ano=${dataRef.getFullYear()}`);
      const diaRef = dataRef.toDateString();
      const temTurno = r.data.some((h: any) =>
        h.horarioTurno.tipo === tipo &&
        new Date(h.horarioTurno.data).toDateString() === diaRef
      );
      setEmTurno(temTurno);
    } catch { setEmTurno(false); }
  };

  const alterarEstado = async (novoEstado: string) => {
    await api.patch(`/doentes/${id}/estado`, { estado: novoEstado });
    setAlterandoEstado(false);
    carregar();
  };

  const darAlta = async () => {
    setSalvandoAlta(true);
    try {
      await api.patch(`/doentes/${id}/alta`);
      router.push('/doentes');
    } finally {
      setSalvandoAlta(false);
      setConfirmandoAlta(false);
    }
  };

  // Deadline de edição com base no turno real:
  // Manhã 08:00–16:00 → até 16:30 | Tarde 16:00–23:00 → até 23:30 | Noite 23:00–08:00 → até 08:30
  const getDeadlineEdicao = (criadaEm: string): Date => {
    const d = new Date(criadaEm);
    const min = d.getHours() * 60 + d.getMinutes();
    const dl = new Date(d);
    if (min >= 8 * 60 && min < 16 * 60) {
      dl.setHours(16, 30, 0, 0);
    } else if (min >= 16 * 60 && min < 23 * 60) {
      dl.setHours(23, 30, 0, 0);
    } else if (min >= 23 * 60) {
      dl.setDate(dl.getDate() + 1);
      dl.setHours(8, 30, 0, 0);
    } else {
      dl.setHours(8, 30, 0, 0);
    }
    return dl;
  };

  const isNotaEditavel = (nota: NotaTurno) => {
    if (!emTurno) return false; // utilizador não está de turno agora
    if (nota.autor.id !== utilizador?.id) return false;
    const criadaEm = new Date(nota.criadaEm);
    const agora = new Date();
    if (agora.getTime() - criadaEm.getTime() > 10 * 60 * 60 * 1000) return false;
    return agora <= getDeadlineEdicao(nota.criadaEm);
  };

  const iniciarEdicaoNota = (nota: NotaTurno) => {
    setNotaEditandoId(nota.id);
    setNotaEditTexto(nota.texto);
  };

  const guardarEdicaoNota = async (notaId: string) => {
    if (!notaEditTexto.trim()) return;
    setSalvandoNota(true);
    try {
      await api.patch(`/doentes/${id}/nota/${notaId}`, { texto: notaEditTexto });
      setNotaEditandoId(null);
      carregar();
    } finally { setSalvandoNota(false); }
  };

  const apagarNota = async (notaId: string) => {
    await api.delete(`/doentes/${id}/nota/${notaId}`);
    carregar();
  };

  const abrirModalTarefa = () => {
    setTarefaDesc(''); setTarefaTipo('clinica'); setTarefaPrioridade('media');
    setTarefaGrupo(gruposDisponiveis[0] ?? ''); setTarefaPrazo(''); setErroModal('');
    setModalTarefa(true);
  };

  const submeterNota = async () => {
    if (!notaTexto.trim()) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post(`/doentes/${id}/nota`, { texto: notaTexto });
      setModalNota(false); setNotaTexto(''); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao guardar nota');
    } finally { setSalvando(false); }
  };

  const submeterTarefa = async () => {
    if (!tarefaDesc.trim() || !tarefaGrupo) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post(`/doentes/${id}/tarefa`, {
        descricao: tarefaDesc,
        tipo: tarefaTipo,
        prioridade: tarefaPrioridade,
        grupoResponsavel: tarefaGrupo,
        prazo: tarefaPrazo || undefined,
      });
      setModalTarefa(false); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally { setSalvando(false); }
  };

  const submeterMed = async () => {
    if (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim()) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post('/medicacao/prescrever', { doenteId: id, nome: medNome, dose: medDose, via: medVia, frequencia: medFreq });
      setModalMed(false); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally { setSalvando(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '120px' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">A carregar...</span>
    </div>
  );

  if (!doente) return (
    <div className="text-center text-slate-400 text-sm" style={{ paddingTop: '120px' }}>Doente não encontrado</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Back */}
      <Link href="/doentes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        style={{ marginBottom: '24px', display: 'inline-flex' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar a Doentes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-3xl font-bold text-slate-900">{doente.nome}</h1>
            <div className="relative">
              <button
                onClick={() => podeAlterarEstado && setAlterandoEstado((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg ${estadoCor[doente.estado]?.badge} ${podeAlterarEstado ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                style={{ padding: '5px 10px' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${estadoCor[doente.estado]?.dot}`} />
                {estadoLabel[doente.estado]}
                {podeAlterarEstado && (
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {alterandoEstado && (
                <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden" style={{ marginTop: '6px', minWidth: '160px' }}>
                  {Object.entries(estadoLabel).map(([key, label]) => (
                    key !== doente.estado && (
                      <button key={key} onClick={() => alterarEstado(key)}
                        className="w-full flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        style={{ padding: '10px 14px' }}>
                        <span className={`w-2 h-2 rounded-full ${estadoCor[key]?.dot}`} />
                        {label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-sm font-mono">{doente.numeroProcesso}</p>
        </div>

        {podeDarAlta && doente.ativo && (
          <button onClick={() => setConfirmandoAlta(true)}
            className="border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 20px' }}>
            Dar Alta
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Dados Pessoais</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Data de Nascimento" value={`${new Date(doente.dataNascimento).toLocaleDateString('pt-PT')} (${calcIdade(doente.dataNascimento)} anos)`} />
            <InfoRow label="Admissão" value={new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')} />
            <InfoRow label="Alta Prevista" value={doente.dataAltaPrevista ? new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'} />
          </div>
        </div>

        {/* Clínico */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Informação Clínica</span>
          </div>
          <InfoRow label="Diagnóstico Principal" value={doente.diagnosticoPrincipal} />
        </div>

        {/* Internamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Internamento</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Cama" value={`Quarto ${doente.cama.quarto} · Cama ${doente.cama.numero}`} />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Enfermeiros Atribuídos</span>
              {(() => {
                const ordemTurno: Record<string, number> = { manha: 0, tarde: 1, noite: 2 };
                const mapa = new Map<string, typeof doente.atribuicoesHorario[0]>();
                for (const a of doente.atribuicoesHorario) {
                  const existente = mapa.get(a.utilizador.id);
                  if (!existente) { mapa.set(a.utilizador.id, a); continue; }
                  const dataA = new Date(a.horarioTurno.data).getTime();
                  const dataE = new Date(existente.horarioTurno.data).getTime();
                  if (dataA > dataE || (dataA === dataE && ordemTurno[a.horarioTurno.tipo] > ordemTurno[existente.horarioTurno.tipo])) {
                    mapa.set(a.utilizador.id, a);
                  }
                }
                const unicos = Array.from(mapa.values());
                return unicos.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {unicos.map((a) => (
                      <div key={a.utilizador.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{a.utilizador.nome}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          a.horarioTurno.tipo === 'manha' ? 'bg-amber-50 text-amber-700' :
                          a.horarioTurno.tipo === 'tarde' ? 'bg-orange-50 text-orange-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {a.horarioTurno.tipo === 'manha' ? 'Manhã' : a.horarioTurno.tipo === 'tarde' ? 'Tarde' : 'Noite'}
                          {' · '}{new Date(a.horarioTurno.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <span className="text-sm text-slate-400">Nenhum atribuído</span>;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Medicação + Tarefas */}
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>

        {/* Medicação */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Medicação Ativa</span>
            {doente.medicacoes.length > 0 && (
              <span className="text-xs font-medium text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.medicacoes.length}
              </span>
            )}
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
              <button onClick={abrirHistoricoMed} title="Histórico de medicação"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {podePrescreveMed && <BtnAdd onClick={() => { setErroModal(''); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); setModalMed(true); }} />}
            </div>
          </div>
          {doente.medicacoes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
              {podePrescreveMed ? 'Sem medicação ativa — clica em + para prescrever' : 'Sem medicação ativa'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.medicacoes.map((m) => (
                <div key={m.id} className="flex items-start justify-between bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                    {m.prescritoPor && (
                      <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Prescrito por {m.prescritoPor.nome}</p>
                    )}
                  </div>
                  {podePrescreveMed && (
                    <button onClick={() => concluirMedicacao(m.id)} title="Concluir medicação"
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors shrink-0"
                      style={{ marginLeft: '8px' }}>
                      <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarefas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Tarefas Pendentes</span>
            {doente.tarefas.length > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.tarefas.length}
              </span>
            )}
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
              <button onClick={abrirHistorico}
                title="Histórico de tarefas"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {podeCriarTarefa && <BtnAdd onClick={abrirModalTarefa} />}
            </div>
          </div>
          {doente.tarefas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
              {podeCriarTarefa ? 'Sem tarefas — clica em + para criar' : 'Sem tarefas pendentes'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.tarefas.map((t) => {
                // Pode concluir se for o responsável directo, ou se tiver a role do grupo atribuído
                const podeConcluir = emTurno && (
                  t.responsavel?.id === utilizador?.id ||
                  (t.grupoResponsavel === meuGrupoChave && !t.responsavel)
                );
                return (
                  <div key={t.id} className="flex items-start gap-3 bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{t.descricao}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                        <span className="text-xs text-slate-400">{t.tipo === 'clinica' ? 'Clínica' : 'Logística'}</span>
                        {t.responsavel ? (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-500 font-medium">A cargo: {t.responsavel.nome}</span>
                          </>
                        ) : t.grupoResponsavel ? (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-500 font-medium">Para: {grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}</span>
                          </>
                        ) : null}
                        {t.criadoPor && (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">
                              Por {t.criadoPor.nome} às {new Date(t.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                      {podeConcluir && (
                        <button
                          onClick={async () => {
                            try {
                              await api.patch(`/tarefas/${t.id}/estado`, { estado: 'concluida' });
                              carregar();
                            } catch { /* ignore */ }
                          }}
                          title="Concluir tarefa"
                          className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-all"
                        >
                          <svg className="w-3 h-3 text-slate-400 hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notas de turno */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Notas de Turno</span>
          {podeCriarNota && <BtnAdd onClick={() => { setNotaTexto(''); setErroModal(''); setModalNota(true); }} />}
        </div>
        {(() => {
          const notasFiltradas = doente.notasTurno.filter((n) => meuGrupo.includes(n.autor.role));
          return notasFiltradas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
            {podeCriarNota ? 'Sem notas — clica em + para adicionar' : 'Sem notas registadas'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {notasFiltradas.map((n) => (
              <div key={n.id} className="border-l-2 border-indigo-200 bg-indigo-50/40 rounded-r-xl" style={{ padding: '14px 16px' }}>
                {notaEditandoId === n.id ? (
                  <div>
                    <textarea
                      rows={3}
                      value={notaEditTexto}
                      onChange={(e) => setNotaEditTexto(e.target.value)}
                      className="w-full border border-indigo-200 rounded-lg text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      style={{ padding: '10px 12px', marginBottom: '10px' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicaoNota(n.id)} disabled={salvandoNota || !notaEditTexto.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                        style={{ padding: '6px 14px' }}>
                        {salvandoNota ? 'A guardar...' : 'Guardar'}
                      </button>
                      <button onClick={() => setNotaEditandoId(null)}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                      <span className="text-xs font-medium text-slate-500">{n.autor.nome}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">{roleLabel[n.autor.role] ?? n.autor.role}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(n.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isNotaEditavel(n) && (
                        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
                          <button onClick={() => iniciarEdicaoNota(n)} title="Editar"
                            className="w-6 h-6 rounded-md hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => apagarNota(n.id)} title="Apagar"
                            className="w-6 h-6 rounded-md hover:bg-red-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        );
        })()}
      </div>

      {/* ── Modal Nota ── */}
      {modalNota && (
        <Modal titulo="Adicionar Nota de Turno" onClose={() => setModalNota(false)}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nota</label>
            <textarea
              autoFocus
              rows={5}
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Escreve a nota de turno..."
              className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: '12px 14px' }}
            />
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalNota(false)} onConfirm={submeterNota}
            loading={salvando} disabled={!notaTexto.trim()} labelConfirm="Guardar Nota" />
        </Modal>
      )}

      {/* ── Modal Tarefa ── */}
      {modalTarefa && (
        <Modal titulo="Criar Tarefa" onClose={() => setModalTarefa(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Descrição *</label>
              <input autoFocus type="text" value={tarefaDesc} onChange={(e) => setTarefaDesc(e.target.value)}
                placeholder="Descrição da tarefa..."
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Tipo</label>
                <select value={tarefaTipo} onChange={(e) => setTarefaTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="clinica">Clínica</option>
                  <option value="logistica">Logística</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prioridade</label>
                <select value={tarefaPrioridade} onChange={(e) => setTarefaPrioridade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Para</label>
              <select value={tarefaGrupo} onChange={(e) => setTarefaGrupo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                {gruposDisponiveis.map((g) => (
                  <option key={g} value={g}>{grupoLabel[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prazo (opcional)</label>
              <input type="datetime-local" value={tarefaPrazo} onChange={(e) => setTarefaPrazo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }} />
            </div>
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalTarefa(false)} onConfirm={submeterTarefa}
            loading={salvando} disabled={!tarefaDesc.trim() || !tarefaGrupo} labelConfirm="Criar Tarefa" />
        </Modal>
      )}

      {/* ── Modal Medicação ── */}
      {modalMed && (
        <Modal titulo="Prescrever Medicação" onClose={() => setModalMed(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nome do medicamento *</label>
              <input autoFocus type="text" value={medNome} onChange={(e) => setMedNome(e.target.value)}
                placeholder="Ex: Paracetamol"
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Dose *</label>
                <input type="text" value={medDose} onChange={(e) => setMedDose(e.target.value)}
                  placeholder="Ex: 500mg"
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Via *</label>
                <select value={medVia} onChange={(e) => setMedVia(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Selecionar...</option>
                  <option value="oral">Oral</option>
                  <option value="intravenosa">Intravenosa</option>
                  <option value="intramuscular">Intramuscular</option>
                  <option value="subcutanea">Subcutânea</option>
                  <option value="topica">Tópica</option>
                  <option value="inalatoria">Inalatória</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Frequência *</label>
              <select value={medFreq} onChange={(e) => setMedFreq(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                <option value="">Selecionar...</option>
                <option value="SOS">SOS (em SOS)</option>
                <option value="1x/dia">1x por dia</option>
                <option value="2x/dia">2x por dia</option>
                <option value="3x/dia">3x por dia</option>
                <option value="4x/dia">4x por dia</option>
                <option value="6x/dia">6x por dia (4/4h)</option>
                <option value="8x/dia">8x por dia (3/3h)</option>
                <option value="contínua">Contínua (perfusão)</option>
              </select>
            </div>
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalMed(false)} onConfirm={submeterMed}
            loading={salvando} disabled={!medNome.trim() || !medDose.trim() || !medVia || !medFreq} labelConfirm="Prescrever" />
        </Modal>
      )}

      {/* ── Modal Histórico de Medicação ── */}
      {modalHistoricoMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Medicação</h2>
              </div>
              <button onClick={() => setModalHistoricoMed(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistoricoMed ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : medHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem medicações concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {medHistorico.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-400">
                            Início: {new Date(m.iniciadoEm).toLocaleDateString('pt-PT')}
                          </span>
                          {m.terminadoEm && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">
                                Fim: {new Date(m.terminadoEm).toLocaleDateString('pt-PT')}
                              </span>
                            </>
                          )}
                          {m.prescritoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {m.prescritoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histórico de Tarefas ── */}
      {modalHistorico && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '560px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Tarefas</h2>
              </div>
              <button onClick={() => setModalHistorico(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistorico ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : tarefasHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem tarefas concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tarefasHistorico.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-green-500 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{t.descricao}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          {t.concluidaEm && (
                            <span className="text-xs text-slate-400">
                              Concluída {new Date(t.concluidaEm).toLocaleDateString('pt-PT')} às {new Date(t.concluidaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {t.responsavel && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-500">{t.responsavel.nome}</span>
                            </>
                          )}
                          {t.criadoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {t.criadoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar alta */}
      {confirmandoAlta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px' }}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center" style={{ marginBottom: '20px' }}>
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900" style={{ marginBottom: '8px' }}>Confirmar Alta</h3>
            <p className="text-slate-500 text-sm" style={{ marginBottom: '28px' }}>
              Tem a certeza que pretende dar alta a <strong>{doente.nome}</strong>? Esta ação irá libertar a cama e não pode ser revertida.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoAlta(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={darAlta} disabled={salvandoAlta}
                className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}>
                {salvandoAlta ? 'A processar...' : 'Confirmar Alta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErroBox({ texto }: { texto: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '16px' }}>
      {texto}
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, labelConfirm }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean; disabled: boolean; labelConfirm: string;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        style={{ padding: '11px' }}>Cancelar</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        style={{ padding: '11px' }}>
        {loading ? 'A guardar...' : labelConfirm}
      </button>
    </div>
  );
}
