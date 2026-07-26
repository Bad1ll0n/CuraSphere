'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useSocket } from '@/lib/use-socket';
import { useToast } from '@/components/toast';
import { AiFeedback } from '@/components/ai-feedback';

interface EpisodioUrgencia {
  id: string;
  nomeTemporario?: string;
  queixaPrincipal: string;
  triagem: string;
  estadoEpisodio: string;
  dataEntrada: string;
  notas?: string;
  preNotificacao?: boolean;
  etaMinutos?: number;
  condicaoPrevia?: string;
  news2Triagem?: number;
  salaAtendimento?: string;
  corAnterior?: string;
  idadeAproximada?: number;
  sexo?: string;
  glasgow?: number;
  mecanismo?: string;
  vitalsPASistolica?: number;
  vitalsPADiastolica?: number;
  vitalsFC?: number;
  vitalsSpO2?: number;
  vitalsFR?: number;
  intervencoes?: string[];
  especialidadeActivada?: string;
  doente?: { id: string; nome: string };
  triadoPor?: { id: string; nome: string };
  medicoResponsavel?: { id: string; nome: string };
}

const CORES_TRIAGEM: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  vermelho: { label: 'Vermelho',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  laranja:  { label: 'Laranja',   bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  amarelo:  { label: 'Amarelo',   bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  verde:    { label: 'Verde',     bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
  azul:     { label: 'Azul',      bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
};

const ESTADO_LABELS: Record<string, string> = {
  triagem:        'Em trânsito / Triagem',
  sala_espera:    'Sala de Espera',
  em_atendimento: 'Em Atendimento',
  alta_urgencia:  'Alta',
  internado:      'Internado',
  transferido:    'Transferido',
};

// Manchester SLA targets (minutes)
const SLA_MINUTOS: Record<string, number> = { vermelho: 0, laranja: 10, amarelo: 30, verde: 120, azul: 240 };

const INTERVENCOES_INEM = [
  { key: 'o2', label: 'O₂' },
  { key: 'acesso_venoso', label: 'Acesso IV' },
  { key: 'adrenalina', label: 'Adrenalina' },
  { key: 'entubacao', label: 'Entubação' },
  { key: 'cardioversao', label: 'Cardioversão' },
  { key: 'outro', label: 'Outro' },
];

function tempoEspera(dataEntrada: string) {
  const diff = Math.floor((Date.now() - new Date(dataEntrada).getTime()) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}min`;
}

function slaStatus(cor: string, dataEntrada: string): { status: 'ok' | 'aviso' | 'excedido'; minutos: number } {
  const minutos = Math.floor((Date.now() - new Date(dataEntrada).getTime()) / 60000);
  const limite = SLA_MINUTOS[cor] ?? 999;
  if (minutos > limite) return { status: 'excedido', minutos };
  if (minutos > limite * 0.8) return { status: 'aviso', minutos };
  return { status: 'ok', minutos };
}

const ORDEM_CORES = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];

const FORM_AMB_INIT = {
  nomeTemporario: '', idadeAproximada: '', sexo: '', consciente: true, glasgow: '',
  queixaPrincipal: '', triagem: 'vermelho', mecanismo: '', condicaoPrevia: '', etaMinutos: 10,
  vitalsPASistolica: '', vitalsPADiastolica: '', vitalsFC: '', vitalsSpO2: '', vitalsFR: '',
  intervencoes: [] as string[],
};

function sugerirEspecialidade(ep: { triagem: string; queixaPrincipal: string; mecanismo?: string }): string | null {
  const q = ep.queixaPrincipal.toLowerCase();
  if (ep.triagem === 'vermelho') {
    if (/tor[aá]c|dor peito|ecg|stemi|enfarte/.test(q)) return 'stemi';
    if (/avc|ictus|afasia|hemiplegia|défice|stroke/.test(q)) return 'avc';
    if (ep.mecanismo === 'trauma') return 'trauma';
  }
  return null;
}

export default function UrgenciaPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ queixaPrincipal: '', triagem: 'verde', nomeTemporario: '', notas: '' });

  const [modalAmb, setModalAmb] = useState(false);
  const [ambStep, setAmbStep] = useState<1 | 2 | 3>(1);
  const [formAmb, setFormAmb] = useState({ ...FORM_AMB_INIT });
  const [sugestaoEspecialidade, setSugestaoEspecialidade] = useState<{ id: string; tipo: string } | null>(null);

  const [etaMap, setEtaMap] = useState<Record<string, number>>({});
  const [modalAtribuir, setModalAtribuir] = useState<string | null>(null);
  const [medicoSelecionadoId, setMedicoSelecionadoId] = useState('');
  const [salaInput, setSalaInput] = useState('');

  const [modalReTriagem, setModalReTriagem] = useState<string | null>(null);
  const [reTriagemForm, setReTriagemForm] = useState({ novaTriagem: 'amarelo', motivo: '' });

  const [aiTriagem, setAiTriagem] = useState<{ alertasVermelhos: string[]; nivelSugerido: string; observacoes: string; discriminadoresAvaliar: string[]; disclaimer: string } | null>(null);
  const [pedindoAiTriagem, setPedindoAiTriagem] = useState(false);

  const [sseConectado, setSseConectado] = useState(false);
  const etaRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: medicos = [] } = useQuery<Array<{ id: string; nome: string }>>({
    queryKey: ['medicos-select'],
    queryFn: () => api.get('/utilizadores?roles=medico').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.utilizadores ?? d?.data ?? []);
    }),
    staleTime: 300_000,
    enabled: !!modalAtribuir,
  });

  const { data: episodios = [], isLoading } = useQuery<EpisodioUrgencia[]>({
    queryKey: ['urgencia-lista'],
    queryFn: () => api.get('/urgencia/lista').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['urgencia-dashboard'],
    queryFn: () => api.get('/urgencia/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const map: Record<string, number> = {};
    episodios
      .filter(e => e.preNotificacao && e.estadoEpisodio === 'triagem' && e.etaMinutos)
      .forEach(e => {
        const chegada = new Date(e.dataEntrada).getTime() + (e.etaMinutos! * 60000);
        const restante = Math.max(0, Math.ceil((chegada - Date.now()) / 1000));
        map[e.id] = restante;
      });
    setEtaMap(map);
  }, [episodios]);

  useEffect(() => {
    etaRef.current = setInterval(() => {
      setEtaMap(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id] > 0) { next[id]--; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(etaRef.current!);
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
  useSocket(token, {
    'urgencia:update':        () => invalidar(),
    'urgencia:ambulancia':    () => invalidar(),
    'urgencia:sla-excedido':  (data: any) => {
      toast.error(`⏰ SLA excedido — ${data?.triagem ?? ''} · ${data?.nomeDoente ?? 'Doente'} (${data?.minutosEspera ?? 0} min)`);
    },
  });

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    const es = new EventSource(`${apiUrl}/v1/urgencia/eventos`, { withCredentials: true });
    es.onopen = () => setSseConectado(true);
    es.onerror = () => setSseConectado(false);
    es.addEventListener('urgencia_nova', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        invalidar();
        if (payload.triagem === 'vermelho') toast.error(`🚨 Vermelho — ${payload.queixaPrincipal}`);
        else if (payload.triagem === 'laranja') toast.error(`🟠 Laranja — ${payload.queixaPrincipal}`);
      } catch { invalidar(); }
    });
    es.addEventListener('urgencia_atualizada', () => invalidar());
    return () => { es.close(); setSseConectado(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['urgencia-lista'] });
    qc.invalidateQueries({ queryKey: ['urgencia-dashboard'] });
  };

  const mutEntrada = useMutation({
    mutationFn: (body: typeof form) => api.post('/urgencia/episodio', body),
    onSuccess: () => { toast.success('Entrada registada na urgência'); setModal(false); setForm({ queixaPrincipal: '', triagem: 'verde', nomeTemporario: '', notas: '' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao registar entrada'),
  });

  const mutPreNotif = useMutation({
    mutationFn: (body: Record<string, any>) => api.post('/urgencia/pre-notificacao', body),
    onSuccess: (res) => {
      toast.success('Equipa notificada');
      setModalAmb(false);
      const ep = res.data;
      if (ep?.id) {
        const sugestao = sugerirEspecialidade({ triagem: formAmb.triagem, queixaPrincipal: formAmb.queixaPrincipal, mecanismo: formAmb.mecanismo || undefined });
        if (sugestao) setSugestaoEspecialidade({ id: ep.id, tipo: sugestao });
      }
      setFormAmb({ ...FORM_AMB_INIT });
      setAmbStep(1);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao enviar notificação'),
  });

  const mutEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => api.patch(`/urgencia/${id}/estado`, { estado }),
    onSuccess: () => { toast.success('Estado actualizado'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao actualizar estado'),
  });

  const mutCompletar = useMutation({
    mutationFn: (id: string) => api.patch(`/urgencia/${id}/completar-pre-notificacao`, {}),
    onSuccess: () => { toast.success('Chegada confirmada'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao confirmar chegada'),
  });

  const mutAtribuirMedico = useMutation({
    mutationFn: ({ id, medicoResponsavelId, sala }: { id: string; medicoResponsavelId: string; sala?: string }) =>
      api.patch(`/urgencia/${id}/atribuir-medico`, { medicoResponsavelId, salaAtendimento: sala || undefined }),
    onSuccess: () => { toast.success('Médico atribuído'); setModalAtribuir(null); setMedicoSelecionadoId(''); setSalaInput(''); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao atribuir médico'),
  });

  const mutReTriagem = useMutation({
    mutationFn: ({ id, novaTriagem, motivo }: { id: string; novaTriagem: string; motivo: string }) =>
      api.patch(`/urgencia/${id}/re-triagem`, { novaTriagem, motivo }),
    onSuccess: () => { toast.success('Re-triagem registada'); setModalReTriagem(null); setReTriagemForm({ novaTriagem: 'amarelo', motivo: '' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro na re-triagem'),
  });

  const mutActivarEspecialidade = useMutation({
    mutationFn: ({ id, tipo }: { id: string; tipo: string }) =>
      api.post(`/urgencia/${id}/activar-especialidade`, { tipo }),
    onSuccess: () => { toast.success('Especialidade activada — notificação enviada'); setSugestaoEspecialidade(null); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao activar especialidade'),
  });

  const AI_NIVEL_COR: Record<string, string> = {
    imediato: 'vermelho', muito_urgente: 'laranja', urgente: 'amarelo',
    pouco_urgente: 'verde', nao_urgente: 'azul',
  };

  const pedirAiTriagem = async () => {
    if (!formAmb.queixaPrincipal.trim()) return;
    setPedindoAiTriagem(true);
    try {
      const r = await api.post('/ai-clinico/triagem', {
        queixaPrincipal: formAmb.queixaPrincipal,
        idadeAproximada: formAmb.idadeAproximada ? parseInt(formAmb.idadeAproximada as string) : null,
        sexo: formAmb.sexo || null,
        glasgow: formAmb.glasgow ? parseInt(formAmb.glasgow as string) : null,
        consciente: formAmb.consciente,
        mecanismo: formAmb.mecanismo || null,
        vitalsPASistolica: formAmb.vitalsPASistolica ? parseInt(formAmb.vitalsPASistolica as string) : null,
        vitalsPADiastolica: formAmb.vitalsPADiastolica ? parseInt(formAmb.vitalsPADiastolica as string) : null,
        vitalsFC: formAmb.vitalsFC ? parseInt(formAmb.vitalsFC as string) : null,
        vitalsSpO2: formAmb.vitalsSpO2 ? parseInt(formAmb.vitalsSpO2 as string) : null,
        vitalsFR: formAmb.vitalsFR ? parseInt(formAmb.vitalsFR as string) : null,
        condicaoPrevia: formAmb.condicaoPrevia || null,
      });
      setAiTriagem(r.data);
      const corSugerida = AI_NIVEL_COR[r.data.nivelSugerido];
      if (corSugerida) setFormAmb(f => ({ ...f, triagem: corSugerida }));
    } catch {}
    finally { setPedindoAiTriagem(false); }
  };

  const emTransito = episodios.filter(e => e.preNotificacao && e.estadoEpisodio === 'triagem');
  const ativos = episodios.filter(e => !['alta_urgencia', 'internado', 'transferido'].includes(e.estadoEpisodio) && !(e.preNotificacao && e.estadoEpisodio === 'triagem'));

  const podeRegistar = ['enfermeiro', 'medico', 'administrativo'].includes(utilizador?.role ?? '');
  const podePreNotificar = ['enfermeiro', 'medico', 'administrativo'].includes(utilizador?.role ?? '');
  const podeAtribuirMedico = ['medico', 'administrativo'].includes(utilizador?.role ?? '');
  const podeReTriar = ['enfermeiro', 'medico'].includes(utilizador?.role ?? '');

  const formatEta = (segundos: number) => {
    if (segundos <= 0) return 'A chegar...';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Urgência</h1>
            {sseConectado && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full" style={{ padding: '3px 10px' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Em directo
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Lista de espera e triagem de Manchester</p>
        </div>
        <div className="flex items-center gap-2">
          {podePreNotificar && (
            <button onClick={() => { setAmbStep(1); setFormAmb({ ...FORM_AMB_INIT }); setAiTriagem(null); setModalAmb(true); }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 18px' }}>
              🚑 Ambulância
            </button>
          )}
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
      </div>

      {/* Banner sugestão especialidade */}
      {sugestaoEspecialidade && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-2xl flex items-center justify-between gap-4" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <div>
            <p className="text-yellow-800 font-semibold text-sm">
              Possível activação de{' '}
              <span className="uppercase font-black">{sugestaoEspecialidade.tipo}</span>
              {' '}detectada — pretende activar a especialidade agora?
            </p>
            <p className="text-yellow-700 text-xs" style={{ marginTop: '2px' }}>A equipa especializada será notificada imediatamente.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setSugestaoEspecialidade(null)}
              className="text-xs text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors"
              style={{ padding: '7px 12px' }}>
              Dispensar
            </button>
            <button onClick={() => mutActivarEspecialidade.mutate(sugestaoEspecialidade)}
              disabled={mutActivarEspecialidade.isPending}
              className="text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ padding: '7px 14px' }}>
              {mutActivarEspecialidade.isPending ? 'A activar...' : `Activar ${sugestaoEspecialidade.tipo.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7" style={{ marginBottom: '24px' }}>
          <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '20px' }}>
            <p className="text-3xl font-bold text-slate-900">{dashboard.total ?? 0}</p>
            <p className="text-xs text-slate-500 font-medium" style={{ marginTop: '4px' }}>Total</p>
          </div>
          {(dashboard.emTransito ?? 0) > 0 && (
            <div className="col-span-2 lg:col-span-1 bg-amber-50 rounded-2xl border border-amber-200 text-center" style={{ padding: '20px' }}>
              <p className="text-3xl font-bold text-amber-600">{dashboard.emTransito}</p>
              <p className="text-xs text-amber-600 font-medium" style={{ marginTop: '4px' }}>Em Trânsito</p>
            </div>
          )}
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

      {/* Banner: Ambulâncias em trânsito */}
      {emTransito.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50" style={{ padding: '20px 24px', marginBottom: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
            <span className="text-amber-600 font-bold text-sm">
              🚑 Ambulância{emTransito.length > 1 ? 's' : ''} a caminho — {emTransito.length} em trânsito
            </span>
          </div>
          <div className="grid gap-3">
            {emTransito.map(ep => {
              const eta = etaMap[ep.id] ?? 0;
              const cfg = CORES_TRIAGEM[ep.triagem] ?? CORES_TRIAGEM.vermelho;
              return (
                <div key={ep.id} className="bg-white rounded-xl border border-amber-200" style={{ padding: '14px 18px' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          {ep.doente?.nome ?? ep.nomeTemporario ?? 'Doente desconhecido'}
                          {ep.idadeAproximada && <span className="text-slate-400 font-normal"> · {ep.idadeAproximada}A</span>}
                          {ep.sexo && ep.sexo !== 'desconhecido' && <span className="text-slate-400 font-normal"> {ep.sexo === 'masculino' ? '♂' : '♀'}</span>}
                        </p>
                        <p className="text-slate-500 text-xs">{ep.queixaPrincipal}</p>
                        {ep.condicaoPrevia && <p className="text-amber-700 text-xs font-medium" style={{ marginTop: '2px' }}>{ep.condicaoPrevia}</p>}
                        {/* Vitais en route */}
                        {(ep.vitalsPASistolica || ep.vitalsFC || ep.vitalsSpO2) && (
                          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '6px' }}>
                            {ep.vitalsPASistolica && <span className="text-xs text-slate-500">PA {ep.vitalsPASistolica}/{ep.vitalsPADiastolica}</span>}
                            {ep.vitalsFC && <span className="text-xs text-slate-500">FC {ep.vitalsFC}</span>}
                            {ep.vitalsSpO2 && <span className="text-xs text-slate-500">SpO₂ {ep.vitalsSpO2}%</span>}
                            {ep.vitalsFR && <span className="text-xs text-slate-500">FR {ep.vitalsFR}</span>}
                          </div>
                        )}
                        {/* Intervenções */}
                        {ep.intervencoes && ep.intervencoes.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap" style={{ marginTop: '4px' }}>
                            {ep.intervencoes.map(iv => (
                              <span key={iv} className="text-xs bg-slate-100 text-slate-600 rounded-md" style={{ padding: '2px 6px' }}>
                                {INTERVENCOES_INEM.find(i => i.key === iv)?.label ?? iv}
                              </span>
                            ))}
                          </div>
                        )}
                        {ep.especialidadeActivada && (
                          <span className="inline-block text-xs font-bold bg-yellow-100 text-yellow-700 rounded-md" style={{ marginTop: '4px', padding: '2px 8px' }}>
                            {ep.especialidadeActivada.toUpperCase()} ACTIVADO
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <p className={`text-lg font-bold ${eta <= 0 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`}>
                          {formatEta(eta)}
                        </p>
                        <p className="text-xs text-slate-400">ETA</p>
                      </div>
                      {ep.news2Triagem != null && (
                        <span className={`text-xs font-bold rounded-lg ${ep.news2Triagem >= 7 ? 'bg-red-100 text-red-700' : ep.news2Triagem >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`} style={{ padding: '4px 8px' }}>
                          NEWS2 {ep.news2Triagem}
                        </span>
                      )}
                      <button onClick={() => mutCompletar.mutate(ep.id)}
                        className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                        style={{ padding: '7px 14px' }}>
                        Chegou
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista por cor */}
      {isLoading ? (
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
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '64px 40px' }}>
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
                  {grupo.map(ep => {
                    const sla = ep.estadoEpisodio === 'sala_espera' ? slaStatus(ep.triagem, ep.dataEntrada) : null;
                    return (
                      <div key={ep.id} className={`bg-white rounded-2xl border ${cfg.border} flex items-start justify-between gap-4`} style={{ padding: '20px 24px' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '6px' }}>
                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                            <p className="font-semibold text-slate-900 text-sm">
                              {ep.doente?.nome ?? ep.nomeTemporario ?? 'Doente desconhecido'}
                            </p>
                            {/* SLA badge */}
                            {sla && (
                              <span className={`text-xs font-bold rounded-lg ${
                                sla.status === 'excedido' ? 'bg-red-100 text-red-700 animate-pulse' :
                                sla.status === 'aviso' ? 'bg-orange-100 text-orange-700' :
                                'bg-slate-100 text-slate-500'
                              }`} style={{ padding: '2px 8px' }}>
                                ⏱ {sla.minutos} min
                                {sla.status === 'excedido' && ' · SLA!'}
                              </span>
                            )}
                            {/* NEWS2 badge */}
                            {ep.news2Triagem != null && (
                              <span className={`text-xs font-bold rounded-lg ${ep.news2Triagem >= 7 ? 'bg-red-100 text-red-700' : ep.news2Triagem >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`} style={{ padding: '2px 8px' }}>
                                NEWS2 {ep.news2Triagem}
                              </span>
                            )}
                            {ep.especialidadeActivada && (
                              <span className="text-xs font-bold bg-yellow-100 text-yellow-700 rounded-lg" style={{ padding: '2px 8px' }}>
                                {ep.especialidadeActivada.toUpperCase()} ✓
                              </span>
                            )}
                            <span className="text-xs text-slate-400 ml-auto shrink-0">⏱ {tempoEspera(ep.dataEntrada)}</span>
                          </div>
                          <p className="text-slate-600 text-sm" style={{ marginBottom: '8px' }}>{ep.queixaPrincipal}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs font-medium badge-pad py-1 rounded-full bg-slate-100 text-slate-600">
                              {ESTADO_LABELS[ep.estadoEpisodio] ?? ep.estadoEpisodio}
                            </span>
                            {ep.salaAtendimento && (
                              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full badge-pad py-1">📍 {ep.salaAtendimento}</span>
                            )}
                            {ep.triadoPor && <span className="text-xs text-slate-400">Triado por {ep.triadoPor.nome}</span>}
                            {ep.medicoResponsavel && <span className="text-xs text-blue-600 font-medium">👨‍⚕️ {ep.medicoResponsavel.nome}</span>}
                            {ep.corAnterior && (
                              <span className="text-xs text-slate-400">Re-triado de {ep.corAnterior}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {ep.estadoEpisodio === 'sala_espera' && (
                            <button onClick={() => mutEstado.mutate({ id: ep.id, estado: 'em_atendimento' })}
                              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              Iniciar atendimento
                            </button>
                          )}
                          {ep.estadoEpisodio === 'em_atendimento' && (
                            <button onClick={() => mutEstado.mutate({ id: ep.id, estado: 'alta_urgencia' })}
                              className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              Dar alta
                            </button>
                          )}
                          {podeAtribuirMedico && (
                            <button onClick={() => { setModalAtribuir(ep.id); setMedicoSelecionadoId(ep.medicoResponsavel?.id ?? ''); setSalaInput(ep.salaAtendimento ?? ''); }}
                              className="text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              {ep.medicoResponsavel ? '↩ Médico' : '+ Médico'}
                            </button>
                          )}
                          {podeReTriar && ep.estadoEpisodio === 'sala_espera' && (
                            <button onClick={() => { setModalReTriagem(ep.id); setReTriagemForm({ novaTriagem: ep.triagem, motivo: '' }); }}
                              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors"
                              style={{ padding: '7px 14px' }}>
                              ↑ Re-triar
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

      {/* Modal: Nova Entrada */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Entrada — Urgência</h2>
              <button aria-label="Fechar" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Queixa Principal *</label>
              <textarea id="fpage-0" value={form.queixaPrincipal} onChange={e => setForm(f => ({ ...f, queixaPrincipal: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva a queixa principal..." />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Triagem de Manchester *</label>
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
              <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome do Doente (se desconhecido)</label>
              <input id="fpage-2" value={form.nomeTemporario} onChange={e => setForm(f => ({ ...f, nomeTemporario: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ padding: '10px 14px' }} placeholder="Nome temporário ou 'Desconhecido'" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas</label>
              <textarea id="fpage-3" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Notas adicionais..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutEntrada.mutate(form)} disabled={mutEntrada.isPending || !form.queixaPrincipal.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutEntrada.isPending ? 'A registar...' : 'Registar Entrada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Re-triagem */}
      {modalReTriagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Re-triagem</h2>
              <button aria-label="Fechar" onClick={() => setModalReTriagem(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nova Triagem *</label>
              <div className="grid grid-cols-5 gap-2">
                {ORDEM_CORES.map(cor => {
                  const cfg = CORES_TRIAGEM[cor];
                  return (
                    <button key={cor} onClick={() => setReTriagemForm(f => ({ ...f, novaTriagem: cor }))}
                      className={`rounded-xl border-2 font-semibold text-xs transition-all ${cfg.bg} ${cfg.text} ${reTriagemForm.novaTriagem === cor ? `${cfg.border} ring-2 ring-offset-1` : 'border-transparent opacity-50'}`}
                      style={{ padding: '10px 4px' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea id="fpage-5" value={reTriagemForm.motivo} onChange={e => setReTriagemForm(f => ({ ...f, motivo: e.target.value }))}
                rows={3} maxLength={500}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Justifique a alteração da triagem..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalReTriagem(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button
                onClick={() => mutReTriagem.mutate({ id: modalReTriagem, novaTriagem: reTriagemForm.novaTriagem, motivo: reTriagemForm.motivo })}
                disabled={mutReTriagem.isPending || !reTriagemForm.motivo.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutReTriagem.isPending ? 'A guardar...' : 'Confirmar Re-triagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atribuir Médico + Sala */}
      {modalAtribuir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Atribuir Médico Responsável</h2>
              <button aria-label="Fechar" onClick={() => setModalAtribuir(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fpage-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Médico</label>
              <select id="fpage-6" value={medicoSelecionadoId} onChange={e => setMedicoSelecionadoId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                <option value="">— Seleccionar médico —</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-7" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Sala / Box de atendimento</label>
              <input id="fpage-7" value={salaInput} onChange={e => setSalaInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: Sala 3, Box 2, Reanimação..." maxLength={50} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAtribuir(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button
                onClick={() => mutAtribuirMedico.mutate({ id: modalAtribuir, medicoResponsavelId: medicoSelecionadoId, sala: salaInput })}
                disabled={mutAtribuirMedico.isPending || !medicoSelecionadoId}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutAtribuirMedico.isPending ? 'A guardar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pré-notificação Ambulância — 3 blocos */}
      {modalAmb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden" style={{ maxWidth: '560px', maxHeight: '90vh', margin: '0 16px' }}>
            {/* Header */}
            <div className="flex items-center justify-between shrink-0" style={{ padding: '24px 28px 0' }}>
              <h2 className="text-lg font-bold text-slate-900">🚑 Pré-notificação de Ambulância</h2>
              <button aria-label="Fechar" onClick={() => setModalAmb(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {/* Step indicators */}
            <div className="flex border-b border-slate-100 shrink-0" style={{ padding: '0 28px', marginTop: '16px' }}>
              {[
                { n: 1, label: 'Doente' },
                { n: 2, label: 'Clínica' },
                { n: 3, label: 'INEM en route' },
              ].map(({ n, label }) => (
                <button key={n} onClick={() => setAmbStep(n as 1 | 2 | 3)}
                  className={`text-sm font-medium pb-3 border-b-2 transition-colors ${ambStep === n ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  style={{ marginRight: '24px' }}>
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-1.5 ${ambStep === n ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1" style={{ padding: '24px 28px' }}>
              {/* Bloco 1 — Doente */}
              {ambStep === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="fpage-8" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome / Identificação (opcional)</label>
                    <input id="fpage-8" value={formAmb.nomeTemporario} onChange={e => setFormAmb(f => ({ ...f, nomeTemporario: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                      style={{ padding: '10px 14px' }} placeholder="Nome temporário ou descrição" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="fpage-9" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Idade Aproximada</label>
                      <input id="fpage-9" type="number" min="0" max="120" value={formAmb.idadeAproximada}
                        onChange={e => setFormAmb(f => ({ ...f, idadeAproximada: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                        style={{ padding: '10px 14px' }} placeholder="Ex: 65" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Sexo</label>
                      <div className="flex gap-2">
                        {[{ v: 'masculino', l: '♂ M' }, { v: 'feminino', l: '♀ F' }, { v: 'desconhecido', l: '?' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setFormAmb(f => ({ ...f, sexo: v }))}
                            className={`flex-1 text-xs font-semibold rounded-lg border transition-all ${formAmb.sexo === v ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600'}`}
                            style={{ padding: '9px 4px' }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Consciência</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormAmb(f => ({ ...f, consciente: true, glasgow: '' }))}
                        className={`flex-1 text-sm font-semibold rounded-xl border transition-all ${formAmb.consciente ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600'}`}
                        style={{ padding: '10px' }}>
                        Consciente
                      </button>
                      <button type="button" onClick={() => setFormAmb(f => ({ ...f, consciente: false }))}
                        className={`flex-1 text-sm font-semibold rounded-xl border transition-all ${!formAmb.consciente ? 'bg-red-600 text-white border-red-600' : 'border-slate-200 text-slate-600'}`}
                        style={{ padding: '10px' }}>
                        Inconsciente
                      </button>
                    </div>
                    {!formAmb.consciente && (
                      <div style={{ marginTop: '10px' }}>
                        <label htmlFor="fpage-12" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Glasgow (3–15)</label>
                        <input id="fpage-12" type="number" min="3" max="15" value={formAmb.glasgow}
                          onChange={e => setFormAmb(f => ({ ...f, glasgow: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                          style={{ padding: '10px 14px' }} placeholder="3-15" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bloco 2 — Situação Clínica */}
              {ambStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="fpage-13" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Queixa Principal *</label>
                    <textarea id="fpage-13" value={formAmb.queixaPrincipal} onChange={e => setFormAmb(f => ({ ...f, queixaPrincipal: e.target.value }))}
                      rows={3} className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none transition"
                      style={{ padding: '10px 14px' }} placeholder="Ex: PCR recuperada, dor torácica, trauma..." maxLength={500} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Triagem Estimada *</label>
                    <div className="grid grid-cols-5 gap-2">
                      {ORDEM_CORES.map(cor => {
                        const cfg = CORES_TRIAGEM[cor];
                        return (
                          <button key={cor} onClick={() => setFormAmb(f => ({ ...f, triagem: cor }))}
                            className={`rounded-xl border-2 font-semibold text-xs transition-all ${cfg.bg} ${cfg.text} ${formAmb.triagem === cor ? `${cfg.border} ring-2 ring-offset-1` : 'border-transparent opacity-50'}`}
                            style={{ padding: '10px 4px' }}>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Mecanismo</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 'medico', l: 'Médico' }, { v: 'trauma', l: 'Trauma' },
                        { v: 'intoxicacao', l: 'Intoxicação' }, { v: 'obstetrico', l: 'Obstétrico' }, { v: 'pediatrico', l: 'Pediátrico' },
                      ].map(({ v, l }) => (
                        <button key={v} type="button" onClick={() => setFormAmb(f => ({ ...f, mecanismo: f.mecanismo === v ? '' : v }))}
                          className={`text-xs font-semibold rounded-lg border transition-all ${formAmb.mecanismo === v ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}
                          style={{ padding: '6px 12px' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="fpage-16" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Condição Prévia</label>
                    <input id="fpage-16" value={formAmb.condicaoPrevia} onChange={e => setFormAmb(f => ({ ...f, condicaoPrevia: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                      style={{ padding: '10px 14px' }} placeholder="Ex: HTA, DM, AC/FA..." maxLength={200} />
                  </div>
                  <div>
                    <label htmlFor="fpage-17" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>ETA — {formAmb.etaMinutos} minutos</label>
                    <input id="fpage-17" type="range" min={1} max={60} value={formAmb.etaMinutos}
                      onChange={e => setFormAmb(f => ({ ...f, etaMinutos: parseInt(e.target.value) }))}
                      className="w-full accent-amber-500" />
                  </div>

                  {/* Botão IA Triagem */}
                  <div className="border-t border-slate-100 pt-4">
                    {aiTriagem ? (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50" style={{ padding: '14px 16px' }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Apoio IA — Manchester</span>
                          <button aria-label="Fechar" onClick={() => setAiTriagem(null)} className="text-indigo-400 hover:text-indigo-600 text-sm font-bold">✕</button>
                        </div>
                        {aiTriagem.alertasVermelhos.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {aiTriagem.alertasVermelhos.map((a, i) => (
                              <span key={i} className="text-xs font-bold bg-red-100 text-red-700 rounded-md px-2 py-0.5">⚠ {a}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-indigo-900 leading-relaxed mb-2">{aiTriagem.observacoes}</p>
                        {aiTriagem.discriminadoresAvaliar.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-indigo-600 mb-1">Discriminadores a avaliar:</p>
                            <div className="flex flex-wrap gap-1">
                              {aiTriagem.discriminadoresAvaliar.map((d, i) => (
                                <span key={i} className="text-xs bg-white text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5">{d}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-indigo-400 italic">{aiTriagem.disclaimer}</p>
                          <AiFeedback decisaoId={(aiTriagem as any)?._decisaoId} />
                        </div>
                        <details className="mt-2">
                          <summary className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Ver factores considerados ▼</summary>
                          <ul className="mt-2 space-y-1">
                            {['Queixa principal', 'Sinais vitais (se disponíveis)', 'Antecedentes relevantes', 'Discriminadores Manchester'].map((f, i) => (
                              <li key={i} className="text-xs text-indigo-700 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />{f}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : (
                      <button
                        onClick={pedirAiTriagem}
                        disabled={pedindoAiTriagem || !formAmb.queixaPrincipal.trim()}
                        className="w-full flex items-center justify-center gap-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ padding: '10px' }}>
                        {pedindoAiTriagem ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            A analisar...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Apoio IA — Triagem Manchester
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bloco 3 — INEM en route */}
              {ambStep === 3 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Sinais Vitais en route</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'vitalsPASistolica', label: 'PAS', placeholder: '120' },
                        { key: 'vitalsPADiastolica', label: 'PAD', placeholder: '80' },
                        { key: 'vitalsFC', label: 'FC', placeholder: '72' },
                        { key: 'vitalsSpO2', label: 'SpO₂', placeholder: '98' },
                        { key: 'vitalsFR', label: 'FR', placeholder: '16' },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label htmlFor="fpage-19" className="block text-xs font-semibold text-slate-400 text-center" style={{ marginBottom: '4px' }}>{label}</label>
                          <input id="fpage-19" type="number" value={(formAmb as any)[key]}
                            onChange={e => setFormAmb(f => ({ ...f, [key]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                            style={{ padding: '8px 4px' }} placeholder={placeholder} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Intervenções INEM</label>
                    <div className="flex flex-wrap gap-2">
                      {INTERVENCOES_INEM.map(({ key, label }) => {
                        const active = formAmb.intervencoes.includes(key);
                        return (
                          <button key={key} type="button"
                            onClick={() => setFormAmb(f => ({
                              ...f,
                              intervencoes: active ? f.intervencoes.filter(v => v !== key) : [...f.intervencoes, key],
                            }))}
                            className={`text-xs font-semibold rounded-lg border transition-all ${active ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}
                            style={{ padding: '7px 12px' }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-slate-100 shrink-0" style={{ padding: '16px 28px' }}>
              {ambStep > 1 && (
                <button onClick={() => setAmbStep(n => (n - 1) as 1 | 2 | 3)}
                  className="border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                  style={{ padding: '11px 20px' }}>
                  ← Anterior
                </button>
              )}
              <button onClick={() => setModalAmb(false)}
                className="border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                style={{ padding: '11px 16px' }}>
                Cancelar
              </button>
              {ambStep < 3 ? (
                <button onClick={() => setAmbStep(n => (n + 1) as 1 | 2 | 3)}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm"
                  style={{ padding: '11px' }}>
                  Seguinte →
                </button>
              ) : (
                <button
                  onClick={() => {
                    const body: Record<string, any> = {
                      queixaPrincipal: formAmb.queixaPrincipal,
                      triagem: formAmb.triagem,
                      etaMinutos: formAmb.etaMinutos,
                      nomeTemporario: formAmb.nomeTemporario || undefined,
                      condicaoPrevia: formAmb.condicaoPrevia || undefined,
                      mecanismo: formAmb.mecanismo || undefined,
                      consciente: formAmb.consciente,
                      sexo: formAmb.sexo || undefined,
                      idadeAproximada: formAmb.idadeAproximada ? parseInt(formAmb.idadeAproximada as string) : undefined,
                      glasgow: formAmb.glasgow ? parseInt(formAmb.glasgow as string) : undefined,
                      vitalsPASistolica: formAmb.vitalsPASistolica ? parseInt(formAmb.vitalsPASistolica as string) : undefined,
                      vitalsPADiastolica: formAmb.vitalsPADiastolica ? parseInt(formAmb.vitalsPADiastolica as string) : undefined,
                      vitalsFC: formAmb.vitalsFC ? parseInt(formAmb.vitalsFC as string) : undefined,
                      vitalsSpO2: formAmb.vitalsSpO2 ? parseInt(formAmb.vitalsSpO2 as string) : undefined,
                      vitalsFR: formAmb.vitalsFR ? parseInt(formAmb.vitalsFR as string) : undefined,
                      intervencoes: formAmb.intervencoes.length > 0 ? formAmb.intervencoes : undefined,
                    };
                    mutPreNotif.mutate(body);
                  }}
                  disabled={mutPreNotif.isPending || !formAmb.queixaPrincipal.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
                  style={{ padding: '11px' }}>
                  {mutPreNotif.isPending ? 'A notificar...' : '🚑 Notificar Equipa'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
