'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const TIPO_LABEL: Record<string, string> = {
  admissao: 'Admissão',
  consulta: 'Consulta',
  faturacao: 'Faturação',
  farmacia: 'Farmácia',
  exames: 'Exames',
  urgencia: 'Urgência',
  geral: 'Informações',
};

const TIPO_COR: Record<string, string> = {
  admissao: '#3b82f6',
  consulta: '#8b5cf6',
  faturacao: '#f59e0b',
  farmacia: '#10b981',
  exames: '#06b6d4',
  urgencia: '#ef4444',
  geral: '#6b7280',
};

const PRIORIDADE_BADGE: Record<string, { label: string; bg: string }> = {
  prioritario: { label: '🔴 Prioritário', bg: '#ef444420' },
  senior:      { label: '🟡 Sénior',      bg: '#f59e0b20' },
  normal:      { label: 'Normal',          bg: '#1e293b' },
};

interface Ticket {
  id: string;
  numero: string;
  letra: string;
  tipo: string;
  estado: string;
  prioridade: string;
  balcao?: string;
  nomeUtente?: string;
  telefone?: string;
  criadoEm: string;
  chamadoEm?: string;
  concluidoEm?: string;
}

interface Stats {
  total: number;
  por_estado: { estado: string; _count: number }[];
  por_tipo: { tipo: string; _count: number }[];
}

