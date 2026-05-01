'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const TIPOS_VISITA: Record<string, { label: string; icon: string; cor: string }> = {
  consulta:     { label: 'Consulta',     icon: '👨‍⚕️', cor: '#8b5cf6' },
  exame:        { label: 'Exame',        icon: '🔬', cor: '#06b6d4' },
  urgencia:     { label: 'Urgência',     icon: '🚨', cor: '#ef4444' },
  farmacia:     { label: 'Farmácia',     icon: '💊', cor: '#10b981' },
  internamento: { label: 'Internamento', icon: '🏥', cor: '#3b82f6' },
  outro:        { label: 'Outro',        icon: 'ℹ️', cor: '#6b7280' },
};

const ESTADO_LABEL: Record<string, { label: string; cor: string }> = {
  pendente_cama: { label: 'Aguarda Cama',   cor: '#f59e0b' },
  ambulatorio:   { label: 'Ambulatório',    cor: '#10b981' },
  internado:     { label: 'Internado',      cor: '#3b82f6' },
};

interface RegistoAdmin {
  id: string;
  nome: string;
  dataNascimento?: string;
  numeroProcesso: string;
  estadoRegisto: string;
  tipoVisita?: string;
  dataAdmissao: string;
  ficheiroPessoal?: {
    nif?: string;
    numeroSNS?: string;
    telefone?: string;
    tipoCobertura?: string;
  };
}

const TIPOS_VISITA_FORM = [
  { value: 'consulta',     label: 'Consulta',     icon: '👨‍⚕️', desc: 'Marcação com médico' },
  { value: 'exame',        label: 'Exame',        icon: '🔬', desc: 'Análises / Imagiologia' },
  { value: 'urgencia',     label: 'Urgência',     icon: '🚨', desc: 'Atendimento de urgência' },
  { value: 'farmacia',     label: 'Farmácia',     icon: '💊', desc: 'Levantamento de medicação' },
  { value: 'internamento', label: 'Internamento', icon: '🏥', desc: 'Admissão com cama' },
  { value: 'outro',        label: 'Outro',        icon: 'ℹ️', desc: 'Outro serviço' },
];

const formVazio = {
  tipoVisita: '',
  nome: '', dataNascimento: '', nif: '', numeroSNS: '',
  telefone: '', email: '', tipoCobertura: 'sns',
  morada: '', codigoPostal: '', localidade: '',
  entidadeSeguradora: '', numeroApolice: '',
};

