'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { Breadcrumb } from '@/components/breadcrumb';
import { SinaisVitaisPanel } from './components/sinais-vitais-panel';
import { PediatriaPanel } from './components/pediatria-panel';
import { RiscoEscalasPanel } from './components/risco-escalas-panel';
import { ExamesPanel } from './components/exames-panel';
import { NotasClinicasPanel } from './components/notas-clinicas-panel';
import { EscalasClinicasPanel } from './components/escalas-clinicas-panel';
import { ProblemasPanel } from './components/problemas-panel';
import { DispositivosPanel } from './components/dispositivos-panel';
import { AlergiasContactosPanel } from './components/alergias-contactos-panel';
import { InterconsultasPanel } from './components/interconsultas-panel';
import { NotasTurnoPanel } from './components/notas-turno-panel';
import { TarefasPanel } from './components/tarefas-panel';
import { MedicacaoPanel } from './components/medicacao-panel';
import { ConsultasPanel } from './components/consultas-panel';
import { FaturacaoPanel } from './components/faturacao-panel';
import { BalancoHidricoPanel } from './components/balanco-hidrico-panel';
import { FeridasPanel } from './components/feridas-panel';
import { TransfusaoPanel } from './components/transfusao-panel';
import { MaternidadePanel } from './components/maternidade-panel';
import { SepsisPanel } from './components/sepsis-panel';
import { PlanoAltaPanel } from './components/plano-alta-panel';
import { AiClinicoPanel } from './components/ai-clinico-panel';
import { ResultadosLabPanel } from './components/resultados-lab-panel';
import { ProtocoloPanel } from './components/protocolo-panel';
import { DocumentosSaudePanel } from './components/documentos-saude-panel';
import { LosWidget } from './components/los-widget';

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

class PanelErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Erro ao carregar {this.props.name}. Os restantes painéis continuam acessíveis.
        </div>
      );
    }
    return this.props.children;
  }
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

  // Modals kept in page
  const [modalQR, setModalQR] = useState(false);
  const [modalEditarDoente, setModalEditarDoente] = useState(false);
  const [editDiagnostico, setEditDiagnostico] = useState('');
  const [editAltaPrevista, setEditAltaPrevista] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Alta estruturada
  const [modalAltaEstruturada, setModalAltaEstruturada] = useState(false);
  const [altaMotivo, setAltaMotivo] = useState('melhoria');
  const [altaDestino, setAltaDestino] = useState('domicilio');
  const [altaResumo, setAltaResumo] = useState('');
  const [altaPrescricao, setAltaPrescricao] = useState('');
  const [altaMedicoFamilia, setAltaMedicoFamilia] = useState('');

  // Turno ativo
  const [emTurno, setEmTurno] = useState(false);

  const toast = useToast();
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  const eAdmin = utilizador?.role === 'administrativo';

  // Ficha pessoal
  const [ficheiroPessoal, setFicheiroPessoal] = useState<Record<string, string | null>>({});
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<Record<string, string>>({});
  const [salvandoFicha, setSalvandoFicha] = useState(false);

  const podeAlterarEstado = ['enfermeiro', 'medico'].includes(utilizador?.role ?? '');
  const podeDarAlta = ['administrativo', 'medico'].includes(utilizador?.role ?? '');
  const podeAcionarSOS = ['enfermeiro', 'medico', 'auxiliar', 'tecnico_saude'].includes(utilizador?.role ?? '');
  const podeSinalizar = ['medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  // Sinalizar como Preocupante
  const [modalSinalizar, setModalSinalizar] = useState(false);
  const [sinalizacaoAtiva, setSinalizacaoAtiva] = useState<{ id: string; motivo: string; nivelUrgencia: string } | null>(null);
  const [motivoSinalizar, setMotivoSinalizar] = useState('');
  const [nivelUrgencia, setNivelUrgencia] = useState<'normal' | 'urgente'>('normal');
  const [salvandoSinalizar, setSalvandoSinalizar] = useState(false);

  // Auto resumo de alta
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  // Portal do Doente
  const [modalPortal, setModalPortal] = useState(false);
  const [portalEmail, setPortalEmail] = useState('');
  const [portalSenha, setPortalSenha] = useState('');
  const [criandoPortal, setCriandoPortal] = useState(false);
  const [portalCriado, setPortalCriado] = useState(false);
  const podeCriarPortal = ['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  // Score de risco
  const [riscoScore, setRiscoScore] = useState<{ score: number; banda: 'verde' | 'ambar' | 'vermelho'; factores: string[] } | null>(null);

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

  const carregarSinalizacao = useCallback(() => {
    api.get(`/sinalizacoes/${id}/ativas`)
      .then(r => setSinalizacaoAtiva(r.data?.length > 0 ? r.data[0] : null))
      .catch(() => {});
  }, [id]);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get(`/doentes/${id}`)
      .then((r) => { setDoente(r.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const carregarFicheiroPessoal = useCallback(() => {
    if (!eAdmin) return;
    api.get(`/doentes/${id}/ficha-pessoal`)
      .then((r) => { setFicheiroPessoal(r.data); setFichaForm(r.data); })
      .catch(() => {});
  }, [id, eAdmin]);

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

  useEffect(() => {
    Promise.all([carregar(), verificarTurnoAtivo(), carregarFicheiroPessoal(), carregarSinalizacao()]);
    api.get(`/baselines/${id}/risco`).then(r => setRiscoScore(r.data)).catch(() => null);
  }, [id]);

  const submeterSinalizar = async () => {
    if (!motivoSinalizar.trim()) return;
    setSalvandoSinalizar(true);
    try {
      await api.post(`/sinalizacoes/${id}`, { motivo: motivoSinalizar, nivelUrgencia });
      toast.success('Sinalização criada');
      setModalSinalizar(false);
      setMotivoSinalizar('');
      carregarSinalizacao();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally { setSalvandoSinalizar(false); }
  };

  const resolverSinalizar = async () => {
    if (!sinalizacaoAtiva) return;
    try {
      await api.patch(`/sinalizacoes/${sinalizacaoAtiva.id}/resolver`);
      toast.success('Sinalização resolvida');
      setSinalizacaoAtiva(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const abrirModalAlta = async () => {
    setModalAltaEstruturada(true);
    setCarregandoResumo(true);
    try {
      const r = await api.get(`/doentes/${id}/resumo-alta`);
      setAltaResumo(r.data.resumoGerado ?? '');
    } catch {
      // se não tiver permissão ou falhar, deixa campo vazio
    } finally { setCarregandoResumo(false); }
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
        <div className="flex items-start gap-4">
          {/* Avatar do doente */}
          {(doente as any).fotoUrl
            ? <img src={(doente as any).fotoUrl} alt={`Foto de ${doente.nome}`} className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shrink-0 mt-0.5" />
            : <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200 shrink-0 mt-0.5">
                <span className="text-xl font-bold text-blue-700">{doente.nome?.[0] ?? '?'}</span>
              </div>
          }
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-2xl font-bold text-slate-900">{doente.nome}</h1>
            {riscoScore && (
              <span className={`text-xs font-bold rounded-lg border px-2 py-0.5 ${
                riscoScore.banda === 'vermelho' ? 'bg-red-100 text-red-700 border-red-200' :
                riscoScore.banda === 'ambar' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                'bg-green-100 text-green-700 border-green-200'
              }`} title={riscoScore.factores.join(' · ')}>
                Risco {riscoScore.score}
              </span>
            )}
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
            <LosWidget doenteId={id!} utilizador={utilizador} />
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
          {/* Sinalizar como Preocupante */}
          {podeSinalizar && doente.ativo && (
            sinalizacaoAtiva ? (
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-sm font-semibold rounded-xl" style={{ padding: '10px 14px' }}>
                  ⚠ Preocupante
                </div>
                <button onClick={resolverSinalizar}
                  className="text-xs text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-xl transition-colors"
                  style={{ padding: '10px 12px' }}>
                  Resolver
                </button>
              </div>
            ) : (
              <button onClick={() => setModalSinalizar(true)}
                className="inline-flex items-center gap-2 border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-medium rounded-xl transition-all"
                style={{ padding: '10px 16px' }}>
                ⚠ Sinalizar
              </button>
            )
          )}

          {podeDarAlta && doente.ativo && (
            <button onClick={abrirModalAlta}
              className="border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
              style={{ padding: '10px 20px' }}>
              Dar Alta
            </button>
          )}
          {podeCriarPortal && (
            <button onClick={() => { setPortalEmail(''); setPortalSenha(''); setPortalCriado(false); setModalPortal(true); }}
              className="inline-flex items-center gap-2 border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium rounded-xl transition-all"
              style={{ padding: '10px 16px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Portal
            </button>
          )}
        </div>
      </div>

      {/* Banner Sépsis */}
      <PanelErrorBoundary name="Sépsis">
        <SepsisPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Análise de Apoio Clínico IA */}
      <PanelErrorBoundary name="AI Clínico">
        <AiClinicoPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Verificação de Protocolos IA */}
      <PanelErrorBoundary name="Protocolos">
        <ProtocoloPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Dossier Universal de Saúde */}
      <PanelErrorBoundary name="Documentos de Saúde">
        <DocumentosSaudePanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

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

      {/* Dados Administrativos */}
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
        <PanelErrorBoundary name="Medicação">
          <MedicacaoPanel doenteId={id!} utilizador={utilizador} medicacoes={doente.medicacoes} onRefresh={carregar} />
        </PanelErrorBoundary>
        <PanelErrorBoundary name="Tarefas">
          <TarefasPanel doenteId={id!} utilizador={utilizador} tarefas={doente.tarefas} emTurno={emTurno} onRefresh={carregar} />
        </PanelErrorBoundary>
      </div>

      {/* Notas de turno */}
      <PanelErrorBoundary name="Notas de Turno">
        <NotasTurnoPanel doenteId={id!} utilizador={utilizador} notas={doente.notasTurno} emTurno={emTurno} onRefresh={carregar} />
      </PanelErrorBoundary>

      {/* Alergias + Contactos de Emergência */}
      <PanelErrorBoundary name="Alergias e Contactos">
        <AlergiasContactosPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Sinais Vitais */}
      <PanelErrorBoundary name="Sinais Vitais">
        <SinaisVitaisPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Pediatria — só para doentes < 16 anos (PEWS + calculadora de dose por peso) */}
      {doente.dataNascimento && calcIdade(doente.dataNascimento) < 16 && (
        <PanelErrorBoundary name="Pediatria">
          <PediatriaPanel doenteId={id!} utilizador={utilizador} />
        </PanelErrorBoundary>
      )}

      {/* Balanço Hídrico */}
      <PanelErrorBoundary name="Balanço Hídrico">
        <BalancoHidricoPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Feridas e Curativos */}
      <PanelErrorBoundary name="Feridas e Curativos">
        <FeridasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Sangue e Transfusão */}
      <PanelErrorBoundary name="Sangue e Transfusão">
        <TransfusaoPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Maternidade / Obstetrícia — auto-fino se não houver gravidez ativa */}
      <PanelErrorBoundary name="Maternidade">
        <MaternidadePanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Plano de Alta */}
      <PanelErrorBoundary name="Plano de Alta">
        <PlanoAltaPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Escalas de Risco */}
      <PanelErrorBoundary name="Escalas de Risco">
        <RiscoEscalasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Resultados Analíticos (Lab) */}
      <PanelErrorBoundary name="Resultados Analíticos">
        <ResultadosLabPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Exames Complementares */}
      <PanelErrorBoundary name="Exames Complementares">
        <ExamesPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Notas Clínicas SOAP */}
      <PanelErrorBoundary name="Notas Clínicas">
        <NotasClinicasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Escalas Clínicas Especializadas */}
      <PanelErrorBoundary name="Escalas Clínicas">
        <EscalasClinicasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Interconsultas */}
      <PanelErrorBoundary name="Interconsultas">
        <InterconsultasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Problemas Clínicos */}
      <PanelErrorBoundary name="Problemas Clínicos">
        <ProblemasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      {/* Dispositivos Invasivos */}
      <PanelErrorBoundary name="Dispositivos Invasivos">
        <DispositivosPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

      <PanelErrorBoundary name="Consultas">
        <ConsultasPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>
      <PanelErrorBoundary name="Faturação">
        <FaturacaoPanel doenteId={id!} utilizador={utilizador} />
      </PanelErrorBoundary>

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

            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalQR(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Fechar
              </button>
              <button
                onClick={() => {
                  const esc = (s: string) =>
                    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
                  const safeId = JSON.stringify(doente.id);
                  const html = `<!DOCTYPE html><html><head><title>QR</title>
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;gap:12px}.nome{font-size:18px;font-weight:700;color:#0f172a}.sub{font-size:12px;color:#94a3b8;font-family:monospace}</style>
</head><body>
<div id="qr"></div>
<p class="nome">${esc(doente.nome)}</p>
<p class="sub">${esc(doente.numeroProcesso)} · Cama ${esc(String(doente.cama.quarto))}/${esc(String(doente.cama.numero))}</p>
<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"><\/script>
<script>QRCode.toCanvas(document.getElementById('qr'),${safeId},{width:220},function(){window.print();window.close();})<\/script>
</body></html>`;
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 30000);
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

      {/* Modal Alta Estruturada */}
      {modalAltaEstruturada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '540px', padding: '32px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Dar Alta — {doente.nome}</h2>
              <button onClick={() => setModalAltaEstruturada(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

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

            <div style={{ marginBottom: '20px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                <label className="block text-sm font-semibold text-slate-700">
                  Resumo Clínico <span className="text-red-500">*</span>
                </label>
                {carregandoResumo && (
                  <span className="text-xs text-blue-500 animate-pulse">A gerar resumo automático...</span>
                )}
                {!carregandoResumo && altaResumo && (
                  <span className="text-xs text-green-600 font-medium">✓ Gerado automaticamente</span>
                )}
              </div>
              <textarea
                value={altaResumo}
                onChange={(e) => setAltaResumo(e.target.value)}
                rows={8}
                placeholder={carregandoResumo ? 'A gerar resumo a partir dos dados do doente...' : 'Descreva o internamento, evolução e estado à data de alta...'}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none font-mono text-xs"
                style={{ padding: '10px 14px' }}
                disabled={carregandoResumo}
              />
            </div>

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

      {/* Modal Sinalizar como Preocupante */}
      {modalSinalizar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">⚠ Sinalizar como Preocupante</h2>
              <button onClick={() => setModalSinalizar(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea value={motivoSinalizar} onChange={e => setMotivoSinalizar(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                style={{ padding: '10px 14px' }} rows={3}
                placeholder="Descreva a preocupação clínica observada..." />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nível de Urgência</label>
              <div className="flex gap-2">
                {(['normal', 'urgente'] as const).map(n => (
                  <button key={n} onClick={() => setNivelUrgencia(n)}
                    className={`flex-1 text-sm font-medium rounded-xl border transition-all ${nivelUrgencia === n ? (n === 'urgente' ? 'bg-red-600 text-white border-red-600' : 'bg-amber-500 text-white border-amber-500') : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    style={{ padding: '9px' }}>
                    {n === 'normal' ? 'Normal' : 'Urgente'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSinalizar(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterSinalizar} disabled={!motivoSinalizar.trim() || salvandoSinalizar}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoSinalizar ? 'A guardar...' : 'Sinalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => {})}
        onCancelar={() => setConfirmarAcao(null)}
      />

      {/* Modal Portal do Doente */}
      {modalPortal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Portal do Doente</h2>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Criar ou actualizar acesso para {doente.nome}</p>
              </div>
              <button onClick={() => setModalPortal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {portalCriado ? (
              <div className="text-center" style={{ padding: '16px 0' }}>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800" style={{ marginBottom: '8px' }}>Acesso criado com sucesso</p>
                <div className="bg-slate-50 rounded-xl text-left" style={{ padding: '12px 16px', marginBottom: '16px' }}>
                  <p className="text-xs text-slate-500" style={{ marginBottom: '4px' }}>Email: <span className="font-semibold text-slate-700">{portalEmail}</span></p>
                  <p className="text-xs text-slate-500">URL: <span className="font-mono text-blue-600">/portal/login</span></p>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg" style={{ padding: '8px 12px' }}>
                  Entregue estas credenciais ao doente por canal seguro (carta ou email pessoal).
                </p>
                <button onClick={() => setModalPortal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                  style={{ padding: '11px', marginTop: '16px' }}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Email do Doente</label>
                  <input type="email" value={portalEmail} onChange={e => setPortalEmail(e.target.value)}
                    placeholder="doente@exemplo.com"
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                    style={{ padding: '10px 14px' }} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Password Temporária</label>
                  <input type="text" value={portalSenha} onChange={e => setPortalSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                    style={{ padding: '10px 14px' }} />
                  <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>O doente poderá alterar a password após o primeiro acesso.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setModalPortal(false)}
                    className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                    style={{ padding: '11px' }}>Cancelar</button>
                  <button
                    disabled={criandoPortal || !portalEmail.trim() || portalSenha.length < 8}
                    onClick={async () => {
                      setCriandoPortal(true);
                      try {
                        await api.post('/portal/criar-acesso', { doenteId: id, email: portalEmail, senha: portalSenha });
                        setPortalCriado(true);
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message ?? 'Erro ao criar acesso');
                      } finally { setCriandoPortal(false); }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
                    style={{ padding: '11px' }}>
                    {criandoPortal ? 'A criar...' : 'Criar Acesso'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
