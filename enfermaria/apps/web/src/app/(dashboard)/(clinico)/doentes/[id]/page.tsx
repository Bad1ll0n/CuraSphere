'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { Breadcrumb } from '@/components/breadcrumb';
import { SinaisVitaisPanel } from './components/sinais-vitais-panel';
import { RiscoEscalasPanel } from './components/risco-escalas-panel';
import { ExamesPanel } from './components/exames-panel';
import { NotasClinicasPanel } from './components/notas-clinicas-panel';
import { EscalasClinicasPanel } from './components/escalas-clinicas-panel';

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
  emIsolamento: boolean;
  motivoIsolamento?: string;
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
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
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

function BtnAdd({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
      style={{ marginLeft: 'auto' }}>
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [salvandoAlta, setSalvandoAlta] = useState(false);
  const [modalIsolamento, setModalIsolamento] = useState(false);
  const [motivoIsolamentoInput, setMotivoIsolamentoInput] = useState('');
  const [salvandoIsolamento, setSalvandoIsolamento] = useState(false);

  // Modals
  const [modalQR, setModalQR] = useState(false);
  const [modalNota, setModalNota] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalMed, setModalMed] = useState(false);
  const [modalPropor, setModalPropor] = useState(false);
  const [propostaObs, setPropostaObs] = useState('');
  const [propostaMedNome, setPropostaMedNome] = useState('');
  const [propostaMedDose, setPropostaMedDose] = useState('');
  const [propostaMedVia, setPropostaMedVia] = useState('');
  const [propostaMedFreq, setPropostaMedFreq] = useState('');
  const [salvandoProposta, setSalvandoProposta] = useState('');
  const [modalRejeitarProposta, setModalRejeitarProposta] = useState<string | null>(null);
  const [motivoRejProposta, setMotivoRejProposta] = useState('');
  const [propostasPendentes, setPropostasPendentes] = useState<any[]>([]);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<Tarefa[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [medHistorico, setMedHistorico] = useState<Medicacao[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  // Alergias
  const [alergias, setAlergias] = useState<any[]>([]);
  const [modalAlergia, setModalAlergia] = useState(false);
  const [alergenio, setAlergenio] = useState('');
  const [alergiaTipo, setAlergiaTipo] = useState('medicamento');
  const [alergiaSev, setAlergiaSev] = useState('moderada');
  const [alergiaNotas, setAlergiaNotas] = useState('');

  // Contactos
  const [contactos, setContactos] = useState<any[]>([]);
  const [modalContacto, setModalContacto] = useState(false);
  const [ctNome, setCtNome] = useState('');
  const [ctRelacao, setCtRelacao] = useState('cônjuge');
  const [ctTel, setCtTel] = useState('');
  const [ctPrincipal, setCtPrincipal] = useState(false);

  // Editar doente
  const [modalEditarDoente, setModalEditarDoente] = useState(false);
  const [editDiagnostico, setEditDiagnostico] = useState('');
  const [editAltaPrevista, setEditAltaPrevista] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Interconsultas
  const [interconsultas, setInterconsultas] = useState<any[]>([]);
  const [modalInterconsulta, setModalInterconsulta] = useState(false);
  const [intercEspecialidade, setIntercEspecialidade] = useState('Cardiologia');
  const [intercMotivo, setIntercMotivo] = useState('');
  const [intercUrgente, setIntercUrgente] = useState(false);
  const [salvandoInterc, setSalvandoInterc] = useState(false);
  const [modalIntercResposta, setModalIntercResposta] = useState<string | null>(null);
  const [intercResposta, setIntercResposta] = useState('');

  // Problemas Clínicos
  const [problemas, setProblemas] = useState<any[]>([]);
  const [modalProblema, setModalProblema] = useState(false);
  const [probDescricao, setProbDescricao] = useState('');
  const [probTipo, setProbTipo] = useState('comorbilidade');
  const [probDataInicio, setProbDataInicio] = useState('');
  const [salvandoProb, setSalvandoProb] = useState(false);

  // Dispositivos Invasivos
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [modalDispositivo, setModalDispositivo] = useState(false);
  const [dispTipo, setDispTipo] = useState('cateter_venoso_central');
  const [dispLocalizacao, setDispLocalizacao] = useState('');
  const [dispObservacoes, setDispObservacoes] = useState('');
  const [salvandoDisp, setSalvandoDisp] = useState(false);

  // Consultas
  const [consultas, setConsultas] = useState<any[]>([]);

  // Faturação
  const [faturacao, setFaturacao] = useState<any[]>([]);

  // Alta estruturada
  const [modalAltaEstruturada, setModalAltaEstruturada] = useState(false);
  const [altaMotivo, setAltaMotivo] = useState('melhoria');
  const [altaDestino, setAltaDestino] = useState('domicilio');
  const [altaResumo, setAltaResumo] = useState('');
  const [altaPrescricao, setAltaPrescricao] = useState('');
  const [altaMedicoFamilia, setAltaMedicoFamilia] = useState('');

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

  const toast = useToast();
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  const eAdmin = utilizador?.role === 'administrativo';

  // Ficha pessoal (dados admin — só carregados para role administrativo)
  const [ficheiroPessoal, setFicheiroPessoal] = useState<Record<string, string | null>>({});
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<Record<string, string>>({});
  const [salvandoFicha, setSalvandoFicha] = useState(false);

  const podeAlterarEstado = ['enfermeiro', 'medico'].includes(utilizador?.role ?? '');
  const podeDarAlta = ['administrativo', 'medico'].includes(utilizador?.role ?? '');
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico'].includes(utilizador?.role ?? '');
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'auxiliar'].includes(utilizador?.role ?? '');
  const podePrescreveMed = utilizador?.role === 'medico';
  const podeProporMed = utilizador?.role === 'enfermeiro';
  const podeAcionarSOS = ['enfermeiro', 'medico', 'auxiliar', 'tecnico_saude'].includes(utilizador?.role ?? '');

  // SOS
  const [sosConfirmando, setSosConfirmando] = useState(false);
  const [sosCount, setSosCount] = useState(3);
  const [sosEnviado, setSosEnviado] = useState(false);
  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarSOS = () => {
    setSosConfirmando(true);
    setSosCount(3);
    sosIntervalRef.current = setInterval(() => {
      setSosCount((c) => {
        if (c <= 1) {
          clearInterval(sosIntervalRef.current!);
          enviarSOS();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const cancelarSOS = () => {
    clearInterval(sosIntervalRef.current!);
    setSosConfirmando(false);
    setSosCount(3);
  };

  const enviarSOS = async () => {
    try {
      await api.post(`/alertas/${id}/sos`);
      toast.success('Alerta SOS enviado');
      setSosEnviado(true);
      setTimeout(() => { setSosEnviado(false); setSosConfirmando(false); }, 5000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
      setSosConfirmando(false);
    }
  };

  // Grupo de role: médicos vêem só médicos; enfermagem vê só enfermagem
  const grupoMedico = ['medico'];
  const grupoEnfermagem = ['enfermeiro', 'auxiliar'];
  const meuGrupo = grupoMedico.includes(utilizador?.role ?? '') ? grupoMedico : grupoEnfermagem;

  // Chave do grupo para filtrar tarefas por grupoResponsavel
  const meuGrupoChave = (() => {
    const role = utilizador?.role ?? '';
    if (role === 'medico') return 'medico';
    if (role === 'auxiliar') return 'auxiliar';
    return 'enfermeiro';
  })();

  // Grupos que cada role pode escolher ao criar tarefa
  const gruposDisponiveis = (() => {
    const role = utilizador?.role ?? '';
    if (role === 'medico') return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const grupoLabel: Record<string, string> = {
    medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  };

  const concluirMedicacao = (medId: string) => {
    setConfirmarAcao({
      titulo: 'Descontinuar Medicação',
      mensagem: 'Confirmar conclusão desta medicação? Esta acção não pode ser revertida.',
      variant: 'warning',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.patch(`/medicacao/${medId}/descontinuar`);
          toast.success('Medicação descontinuada');
          carregar();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
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
      .then((r) => { setDoente(r.data); })
      .finally(() => setLoading(false));
  };

  const carregarPropostas = useCallback(async () => {
    if (utilizador?.role !== 'medico' && utilizador?.role !== 'direcao') return;
    try {
      const { data } = await api.get(`/medicacao/pendentes-aprovacao-medico`);
      setPropostasPendentes((data ?? []).filter((p: any) => p.doenteId === id));
    } catch {}
  }, [id, utilizador?.role]);

  const carregarFicheiroPessoal = () => {
    if (!eAdmin) return;
    api.get(`/doentes/${id}/ficha-pessoal`)
      .then((r) => { setFicheiroPessoal(r.data); setFichaForm(r.data); })
      .catch(() => {});
  };

  const carregarAlergias = () =>
    api.get(`/alergias/${id}`).then((r) => setAlergias(r.data)).catch(() => setAlergias([]));

  const carregarContactos = () =>
    api.get(`/contactos/${id}`).then((r) => setContactos(r.data)).catch(() => setContactos([]));

  const carregarInterconsultas = () =>
    api.get(`/interconsultas/doente/${id}`).then((r) => setInterconsultas(r.data)).catch(() => setInterconsultas([]));

  const carregarDispositivos = () =>
    api.get(`/dispositivos-invasivos/doente/${id}`).then((r) => setDispositivos(r.data)).catch(() => setDispositivos([]));

  const abrirEditarDoente = () => {
    if (!doente) return;
    setEditDiagnostico(doente.diagnosticoPrincipal);
    setEditAltaPrevista(doente.dataAltaPrevista ? doente.dataAltaPrevista.split('T')[0] : '');
    setModalEditarDoente(true);
  };

  const submeterEdicaoDoente = async () => {
    setSalvandoEdicao(true);
    try {
      await api.patch(`/doentes/${id}`, {
        diagnosticoPrincipal: editDiagnostico || undefined,
        dataAltaPrevista: editAltaPrevista ? new Date(editAltaPrevista) : null,
      });
      toast.success('Guardado com sucesso');
      setModalEditarDoente(false);
      await carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoEdicao(false); }
  };

  const submeterAltaEstruturada = async () => {
    if (!altaResumo.trim()) return;
    setSalvandoAlta(true);
    try {
      await api.post(`/doentes/${id}/alta-estruturada`, {
        motivoAlta: altaMotivo,
        destino: altaMotivo !== 'obito' ? altaDestino : undefined,
        resumoClinical: altaResumo,
        prescricaoSaida: altaPrescricao || undefined,
        medicoFamilia: altaMedicoFamilia || undefined,
      });
      setModalAltaEstruturada(false);
      router.push('/doentes');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoAlta(false); }
  };

  const submeterAlergia = async () => {
    if (!alergenio.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/alergias/${id}`, { alergenio, tipo: alergiaTipo, severidade: alergiaSev, notas: alergiaNotas || undefined });
      toast.success('Guardado com sucesso');
      setModalAlergia(false); setAlergenio(''); setAlergiaNotas('');
      carregarAlergias();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const guardarFicheiroPessoal = async () => {
    setSalvandoFicha(true);
    try {
      const r = await api.patch(`/doentes/${id}/ficha-pessoal`, fichaForm);
      setFicheiroPessoal(r.data);
      toast.success('Guardado com sucesso');
      setEditandoFicha(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoFicha(false); }
  };

  const removerAlergia = (alergiaId: string, nomeAlergenio: string) => {
    setConfirmarAcao({
      titulo: 'Remover Alergia',
      mensagem: `Remover alergia a "${nomeAlergenio}"? Esta acção não pode ser revertida.`,
      variant: 'danger',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.delete(`/alergias/${alergiaId}`);
          toast.success('Removido');
          carregarAlergias();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  const submeterContacto = async () => {
    if (!ctNome.trim() || !ctTel.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/contactos/${id}`, { nome: ctNome, relacao: ctRelacao, telefone: ctTel, principal: ctPrincipal });
      toast.success('Guardado com sucesso');
      setModalContacto(false); setCtNome(''); setCtTel(''); setCtPrincipal(false);
      carregarContactos();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const removerContacto = (ctId: string, nomeContacto: string) => {
    setConfirmarAcao({
      titulo: 'Remover Contacto',
      mensagem: `Remover contacto "${nomeContacto}"? Esta acção não pode ser revertida.`,
      variant: 'danger',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.delete(`/contactos/${ctId}`);
          toast.success('Removido');
          carregarContactos();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  useEffect(() => {
    Promise.all([
      carregar(),
      verificarTurnoAtivo(),
      carregarAlergias(),
      carregarContactos(),
      carregarInterconsultas(),
      carregarDispositivos(),
      carregarFicheiroPessoal(),
      carregarPropostas(),
      api.get(`/doentes/${id}/problemas`).then(r => setProblemas(r.data ?? [])).catch(() => setProblemas([])),
      api.get(`/consultas?doenteId=${id}`).then(r => setConsultas(r.data ?? [])).catch(() => setConsultas([])),
      api.get(`/faturacao/doente/${id}`).then(r => setFaturacao(r.data ?? [])).catch(() => setFaturacao([])),
    ]);
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

  const toggleIsolamento = async (ativar: boolean) => {
    if (ativar && !motivoIsolamentoInput.trim()) return;
    setSalvandoIsolamento(true);
    try {
      await api.patch(`/doentes/${id}/isolamento`, { emIsolamento: ativar, motivoIsolamento: ativar ? motivoIsolamentoInput : undefined });
      toast.success('Guardado com sucesso');
      setModalIsolamento(false);
      setMotivoIsolamentoInput('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally {
      setSalvandoIsolamento(false);
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
      toast.success('Nota guardada');
      setNotaEditandoId(null);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoNota(false); }
  };

  const apagarNota = async (notaId: string) => {
    try {
      await api.delete(`/doentes/${id}/nota/${notaId}`);
      toast.success('Removido');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
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
      toast.success('Nota guardada');
      setModalNota(false); setNotaTexto(''); carregar();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao guardar nota');
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
      toast.success('Tarefa criada');
      setModalTarefa(false); carregar();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally { setSalvando(false); }
  };

  const submeterMed = async () => {
    if (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim()) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post('/medicacao/prescrever', { doenteId: id, nome: medNome, dose: medDose, via: medVia, frequencia: medFreq });
      toast.success('Prescrição guardada');
      setModalMed(false); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); carregar();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally { setSalvando(false); }
  };

  const submeterProposta = async () => {
    if (!propostaMedNome.trim() || !propostaMedDose.trim() || !propostaMedVia.trim() || !propostaMedFreq.trim()) return;
    setSalvandoProposta('propor');
    try {
      await api.post('/medicacao/propor', { doenteId: id, nome: propostaMedNome, dose: propostaMedDose, via: propostaMedVia, frequencia: propostaMedFreq, observacoes: propostaObs || undefined });
      toast.success('Proposta de prescrição enviada ao médico');
      setModalPropor(false);
      setPropostaMedNome(''); setPropostaMedDose(''); setPropostaMedVia(''); setPropostaMedFreq(''); setPropostaObs('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao propor prescrição');
    } finally { setSalvandoProposta(''); }
  };

  const aprovarProposta = async (medicacaoId: string) => {
    setSalvandoProposta('aprovar');
    try {
      await api.patch(`/medicacao/${medicacaoId}/aprovar-medico`);
      toast.success('Prescrição aprovada e activada');
      carregar(); carregarPropostas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao aprovar');
    } finally { setSalvandoProposta(''); }
  };

  const rejeitarProposta = async () => {
    if (!modalRejeitarProposta || !motivoRejProposta.trim()) return;
    setSalvandoProposta('rejeitar');
    try {
      await api.patch(`/medicacao/${modalRejeitarProposta}/rejeitar-medico`, { motivoRejeicao: motivoRejProposta });
      toast.success('Proposta rejeitada');
      setModalRejeitarProposta(null); setMotivoRejProposta('');
      carregarPropostas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao rejeitar');
    } finally { setSalvandoProposta(''); }
  };

  const submeterInterconsulta = async () => {
    setSalvandoInterc(true);
    try {
      await api.post(`/interconsultas/doente/${id}`, {
        especialidadeAlvo: intercEspecialidade, motivo: intercMotivo, urgente: intercUrgente,
      });
      toast.success('Guardado com sucesso');
      setModalInterconsulta(false);
      setIntercMotivo(''); setIntercUrgente(false);
      carregarInterconsultas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoInterc(false); }
  };

  const submeterResposta = async (intercId: string) => {
    if (!intercResposta.trim()) return;
    try {
      await api.patch(`/interconsultas/${intercId}/responder`, { resposta: intercResposta });
      toast.success('Guardado com sucesso');
      setModalIntercResposta(null); setIntercResposta('');
      carregarInterconsultas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
  };

  const submeterProblema = async () => {
    if (!probDescricao.trim()) return;
    setSalvandoProb(true);
    try {
      await api.post(`/doentes/${id}/problemas`, {
        descricao: probDescricao, tipo: probTipo,
        dataInicio: probDataInicio || undefined,
      });
      toast.success('Guardado com sucesso');
      setModalProblema(false);
      setProbDescricao(''); setProbTipo('comorbilidade'); setProbDataInicio('');
      const r = await api.get(`/doentes/${id}/problemas`);
      setProblemas(r.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoProb(false); }
  };

  const resolverProblema = async (probId: string) => {
    try {
      await api.patch(`/doentes/${id}/problemas/${probId}`, { estado: 'resolvido', dataFim: new Date().toISOString().split('T')[0] });
      toast.success('Guardado com sucesso');
      const r = await api.get(`/doentes/${id}/problemas`);
      setProblemas(r.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
  };

  const submeterDispositivo = async () => {
    setSalvandoDisp(true);
    try {
      await api.post(`/dispositivos-invasivos/doente/${id}`, {
        tipo: dispTipo, localizacao: dispLocalizacao || undefined, observacoes: dispObservacoes || undefined,
      });
      toast.success('Guardado com sucesso');
      setModalDispositivo(false);
      setDispLocalizacao(''); setDispObservacoes('');
      carregarDispositivos();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoDisp(false); }
  };

  const removerDispositivo = (dispId: string) => {
    setConfirmarAcao({
      titulo: 'Remover Dispositivo',
      mensagem: 'Confirmar remoção deste dispositivo invasivo? O registo ficará marcado como removido.',
      variant: 'warning',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.patch(`/dispositivos-invasivos/${dispId}/remover`);
          toast.success('Dispositivo removido');
          carregarDispositivos();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
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

      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[
          { label: 'Doentes', href: '/doentes' },
          { label: doente.nome },
        ]} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-2xl font-bold text-slate-900">{doente.nome}</h1>
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
          <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
            {doente.emIsolamento && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg" style={{ padding: '4px 10px' }}>
                🔶 Em Isolamento{doente.motivoIsolamento ? `: ${doente.motivoIsolamento}` : ''}
              </span>
            )}
            {podeAlterarEstado && doente.ativo && (
              doente.emIsolamento ? (
                <button onClick={() => toggleIsolamento(false)}
                  className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                  style={{ padding: '4px 10px' }}>
                  Remover Isolamento
                </button>
              ) : (
                <button onClick={() => { setMotivoIsolamentoInput(''); setModalIsolamento(true); }}
                  className="text-xs font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                  style={{ padding: '4px 10px' }}>
                  🔶 Activar Isolamento
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão SOS */}
          {podeAcionarSOS && doente.ativo && (
            sosEnviado ? (
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl" style={{ padding: '10px 18px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                SOS enviado
              </div>
            ) : sosConfirmando ? (
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold rounded-xl animate-pulse" style={{ padding: '10px 18px' }}>
                  🚨 A enviar... {sosCount}s
                </div>
                <button onClick={cancelarSOS}
                  className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-colors"
                  style={{ padding: '10px 14px' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={iniciarSOS}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                style={{ padding: '10px 18px' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5a1 1 0 011 1v5a1 1 0 01-2 0V8a1 1 0 011-1zm0 10a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                </svg>
                SOS
              </button>
            )
          )}

          <button
            onClick={() => window.open(`/doentes/${id}/print`, '_blank')}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </button>
          <button onClick={() => setModalQR(true)}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V16M4 4h4v4H4V4zm12 0h4v4h-4V4zm-12 12h4v4H4v-4z" />
            </svg>
            QR Code
          </button>
          {podeDarAlta && doente.ativo && (
            <button onClick={() => setModalAltaEstruturada(true)}
              className="border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
              style={{ padding: '10px 20px' }}>
              Dar Alta
            </button>
          )}
        </div>
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
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Informação Clínica</span>
            </div>
            {['medico', 'enfermeiro', 'administrativo'].includes(utilizador?.role ?? '') && (
              <button onClick={abrirEditarDoente}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                style={{ padding: '4px 8px' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Editar
              </button>
            )}
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
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-md ${
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

      {/* Dados Administrativos — só para role administrativo */}
      {eAdmin && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Dados Administrativos</span>
              <span className="text-xs text-slate-300 bg-slate-100 badge-pad py-0.5 rounded-full font-medium">Confidencial</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/faturacao`} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Ver Faturação
              </a>
              {!editandoFicha ? (
                <button onClick={() => setEditandoFicha(true)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  style={{ padding: '4px 8px' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditandoFicha(false); setFichaForm(ficheiroPessoal as any); }}
                    className="text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" style={{ padding: '4px 10px' }}>
                    Cancelar
                  </button>
                  <button onClick={guardarFicheiroPessoal} disabled={salvandoFicha}
                    className="text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors" style={{ padding: '4px 10px' }}>
                    {salvandoFicha ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {editandoFicha ? (
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'nif', label: 'NIF', placeholder: '123456789' },
                { key: 'numeroSNS', label: 'Nº SNS / Beneficiário', placeholder: '123456789' },
                { key: 'telefone', label: 'Telefone', placeholder: '+351 912 345 678' },
                { key: 'email', label: 'Email', placeholder: 'doente@email.com' },
                { key: 'morada', label: 'Morada', placeholder: 'Rua Exemplo, 12' },
                { key: 'codigoPostal', label: 'Código Postal', placeholder: '1000-001' },
                { key: 'localidade', label: 'Localidade', placeholder: 'Lisboa' },
                { key: 'entidadeSeguradora', label: 'Seguradora', placeholder: 'Médis, Multicare...' },
                { key: 'numeroApolice', label: 'Nº Apólice', placeholder: '' },
                { key: 'tipoCobertura', label: 'Tipo Cobertura', placeholder: 'sns / seguro / particular' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                  <input
                    value={(fichaForm as any)[key] ?? ''}
                    onChange={e => setFichaForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              {[
                { label: 'NIF', value: ficheiroPessoal?.nif },
                { label: 'Nº SNS / Beneficiário', value: ficheiroPessoal?.numeroSNS },
                { label: 'Telefone', value: ficheiroPessoal?.telefone },
                { label: 'Email', value: ficheiroPessoal?.email },
                { label: 'Morada', value: ficheiroPessoal?.morada },
                { label: 'Código Postal', value: ficheiroPessoal?.codigoPostal },
                { label: 'Localidade', value: ficheiroPessoal?.localidade },
                { label: 'Seguradora', value: ficheiroPessoal?.entidadeSeguradora },
                { label: 'Nº Apólice', value: ficheiroPessoal?.numeroApolice },
                { label: 'Tipo Cobertura', value: ficheiroPessoal?.tipoCobertura },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide block" style={{ marginBottom: '2px' }}>{label}</span>
                  <span className="text-sm text-slate-700">{value || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              <span className="text-xs font-medium text-pink-600 bg-pink-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.medicacoes.length}
              </span>
            )}
            <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
              <button onClick={abrirHistoricoMed} aria-label="Histórico de medicação"
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {podePrescreveMed && <BtnAdd label="Prescrever medicação" onClick={() => { setErroModal(''); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); setModalMed(true); }} />}
              {podeProporMed && (
                <button onClick={() => { setPropostaMedNome(''); setPropostaMedDose(''); setPropostaMedVia(''); setPropostaMedFreq(''); setPropostaObs(''); setModalPropor(true); }}
                  aria-label="Propor prescrição"
                  className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors">
                  <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
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
          {/* Propostas pendentes de aprovação médica */}
          {podePrescreveMed && propostasPendentes.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                Propostas de enfermagem aguardam aprovação ({propostasPendentes.length})
              </p>
              <div className="flex flex-col gap-2">
                {propostasPendentes.map((p) => (
                  <div key={p.id} className="flex items-start justify-between bg-violet-50 border border-violet-100 rounded-xl" style={{ padding: '10px 12px' }}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
                      <p className="text-xs text-slate-400">{p.dose} · {p.via} · {p.frequencia}</p>
                      {p.prescritoPor && <p className="text-xs text-violet-600" style={{ marginTop: '2px' }}>Proposto por {p.prescritoPor.nome}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0" style={{ marginLeft: '8px' }}>
                      <button onClick={() => { setModalRejeitarProposta(p.id); setMotivoRejProposta(''); }}
                        className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        style={{ padding: '5px 10px' }}>Rejeitar</button>
                      <button onClick={() => aprovarProposta(p.id)} disabled={salvandoProposta === 'aprovar'}
                        className="text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ padding: '5px 10px' }}>Aprovar</button>
                    </div>
                  </div>
                ))}
              </div>
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
              <span className="text-xs font-medium text-amber-600 bg-amber-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
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
              {podeCriarTarefa && <BtnAdd label="Adicionar tarefa" onClick={abrirModalTarefa} />}
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
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-md ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                      {podeConcluir && (
                        <button
                          onClick={async () => {
                            try {
                              await api.patch(`/tarefas/${t.id}/estado`, { estado: 'concluida' });
                              toast.success('Guardado com sucesso');
                              carregar();
                            } catch (e: any) {
                              toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
                            }
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
          {podeCriarNota && <BtnAdd label="Adicionar nota de turno" onClick={() => { setNotaTexto(''); setErroModal(''); setModalNota(true); }} />}
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
                          <button onClick={() => apagarNota(n.id)} aria-label="Apagar nota de turno"
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

      {/* Alergias + Contactos de Emergência */}
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px', marginTop: '24px' }}>
        {/* Alergias */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Alergias</span>
            <BtnAdd label="Registar alergia" onClick={() => { setAlergenio(''); setAlergiaNotas(''); setModalAlergia(true); }} />
          </div>
          {alergias.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem alergias registadas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alergias.map((a: any) => {
                const sevCor: Record<string, string> = { anafilaxia: 'bg-red-100 text-red-700', grave: 'bg-orange-100 text-orange-700', moderada: 'bg-yellow-100 text-yellow-700', ligeira: 'bg-slate-100 text-slate-600' };
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                    <span className={`text-xs font-bold badge-pad py-0.5 rounded-full ${sevCor[a.severidade] ?? 'bg-slate-100 text-slate-600'}`}>{a.severidade}</span>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-slate-800">{a.alergenio}</span>
                      <span className="text-xs text-slate-400 ml-2">{a.tipo}</span>
                    </div>
                    <button onClick={() => removerAlergia(a.id, a.alergenio)} aria-label={`Remover alergia ${a.alergenio}`} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contactos de Emergência */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Contactos de Emergência</span>
            <BtnAdd label="Adicionar contacto de emergência" onClick={() => { setCtNome(''); setCtTel(''); setCtRelacao('cônjuge'); setCtPrincipal(false); setModalContacto(true); }} />
          </div>
          {contactos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem contactos registados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contactos.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.nome}</span>
                      {c.principal && <span className="text-xs bg-blue-100 text-blue-700 font-bold badge-pad py-0.5 rounded">Principal</span>}
                    </div>
                    <span className="text-xs text-slate-400">{c.relacao} · {c.telefone}</span>
                  </div>
                  <button onClick={() => removerContacto(c.id, c.nome)} aria-label={`Remover contacto ${c.nome}`} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sinais Vitais */}
      <SinaisVitaisPanel doenteId={id!} utilizador={utilizador} />


      {/* ── Escalas de Risco ── */}
      <RiscoEscalasPanel doenteId={id!} utilizador={utilizador} />

      {/* ── Exames Complementares ── */}
      <ExamesPanel doenteId={id!} utilizador={utilizador} />


      {/* ── Notas Clínicas SOAP ── */}
      <NotasClinicasPanel doenteId={id!} utilizador={utilizador} />

      {/* ── Escalas Clínicas Especializadas ── */}
      <EscalasClinicasPanel doenteId={id!} utilizador={utilizador} />

      {/* ── Interconsultas ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const podeCriarInterc = role === 'medico';
        const podeResponder = role === 'medico';
        const estadoCor: Record<string, string> = {
          pendente: 'bg-amber-50 text-amber-700',
          aceite: 'bg-blue-50 text-blue-700',
          respondida: 'bg-green-50 text-green-700',
          cancelada: 'bg-slate-100 text-slate-500',
        };
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Interconsultas</span>
              {interconsultas.filter((i: any) => i.estado === 'pendente').length > 0 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {interconsultas.filter((i: any) => i.estado === 'pendente').length} pendente(s)
                </span>
              )}
              {podeCriarInterc && (
                <BtnAdd label="Solicitar interconsulta" onClick={() => { setIntercMotivo(''); setIntercUrgente(false); setModalInterconsulta(true); }} />
              )}
            </div>
            {interconsultas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem interconsultas registadas</p>
            ) : (
              <div className="flex flex-col gap-3">
                {interconsultas.map((ic: any) => (
                  <div key={ic.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{ic.especialidadeAlvo}</span>
                          {ic.urgente && <span className="text-xs font-bold text-red-600 bg-red-50 badge-pad py-0.5 rounded-full">Urgente</span>}
                          <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${estadoCor[ic.estado] ?? 'bg-slate-100 text-slate-500'}`}>{ic.estado}</span>
                        </div>
                        <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{ic.motivo}</p>
                        <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                          Por {ic.requisitante?.nome} · {new Date(ic.criadaEm).toLocaleDateString('pt-PT')}
                        </p>
                        {ic.resposta && (
                          <div className="bg-green-50 rounded-lg" style={{ padding: '10px 12px', marginTop: '8px' }}>
                            <p className="text-xs font-semibold text-green-700" style={{ marginBottom: '2px' }}>Resposta de {ic.medicoResposta?.nome}</p>
                            <p className="text-xs text-green-800">{ic.resposta}</p>
                          </div>
                        )}
                      </div>
                      {podeResponder && ic.estado !== 'respondida' && ic.estado !== 'cancelada' && (
                        <button onClick={() => { setModalIntercResposta(ic.id); setIntercResposta(''); }}
                          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                          style={{ padding: '6px 12px' }}>Responder</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Problemas Clínicos ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const visivel = ['medico', 'enfermeiro', 'auxiliar'].includes(role);
        if (!visivel) return null;
        const podeCriar = role === 'medico';

        const TIPO_COR: Record<string, string> = {
          principal: 'bg-red-50 text-red-700', comorbilidade: 'bg-blue-50 text-blue-700',
          cirurgico: 'bg-purple-50 text-purple-700', cronico: 'bg-amber-50 text-amber-700',
          agudo: 'bg-orange-50 text-orange-700',
        };
        const TIPO_LABEL: Record<string, string> = {
          principal: 'Principal', comorbilidade: 'Comorbilidade',
          cirurgico: 'Cirúrgico', cronico: 'Crónico', agudo: 'Agudo',
        };

        const ativos = problemas.filter((p: any) => p.estado === 'ativo');
        const cronicos = problemas.filter((p: any) => p.estado === 'cronico');
        const resolvidos = problemas.filter((p: any) => p.estado === 'resolvido');

        return (
          <div className="rounded-2xl shadow-sm border" style={{ padding: '20px 24px', background: '#fff', borderColor: '#e2e8f0', marginBottom: '20px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: ativos.length + cronicos.length + resolvidos.length === 0 ? 0 : '14px' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Lista de Problemas</span>
                {ativos.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 rounded-full badge-pad py-0.5 font-medium">{ativos.length} ativo(s)</span>
                )}
              </div>
              {podeCriar && (
                <button onClick={() => setModalProblema(true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-1.5 font-medium transition-colors">
                  + Adicionar
                </button>
              )}
            </div>

            {problemas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '12px 0' }}>Sem problemas registados</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...ativos, ...cronicos].map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg" style={{ padding: '8px 12px', background: '#f8fafc' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs rounded-full badge-pad py-0.5 font-medium shrink-0 ${TIPO_COR[p.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                        {TIPO_LABEL[p.tipo] ?? p.tipo}
                      </span>
                      <span className="text-sm text-slate-700 truncate">{p.descricao}</span>
                      {p.dataInicio && <span className="text-xs text-slate-400 shrink-0">{new Date(p.dataInicio).toLocaleDateString('pt-PT')}</span>}
                    </div>
                    {podeCriar && (
                      <button onClick={() => resolverProblema(p.id)}
                        className="text-xs text-slate-400 hover:text-emerald-600 shrink-0 ml-2 transition-colors">
                        ✓ Resolver
                      </button>
                    )}
                  </div>
                ))}
                {resolvidos.length > 0 && (
                  <details className="text-xs text-slate-400" style={{ marginTop: 4 }}>
                    <summary className="cursor-pointer hover:text-slate-600">{resolvidos.length} problema(s) resolvido(s)</summary>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {resolvidos.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-lg" style={{ padding: '6px 10px', background: '#f1f5f9', opacity: 0.6 }}>
                          <span className="line-through text-xs text-slate-400">{p.descricao}</span>
                          {p.dataFim && <span className="text-xs text-slate-300">{new Date(p.dataFim).toLocaleDateString('pt-PT')}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Modal Adicionar Problema */}
            {modalProblema && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                style={{ backdropFilter: 'blur(4px)' }}
                onClick={e => { if (e.target === e.currentTarget) setModalProblema(false); }}>
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800">Adicionar Problema Clínico</h3>
                    <button onClick={() => setModalProblema(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Descrição *</label>
                      <input value={probDescricao} onChange={e => setProbDescricao(e.target.value)} autoFocus
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="Ex: Diabetes mellitus tipo 2, HTA, IRC grau 3..." />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Tipo</label>
                        <select value={probTipo} onChange={e => setProbTipo(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="comorbilidade">Comorbilidade</option>
                          <option value="principal">Principal</option>
                          <option value="agudo">Agudo</option>
                          <option value="cirurgico">Cirúrgico</option>
                          <option value="cronico">Crónico</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Data Início</label>
                        <input type="date" value={probDataInicio} onChange={e => setProbDataInicio(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => setModalProblema(false)}
                        className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors">
                        Cancelar
                      </button>
                      <button onClick={submeterProblema} disabled={salvandoProb || !probDescricao.trim()}
                        className="flex-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                        style={{ flex: 2 }}>
                        {salvandoProb ? 'A guardar...' : 'Adicionar Problema'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Dispositivos Invasivos ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const visivel = ['enfermeiro', 'medico'].includes(role);
        if (!visivel) return null;
        const podeRegistar = ['enfermeiro', 'medico'].includes(role);

        const TIPOS_DISP: Record<string, string> = {
          cateter_venoso_central: 'CVC', cateter_venoso_periferico: 'CVP', cateter_arterial: 'Cateter Arterial',
          sonda_vesical: 'Sonda Vesical', tubo_orotaqueal: 'TOT', traqueostomia: 'Traqueostomia',
          dreno_toracico: 'Dreno Torácico', sonda_nasogastrica: 'SNG', linha_epidural: 'Linha Epidural', outro: 'Outro',
        };
        const COR_TIPO: Record<string, string> = {
          cateter_venoso_central: 'bg-blue-50 text-blue-700', cateter_venoso_periferico: 'bg-sky-50 text-sky-700',
          cateter_arterial: 'bg-red-50 text-red-700', sonda_vesical: 'bg-yellow-50 text-yellow-700',
          tubo_orotaqueal: 'bg-orange-50 text-orange-700', traqueostomia: 'bg-orange-50 text-orange-700',
          dreno_toracico: 'bg-purple-50 text-purple-700', sonda_nasogastrica: 'bg-teal-50 text-teal-700',
          linha_epidural: 'bg-green-50 text-green-700', outro: 'bg-slate-100 text-slate-600',
        };

        const ativos = dispositivos.filter((d: any) => d.ativo);
        const diasInsercao = (data: string) => Math.floor((Date.now() - new Date(data).getTime()) / 86400000);

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Dispositivos Invasivos</span>
              {ativos.length > 0 && (
                <span className="text-xs font-medium text-teal-600 bg-teal-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
                </span>
              )}
              {podeRegistar && (
                <BtnAdd label="Registar dispositivo invasivo" onClick={() => { setDispTipo('cateter_venoso_central'); setDispLocalizacao(''); setDispObservacoes(''); setModalDispositivo(true); }} />
              )}
            </div>
            {ativos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem dispositivos invasivos ativos</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ativos.map((d: any) => {
                  const dias = diasInsercao(d.dataInsercao);
                  return (
                    <div key={d.id} className="flex items-center gap-3 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
                      <span className={`text-xs font-semibold badge-pad py-1 rounded-lg shrink-0 ${COR_TIPO[d.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                        {TIPOS_DISP[d.tipo] ?? d.tipo}
                      </span>
                      <div className="flex-1 min-w-0">
                        {d.localizacao && <p className="text-xs text-slate-600">{d.localizacao}</p>}
                        <p className="text-xs text-slate-400">
                          Inserido há {dias} dia{dias !== 1 ? 's' : ''} · {d.inseridoPor?.nome}
                        </p>
                        {dias >= 3 && (
                          <p className="text-xs text-amber-600 font-medium" style={{ marginTop: '2px' }}>⚠ Avaliar substituição</p>
                        )}
                      </div>
                      {podeRegistar && (
                        <button onClick={() => removerDispositivo(d.id)}
                          className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                          style={{ padding: '5px 10px' }}>Remover</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Modal Alergia ── */}
      {modalAlergia && (
        <Modal titulo="Registar Alergia" onClose={() => setModalAlergia(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="alergia-alergenio" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Agente alérgeno *</label>
            <input id="alergia-alergenio" type="text" value={alergenio} onChange={(e) => setAlergenio(e.target.value)} placeholder="Ex: Penicilina, Ibuprofeno..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {['medicamento', 'alimento', 'ambiental', 'outro'].map((t) => (
                <button key={t} onClick={() => setAlergiaTipo(t)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${alergiaTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Severidade</label>
            <div className="flex gap-2 flex-wrap">
              {['ligeira', 'moderada', 'grave', 'anafilaxia'].map((s) => (
                <button key={s} onClick={() => setAlergiaSev(s)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${alergiaSev === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="alergia-notas" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas</label>
            <input id="alergia-notas" type="text" value={alergiaNotas} onChange={(e) => setAlergiaNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <ModalFooter onCancel={() => setModalAlergia(false)} onConfirm={submeterAlergia} loading={salvando} disabled={!alergenio.trim() || salvando} labelConfirm="Registar" />
        </Modal>
      )}

      {/* ── Modal Contacto ── */}
      {modalContacto && (
        <Modal titulo="Contacto de Emergência" onClose={() => setModalContacto(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome *</label>
            <input type="text" value={ctNome} onChange={(e) => setCtNome(e.target.value)} placeholder="Nome completo" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Relação</label>
            <div className="flex gap-2 flex-wrap">
              {['cônjuge', 'filho/a', 'pai/mãe', 'outro'].map((r) => (
                <button key={r} onClick={() => setCtRelacao(r)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${ctRelacao === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Telefone *</label>
            <input type="tel" value={ctTel} onChange={(e) => setCtTel(e.target.value)} placeholder="9xx xxx xxx" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer" style={{ marginBottom: '16px' }}>
            <input type="checkbox" checked={ctPrincipal} onChange={(e) => setCtPrincipal(e.target.checked)} className="w-4 h-4 rounded" />
            Contacto principal
          </label>
          <ModalFooter onCancel={() => setModalContacto(false)} onConfirm={submeterContacto} loading={salvando} disabled={!ctNome.trim() || !ctTel.trim() || salvando} labelConfirm="Guardar" />
        </Modal>
      )}

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

      {/* Modal Propor Prescrição (enfermeiro) */}
      {modalPropor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Propor Prescrição</h2>
                <p className="text-xs text-violet-600 font-medium" style={{ marginTop: '2px' }}>Aguardará aprovação do médico responsável</p>
              </div>
              <button onClick={() => setModalPropor(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Medicamento *</label>
              <input autoFocus type="text" value={propostaMedNome} onChange={e => setPropostaMedNome(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: Paracetamol 500mg" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Dose *</label>
              <input type="text" value={propostaMedDose} onChange={e => setPropostaMedDose(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: 500mg" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Via *</label>
              <select value={propostaMedVia} onChange={e => setPropostaMedVia(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {['Oral','IV','IM','SC','Tópica','Inalatória','SL','Retal','Nasal'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Frequência *</label>
              <select value={propostaMedFreq} onChange={e => setPropostaMedFreq(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {['SOS','1x/dia','2x/dia','3x/dia','4x/dia','6/6h','8/8h','12/12h','Contínuo'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações clínicas</label>
              <textarea value={propostaObs} onChange={e => setPropostaObs(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Justificação clínica, alergias conhecidas..." />
            </div>
            {erroModal && <p className="text-sm text-red-600 bg-red-50 rounded-xl text-center" style={{ padding: '10px', marginBottom: '16px' }}>{erroModal}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModalPropor(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterProposta} disabled={salvandoProposta === 'propor' || !propostaMedNome.trim() || !propostaMedDose.trim() || !propostaMedVia || !propostaMedFreq}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoProposta === 'propor' ? 'A enviar...' : 'Propor ao Médico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar Proposta (médico) */}
      {modalRejeitarProposta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Rejeitar Proposta</h2>
              <button onClick={() => setModalRejeitarProposta(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea value={motivoRejProposta} onChange={e => setMotivoRejProposta(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Ex: Contra-indicação com medicação atual..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRejeitarProposta(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={rejeitarProposta} disabled={!motivoRejProposta.trim() || salvandoProposta === 'rejeitar'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>Rejeitar</button>
            </div>
          </div>
        </div>
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
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-md shrink-0 ${prioridadeCor[t.prioridade]}`}>
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

      {/* ── Consultas ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const visivel = ['medico', 'enfermeiro', 'administrativo'].includes(role);
        if (!visivel) return null;

        const proximas = consultas
          .filter((c: any) => c.estado === 'agendada')
          .sort((a: any, b: any) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
        const historico = consultas
          .filter((c: any) => c.estado !== 'agendada')
          .sort((a: any, b: any) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

        const ESTADO_BADGE: Record<string, string> = {
          agendada: 'bg-blue-50 text-blue-700',
          realizada: 'bg-green-50 text-green-700',
          faltou: 'bg-orange-50 text-orange-700',
          cancelada: 'bg-slate-100 text-slate-500',
        };
        const ESTADO_LABEL: Record<string, string> = {
          agendada: 'Agendada', realizada: 'Realizada', faltou: 'Faltou', cancelada: 'Cancelada',
        };

        const fmtData = (iso: string) =>
          new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const ConsultaRow = ({ c }: { c: any }) => (
          <div className="flex flex-col gap-1 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{fmtData(c.dataHora)}</span>
              <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                {ESTADO_LABEL[c.estado] ?? c.estado}
              </span>
              <span className="text-xs text-slate-400 font-mono">{c.codigo}</span>
            </div>
            <div className="text-xs text-slate-500">
              {c.especialidade}{c.medico?.nome ? ` · ${c.medico.nome}` : ''}
            </div>
            {c.diagnostico && (
              <p className="text-xs text-slate-500 italic" style={{ marginTop: '2px' }}>{c.diagnostico}</p>
            )}
          </div>
        );

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Consultas</span>
              {consultas.length > 0 && (
                <span className="text-xs font-medium text-blue-600 bg-blue-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {consultas.length}
                </span>
              )}
            </div>

            {consultas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem consultas registadas</p>
            ) : (
              <div className="flex flex-col gap-4">
                {proximas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Próximas</p>
                    <div className="flex flex-col gap-2">
                      {proximas.map((c: any) => <ConsultaRow key={c.id} c={c} />)}
                    </div>
                  </div>
                )}
                {historico.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Histórico</p>
                    <div className="flex flex-col gap-2">
                      {historico.map((c: any) => <ConsultaRow key={c.id} c={c} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Faturação ── */}
      {(() => {
        const role = utilizador?.role ?? '';
        const visivel = ['administrativo', 'direcao'].includes(role);
        if (!visivel) return null;

        const pendentes = faturacao.filter((e: any) => ['pendente', 'emitida'].includes(e.estado));
        const totalPendente = pendentes.reduce((acc: number, e: any) => {
          const pago = (e.pagamentos ?? []).reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
          return acc + Math.max(0, (e.totalCobrado ?? 0) - pago);
        }, 0);

        const ESTADO_BADGE: Record<string, string> = {
          pendente: 'bg-yellow-50 text-yellow-700',
          emitida: 'bg-orange-50 text-orange-700',
          paga: 'bg-green-50 text-green-700',
          isenta: 'bg-blue-50 text-blue-700',
          anulada: 'bg-slate-100 text-slate-500',
        };
        const ESTADO_LABEL: Record<string, string> = {
          pendente: '⏳ Pendente', emitida: '📄 Emitida', paga: '✅ Paga', isenta: '🔵 Isenta', anulada: '❌ Anulada',
        };

        const fmtEur = (v: number) =>
          v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        const fmtData = (iso: string) =>
          new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Faturação</span>
              {faturacao.length > 0 && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                  {faturacao.length} episódio{faturacao.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {pendentes.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800" style={{ padding: '10px 14px', marginBottom: '16px' }}>
                <span>⚠</span>
                <span>
                  {pendentes.length} episódio{pendentes.length !== 1 ? 's' : ''} com pagamento pendente —{' '}
                  <strong>Total: {fmtEur(totalPendente)}</strong>
                </span>
              </div>
            )}

            {faturacao.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem episódios de faturação</p>
            ) : (
              <div className="flex flex-col gap-3">
                {faturacao.map((e: any) => {
                  const pago = (e.pagamentos ?? []).reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
                  const emFalta = Math.max(0, (e.totalCobrado ?? 0) - pago);
                  return (
                    <div key={e.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '8px' }}>
                        <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE[e.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                          {ESTADO_LABEL[e.estado] ?? e.estado}
                        </span>
                        {e.dataEmissao && <span className="text-xs text-slate-500">{fmtData(e.dataEmissao)}</span>}
                        {e.tipoCobertura && <span className="text-xs text-slate-400">{e.tipoCobertura}</span>}
                        <span className="text-xs font-semibold text-slate-700" style={{ marginLeft: 'auto' }}>{fmtEur(e.totalCobrado ?? 0)}</span>
                      </div>

                      {(e.itens ?? []).length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Itens</p>
                          {(e.itens ?? []).map((it: any) => (
                            <div key={it.id} className="flex justify-between text-xs text-slate-500 py-0.5">
                              <span>{it.descricao} <span className="text-slate-400">({it.categoria})</span></span>
                              <span>{it.quantidade} × {fmtEur(it.precoUnitario)} = {fmtEur(it.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(e.pagamentos ?? []).length > 0 && (
                        <div style={{ marginBottom: '6px' }}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Pagamentos</p>
                          {(e.pagamentos ?? []).map((p: any) => (
                            <div key={p.id} className="flex justify-between text-xs text-slate-500 py-0.5">
                              <span>{p.metodo}{p.referencia ? ` · ${p.referencia}` : ''} · {fmtData(p.criadoEm)}</span>
                              <span>{fmtEur(p.valor)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {emFalta > 0 && (
                        <div className="flex justify-between text-xs font-semibold text-red-600 border-t border-slate-100" style={{ paddingTop: '6px', marginTop: '4px' }}>
                          <span>Valor em falta</span>
                          <span>{fmtEur(emFalta)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal Editar Doente */}
      {modalEditarDoente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Editar Dados Clínicos</h2>
              <button onClick={() => setModalEditarDoente(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Diagnóstico Principal</label>
              <input type="text" value={editDiagnostico} onChange={(e) => setEditDiagnostico(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Alta Prevista</label>
              <input type="date" value={editAltaPrevista} onChange={(e) => setEditAltaPrevista(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalEditarDoente(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterEdicaoDoente} disabled={salvandoEdicao}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoEdicao ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Activar Isolamento */}
      {modalIsolamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">🔶 Activar Isolamento</h2>
              <button onClick={() => setModalIsolamento(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo do Isolamento *</label>
              <textarea value={motivoIsolamentoInput} onChange={e => setMotivoIsolamentoInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                style={{ padding: '10px 14px' }} rows={3}
                placeholder="Ex: MRSA, Clostrídio, contacto suspeito COVID..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalIsolamento(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => toggleIsolamento(true)} disabled={!motivoIsolamentoInput.trim() || salvandoIsolamento}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoIsolamento ? 'A guardar...' : 'Activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {modalQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '32px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h3 className="text-lg font-bold text-slate-900">QR Code do Doente</h3>
              <button onClick={() => setModalQR(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* QR Code */}
            <div id="qr-print-area" className="flex flex-col items-center" style={{ gap: '16px' }}>
              <div className="bg-white border border-slate-100 rounded-2xl" style={{ padding: '20px' }}>
                <QRCode value={doente.id} size={180} />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-900" style={{ fontSize: '15px' }}>{doente.nome}</p>
                <p className="text-slate-400 font-mono text-xs" style={{ marginTop: '4px' }}>{doente.numeroProcesso}</p>
                <p className="text-slate-400 text-xs" style={{ marginTop: '2px' }}>Cama {doente.cama.quarto}/{doente.cama.numero}</p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalQR(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Fechar
              </button>
              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(`
                    <html><head><title>QR - ${doente.nome}</title>
                    <style>
                      body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; gap: 12px; }
                      .nome { font-size: 18px; font-weight: 700; color: #0f172a; }
                      .sub { font-size: 12px; color: #94a3b8; font-family: monospace; }
                    </style></head>
                    <body>
                      <div id="qr"></div>
                      <p class="nome">${doente.nome}</p>
                      <p class="sub">${doente.numeroProcesso} · Cama ${doente.cama.quarto}/${doente.cama.numero}</p>
                      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
                      <script>QRCode.toCanvas(document.getElementById('qr'), '${doente.id}', { width: 220 }, function() { window.print(); window.close(); });</script>
                    </body></html>
                  `);
                  win.document.close();
                }}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
                style={{ padding: '11px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Alta Estruturada ── */}
      {modalAltaEstruturada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '540px', padding: '32px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Dar Alta — {doente.nome}</h2>
              <button onClick={() => setModalAltaEstruturada(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Motivo de Alta</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'melhoria', label: 'Melhoria Clínica' },
                  { value: 'transferencia', label: 'Transferência' },
                  { value: 'pedido_proprio', label: 'Pedido Próprio' },
                  { value: 'obito', label: 'Óbito' },
                ].map((op) => (
                  <button key={op.value} type="button"
                    onClick={() => setAltaMotivo(op.value)}
                    className={`text-sm font-medium rounded-xl border transition-all text-left ${altaMotivo === op.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                    style={{ padding: '10px 14px' }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destino (se não for óbito) */}
            {altaMotivo !== 'obito' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Destino</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'domicilio', label: 'Domicílio' },
                    { value: 'outro_hospital', label: 'Outro Hospital' },
                    { value: 'lar', label: 'Lar/Institucional' },
                    { value: 'outro', label: 'Outro' },
                  ].map((op) => (
                    <button key={op.value} type="button"
                      onClick={() => setAltaDestino(op.value)}
                      className={`text-sm font-medium rounded-xl border transition-all ${altaDestino === op.value ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={{ padding: '6px 14px' }}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo clínico */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>
                Resumo Clínico <span className="text-red-500">*</span>
              </label>
              <textarea
                value={altaResumo}
                onChange={(e) => setAltaResumo(e.target.value)}
                rows={4}
                placeholder="Descreva o internamento, evolução e estado à data de alta..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            {/* Prescrição de saída */}
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Prescrição de Saída <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
              <textarea
                value={altaPrescricao}
                onChange={(e) => setAltaPrescricao(e.target.value)}
                rows={2}
                placeholder="Ex: Amoxicilina 500mg 3×/dia 7 dias, Ibuprofeno 400mg SOS..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            {/* Médico de família */}
            <div style={{ marginBottom: '28px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Médico de Família / Referenciação <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
              <input
                value={altaMedicoFamilia}
                onChange={(e) => setAltaMedicoFamilia(e.target.value)}
                placeholder="Nome ou contacto do médico de família..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAltaEstruturada(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={submeterAltaEstruturada} disabled={salvandoAlta || !altaResumo.trim()}
                className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}>
                {salvandoAlta ? 'A processar...' : 'Confirmar Alta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Interconsulta ── */}
      {modalInterconsulta && (
        <Modal titulo="Solicitar Interconsulta" onClose={() => setModalInterconsulta(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Especialidade *</label>
            <select value={intercEspecialidade} onChange={(e) => setIntercEspecialidade(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {['Cardiologia','Neurologia','Nefrologia','Gastrenterologia','Pneumologia','Endocrinologia',
                'Ortopedia','Cirurgia Geral','Anestesiologia','Psiquiatria','Dermatologia','Medicina Interna',
                'Oncologia','Hematologia','Reumatologia','Urologia','Ginecologia','Pediatria','Oftalmologia'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
            <textarea value={intercMotivo} onChange={(e) => setIntercMotivo(e.target.value)}
              placeholder="Descreva o motivo da interconsulta..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '0' }} rows={3} />
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <input type="checkbox" id="interc-urgente" checked={intercUrgente} onChange={(e) => setIntercUrgente(e.target.checked)}
              className="w-4 h-4 rounded accent-red-600" />
            <label htmlFor="interc-urgente" className="text-sm font-medium text-red-600">Urgente</label>
          </div>
          <ModalFooter onCancel={() => setModalInterconsulta(false)} onConfirm={submeterInterconsulta}
            loading={salvandoInterc} disabled={!intercMotivo.trim() || salvandoInterc} labelConfirm="Solicitar" />
        </Modal>
      )}

      {/* ── Modal Resposta Interconsulta ── */}
      {modalIntercResposta && (
        <Modal titulo="Responder Interconsulta" onClose={() => setModalIntercResposta(null)}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resposta clínica *</label>
            <textarea value={intercResposta} onChange={(e) => setIntercResposta(e.target.value)}
              placeholder="Escreva a sua avaliação e recomendações..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={5} />
          </div>
          <ModalFooter onCancel={() => setModalIntercResposta(null)}
            onConfirm={() => submeterResposta(modalIntercResposta)}
            loading={false} disabled={!intercResposta.trim()} labelConfirm="Responder" />
        </Modal>
      )}

      {/* ── Modal Dispositivo Invasivo ── */}
      {modalDispositivo && (
        <Modal titulo="Registar Dispositivo Invasivo" onClose={() => setModalDispositivo(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="disp-tipo" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo *</label>
            <select id="disp-tipo" value={dispTipo} onChange={(e) => setDispTipo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {[
                ['cateter_venoso_central','Cateter Venoso Central (CVC)'],
                ['cateter_venoso_periferico','Cateter Venoso Periférico (CVP)'],
                ['cateter_arterial','Cateter Arterial'],
                ['sonda_vesical','Sonda Vesical'],
                ['tubo_orotaqueal','Tubo Orotaqueal (TOT)'],
                ['traqueostomia','Traqueostomia'],
                ['dreno_toracico','Dreno Torácico'],
                ['sonda_nasogastrica','Sonda Nasogástrica (SNG)'],
                ['linha_epidural','Linha Epidural'],
                ['outro','Outro'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="disp-localizacao" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Localização / Acesso</label>
            <input id="disp-localizacao" type="text" value={dispLocalizacao} onChange={(e) => setDispLocalizacao(e.target.value)}
              placeholder="Ex: Subclávia D, Femoral E, Dorso mão esq..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="disp-obs" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
            <textarea id="disp-obs" value={dispObservacoes} onChange={(e) => setDispObservacoes(e.target.value)}
              placeholder="Calibre, lúmen, intercorrências..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={2} />
          </div>
          <ModalFooter onCancel={() => setModalDispositivo(false)} onConfirm={submeterDispositivo}
            loading={salvandoDisp} disabled={salvandoDisp} labelConfirm="Registar Dispositivo" />
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => {})}
        onCancelar={() => setConfirmarAcao(null)}
      />
    </div>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement;
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         style={{ backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref}
           role="dialog"
           aria-modal="true"
           aria-labelledby="modal-titulo"
           className="bg-white rounded-2xl shadow-2xl w-full"
           style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-titulo" className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
