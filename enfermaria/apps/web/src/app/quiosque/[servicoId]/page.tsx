'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const REFRESH_MS = 30_000;

interface DadosQuiosque {
  camasTotal: number;
  camasOcupadas: number;
  camasLivres: number;
  camasLimpeza: number;
  news2Counts: { normal: number; medio: number; alto: number; critico: number };
  alertasCriticosCount: number;
}

function DonutChart({ counts }: { counts: DadosQuiosque['news2Counts'] }) {
  const total = counts.normal + counts.medio + counts.alto + counts.critico;
  if (total === 0) return <div style={{ color: '#475569', fontSize: 14, textAlign: 'center' }}>Sem dados NEWS2</div>;

  const segmentos = [
    { label: 'Normal', valor: counts.normal, cor: '#22c55e' },
    { label: 'Médio', valor: counts.medio, cor: '#f59e0b' },
    { label: 'Alto', valor: counts.alto, cor: '#f97316' },
    { label: 'Crítico', valor: counts.critico, cor: '#ef4444' },
  ];

  let acumulado = 0;
  const r = 60;
  const cx = 80;
  const cy = 80;
  const innerR = 38;

  const arcos = segmentos.map(seg => {
    const frac = seg.valor / total;
    const startAngle = acumulado * 2 * Math.PI - Math.PI / 2;
    acumulado += frac;
    const endAngle = acumulado * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(endAngle);
    const yi1 = cy + innerR * Math.sin(endAngle);
    const xi2 = cx + innerR * Math.cos(startAngle);
    const yi2 = cy + innerR * Math.sin(startAngle);

    const largeArc = frac > 0.5 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi2} ${yi2} Z`;

    return { ...seg, d, frac };
  }).filter(s => s.frac > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {arcos.map(a => (
          <path key={a.label} d={a.d} fill={a.cor} stroke="#0f172a" strokeWidth={2} />
        ))}
        <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={22} fontWeight={700}>{total}</text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center' }}>
        {segmentos.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.cor, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{s.label}: <strong style={{ color: '#fff' }}>{s.valor}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuiosqueServico() {
  const params = useParams();
  const searchParams = useSearchParams();
  const servicoId = params?.servicoId as string;
  const token = searchParams?.get('token') ?? '';

  const [dados, setDados] = useState<DadosQuiosque | null>(null);
  const [erro, setErro] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    if (!token || !servicoId) { setErro('Token ou serviço em falta'); return; }
    try {
      const r = await fetch(`${API}/v1/doentes/quiosque-dados?token=${encodeURIComponent(token)}&servicoId=${encodeURIComponent(servicoId)}`);
      if (!r.ok) { setErro('Token inválido ou expirado'); return; }
      setDados(await r.json());
      setUltimaAtualizacao(new Date());
      setErro('');
    } catch {
      setErro('Sem ligação ao servidor');
    }
  }, [token, servicoId]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, REFRESH_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const taxaOcupacao = dados ? Math.round((dados.camasOcupadas / Math.max(dados.camasTotal, 1)) * 100) : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #0a1929 100%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      padding: '32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>CuraSphere</h1>
          <p style={{ color: '#475569', fontSize: 14, margin: '4px 0 0' }}>
            Serviço: <span style={{ color: '#60a5fa', fontWeight: 600 }}>{servicoId}</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {ultimaAtualizacao && (
            <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <p style={{ color: '#334155', fontSize: 11, margin: '2px 0 0' }}>Atualização automática 30s</p>
        </div>
      </div>

      {erro ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '32px 48px', textAlign: 'center' }}>
            <p style={{ color: '#fca5a5', fontSize: 18, fontWeight: 600, margin: 0 }}>{erro}</p>
          </div>
        </div>
      ) : dados ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>

          {/* Camas Ocupadas */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 32px' }}>
            <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Ocupação</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 56, fontWeight: 800, color: taxaOcupacao >= 90 ? '#ef4444' : taxaOcupacao >= 75 ? '#f97316' : '#22c55e', lineHeight: 1 }}>{taxaOcupacao}%</span>
              <span style={{ color: '#475569', fontSize: 16 }}>{dados.camasOcupadas}/{dados.camasTotal}</span>
            </div>
            {/* barra */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${taxaOcupacao}%`, background: taxaOcupacao >= 90 ? '#ef4444' : taxaOcupacao >= 75 ? '#f97316' : '#22c55e', borderRadius: 8, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Camas Livres */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '28px 32px' }}>
            <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Camas Livres</p>
            <span style={{ fontSize: 56, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{dados.camasLivres}</span>
            {dados.camasLimpeza > 0 && (
              <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0' }}>{dados.camasLimpeza} em limpeza</p>
            )}
          </div>

          {/* Alertas Críticos */}
          <div style={{
            background: dados.alertasCriticosCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${dados.alertasCriticosCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 20, padding: '28px 32px'
          }}>
            <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Alertas Activos</p>
            <span style={{ fontSize: 56, fontWeight: 800, color: dados.alertasCriticosCount > 0 ? '#ef4444' : '#475569', lineHeight: 1 }}>
              {dados.alertasCriticosCount}
            </span>
            {dados.alertasCriticosCount > 0 && (
              <p style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600, margin: '8px 0 0' }}>Requer atenção clínica</p>
            )}
          </div>

          {/* Donut NEWS2 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 32px', gridColumn: 'span 1' }}>
            <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 20px' }}>NEWS2 — Últimas 12h</p>
            <DonutChart counts={dados.news2Counts} />
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#475569', fontSize: 16 }}>A carregar dados...</p>
        </div>
      )}
    </div>
  );
}
