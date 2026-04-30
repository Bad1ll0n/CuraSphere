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
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const podeVer = utilizador?.role === 'administrativo';

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

  useEffect(() => {
    if (!podeVer || !token) return;
    carregarDados();

    function conectar() {
      const es = new EventSource(`${API}/quiosque/eventos`);
      esRef.current = es;

      es.addEventListener('ticket_chamado', (e) => {
        const payload = JSON.parse(e.data);
        setUltimoChamado(payload.ticket);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        if (Array.isArray(payload.ultimos)) setUltimos(payload.ultimos);
        triggerFlash();
      });

      es.addEventListener('novo_ticket', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        carregarDados();
      });

      es.addEventListener('ticket_concluido', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        carregarDados();
      });

      es.addEventListener('error', () => {
        es.close();
        setTimeout(conectar, 3000);
      });
    }

    conectar();
    return () => {
      esRef.current?.close();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [podeVer, token, carregarDados]);

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
    </div>
  );
}