export default function RecepcaoPage() {
  const { utilizador } = useAuth();
  const [fila, setFila] = useState<Ticket[]>([]);
  const [ultimos, setUltimos] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balcao, setBalcao] = useState('1');
  const [chamando, setChamando] = useState(false);
  const [ultimoChamado, setUltimoChamado] = useState<Ticket | null>(null);
  const [flash, setFlash] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const carregarDadosRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const podeVer = utilizador?.role === 'administrativo';

  // Modal Registo Administrativo
  const TIPOS_VISITA = [
    { value: 'consulta',     label: 'Consulta',     icon: '👨‍⚕️', desc: 'Marcação com médico' },
    { value: 'exame',        label: 'Exame',        icon: '🔬', desc: 'Análises / Imagiologia' },
    { value: 'urgencia',     label: 'Urgência',     icon: '🚨', desc: 'Atendimento de urgência' },
    { value: 'farmacia',     label: 'Farmácia',     icon: '💊', desc: 'Levantamento de medicação' },
    { value: 'internamento', label: 'Internamento', icon: '🏥', desc: 'Admissão com cama' },
    { value: 'outro',        label: 'Outro',        icon: 'ℹ️', desc: 'Outro serviço' },
  ];

  const [modalNovoUtente, setModalNovoUtente] = useState(false);
  const [novoUtenteForm, setNovoUtenteForm] = useState({
    tipoVisita: '',
    nome: '', dataNascimento: '', nif: '', numeroSNS: '',
    telefone: '', email: '', tipoCobertura: 'sns',
    morada: '', codigoPostal: '', localidade: '',
    entidadeSeguradora: '', numeroApolice: '',
  });
  const [criandoUtente, setCriandoUtente] = useState(false);
  const [novoUtenteErro, setNovoUtenteErro] = useState('');
  const [novoUtenteErros, setNovoUtenteErros] = useState<Record<string, string>>({});
  const [novoUtenteSucesso, setNovoUtenteSucesso] = useState<{ nome: string; numeroProcesso: string; tipoVisita: string } | null>(null);

  function validarNovoUtente(f: typeof novoUtenteForm): Record<string, string> {
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

  const formVazio = {
    tipoVisita: '',
    nome: '', dataNascimento: '', nif: '', numeroSNS: '',
    telefone: '', email: '', tipoCobertura: 'sns',
    morada: '', codigoPostal: '', localidade: '',
    entidadeSeguradora: '', numeroApolice: '',
  };

  async function criarUtente(e: React.FormEvent) {
    e.preventDefault();
    const validacoes = validarNovoUtente(novoUtenteForm);
    if (Object.keys(validacoes).length > 0) { setNovoUtenteErros(validacoes); return; }
    setNovoUtenteErros({});
    setCriandoUtente(true);
    setNovoUtenteErro('');
    try {
      const res = await fetch(`${API}/doentes/registro-rapido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: novoUtenteForm.nome,
          tipoVisita: novoUtenteForm.tipoVisita,
          dataNascimento: novoUtenteForm.dataNascimento || undefined,
          nif: novoUtenteForm.nif || undefined,
          numeroSNS: novoUtenteForm.numeroSNS || undefined,
          telefone: novoUtenteForm.telefone || undefined,
          email: novoUtenteForm.email || undefined,
          tipoCobertura: novoUtenteForm.tipoCobertura,
          morada: novoUtenteForm.morada || undefined,
          codigoPostal: novoUtenteForm.codigoPostal || undefined,
          localidade: novoUtenteForm.localidade || undefined,
          entidadeSeguradora: novoUtenteForm.entidadeSeguradora || undefined,
          numeroApolice: novoUtenteForm.numeroApolice || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNovoUtenteErro(err.message ?? 'Erro ao registar utente');
        return;
      }
      const doente = await res.json();
      setNovoUtenteSucesso({ nome: doente.nome, numeroProcesso: doente.numeroProcesso, tipoVisita: novoUtenteForm.tipoVisita });
      setNovoUtenteForm(formVazio);
    } finally {
      setCriandoUtente(false);
    }
  }

  function fecharModalNovoUtente() {
    setModalNovoUtente(false);
    setNovoUtenteErro('');
    setNovoUtenteErros({});
    setNovoUtenteSucesso(null);
    setNovoUtenteForm(formVazio);
  }

  function triggerFlash() {
    setFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 3000);
  }

  const carregarDados = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [filaRes, ultimosRes, statsRes] = await Promise.all([
      fetch(`${API}/tickets/fila`, { headers }),
      fetch(`${API}/tickets/ultimos`, { headers }),
      fetch(`${API}/tickets/stats`, { headers }),
    ]);
    if (filaRes.ok) setFila(await filaRes.json());
    if (ultimosRes.ok) {
      const u = await ultimosRes.json();
      setUltimos(u);
      if (u.length > 0) setUltimoChamado(u[0]);
    }
    if (statsRes.ok) setStats(await statsRes.json());
  }, [token]);

  // Manter ref sempre atualizada para usar dentro do SSE sem stale closure
  useEffect(() => { carregarDadosRef.current = carregarDados; }, [carregarDados]);

  useEffect(() => {
    if (!podeVer || !token) return;
    carregarDadosRef.current();

    // Polling de backup — garante sincronização mesmo que o SSE falhe
    const pollInterval = setInterval(() => carregarDadosRef.current(), 8000);

    function conectar() {
      const es = new EventSource(`${API}/quiosque/eventos`);
      esRef.current = es;

      es.addEventListener('ticket_chamado', (e) => {
        const payload = JSON.parse(e.data);
        setUltimoChamado(payload.ticket);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        if (Array.isArray(payload.ultimos)) setUltimos(payload.ultimos);
        triggerFlash();
        carregarDadosRef.current();
      });

      es.addEventListener('novo_ticket', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        carregarDadosRef.current();
      });

      es.addEventListener('ticket_concluido', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        carregarDadosRef.current();
      });

      es.addEventListener('error', () => {
        es.close();
        setTimeout(conectar, 3000);
      });
    }

    conectar();
    return () => {
      esRef.current?.close();
      clearInterval(pollInterval);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [podeVer, token]);

  async function chamarProximo() {
    if (!token || chamando) return;
    setChamando(true);
    try {
      const res = await fetch(`${API}/tickets/chamar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ balcao }),
      });
      const data = await res.json();
      if (!data || !data.numero) {
        alert('Não há tickets em espera.');
      }
    } finally {
      setChamando(false);
    }
  }

  async function rechamar(id: string) {
    if (!token) return;
    await fetch(`${API}/tickets/${id}/rechamar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ balcao }),
    });
  }

  async function concluir(id: string) {
    if (!token) return;
    await fetch(`${API}/tickets/${id}/concluir`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function desistiu(id: string) {
    if (!token) return;
    await fetch(`${API}/tickets/${id}/desistiu`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setFila((prev) => prev.filter((t) => t.id !== id));
  }

  if (!podeVer) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <p style={{ marginTop: 16, fontSize: 18 }}>Acesso restrito ao departamento administrativo.</p>
      </div>
    );
  }

  const totalEspera = fila.length;
  const totalHoje = stats?.total ?? 0;
  const concluidos = stats?.por_estado.find((e) => e.estado === 'concluido')?._count ?? 0;
  const prioritarios = fila.filter((t) => t.prioridade === 'prioritario').length;
  const seniors = fila.filter((t) => t.prioridade === 'senior').length;

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Receção — Gestão de Filas</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href="/registos-administrativos"
            style={{
              background: '#10b981',
              border: 'none',
              color: '#fff',
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            + Registar Utente
          </a>
          <a
            href="/quiosque"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            🖥️ Quiosque
          </a>
          <a
            href="/painel"
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            📺 Painel
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Em Espera', value: totalEspera, cor: '#3b82f6' },
          { label: 'Prioritários', value: prioritarios, cor: '#ef4444' },
          { label: 'Seniores', value: seniors, cor: '#f59e0b' },
          { label: 'Concluídos Hoje', value: concluidos, cor: '#10b981' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#1e293b',
              border: `1px solid ${k.cor}30`,
              borderRadius: 12,
              padding: '20px 24px',
            }}
          >
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>{k.label}</p>
            <p style={{ fontSize: 36, fontWeight: 800, color: k.cor, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Painel principal — fila + chamar */}
        <div>
          {/* Controlo de chamada */}
          <div
            style={{
              background: flash ? '#1e3a5f' : '#1e293b',
              border: `1px solid ${flash ? '#3b82f6' : '#334155'}`,
              borderRadius: 16,
              padding: '24px',
              marginBottom: 24,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                {ultimoChamado ? (
                  <div>
                    <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Última chamada</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 40, fontWeight: 900, color: flash ? '#60a5fa' : '#fff' }}>
                        {ultimoChamado.numero}
                      </span>
                      {ultimoChamado.balcao && (
                        <span style={{ background: '#3b82f620', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 8, padding: '4px 12px', fontSize: 14 }}>
                          Balcão {ultimoChamado.balcao}
                        </span>
                      )}
                      <button
                        onClick={() => rechamar(ultimoChamado.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #334155',
                          color: '#94a3b8',
                          borderRadius: 8,
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        🔁 Re-chamar
                      </button>
                      <button
                        onClick={() => concluir(ultimoChamado.id)}
                        style={{
                          background: '#10b98120',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          borderRadius: 8,
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        ✓ Concluir
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#475569' }}>Nenhuma chamada activa</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>Balcão</label>
                  <input
                    type="text"
                    value={balcao}
                    onChange={(e) => setBalcao(e.target.value)}
                    style={{
                      width: 64,
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: 16,
                      textAlign: 'center',
                    }}
                  />
                </div>
                <button
                  onClick={chamarProximo}
                  disabled={chamando || fila.length === 0}
                  style={{
                    marginTop: 20,
                    background: chamando || fila.length === 0 ? '#1e293b' : '#3b82f6',
                    border: 'none',
                    color: chamando || fila.length === 0 ? '#475569' : '#fff',
                    borderRadius: 10,
                    padding: '12px 24px',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: chamando || fila.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {chamando ? 'A chamar...' : '▶ Chamar Próximo'}
                </button>
              </div>
            </div>
          </div>

          {/* Fila em espera */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #334155' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Fila em Espera ({totalEspera})
              </h2>
            </div>
            {fila.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                <div style={{ fontSize: 40 }}>✅</div>
                <p style={{ marginTop: 8 }}>Fila vazia — todos atendidos!</p>
              </div>
            ) : (
              <div>
                {fila.map((t, i) => {
                  const badge = PRIORIDADE_BADGE[t.prioridade] ?? PRIORIDADE_BADGE.normal;
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 24px',
                        borderBottom: i < fila.length - 1 ? '1px solid #0f172a' : 'none',
                        background: i === 0 ? '#172033' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontWeight: 800, fontSize: 24, minWidth: 60, color: i === 0 ? '#60a5fa' : '#94a3b8' }}>
                          {t.numero}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                background: `${TIPO_COR[t.tipo] ?? '#6b7280'}20`,
                                color: TIPO_COR[t.tipo] ?? '#6b7280',
                                borderRadius: 6,
                                padding: '2px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {TIPO_LABEL[t.tipo] ?? t.tipo}
                            </span>
                            {t.prioridade !== 'normal' && (
                              <span
                                style={{
                                  background: badge.bg,
                                  borderRadius: 6,
                                  padding: '2px 10px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: t.prioridade === 'prioritario' ? '#fca5a5' : '#fcd34d',
                                }}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                            {t.nomeUtente && <span style={{ color: '#64748b', fontSize: 12 }}>{t.nomeUtente}</span>}
                            <span style={{ color: '#334155', fontSize: 12 }}>
                              {new Date(t.criadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={async () => {
                            const res = await fetch(`${API}/tickets/chamar`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ balcao, ticketId: t.id }),
                            });
                            await res.json();
                          }}
                          style={{
                            background: '#3b82f620',
                            border: '1px solid #3b82f6',
                            color: '#60a5fa',
                            borderRadius: 6,
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                          title="Chamar este ticket"
                        >
                          📣 Chamar
                        </button>
                        <button
                          onClick={() => desistiu(t.id)}
                          style={{
                            background: '#ef444420',
                            border: '1px solid #ef4444',
                            color: '#fca5a5',
                            borderRadius: 6,
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                          title="Marcar como desistiu"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel lateral — histórico + stats por tipo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats por tipo */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Hoje por Serviço
            </h3>
            {stats?.por_tipo.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.por_tipo
                  .sort((a, b) => b._count - a._count)
                  .map((pt) => (
                    <div key={pt.tipo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#cbd5e1', fontSize: 13 }}>{TIPO_LABEL[pt.tipo] ?? pt.tipo}</span>
                      <span
                        style={{
                          background: `${TIPO_COR[pt.tipo] ?? '#6b7280'}20`,
                          color: TIPO_COR[pt.tipo] ?? '#6b7280',
                          borderRadius: 20,
                          padding: '2px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {pt._count}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p style={{ color: '#334155', fontSize: 13 }}>Sem dados</p>
            )}
            <div style={{ borderTop: '1px solid #334155', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Total Hoje</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{totalHoje}</span>
            </div>
          </div>

          {/* Histórico de chamadas */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, flex: 1 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Histórico
            </h3>
            {ultimos.length === 0 ? (
              <p style={{ color: '#334155', fontSize: 13 }}>Sem chamadas</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ultimos.map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: i < ultimos.length - 1 ? '1px solid #0f172a' : 'none',
                      opacity: i === 0 ? 1 : 0.7,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: i === 0 ? '#60a5fa' : '#94a3b8', fontSize: 16 }}>{t.numero}</span>
                      <span style={{ color: '#475569', fontSize: 12, marginLeft: 8 }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {t.balcao && <div style={{ color: '#475569', fontSize: 12 }}>B.{t.balcao}</div>}
                      <div style={{ color: '#334155', fontSize: 11 }}>
                        {t.chamadoEm ? new Date(t.chamadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo Utente */}
      {modalNovoUtente && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) fecharModalNovoUtente(); }}
        >
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
            padding: '32px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          }}>
            {novoUtenteSucesso ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 8 }}>Registo Concluído</h2>
                <p style={{ color: '#6ee7b7', fontSize: 18, fontWeight: 700 }}>{novoUtenteSucesso.nome}</p>
                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                  Nº de processo: <strong style={{ color: '#94a3b8' }}>{novoUtenteSucesso.numeroProcesso}</strong>
                </p>
                {(() => {
                  const tv = TIPOS_VISITA.find(t => t.value === novoUtenteSucesso.tipoVisita);
                  const msgs: Record<string, string> = {
                    internamento: 'Aguarda atribuição de cama pela equipa clínica.',
                    consulta: 'Dirija-se ao balcão de consultas ou ao quiosque para tirar senha.',
                    exame: 'Dirija-se ao serviço de exames.',
                    urgencia: 'Dirija-se à urgência imediatamente.',
                    farmacia: 'Dirija-se à farmácia.',
                    outro: 'Registo concluído.',
                  };
                  return (
                    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
                      <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>
                        {tv?.icon} <strong>{tv?.label}</strong> — {msgs[novoUtenteSucesso.tipoVisita] ?? ''}
                      </p>
                    </div>
                  );
                })()}
                <button
                  onClick={fecharModalNovoUtente}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={criarUtente}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Registo Administrativo</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 13 }}>Dados legais e de identificação do utente</p>
                  </div>
                  <button type="button" onClick={fecharModalNovoUtente}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', padding: 4 }}>
                    ✕
                  </button>
                </div>

                {novoUtenteErro && (
                  <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>
                    {novoUtenteErro}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>

                  {/* Secção: Tipo de visita */}
                  <div>
                    <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 0' }}>
                      Motivo da Visita <span style={{ color: '#ef4444' }}>*</span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {TIPOS_VISITA.map(tv => (
                        <button
                          key={tv.value}
                          type="button"
                          onClick={() => { setNovoUtenteForm(f => ({ ...f, tipoVisita: tv.value })); setNovoUtenteErros(p => ({ ...p, tipoVisita: '' })); }}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 10,
                            border: novoUtenteForm.tipoVisita === tv.value ? '2px solid #3b82f6' : `1px solid ${novoUtenteErros.tipoVisita ? '#ef4444' : '#334155'}`,
                            background: novoUtenteForm.tipoVisita === tv.value ? '#1e3a5f' : '#0f172a',
                            color: novoUtenteForm.tipoVisita === tv.value ? '#60a5fa' : '#94a3b8',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontSize: 13,
                            fontWeight: novoUtenteForm.tipoVisita === tv.value ? 700 : 400,
                          }}
                        >
                          <div style={{ fontSize: 22, marginBottom: 4 }}>{tv.icon}</div>
                          <div>{tv.label}</div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{tv.desc}</div>
                        </button>
                      ))}
                    </div>
                    {novoUtenteErros.tipoVisita && <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>{novoUtenteErros.tipoVisita}</p>}
                  </div>

                  {/* Secção: Identificação */}
                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Identificação</p>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Nome Completo <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={novoUtenteForm.nome}
                      onChange={e => { setNovoUtenteForm(f => ({ ...f, nome: e.target.value })); setNovoUtenteErros(p => ({ ...p, nome: '' })); }}
                      style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.nome ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="Nome completo do utente"
                    />
                    {novoUtenteErros.nome && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.nome}</p>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Data de Nascimento <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={novoUtenteForm.dataNascimento}
                        onChange={e => { setNovoUtenteForm(f => ({ ...f, dataNascimento: e.target.value })); setNovoUtenteErros(p => ({ ...p, dataNascimento: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.dataNascimento ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      />
                      {novoUtenteErros.dataNascimento && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.dataNascimento}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        NIF <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        value={novoUtenteForm.nif}
                        onChange={e => { setNovoUtenteForm(f => ({ ...f, nif: e.target.value.replace(/\D/g, '') })); setNovoUtenteErros(p => ({ ...p, nif: '' })); }}
                        maxLength={9}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.nif ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="000000000"
                      />
                      {novoUtenteErros.nif && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.nif}</p>}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Nº SNS <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={novoUtenteForm.numeroSNS}
                      onChange={e => { setNovoUtenteForm(f => ({ ...f, numeroSNS: e.target.value.replace(/\D/g, '') })); setNovoUtenteErros(p => ({ ...p, numeroSNS: '' })); }}
                      maxLength={9}
                      style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.numeroSNS ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="000000000"
                    />
                    {novoUtenteErros.numeroSNS && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.numeroSNS}</p>}
                  </div>

                  {/* Secção: Contactos */}
                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Contactos</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Telefone <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        value={novoUtenteForm.telefone}
                        onChange={e => { setNovoUtenteForm(f => ({ ...f, telefone: e.target.value })); setNovoUtenteErros(p => ({ ...p, telefone: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.telefone ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="9XX XXX XXX"
                      />
                      {novoUtenteErros.telefone && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.telefone}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Email</label>
                      <input
                        type="email"
                        value={novoUtenteForm.email}
                        onChange={e => { setNovoUtenteForm(f => ({ ...f, email: e.target.value })); setNovoUtenteErros(p => ({ ...p, email: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.email ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="email@exemplo.pt"
                      />
                      {novoUtenteErros.email && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.email}</p>}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Morada</label>
                    <input
                      value={novoUtenteForm.morada}
                      onChange={e => setNovoUtenteForm(f => ({ ...f, morada: e.target.value }))}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                      placeholder="Rua, nº, andar"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Cód. Postal</label>
                      <input
                        value={novoUtenteForm.codigoPostal}
                        onChange={e => { setNovoUtenteForm(f => ({ ...f, codigoPostal: e.target.value })); setNovoUtenteErros(p => ({ ...p, codigoPostal: '' })); }}
                        style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.codigoPostal ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="0000-000"
                      />
                      {novoUtenteErros.codigoPostal && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.codigoPostal}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Localidade</label>
                      <input
                        value={novoUtenteForm.localidade}
                        onChange={e => setNovoUtenteForm(f => ({ ...f, localidade: e.target.value }))}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                        placeholder="Cidade"
                      />
                    </div>
                  </div>

                  {/* Secção: Cobertura */}
                  <p style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '6px 0 0 0' }}>Cobertura de Saúde</p>

                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Tipo de Cobertura
                    </label>
                    <select
                      value={novoUtenteForm.tipoCobertura}
                      onChange={e => { setNovoUtenteForm(f => ({ ...f, tipoCobertura: e.target.value, entidadeSeguradora: '', numeroApolice: '' })); setNovoUtenteErros(p => ({ ...p, entidadeSeguradora: '', numeroApolice: '' })); }}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 15, boxSizing: 'border-box' }}
                    >
                      <option value="sns">SNS</option>
                      <option value="seguro">Seguro de Saúde</option>
                      <option value="particular">Particular</option>
                    </select>
                  </div>

                  {novoUtenteForm.tipoCobertura === 'seguro' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Entidade Seguradora <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          value={novoUtenteForm.entidadeSeguradora}
                          onChange={e => { setNovoUtenteForm(f => ({ ...f, entidadeSeguradora: e.target.value })); setNovoUtenteErros(p => ({ ...p, entidadeSeguradora: '' })); }}
                          style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.entidadeSeguradora ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                          placeholder="Nome da seguradora"
                        />
                        {novoUtenteErros.entidadeSeguradora && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.entidadeSeguradora}</p>}
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Nº Apólice <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          value={novoUtenteForm.numeroApolice}
                          onChange={e => { setNovoUtenteForm(f => ({ ...f, numeroApolice: e.target.value })); setNovoUtenteErros(p => ({ ...p, numeroApolice: '' })); }}
                          style={{ width: '100%', background: '#0f172a', border: `1px solid ${novoUtenteErros.numeroApolice ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                          placeholder="Nº da apólice"
                        />
                        {novoUtenteErros.numeroApolice && <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{novoUtenteErros.numeroApolice}</p>}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button type="button" onClick={fecharModalNovoUtente}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 15, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={criandoUtente}
                      style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 15, fontWeight: 700, cursor: criandoUtente ? 'not-allowed' : 'pointer', opacity: criandoUtente ? 0.5 : 1 }}>
                      {criandoUtente ? 'A registar...' : 'Registar Administrativamente'}
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
