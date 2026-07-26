'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface DoenteBasico {
  id: string;
  nome: string;
  numeroProcesso: string;
  estadoRegisto: string;
  tipoVisita?: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama?: { numero: string; quarto: string };
}

interface FichaPessoal {
  nif?: string;
  numeroSNS?: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  tipoCobertura?: string;
  entidadeSeguradora?: string;
  numeroApolice?: string;
  contactosEmergencia?: { nome: string; relacao: string; telefone: string }[];
}

const ESTADO_LABEL: Record<string, string> = {
  internado: 'Internado', ambulatorio: 'Ambulatório', pendente_cama: 'Aguarda Cama', alta: 'Alta',
};
const ESTADO_COR: Record<string, string> = {
  internado: 'bg-blue-100 text-blue-700', ambulatorio: 'bg-green-100 text-green-700',
  pendente_cama: 'bg-amber-100 text-amber-700', alta: 'bg-slate-100 text-slate-500',
};
const COBERTURA_LABEL: Record<string, string> = {
  sns: 'SNS', seguro: 'Seguro', particular: 'Particular', adse: 'ADSE',
};
const TIPO_VISITA_LABEL: Record<string, string> = {
  consulta: 'Consulta', exame: 'Exame', urgencia: 'Urgência',
  farmacia: 'Farmácia', internamento: 'Internamento', outro: 'Outro',
};

