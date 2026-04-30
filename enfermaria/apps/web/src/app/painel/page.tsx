'use client';

import { useEffect, useRef, useState } from 'react';

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

const PRIORIDADE_COR: Record<string, string> = {
  prioritario: '#ef4444',
  senior: '#f59e0b',
  normal: 'transparent',
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
  criadoEm: string;
  chamadoEm?: string;
}

export default function PainelPage() {
  const [ultimoChamado, setUltimoChamado] = useState<Ticket | null>(null);
  const [ultimos, setUltimos] = useState<Ticket[]>([]);
  const [fila, setFila] = useState<Ticket[]>([]);
  const [flash, setFlash] = useState(false);
  const [conectado, setConectado] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerFlash() {
    setFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 2500);
  }

  useEffect(() => {
    // Carregar estado inicial
    Promise.all([
      fetch(`${API}/quiosque/ultimos?n=8`).then((r) => r.json()),
      fetch(`${API}/quiosque/fila`).then((r) => r.json()),
    ]).then(([u, f]) => {
      if (Array.isArray(u) && u.length > 0) {
        setUltimoChamado(u[0]);
        setUltimos(u);
      }
      if (Array.isArray(f)) setFila(f);
    }).catch(() => {});

    // SSE
    function conectar() {
      const es = new EventSource(`${API}/quiosque/eventos`);
      esRef.current = es;

      es.addEventListener('open', () => setConectado(true));
      es.addEventListener('error', () => {
        setConectado(false);
        es.close();
        setTimeout(conectar, 3000);
      });

      es.addEventListener('ticket_chamado', (e) => {
        const payload = JSON.parse(e.data);
        setUltimoChamado(payload.ticket);
        if (Array.isArray(payload.ultimos)) setUltimos(payload.ultimos);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
        triggerFlash();
      });

      es.addEventListener('novo_ticket', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
      });

      es.addEventListener('ticket_concluido', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
      });

      es.addEventListener('ticket_desistiu', (e) => {
        const payload = JSON.parse(e.data);
        if (Array.isArray(payload.fila)) setFila(payload.fila);
      });
    }

    conectar();
    return () => {
      esRef.current?.close();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>CuraSphere</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Painel de Chamadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: conectado ? '#10b981' : '#ef4444',
            }}
          />
          <span style={{ color: '#64748b', fontSize: 13 }}>{conectado ? 'Ligado' : 'A reconectar...'}</span>
          <span style={{ color: '#475569', fontSize: 13, marginLeft: 16 }}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
        {/* Chamada actual — lado esquerdo */}
        <div
          style={{
            flex: '0 0 60%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            borderRight: '1px solid #1e293b',
            background: flash
              ? 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)'
              : '#0f172a',
            transition: 'background 0.3s',
          }}
        >
          {ultimoChamado ? (
            <>
              <p style={{ color: '#64748b', fontSize: 20, marginBottom: 16, letterSpacing: 2, textTransform: 'uppercase' }}>
                A chamar
              </p>

              {/* Número destaque */}
              <div
                style={{
                  fontSize: 'clamp(120px, 20vw, 200px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  color: flash ? '#60a5fa' : '#fff',
                  transition: 'color 0.3s',
                  letterSpacing: -4,
                  textShadow: flash ? '0 0 60px #3b82f680' : 'none',
                  marginBottom: 16,
                }}
              >
                {ultimoChamado.numero}
              </div>

              {/* Balcão */}
              {ultimoChamado.balcao && (
                <div
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '12px 36px',
                    fontSize: 32,
                    fontWeight: 700,
                    marginBottom: 20,
                  }}
                >
                  Balcão {ultimoChamado.balcao}
                </div>
              )}

              {/* Tipo + prioridade */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span
                  style={{
                    background: `${TIPO_COR[ultimoChamado.tipo] ?? '#6b7280'}22`,
                    border: `1px solid ${TIPO_COR[ultimoChamado.tipo] ?? '#6b7280'}`,
                    color: TIPO_COR[ultimoChamado.tipo] ?? '#6b7280',
                    borderRadius: 20,
                    padding: '6px 20px',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {TIPO_LABEL[ultimoChamado.tipo] ?? ultimoChamado.tipo}
                </span>
                {ultimoChamado.prioridade !== 'normal' && (
                  <span
                    style={{
                      background: PRIORIDADE_COR[ultimoChamado.prioridade],
                      color: '#fff',
                      borderRadius: 20,
                      padding: '6px 20px',
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {ultimoChamado.prioridade === 'prioritario' ? '🔴 Prioritário' : '🟡 Sénior'}
                  </span>
                )}
              </div>

              {ultimoChamado.nomeUtente && (
                <p style={{ color: '#94a3b8', marginTop: 16, fontSize: 18 }}>{ultimoChamado.nomeUtente}</p>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#334155' }}>
              <div style={{ fontSize: 80, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 24 }}>Aguardando chamadas...</p>
            </div>
          )}
        </div>

        {/* Painel lateral — fila + histórico */}
        <div
          style={{
            flex: '0 0 40%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Fila em espera */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ color: '#64748b', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, margin: '0 0 16px 0' }}>
              Em Espera ({fila.length})
            </h3>
            {fila.length === 0 ? (
              <p style={{ color: '#334155', fontSize: 15 }}>Fila vazia</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fila.slice(0, 12).map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      background: i === 0 ? '#1e3a5f' : '#1e293b',
                      border: `1px solid ${i === 0 ? '#3b82f6' : '#334155'}`,
                      borderRadius: 10,
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 22,
                          color: i === 0 ? '#60a5fa' : '#94a3b8',
                          minWidth: 56,
                        }}
                      >
                        {t.numero}
                      </span>
                      <div>
                        <div style={{ color: '#cbd5e1', fontSize: 13 }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</div>
                        {t.nomeUtente && <div style={{ color: '#475569', fontSize: 12 }}>{t.nomeUtente}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {t.prioridade !== 'normal' && (
                        <span style={{ fontSize: 16 }}>{t.prioridade === 'prioritario' ? '🔴' : '🟡'}</span>
                      )}
                      {i === 0 && (
                        <span style={{ color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>PRÓXIMO</span>
                      )}
                    </div>
                  </div>
                ))}
                {fila.length > 12 && (
                  <p style={{ color: '#475569', fontSize: 13, textAlign: 'center' }}>
                    +{fila.length - 12} em espera
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Histórico de chamadas */}
          <div style={{ flex: '0 0 auto', padding: '16px 24px', maxHeight: '280px', overflowY: 'auto' }}>
            <h3 style={{ color: '#64748b', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 12px 0' }}>
              Chamadas Anteriores
            </h3>
            {ultimos.slice(1, 8).length === 0 ? (
              <p style={{ color: '#334155', fontSize: 14 }}>Sem chamadas anteriores</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ultimos.slice(1, 8).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid #1e293b',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#475569', fontSize: 18, minWidth: 56 }}>{t.numero}</span>
                    <span style={{ color: '#334155', fontSize: 12 }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                    <span style={{ color: '#334155', fontSize: 12 }}>
                      {t.balcao ? `Balcão ${t.balcao}` : '—'}
                    </span>
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
