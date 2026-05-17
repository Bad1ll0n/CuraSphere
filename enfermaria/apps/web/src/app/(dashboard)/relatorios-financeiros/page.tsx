'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

type Episodio = {
  id: string;
  criadoEm: string;
  estado: string;
  totalBase: number;
  totalCobrado: number;
  notas?: string;
  doente?: { nome: string; numeroProcesso: string };
  criadoPor?: { nome: string };
  itens: { descricao: string; categoria: string; quantidade: number; precoUnitario: number; total: number }[];
};

type Stats = {
  totalFaturado: number;
  totalPago: number;
  totalPendente: number;
  totalAnulado: number;
  countPorEstado: Record<string, number>;
};

const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  emitida: 'Emitida',
  paga: 'Paga',
  anulada: 'Anulada',
};

const ESTADO_COLOR: Record<string, string> = {
  pendente: '#f59e0b',
  emitida: '#3b82f6',
  paga: '#10b981',
  anulada: '#ef4444',
};

function fmt(n: number) {
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function exportCSV(episodios: Episodio[]) {
  const rows = [
    ['ID', 'Data', 'Doente', 'Nº Processo', 'Estado', 'Total Base', 'Total Cobrado', 'Notas', 'Criado Por'].join(';'),
    ...episodios.map((ep) =>
      [
        ep.id,
        new Date(ep.criadoEm).toLocaleDateString('pt-PT'),
        ep.doente?.nome ?? '',
        ep.doente?.numeroProcesso ?? '',
        ESTADO_LABEL[ep.estado] ?? ep.estado,
        ep.totalBase.toFixed(2).replace('.', ','),
        ep.totalCobrado.toFixed(2).replace('.', ','),
        ep.notas ?? '',
        ep.criadoPor?.nome ?? '',
      ].join(';'),
    ),
  ].join('\n');

  const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosFinanceirosPage() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [inicio, setInicio] = useState(inicioMes);
  const [fim, setFim] = useState(hoje);
  const [stats, setStats] = useState<Stats | null>(null);
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (inicio) params.append('inicio', inicio);
      if (fim) params.append('fim', fim);
      const res = await api.get(`/faturacao/resumo?${params}`);
      setStats(res.data.stats);
      setEpisodios(res.data.episodios);
    } catch {
      setErro('Erro ao carregar relatório.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = filtroEstado ? episodios.filter((e) => e.estado === filtroEstado) : episodios;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Relatórios Financeiros</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: 14 }}>
            Resumo de faturação por período
          </p>
        </div>
        <button
          onClick={() => exportCSV(filtrados)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#10b981', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{
        background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 24,
        display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #64748b)' }}>
            Data início
          </label>
          <input
            type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
            style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '7px 12px', fontSize: 14, background: 'var(--input-bg, #fff)', color: 'inherit' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #64748b)' }}>
            Data fim
          </label>
          <input
            type="date" value={fim} onChange={(e) => setFim(e.target.value)}
            style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '7px 12px', fontSize: 14, background: 'var(--input-bg, #fff)', color: 'inherit' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary, #64748b)' }}>
            Estado
          </label>
          <select
            value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: '7px 12px', fontSize: 14, background: 'var(--input-bg, #fff)', color: 'inherit' }}
          >
            <option value="">Todos</option>
            {['pendente', 'emitida', 'paga', 'anulada'].map((e) => (
              <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          style={{
            background: 'var(--primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          {loading ? 'A carregar...' : 'Aplicar'}
        </button>
      </div>

      {erro && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14 }}>
          {erro}
        </div>
      )}

      {/* Estatísticas */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Faturado', value: stats.totalFaturado, color: '#3b82f6' },
            { label: 'Total Pago', value: stats.totalPago, color: '#10b981' },
            { label: 'Pendente / Emitido', value: stats.totalPendente, color: '#f59e0b' },
            { label: 'Anulado', value: stats.totalAnulado, color: '#ef4444' },
          ].map((card) => (
            <div key={card.label} style={{
              background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 12, padding: '16px 20px', borderTop: `3px solid ${card.color}`,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', fontWeight: 600, marginBottom: 6 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{fmt(card.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Estado breakdown chips */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {Object.entries(stats.countPorEstado).map(([estado, count]) => (
            <span key={estado} style={{
              background: ESTADO_COLOR[estado] + '22', color: ESTADO_COLOR[estado],
              border: `1px solid ${ESTADO_COLOR[estado]}44`, borderRadius: 20,
              padding: '3px 12px', fontSize: 13, fontWeight: 600,
            }}>
              {ESTADO_LABEL[estado] ?? estado}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div style={{
        background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            Episódios ({filtrados.length})
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--table-head, #f8fafc)' }}>
                <th style={{ padding: '10px 16px 10px 28px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap' }}>Data</th>
                {['Doente', 'Nº Processo', 'Estado', 'Total Base', 'Total Cobrado', 'Origem'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                    {loading ? 'A carregar...' : 'Nenhum episódio encontrado.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((ep) => (
                  <tr key={ep.id} style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                    <td style={{ padding: '10px 16px 10px 28px', whiteSpace: 'nowrap' }}>
                      {new Date(ep.criadoEm).toLocaleDateString('pt-PT')}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {ep.doente?.nome ?? <span style={{ color: 'var(--text-secondary, #64748b)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary, #64748b)' }}>
                      {ep.doente?.numeroProcesso ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        background: (ESTADO_COLOR[ep.estado] ?? '#94a3b8') + '22',
                        color: ESTADO_COLOR[ep.estado] ?? '#94a3b8',
                        border: `1px solid ${(ESTADO_COLOR[ep.estado] ?? '#94a3b8')}44`,
                        borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        {ESTADO_LABEL[ep.estado] ?? ep.estado}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(ep.totalBase)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmt(ep.totalCobrado)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                      {ep.notas
                        ? ep.notas.startsWith('cirurgia:') ? 'Cirurgia'
                          : ep.notas.startsWith('exame:') ? 'Exame'
                          : ep.notas
                        : 'Manual'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totais rodapé */}
        {filtrados.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--border, #e2e8f0)', padding: '12px 16px',
            display: 'flex', justifyContent: 'flex-end', gap: 32, fontSize: 14,
          }}>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>
              Total base: <strong>{fmt(filtrados.reduce((s, e) => s + e.totalBase, 0))}</strong>
            </span>
            <span>
              Total cobrado: <strong style={{ color: '#3b82f6' }}>{fmt(filtrados.reduce((s, e) => s + e.totalCobrado, 0))}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