function Campo({ label, valor }: { label: string; valor?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '3px' }}>{label}</p>
      <p className="text-sm text-slate-700">{valor || <span className="text-slate-300 italic">—</span>}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '5px' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
        style={{ padding: '9px 13px' }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '5px' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
        style={{ padding: '9px 13px' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Secao({ titulo, children, action }: { titulo: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px 28px', marginBottom: '20px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '18px' }}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{titulo}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

const fichaVazia = (): FichaPessoal => ({
  nif: '', numeroSNS: '', telefone: '', email: '',
  morada: '', codigoPostal: '', localidade: '',
  tipoCobertura: '', entidadeSeguradora: '', numeroApolice: '',
});

export default function DoenteAdminDetalhePage() {
  const { utilizador } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [doente, setDoente] = useState<DoenteBasico | null>(null);
  const [ficha, setFicha] = useState<FichaPessoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FichaPessoal>(fichaVazia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [consultas, setConsultas] = useState<any[]>([]);
  const [faturacao, setFaturacao] = useState<any[]>([]);

  // Modal agendamento
  const [modalAgendar, setModalAgendar] = useState(false);
  const [agStep, setAgStep] = useState<1|2|3|4>(1);
  const [medicos, setMedicos] = useState<any[]>([]);
  const [agEspecialidade, setAgEspecialidade] = useState('');
  const [agMedico, setAgMedico] = useState<any>(null);
  const [agData, setAgData] = useState('');
  const [agSlots, setAgSlots] = useState<any[]>([]);
  const [agSlot, setAgSlot] = useState('');
  const [agLoadingSlots, setAgLoadingSlots] = useState(false);
  const [agSalvando, setAgSalvando] = useState(false);
  const [agErro, setAgErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [resDoente, resFicha, resConsultas, resFaturacao] = await Promise.all([
        api.get(`/doentes/${id}`),
        api.get(`/doentes/${id}/ficha-pessoal`).catch(() => ({ data: {} })),
        api.get(`/consultas?doenteId=${id}`).catch(() => ({ data: [] })),
        api.get(`/faturacao/doente/${id}`).catch(() => ({ data: [] })),
      ]);
      setDoente(resDoente.data);
      setFicha(resFicha.data ?? {});
      setConsultas(resConsultas.data ?? []);
      setFaturacao(resFaturacao.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (utilizador?.role !== 'administrativo') return null;

  const iniciarEdicao = () => {
    setForm({
      nif: ficha?.nif ?? '',
      numeroSNS: ficha?.numeroSNS ?? '',
      telefone: ficha?.telefone ?? '',
      email: ficha?.email ?? '',
      morada: ficha?.morada ?? '',
      codigoPostal: ficha?.codigoPostal ?? '',
      localidade: ficha?.localidade ?? '',
      tipoCobertura: ficha?.tipoCobertura ?? '',
      entidadeSeguradora: ficha?.entidadeSeguradora ?? '',
      numeroApolice: ficha?.numeroApolice ?? '',
    });
    setErro('');
    setEditando(true);
  };

  const cancelar = () => { setEditando(false); setErro(''); };

  const guardar = async () => {
    setSalvando(true);
    setErro('');
    try {
      const payload: Record<string, string | undefined> = {};
      (Object.keys(form) as (keyof FichaPessoal)[]).forEach(k => {
        const v = form[k] as string | undefined;
        if (typeof v === 'string') payload[k] = v || undefined;
      });
      const res = await api.patch(`/doentes/${id}/ficha-pessoal`, payload);
      setFicha(res.data ?? form);
      setEditando(false);
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao guardar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const f = (k: keyof FichaPessoal) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const SUBROLE_LABEL: Record<string, string> = {
    clinico_geral: 'Clínica Geral', cardiologista: 'Cardiologia',
    cirurgiao_geral: 'Cirurgia Geral', ortopedista: 'Ortopedia',
    pediatra: 'Pediatria', neurologista: 'Neurologia',
    pneumologista: 'Pneumologia', dermatologista: 'Dermatologia',
  };

  const abrirModalAgendar = async () => {
    setAgStep(1); setAgEspecialidade(''); setAgMedico(null);
    setAgData(''); setAgSlots([]); setAgSlot(''); setAgErro('');
    setModalAgendar(true);
    const r = await api.get('/quiosque/medicos').catch(() => ({ data: [] }));
    setMedicos(r.data ?? []);
  };

  const carregarSlots = async (medicoId: string, data: string) => {
    setAgData(data); setAgSlot(''); setAgSlots([]);
    setAgLoadingSlots(true);
    const r = await api.get(`/consultas/slots?medicoId=${medicoId}&data=${data}`).catch(() => ({ data: [] }));
    setAgSlots((r.data ?? []).filter((s: any) => s.disponivel));
    setAgLoadingSlots(false);
  };

  const remarcarConsulta = (c: any) => {
    const medico = c.medico ?? { id: c.medicoId, nome: '', subRole: c.especialidade };
    setAgMedico(medico);
    setAgEspecialidade(medico.subRole ?? c.especialidade);
    setAgStep(3);
    setAgData(''); setAgSlots([]); setAgSlot(''); setAgErro('');
    setModalAgendar(true);
  };

  const confirmarAgendamento = async () => {
    if (!agSlot || !agMedico) return;
    setAgSalvando(true); setAgErro('');
    try {
      await api.post('/consultas', {
        doenteId: id,
        medicoId: agMedico.id,
        especialidade: agMedico.subRole,
        dataHora: agSlot,
      });
      setModalAgendar(false);
      const r = await api.get(`/consultas?doenteId=${id}`).catch(() => ({ data: [] }));
      setConsultas(r.data ?? []);
    } catch (e: any) {
      setAgErro(e.response?.data?.message ?? 'Erro ao agendar consulta');
    } finally {
      setAgSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">A carregar...</span>
      </div>
    );
  }

  if (!doente) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: '900px', margin: '0 auto' }}>
        <p className="text-slate-400 text-sm">Utente não encontrado.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => router.push('/doentes-admin')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          style={{ marginBottom: '20px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar à lista
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{doente.nome}</h1>
            <p className="text-slate-400 text-sm" style={{ marginTop: '6px' }}>Processo n.º {doente.numeroProcesso}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold badge-pad py-1 rounded-full ${ESTADO_COR[doente.estadoRegisto] ?? 'bg-slate-100 text-slate-500'}`}>
              {ESTADO_LABEL[doente.estadoRegisto] ?? doente.estadoRegisto}
            </span>
            {!editando ? (
              <button
                onClick={iniciarEdicao}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                style={{ padding: '9px 18px' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={cancelar}
                  className="border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '9px 16px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={salvando}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  style={{ padding: '9px 18px' }}
                >
                  {salvando ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        </div>
        {erro && <p className="text-red-600 text-sm" style={{ marginTop: '12px' }}>{erro}</p>}
      </div>

      {/* Localização e admissão — apenas leitura (dados clínicos/logísticos) */}
      <Secao titulo="Internamento">
        <div className="grid gap-x-10 gap-y-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Campo label="Quarto" valor={doente.cama ? `Quarto ${doente.cama.quarto}` : undefined} />
          <Campo label="Cama" valor={doente.cama ? `Cama ${doente.cama.numero}` : undefined} />
          <Campo label="Admissão" valor={new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')} />
          <Campo label="Alta Prevista" valor={doente.dataAltaPrevista ? new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT') : undefined} />
          {doente.tipoVisita && (
            <Campo label="Tipo de Visita" valor={TIPO_VISITA_LABEL[doente.tipoVisita] ?? doente.tipoVisita} />
          )}
        </div>
      </Secao>

      {/* Identificação */}
      <Secao titulo="Identificação">
        {editando ? (
          <div className="grid gap-x-8 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Input label="NIF" value={form.nif ?? ''} onChange={f('nif')} />
            <Input label="N.º SNS" value={form.numeroSNS ?? ''} onChange={f('numeroSNS')} />
            <Input label="Telefone" value={form.telefone ?? ''} onChange={f('telefone')} type="tel" />
            <Input label="Email" value={form.email ?? ''} onChange={f('email')} type="email" />
          </div>
        ) : (
          <div className="grid gap-x-10 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Campo label="NIF" valor={ficha?.nif} />
            <Campo label="N.º SNS" valor={ficha?.numeroSNS} />
            <Campo label="Telefone" valor={ficha?.telefone} />
            <Campo label="Email" valor={ficha?.email} />
          </div>
        )}
      </Secao>

      {/* Morada */}
      <Secao titulo="Morada">
        {editando ? (
          <div className="grid gap-x-8 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div style={{ gridColumn: '1 / span 2' }}>
              <Input label="Morada" value={form.morada ?? ''} onChange={f('morada')} />
            </div>
            <Input label="Código Postal" value={form.codigoPostal ?? ''} onChange={f('codigoPostal')} />
            <Input label="Localidade" value={form.localidade ?? ''} onChange={f('localidade')} />
          </div>
        ) : (
          <div className="grid gap-x-10 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Campo label="Morada" valor={ficha?.morada} />
            <Campo label="Código Postal" valor={ficha?.codigoPostal} />
            <Campo label="Localidade" valor={ficha?.localidade} />
          </div>
        )}
      </Secao>

      {/* Cobertura */}
      <Secao titulo="Cobertura de Saúde">
        {editando ? (
          <div className="grid gap-x-8 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Select
              label="Tipo de Cobertura"
              value={form.tipoCobertura ?? ''}
              onChange={f('tipoCobertura')}
              options={[
                { value: 'sns', label: 'SNS' },
                { value: 'seguro', label: 'Seguro' },
                { value: 'particular', label: 'Particular' },
                { value: 'adse', label: 'ADSE' },
              ]}
            />
            <Input label="Entidade Seguradora" value={form.entidadeSeguradora ?? ''} onChange={f('entidadeSeguradora')} />
            <Input label="N.º Apólice" value={form.numeroApolice ?? ''} onChange={f('numeroApolice')} />
          </div>
        ) : (
          <div className="grid gap-x-10 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Campo label="Tipo de Cobertura" valor={ficha?.tipoCobertura ? (COBERTURA_LABEL[ficha.tipoCobertura] ?? ficha.tipoCobertura) : undefined} />
            <Campo label="Entidade Seguradora" valor={ficha?.entidadeSeguradora} />
            <Campo label="N.º Apólice" valor={ficha?.numeroApolice} />
          </div>
        )}
      </Secao>

      {/* Contactos de emergência — read-only */}
      {ficha?.contactosEmergencia && ficha.contactosEmergencia.length > 0 && (
        <Secao titulo="Contactos de Emergência">
          <div className="flex flex-col gap-3">
            {ficha.contactosEmergencia.map((c, i) => (
              <div key={i} className="flex items-center gap-6 bg-slate-50 rounded-xl" style={{ padding: '12px 16px' }}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">{c.nome}</p>
                  <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{c.relacao}</p>
                </div>
                <p className="text-sm text-slate-600">{c.telefone}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* Consultas */}
      {(() => {
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
        const ESTADO_LABEL_C: Record<string, string> = {
          agendada: 'Agendada', realizada: 'Realizada', faltou: 'Faltou', cancelada: 'Cancelada',
        };
        const fmtDataHora = (iso: string) =>
          new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const Row = ({ c }: { c: any }) => (
          <div className="flex items-start gap-3 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{fmtDataHora(c.dataHora)}</span>
                <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                  {ESTADO_LABEL_C[c.estado] ?? c.estado}
                </span>
                <span className="text-xs text-slate-400 font-mono">{c.codigo}</span>
              </div>
              <div className="text-xs text-slate-500">
                {c.especialidade}{c.medico?.nome ? ` · ${c.medico.nome}` : ''}
              </div>
              {c.diagnostico && <p className="text-xs text-slate-500 italic" style={{ marginTop: '2px' }}>{c.diagnostico}</p>}
            </div>
            {c.estado !== 'agendada' && (
              <button
                onClick={() => remarcarConsulta(c)}
                className="shrink-0 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                style={{ padding: '5px 10px', marginTop: '1px' }}
              >
                Remarcar
              </button>
            )}
          </div>
        );

        return (
          <Secao titulo="Consultas" action={
            <button
              onClick={abrirModalAgendar}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
              style={{ padding: '6px 12px' }}
            >
              + Agendar Consulta
            </button>
          }>
            {consultas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '8px 0' }}>Sem consultas registadas</p>
            ) : (
              <div className="flex flex-col gap-4">
                {proximas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Próximas</p>
                    <div className="flex flex-col gap-2">{proximas.map((c: any) => <Row key={c.id} c={c} />)}</div>
                  </div>
                )}
                {historico.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Histórico</p>
                    <div className="flex flex-col gap-2">{historico.map((c: any) => <Row key={c.id} c={c} />)}</div>
                  </div>
                )}
              </div>
            )}
          </Secao>
        );
      })()}

      {/* Faturação */}
      {(() => {
        const pendentes = faturacao.filter((e: any) => ['pendente', 'emitida'].includes(e.estado));
        const totalPendente = pendentes.reduce((acc: number, e: any) => {
          const pago = (e.pagamentos ?? []).reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
          return acc + Math.max(0, (e.totalCobrado ?? 0) - pago);
        }, 0);
        const fmtEur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const ESTADO_BADGE_F: Record<string, string> = {
          pendente: 'bg-yellow-50 text-yellow-700', emitida: 'bg-orange-50 text-orange-700',
          paga: 'bg-green-50 text-green-700', isenta: 'bg-blue-50 text-blue-700', anulada: 'bg-slate-100 text-slate-500',
        };
        const ESTADO_LABEL_F: Record<string, string> = {
          pendente: '⏳ Pendente', emitida: '📄 Emitida', paga: '✅ Paga', isenta: '🔵 Isenta', anulada: '❌ Anulada',
        };

        return (
          <Secao titulo="Faturação">
            {pendentes.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800" style={{ padding: '10px 14px', marginBottom: '16px' }}>
                <span>⚠</span>
                <span>{pendentes.length} episódio{pendentes.length !== 1 ? 's' : ''} com pagamento pendente — <strong>Total: {fmtEur(totalPendente)}</strong></span>
              </div>
            )}
            {faturacao.length === 0 ? (
              <p className="text-sm text-slate-400 text-center" style={{ padding: '8px 0' }}>Sem episódios de faturação</p>
            ) : (
              <div className="flex flex-col gap-3">
                {faturacao.map((e: any) => {
                  const pago = (e.pagamentos ?? []).reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
                  const emFalta = Math.max(0, (e.totalCobrado ?? 0) - pago);
                  return (
                    <div key={e.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '8px' }}>
                        <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE_F[e.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                          {ESTADO_LABEL_F[e.estado] ?? e.estado}
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
          </Secao>
        );
      })()}

      {/* ── Modal Agendar Consulta ── */}
      {modalAgendar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalAgendar(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div>
                <p className="text-base font-bold text-slate-900">Agendar Consulta</p>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Passo {agStep} de 4</p>
              </div>
              <button aria-label="Fechar" onClick={() => setModalAgendar(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            {/* Passo 1 — Especialidade */}
            {agStep === 1 && (() => {
              const especialidades = [...new Set(medicos.map((m: any) => m.subRole).filter(Boolean))];
              return (
                <div>
                  <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '14px' }}>Selecionar Especialidade</p>
                  {especialidades.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>A carregar médicos...</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {especialidades.map((esp: string) => (
                        <button
                          key={esp}
                          onClick={() => { setAgEspecialidade(esp); setAgStep(2); }}
                          className="text-left border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
                          style={{ padding: '12px 16px' }}
                        >
                          <span className="text-sm font-medium text-slate-800">
                            {(SUBROLE_LABEL as any)[esp] ?? esp}
                          </span>
                          <span className="text-xs text-slate-400" style={{ marginLeft: '8px' }}>
                            {medicos.filter((m: any) => m.subRole === esp).length} médico{medicos.filter((m: any) => m.subRole === esp).length !== 1 ? 's' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Passo 2 — Médico */}
            {agStep === 2 && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                  <button onClick={() => setAgStep(1)} className="text-blue-600 text-xs hover:underline">← Voltar</button>
                  <p className="text-sm font-semibold text-slate-700">Selecionar Médico</p>
                </div>
                <div className="flex flex-col gap-2">
                  {medicos.filter((m: any) => m.subRole === agEspecialidade).map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => { setAgMedico(m); setAgStep(3); }}
                      className="text-left border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
                      style={{ padding: '12px 16px' }}
                    >
                      <p className="text-sm font-medium text-slate-800">{m.nome}</p>
                      <p className="text-xs text-slate-400">{(SUBROLE_LABEL as any)[m.subRole] ?? m.subRole}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Passo 3 — Data + Hora */}
            {agStep === 3 && (() => {
              const hoje = new Date();
              const amanhaUtc = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
              const dias = Array.from({ length: 28 }, (_, i) => new Date(amanhaUtc.getTime() + i * 86400000));
              const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              const firstDow = amanhaUtc.getUTCDay();
              const cells = [...Array(firstDow).fill(null), ...dias];

              return (
                <div>
                  <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
                    <button onClick={() => { setAgStep(2); setAgData(''); setAgSlots([]); setAgSlot(''); }} className="text-blue-600 text-xs hover:underline">← Voltar</button>
                    <p className="text-sm font-semibold text-slate-700">{agMedico?.nome} — Selecionar Data</p>
                  </div>

                  {/* Calendário */}
                  <div className="grid grid-cols-7 gap-1" style={{ marginBottom: '16px' }}>
                    {DIAS_SEMANA.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-slate-400" style={{ padding: '4px 0' }}>{d}</div>
                    ))}
                    {cells.map((d, i) => {
                      if (!d) return <div key={`empty-${i}`} />;
                      const iso = d.toISOString().split('T')[0];
                      const isSelected = agData === iso;
                      return (
                        <button
                          key={iso}
                          onClick={() => carregarSlots(agMedico.id, iso)}
                          className={`text-center text-sm rounded-lg transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'hover:bg-blue-50 text-slate-700'
                          }`}
                          style={{ padding: '6px 0' }}
                        >
                          {d.getUTCDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Slots */}
                  {agData && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                        Horários disponíveis — {new Date(agData + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </p>
                      {agLoadingSlots ? (
                        <p className="text-sm text-slate-400 text-center" style={{ padding: '12px 0' }}>A carregar horários...</p>
                      ) : agSlots.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center" style={{ padding: '12px 0' }}>Sem horários disponíveis neste dia</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {agSlots.map((s: any) => {
                            const hora = new Date(s.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                            const sel = agSlot === s.dataHora;
                            return (
                              <button
                                key={s.dataHora}
                                onClick={() => { setAgSlot(s.dataHora); setAgStep(4); }}
                                className={`text-sm font-medium rounded-lg border transition-all ${
                                  sel
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                                style={{ padding: '8px 0' }}
                              >
                                {hora}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Passo 4 — Confirmação */}
            {agStep === 4 && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
                  <button onClick={() => setAgStep(3)} className="text-blue-600 text-xs hover:underline">← Voltar</button>
                  <p className="text-sm font-semibold text-slate-700">Confirmar Marcação</p>
                </div>
                <div className="border border-slate-100 rounded-xl" style={{ padding: '16px', marginBottom: '20px' }}>
                  <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Utente</p>
                      <p className="text-sm font-medium text-slate-800">{doente?.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Especialidade</p>
                      <p className="text-sm font-medium text-slate-800">{(SUBROLE_LABEL as any)[agMedico?.subRole] ?? agMedico?.subRole}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Médico</p>
                      <p className="text-sm font-medium text-slate-800">{agMedico?.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Data e Hora</p>
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(agSlot).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
                {agErro && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl" style={{ padding: '10px 14px', marginBottom: '16px' }}>{agErro}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setModalAgendar(false)}
                    className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    style={{ padding: '11px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAgendamento}
                    disabled={agSalvando}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    style={{ padding: '11px' }}
                  >
                    {agSalvando ? 'A agendar...' : 'Confirmar Marcação'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