export default function RegistosAdministrativosPage() {
  const { utilizador } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const podeVer = utilizador?.role === 'administrativo';

  const [registos, setRegistos] = useState<RegistoAdmin[]>([]);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal novo registo
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [sucesso, setSucesso] = useState<{ nome: string; numeroProcesso: string; tipoVisita: string } | null>(null);

  function validar(f: typeof form): Record<string, string> {
    const e: Record<string, string> = {};
    if (!f.tipoVisita) e.tipoVisita = 'Selecione o tipo de visita';
    if (!f.nome.trim()) e.nome = 'Nome é obrigatório';
    if (!f.dataNascimento) e.dataNascimento = 'Data de nascimento é obrigatória';
    else if (new Date(f.dataNascimento) >= new Date()) e.dataNascimento = 'Data deve ser no passado';
    if (!f.nif) e.nif = 'NIF é obrigatório';
    else if (!/^\d{9}$/.test(f.nif)) e.nif = 'NIF deve ter exactamente 9 dígitos';
    if (!f.telefone) e.telefone = 'Telefone é obrigatório';
    else if (!/^[239]\d{8}$/.test(f.telefone.replace(/\s/g, ''))) e.telefone = 'Inválido (9 dígitos, começa com 2, 3 ou 9)';
    if (!f.numeroSNS) e.numeroSNS = 'Número SNS é obrigatório';
    else if (!/^\d{9}$/.test(f.numeroSNS.replace(/\s/g, ''))) e.numeroSNS = 'SNS deve ter 9 dígitos';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Email inválido';
    if (f.codigoPostal && !/^\d{4}-\d{3}$/.test(f.codigoPostal)) e.codigoPostal = 'Formato: 0000-000';
    if (f.tipoCobertura === 'seguro') {
      if (!f.entidadeSeguradora.trim()) e.entidadeSeguradora = 'Obrigatório para seguro';
      if (!f.numeroApolice.trim()) e.numeroApolice = 'Obrigatório para seguro';
    }
    return e;
  }

  const carregar = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API}/doentes/registos-administrativos${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRegistos(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    if (podeVer) carregar();
  }, [podeVer, carregar]);

  async function criarRegisto(e: React.FormEvent) {
    e.preventDefault();
    const validacoes = validar(form);
    if (Object.keys(validacoes).length > 0) { setErros(validacoes); return; }
    setErros({});
    setCriando(true);
    setErro('');
    try {
      const res = await fetch(`${API}/doentes/registro-rapido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: form.nome,
          tipoVisita: form.tipoVisita,
          dataNascimento: form.dataNascimento || undefined,
          nif: form.nif || undefined,
          numeroSNS: form.numeroSNS || undefined,
          telefone: form.telefone || undefined,
          email: form.email || undefined,
          tipoCobertura: form.tipoCobertura,
          morada: form.morada || undefined,
          codigoPostal: form.codigoPostal || undefined,
          localidade: form.localidade || undefined,
          entidadeSeguradora: form.entidadeSeguradora || undefined,
          numeroApolice: form.numeroApolice || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErro(err.message ?? 'Erro ao registar utente');
        return;
      }
      const doente = await res.json();
      setSucesso({ nome: doente.nome, numeroProcesso: doente.numeroProcesso, tipoVisita: form.tipoVisita });
      setForm(formVazio);
      carregar();
    } finally {
      setCriando(false);
    }
  }

  function fecharModal() {
    setModalAberto(false);
    setErro('');
    setErros({});
    setSucesso(null);
    setForm(formVazio);
  }

  const registosFiltrados = registos.filter(r =>
    !filtroTipo || r.tipoVisita === filtroTipo
  );

  if (!podeVer) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <p style={{ marginTop: 16, fontSize: 18 }}>Acesso restrito ao departamento administrativo.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Registos Administrativos</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
            Utentes registados administrativamente — aguardam encaminhamento clínico
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          + Novo Registo
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Pesquisar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && carregar()}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 14, width: 240 }}
        />
        <button onClick={carregar}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Pesquisar
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setFiltroTipo('')}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: !filtroTipo ? '#3b82f6' : 'transparent', color: !filtroTipo ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}
          >
            Todos
          </button>
          {TIPOS_VISITA_FORM.map(t => (
            <button
              key={t.value}
              onClick={() => setFiltroTipo(prev => prev === t.value ? '' : t.value)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: filtroTipo === t.value ? '#3b82f6' : 'transparent', color: filtroTipo === t.value ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>A carregar...</div>
      ) : registosFiltrados.length === 0 ? (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '48px', textAlign: 'center', color: '#475569' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p>Sem registos administrativos pendentes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registosFiltrados.map(r => {
            const tv = r.tipoVisita ? TIPOS_VISITA[r.tipoVisita] : null;
            const estado = ESTADO_LABEL[r.estadoRegisto] ?? { label: r.estadoRegisto, cor: '#6b7280' };
            return (
              <div key={r.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Tipo visita */}
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${tv?.cor ?? '#6b7280'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {tv?.icon ?? '?'}
                </div>

                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{r.nome}</span>
                    <span style={{ background: `${tv?.cor ?? '#6b7280'}20`, color: tv?.cor ?? '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                      {tv?.label ?? r.tipoVisita}
                    </span>
                    <span style={{ background: `${estado.cor}20`, color: estado.cor, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                      {estado.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, color: '#64748b', fontSize: 13 }}>
                    <span>Processo: <strong style={{ color: '#94a3b8' }}>{r.numeroProcesso}</strong></span>
                    {r.ficheiroPessoal?.nif && <span>NIF: {r.ficheiroPessoal.nif}</span>}
                    {r.ficheiroPessoal?.telefone && <span>📞 {r.ficheiroPessoal.telefone}</span>}
                    {r.dataNascimento && (
                      <span>
                        {new Date(r.dataNascimento).toLocaleDateString('pt-PT')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Data registo + cobertura */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {new Date(r.dataAdmissao).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {r.ficheiroPessoal?.tipoCobertura && (
                    <span style={{ background: '#0f172a', color: '#94a3b8', borderRadius: 6, padding: '2px 8px', fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                      {r.ficheiroPessoal.tipoCobertura.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo Registo */}
      {modalAberto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) fecharModal(); }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            {sucesso ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 8 }}>Registo Concluído</h2>
                <p style={{ color: '#6ee7b7', fontSize: 18, fontWeight: 700 }}>{sucesso.nome}</p>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                  Processo nº <strong style={{ color: '#94a3b8' }}>{sucesso.numeroProcesso}</strong>
                </p>
                {(() => {
                  const tv = TIPOS_VISITA_FORM.find(t => t.value === sucesso.tipoVisita);
                  const msgs: Record<string, string> = {
                    internamento: 'Aguarda atribuição de cama pela equipa clínica.',
                    consulta: 'Pode tirar senha no quiosque para consulta.',
                    exame: 'Dirija-se ao serviço de exames.',
                    urgencia: 'Dirija-se à urgência imediatamente.',
                    farmacia: 'Dirija-se à farmácia.',
                    outro: 'Registo concluído.',
                  };
                  return (
                    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
                      <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>
                        {tv?.icon} <strong>{tv?.label}</strong> — {msgs[sucesso.tipoVisita] ?? ''}
                      </p>
                    </div>
                  );
                })()}
                <button onClick={fecharModal}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={criarRegisto}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Novo Registo Administrativo</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 13 }}>Dados legais e de identificação do utente</p>
                  </div>
                  <button type="button" onClick={fecharModal}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
                </div>

                {erro && (
                  <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>
                    {erro}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>

                  {/* Motivo da visita */}
                  <div>
                    <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 0' }}>
                      Motivo da Visita <span style={{ color: '#ef4444' }}>*</span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {TIPOS_VISITA_FORM.map(tv => (
                        <button key={tv.value} type="button"
                          onClick={() => { setForm(f => ({ ...f, tipoVisita: tv.value })); setErros(p => ({ ...p, tipoVisita: '' })); }}
                          style={{ padding: '10px 8px', borderRadius: 10, border: form.tipoVisita === tv.value ? '2px solid #3b82f6' : `1px solid ${erros.tipoVisita ? '#ef4444' : '#334155'}`, background: form.tipoVisita === tv.value ? '#1e3a5f' : '#0f172a', color: form.tipoVisita === tv.value ? '#60a5fa' : '#94a3b8', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: form.tipoVisita === tv.value ? 700 : 400 }}
                        >
                          <div style={{ fontSize: 22, marginBottom: 4 }}>{tv.icon}</div>
                          <div>{tv.label}</div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{tv.desc}</div>
                        </button>
                      ))}
                    </div>
                    {erros.tipoVisita && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{erros.tipoVisita}</p>}
                  </div>

                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Identificação</p>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Nome Completo <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input value={form.nome}
                      onChange={e => { setForm(f => ({ ...f, nome: e.target.value })); setErros(p => ({ ...p, nome: '' })); }}
                      style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.nome ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="Nome completo do utente" />
                    {erros.nome && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.nome}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Data de Nascimento <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input type="date" value={form.dataNascimento}
                        onChange={e => { setForm(f => ({ ...f, dataNascimento: e.target.value })); setErros(p => ({ ...p, dataNascimento: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.dataNascimento ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }} />
                      {erros.dataNascimento && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.dataNascimento}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        NIF <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input value={form.nif}
                        onChange={e => { setForm(f => ({ ...f, nif: e.target.value.replace(/\D/g, '') })); setErros(p => ({ ...p, nif: '' })); }}
                        maxLength={9}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.nif ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="000000000" />
                      {erros.nif && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.nif}</p>}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Nº SNS <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input value={form.numeroSNS}
                      onChange={e => { setForm(f => ({ ...f, numeroSNS: e.target.value.replace(/\D/g, '') })); setErros(p => ({ ...p, numeroSNS: '' })); }}
                      maxLength={9}
                      style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.numeroSNS ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="000000000" />
                    {erros.numeroSNS && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.numeroSNS}</p>}
                  </div>

                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Contactos</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Telefone <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input type="tel" value={form.telefone}
                        onChange={e => { setForm(f => ({ ...f, telefone: e.target.value })); setErros(p => ({ ...p, telefone: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.telefone ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="9XX XXX XXX" />
                      {erros.telefone && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.telefone}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Email</label>
                      <input type="email" value={form.email}
                        onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErros(p => ({ ...p, email: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.email ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="email@exemplo.pt" />
                      {erros.email && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.email}</p>}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Morada</label>
                    <input value={form.morada} onChange={e => setForm(f => ({ ...f, morada: e.target.value }))}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="Rua, nº, andar" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Cód. Postal</label>
                      <input value={form.codigoPostal}
                        onChange={e => { setForm(f => ({ ...f, codigoPostal: e.target.value })); setErros(p => ({ ...p, codigoPostal: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.codigoPostal ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="0000-000" />
                      {erros.codigoPostal && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.codigoPostal}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Localidade</label>
                      <input value={form.localidade} onChange={e => setForm(f => ({ ...f, localidade: e.target.value }))}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="Cidade" />
                    </div>
                  </div>

                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Cobertura de Saúde</p>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Tipo de Cobertura</label>
                    <select value={form.tipoCobertura} onChange={e => { setForm(f => ({ ...f, tipoCobertura: e.target.value, entidadeSeguradora: '', numeroApolice: '' })); setErros(p => ({ ...p, entidadeSeguradora: '', numeroApolice: '' })); }}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}>
                      <option value="sns">SNS</option>
                      <option value="seguro">Seguro de Saúde</option>
                      <option value="particular">Particular</option>
                    </select>
                  </div>

                  {form.tipoCobertura === 'seguro' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Entidade Seguradora <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input value={form.entidadeSeguradora}
                          onChange={e => { setForm(f => ({ ...f, entidadeSeguradora: e.target.value })); setErros(p => ({ ...p, entidadeSeguradora: '' })); }}
                          style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.entidadeSeguradora ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                          placeholder="Nome da seguradora" />
                        {erros.entidadeSeguradora && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.entidadeSeguradora}</p>}
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Nº Apólice <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input value={form.numeroApolice}
                          onChange={e => { setForm(f => ({ ...f, numeroApolice: e.target.value })); setErros(p => ({ ...p, numeroApolice: '' })); }}
                          style={{ width: '100%', background: '#0f172a', border: `1px solid ${erros.numeroApolice ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                          placeholder="Nº da apólice" />
                        {erros.numeroApolice && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{erros.numeroApolice}</p>}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button type="button" onClick={fecharModal}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 15, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={criando}
                      style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 15, fontWeight: 700, cursor: criando ? 'not-allowed' : 'pointer', opacity: criando ? 0.5 : 1 }}>
                      {criando ? 'A registar...' : 'Registar Administrativamente'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
