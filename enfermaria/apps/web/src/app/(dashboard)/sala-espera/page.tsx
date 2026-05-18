'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

interface Checkin {
  id: string;
  nomeDoente: string;
  dataNascimento: string | null;
  numeroUtente: string | null;
  motivo: string;
  prioridade: number;
  estado: 'aguardando' | 'em_atendimento' | 'atendido' | 'desistiu' | 'ausente';
  chegadaEm: string;
  chamadoEm: string | null;
  atendidoEm: string | null;
  rececionista: { nome: string } | null;
  medico: { nome: string } | null;
  observacoes: string | null;
}

interface Stats {
  aguardando: number;
  em_atendimento: number;
  atendidos: number;
  tempoMedioMin: number | null;
}

const PRIORIDADE_CONFIG: Record<number, { label: string; bg: string; text: string; dot: string }> = {
  1: { label: 'Urgente',  bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  2: { label: 'Alta',     bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  3: { label: 'Normal',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  4: { label: 'Baixa',    bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
};

const ESTADO_CONFIG = {
  aguardando:     { label: 'A aguardar',     bg: 'bg-amber-50',  text: 'text-amber-700' },
  em_atendimento: { label: 'Em atendimento', bg: 'bg-green-50',  text: 'text-green-700' },
  atendido:       { label: 'Atendido',       bg: 'bg-slate-100', text: 'text-slate-500' },
  desistiu:       { label: 'Desistiu',       bg: 'bg-red-50',    text: 'text-red-500' },
  ausente:        { label: 'Ausente',        bg: 'bg-slate-100', text: 'text-slate-500' },
};

function tempoEspera(chegadaEm: string) {
  const mins = Math.floor((Date.now() - new Date(chegadaEm).getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`;
}

export default function SalaEsperaPage() {
  const { utilizador } = useAuth();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    nomeDoente: '', dataNascimento: '', numeroUtente: '', motivo: '', prioridade: 3, observacoes: '',
    nif: '', telefone: '', email: '',
    morada: '', codigoPostal: '', localidade: '',
    tipoCobertura: 'sns', entidadeSeguradora: '', numeroApolice: '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const resetForm = () => setForm({
    nomeDoente: '', dataNascimento: '', numeroUtente: '', motivo: '', prioridade: 3, observacoes: '',
    nif: '', telefone: '', email: '',
    morada: '', codigoPostal: '', localidade: '',
    tipoCobertura: 'sns', entidadeSeguradora: '', numeroApolice: '',
  });

  const carregar = useCallback(async () => {
    const [c, s] = await Promise.all([
      api.get('/sala-espera', { params: { todos: mostrarTodos } }),
      api.get('/sala-espera/estatisticas'),
    ]);
    setCheckins(c.data);
    setStats(s.data);
    setLoading(false);
  }, [mostrarTodos]);

  useEffect(() => { carregar(); }, [carregar]);

  const podeRegistar = ['administrativo', 'auxiliar', 'enfermeiro'].includes(utilizador?.role ?? '');
  const podeChamar   = ['medico', 'enfermeiro'].includes(utilizador?.role ?? '');

  const registar = async () => {
    const e: Record<string, string> = {};
    if (!form.nomeDoente.trim()) e.nomeDoente = 'Nome obrigatório';
    if (!form.motivo.trim()) e.motivo = 'Motivo obrigatório';
    if (form.nif && !/^\d{9}$/.test(form.nif)) e.nif = 'NIF deve ter 9 dígitos';
    if (form.telefone && !/^[239]\d{8}$/.test(form.telefone)) e.telefone = 'Telefone inválido (ex: 912345678)';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';
    if (form.codigoPostal && !/^\d{4}-\d{3}$/.test(form.codigoPostal)) e.codigoPostal = 'Formato: 0000-000';
    if (form.tipoCobertura === 'seguro' && !form.entidadeSeguradora.trim()) e.entidadeSeguradora = 'Campo obrigatório para seguro';
    if (form.tipoCobertura === 'seguro' && !form.numeroApolice.trim()) e.numeroApolice = 'Campo obrigatório para seguro';
    if (Object.keys(e).length > 0) { setErros(e); return; }
    setErros({});
    setSalvando(true);
    try {
      await api.post('/sala-espera', {
        nomeDoente: form.nomeDoente,
        dataNascimento: form.dataNascimento || undefined,
        numeroUtente: form.numeroUtente || undefined,
        motivo: form.motivo,
        prioridade: form.prioridade,
        observacoes: form.observacoes || undefined,
      });
      if (form.nif && form.numeroUtente && form.telefone) {
        await api.post('/doentes/registro-rapido', {
          tipoVisita: 'urgencia',
          nome: form.nomeDoente,
          dataNascimento: form.dataNascimento || undefined,
          nif: form.nif,
          numeroSNS: form.numeroUtente,
          telefone: form.telefone,
          email: form.email || undefined,
          morada: form.morada || undefined,
          codigoPostal: form.codigoPostal || undefined,
          localidade: form.localidade || undefined,
          tipoCobertura: form.tipoCobertura || undefined,
          entidadeSeguradora: form.entidadeSeguradora || undefined,
          numeroApolice: form.numeroApolice || undefined,
        }).catch(() => {});
      }
      setModal(false);
      resetForm();
      carregar();
    } finally { setSalvando(false); }
  };

  const chamar = async (id: string) => {
    await api.patch(`/sala-espera/${id}/chamar`, {});
    carregar();
  };

  const concluir = async (id: string, estado: 'atendido' | 'desistiu' | 'ausente') => {
    await api.patch(`/sala-espera/${id}/concluir`, { estado });
    carregar();
  };

  const aguardando = checkins.filter(c => c.estado === 'aguardando');
  const emAtendimento = checkins.filter(c => c.estado === 'em_atendimento');
  const concluidos = checkins.filter(c => ['atendido', 'desistiu', 'ausente'].includes(c.estado));

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sala de Espera</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Gestão de utentes em espera para consulta</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={carregar} className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2" style={{ padding: '10px 18px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
          {podeRegistar && (
            <button onClick={() => setModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 20px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Registar Entrada
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '28px' }}>
          {[
            { label: 'A aguardar', value: stats.aguardando, cor: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Em atendimento', value: stats.em_atendimento, cor: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Atendidos hoje', value: stats.atendidos, cor: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Tempo médio', value: stats.tempoMedioMin != null ? `${stats.tempoMedioMin}min` : '—', cor: 'text-slate-700', bg: 'bg-slate-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border border-slate-100 shadow-sm ${s.bg}`} style={{ padding: '20px 24px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-bold ${s.cor}`} style={{ marginTop: '6px' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar sala de espera...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Em Atendimento */}
          {emAtendimento.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                Em Atendimento ({emAtendimento.length})
              </h2>
              <div className="flex flex-col gap-2">
                {emAtendimento.map(c => <CheckinCard key={c.id} c={c} podeChamar={podeChamar} onConcluir={concluir} />)}
              </div>
            </div>
          )}

          {/* A Aguardar */}
          <div>
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
              A Aguardar ({aguardando.length})
            </h2>
            {aguardando.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 text-center text-slate-400 text-sm" style={{ padding: '40px' }}>
                Nenhum utente em espera
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {aguardando.map(c => (
                  <CheckinCard key={c.id} c={c} podeChamar={podeChamar} onChamar={chamar} onConcluir={concluir} />
                ))}
              </div>
            )}
          </div>

          {/* Concluídos */}
          <div>
            <button
              onClick={() => setMostrarTodos(v => !v)}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors">
              <svg className={`w-4 h-4 transition-transform ${mostrarTodos ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {mostrarTodos ? 'Ocultar' : 'Mostrar'} concluídos ({concluidos.length})
            </button>
            {mostrarTodos && concluidos.length > 0 && (
              <div className="flex flex-col gap-2" style={{ marginTop: '10px' }}>
                {concluidos.map(c => <CheckinCard key={c.id} c={c} podeChamar={false} onConcluir={concluir} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Registar Entrada */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setModal(false); setErros({}); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px', maxHeight: '92vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Entrada</h2>
              <button onClick={() => { setModal(false); setErros({}); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            {/* ── Secção 1: Triagem ── */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '14px' }}>Triagem</p>

            {([
              { label: 'Nome do Utente *', key: 'nomeDoente', type: 'text', placeholder: 'Nome completo' },
              { label: 'Número de Utente (SNS)', key: 'numeroUtente', type: 'text', placeholder: 'Ex: 123456789' },
              { label: 'Data de Nascimento', key: 'dataNascimento', type: 'date', placeholder: '' },
              { label: 'Motivo da Entrada *', key: 'motivo', type: 'text', placeholder: 'Ex: Dor abdominal, Febre alta...' },
            ] as { label: string; key: string; type: string; placeholder: string }[]).map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '12px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros[key] ? 'border-red-400' : 'border-slate-200'}`}
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
                {erros[key] && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros[key]}</p>}
              </div>
            ))}

            <div style={{ marginBottom: '12px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Prioridade</label>
              <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                {Object.entries(PRIORIDADE_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} placeholder="Informações adicionais..."
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            {/* ── Secção 2: Dados Administrativos ── */}
            <div className="border-t border-slate-100" style={{ paddingTop: '20px', marginBottom: '14px' }}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '4px' }}>Dados Administrativos</p>
              <p className="text-xs text-slate-400" style={{ marginBottom: '14px' }}>Se disponíveis, ficam associados ao processo do utente.</p>
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              {([
                { label: 'NIF', key: 'nif', placeholder: '123456789' },
                { label: 'Telefone', key: 'telefone', placeholder: '912345678' },
              ] as { label: string; key: string; placeholder: string }[]).map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>{label}</label>
                  <input type="text" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros[key] ? 'border-red-400' : 'border-slate-200'}`}
                    style={{ padding: '10px 14px' }} placeholder={placeholder} />
                  {erros[key] && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros[key]}</p>}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros.email ? 'border-red-400' : 'border-slate-200'}`}
                style={{ padding: '10px 14px' }} placeholder="exemplo@email.com" />
              {erros.email && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros.email}</p>}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Morada</label>
              <input type="text" value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="Rua, número, andar" />
            </div>

            <div className="grid grid-cols-2 gap-x-4" style={{ marginBottom: '12px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Código Postal</label>
                <input type="text" value={form.codigoPostal} onChange={e => setForm(f => ({ ...f, codigoPostal: e.target.value }))}
                  className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros.codigoPostal ? 'border-red-400' : 'border-slate-200'}`}
                  style={{ padding: '10px 14px' }} placeholder="0000-000" />
                {erros.codigoPostal && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros.codigoPostal}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Localidade</label>
                <input type="text" value={form.localidade} onChange={e => setForm(f => ({ ...f, localidade: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} placeholder="Lisboa" />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Tipo de Cobertura</label>
              <select value={form.tipoCobertura} onChange={e => setForm(f => ({ ...f, tipoCobertura: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                <option value="sns">SNS</option>
                <option value="seguro">Seguro</option>
                <option value="particular">Particular</option>
                <option value="adse">ADSE</option>
              </select>
            </div>

            {form.tipoCobertura === 'seguro' && (
              <div className="grid grid-cols-2 gap-x-4" style={{ marginBottom: '12px' }}>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>Entidade Seguradora *</label>
                  <input type="text" value={form.entidadeSeguradora} onChange={e => setForm(f => ({ ...f, entidadeSeguradora: e.target.value }))}
                    className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros.entidadeSeguradora ? 'border-red-400' : 'border-slate-200'}`}
                    style={{ padding: '10px 14px' }} placeholder="Ex: Fidelidade" />
                  {erros.entidadeSeguradora && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros.entidadeSeguradora}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '5px' }}>N.º Apólice *</label>
                  <input type="text" value={form.numeroApolice} onChange={e => setForm(f => ({ ...f, numeroApolice: e.target.value }))}
                    className={`w-full border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${erros.numeroApolice ? 'border-red-400' : 'border-slate-200'}`}
                    style={{ padding: '10px 14px' }} placeholder="Ex: AP12345678" />
                  {erros.numeroApolice && <p className="text-xs text-red-500" style={{ marginTop: '3px' }}>{erros.numeroApolice}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => { setModal(false); setErros({}); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registar} disabled={salvando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A registar...' : 'Registar Entrada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckinCard({ c, podeChamar, onChamar, onConcluir }: {
  c: Checkin;
  podeChamar: boolean;
  onChamar?: (id: string) => void;
  onConcluir: (id: string, estado: 'atendido' | 'desistiu' | 'ausente') => void;
}) {
  const pCfg = PRIORIDADE_CONFIG[c.prioridade] ?? PRIORIDADE_CONFIG[3];
  const eCfg = ESTADO_CONFIG[c.estado];
  const concluido = ['atendido', 'desistiu', 'ausente'].includes(c.estado);

  return (
    <div className={`bg-white rounded-2xl border flex items-start justify-between gap-4 ${concluido ? 'border-slate-100 opacity-70' : 'border-slate-200'}`} style={{ padding: '16px 20px' }}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${pCfg.dot}`} style={{ marginTop: '5px' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 text-sm">{c.nomeDoente}</p>
            <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${pCfg.bg} ${pCfg.text}`}>{pCfg.label}</span>
            <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${eCfg.bg} ${eCfg.text}`}>{eCfg.label}</span>
          </div>
          <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>{c.motivo}</p>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '4px' }}>
            <span className="text-xs text-slate-400">
              {c.estado === 'aguardando' ? `Espera: ${tempoEspera(c.chegadaEm)}` : `Chegou: ${new Date(c.chegadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
            {c.numeroUtente && <span className="text-xs text-slate-400">SNS: {c.numeroUtente}</span>}
            {c.medico && <span className="text-xs text-slate-400">Dr(a). {c.medico.nome}</span>}
          </div>
        </div>
      </div>
      {!concluido && (
        <div className="flex gap-2 shrink-0">
          {c.estado === 'aguardando' && podeChamar && onChamar && (
            <button onClick={() => onChamar(c.id)}
              className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              style={{ padding: '7px 14px' }}>
              Chamar
            </button>
          )}
          {c.estado === 'em_atendimento' && (
            <button onClick={() => onConcluir(c.id, 'atendido')}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              style={{ padding: '7px 14px' }}>
              Concluído
            </button>
          )}
          <button onClick={() => onConcluir(c.id, 'desistiu')}
            className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            style={{ padding: '7px 12px' }}>
            Desistiu
          </button>
        </div>
      )}
    </div>
  );
}
