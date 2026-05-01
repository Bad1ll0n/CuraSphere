'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';

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

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px 28px', marginBottom: '20px' }}>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '18px' }}>{titulo}</p>
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

  const carregar = useCallback(async () => {
    try {
      const [resDoente, resFicha] = await Promise.all([
        api.get(`/doentes/${id}`),
        api.get(`/doentes/${id}/ficha-pessoal`).catch(() => ({ data: {} })),
      ]);
      setDoente(resDoente.data);
      setFicha(resFicha.data ?? {});
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
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${ESTADO_COR[doente.estadoRegisto] ?? 'bg-slate-100 text-slate-500'}`}>
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
    </div>
  );
}
