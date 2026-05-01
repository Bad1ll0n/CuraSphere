'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const TIPOS_EQUIP: Record<string, { label: string; icon: string }> = {
  cama_eletrica:   { label: 'Cama Eléctrica',    icon: '🛏️' },
  ventilador:      { label: 'Ventilador',         icon: '🌬️' },
  monitor:         { label: 'Monitor',            icon: '📺' },
  cadeira_rodas:   { label: 'Cadeira de Rodas',   icon: '♿' },
  bomba_perfusao:  { label: 'Bomba de Perfusão',  icon: '💉' },
  desfibrilhador:  { label: 'Desfibrilhador',     icon: '⚡' },
  outro:           { label: 'Outro',              icon: '🔧' },
};

const ESTADO_INFO: Record<string, { label: string; cor: string; dot: string }> = {
  operacional:    { label: 'Operacional',     cor: '#10b981', dot: '🟢' },
  em_manutencao:  { label: 'Em Manutenção',   cor: '#f59e0b', dot: '🟡' },
  avariado:       { label: 'Avariado',        cor: '#ef4444', dot: '🔴' },
  abatido:        { label: 'Abatido',         cor: '#6b7280', dot: '⚫' },
};

const PRIORIDADE_COR: Record<string, string> = {
  urgente: '#ef4444', alta: '#f59e0b', normal: '#3b82f6', baixa: '#6b7280',
};

interface Equipamento {
  id: string;
  nome: string;
  tipo: string;
  numeroSerie?: string;
  localizacao?: string;
  estado: string;
  ultimaManutencao?: string;
  proximaManutencao?: string;
  manutencoes?: Array<{ id: string; tipo: string; estado: string; prioridade: string; descricao: string }>;
}

interface Manutencao {
  id: string;
  tipo: string;
  descricao: string;
  estado: string;
  prioridade: string;
  dataReporte: string;
  dataConclusao?: string;
  observacoes?: string;
  equipamento: { id: string; nome: string; tipo: string; localizacao?: string };
  reportadoPor?: { nome: string; role: string };
  tecnico?: { nome: string; role: string };
}

const formEqVazio = { nome: '', tipo: 'monitor', numeroSerie: '', localizacao: '', proximaManutencao: '' };
const formManVazio = { tipo: 'corretiva', descricao: '', prioridade: 'normal', observacoes: '' };

export default function EquipamentosPage() {
  const { utilizador } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const role = utilizador?.role ?? '';
  const podeGerirEquip = ['operacional', 'ti'].includes(role);
  const podeVerManutencoes = ['operacional', 'ti', 'direcao', 'administrativo'].includes(role);
  const podeReportarAvaria = ['operacional', 'ti', 'enfermeiro', 'medico', 'auxiliar'].includes(role);

  const [aba, setAba] = useState<'inventario' | 'manutencoes'>('inventario');
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroManEstado, setFiltroManEstado] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal novo equipamento
  const [modalEq, setModalEq] = useState(false);
  const [formEq, setFormEq] = useState(formEqVazio);
  const [criandoEq, setCriandoEq] = useState(false);
  const [erroEq, setErroEq] = useState('');

  // Modal reportar avaria / nova manutenção
  const [modalMan, setModalMan] = useState<{ equipamentoId: string; nome: string } | null>(null);
  const [formMan, setFormMan] = useState(formManVazio);
  const [criandoMan, setCriandoMan] = useState(false);
  const [erroMan, setErroMan] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const carregarEquipamentos = useCallback(async () => {
    const q = filtroEstado ? `?estado=${filtroEstado}` : '';
    const res = await fetch(`${API}/equipamentos${q}`, { headers }).catch(() => null);
    if (res?.ok) setEquipamentos(await res.json());
  }, [filtroEstado, token]);

  const carregarManutencoes = useCallback(async () => {
    const res = await fetch(`${API}/equipamentos/manutencoes`, { headers }).catch(() => null);
    if (res?.ok) setManutencoes(await res.json());
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([carregarEquipamentos(), carregarManutencoes()]).finally(() => setLoading(false));
  }, [carregarEquipamentos, carregarManutencoes]);

  async function criarEquipamento(e: React.FormEvent) {
    e.preventDefault();
    setCriandoEq(true); setErroEq('');
    const res = await fetch(`${API}/equipamentos`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: formEq.nome, tipo: formEq.tipo, numeroSerie: formEq.numeroSerie || undefined, localizacao: formEq.localizacao || undefined, proximaManutencao: formEq.proximaManutencao || undefined }),
    });
    if (res.ok) { setModalEq(false); setFormEq(formEqVazio); carregarEquipamentos(); }
    else { const err = await res.json().catch(() => ({})); setErroEq(err.message ?? 'Erro ao criar equipamento'); }
    setCriandoEq(false);
  }

  async function reportarAvaria(e: React.FormEvent) {
    e.preventDefault();
    if (!modalMan) return;
    setCriandoMan(true); setErroMan('');
    const res = await fetch(`${API}/equipamentos/${modalMan.equipamentoId}/manutencoes`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: formMan.tipo, descricao: formMan.descricao, prioridade: formMan.prioridade, observacoes: formMan.observacoes || undefined }),
    });
    if (res.ok) { setModalMan(null); setFormMan(formManVazio); carregarEquipamentos(); carregarManutencoes(); }
    else { const err = await res.json().catch(() => ({})); setErroMan(err.message ?? 'Erro ao reportar'); }
    setCriandoMan(false);
  }

  async function atualizarManutencao(id: string, estado: string) {
    await fetch(`${API}/equipamentos/manutencoes/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    carregarEquipamentos();
    carregarManutencoes();
  }

  const manutencoesFiltradas = manutencoes.filter(m => !filtroManEstado || m.estado === filtroManEstado);

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Equipamentos</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>Inventário hospitalar e gestão de manutenções</p>
        </div>
        {podeGerirEquip && (
          <button onClick={() => setModalEq(true)}
            style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            + Novo Equipamento
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#1e293b', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[{ key: 'inventario', label: '📦 Inventário' }, { key: 'manutencoes', label: '🔧 Manutenções' }].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: aba === t.key ? '#334155' : 'transparent', color: aba === t.key ? '#fff' : '#64748b', fontSize: 14, fontWeight: aba === t.key ? 600 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>A carregar...</div>
      ) : aba === 'inventario' ? (
        <>
          {/* Filtro estado */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['', 'operacional', 'em_manutencao', 'avariado', 'abatido'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: filtroEstado === e ? '#3b82f6' : 'transparent', color: filtroEstado === e ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                {e === '' ? 'Todos' : ESTADO_INFO[e]?.dot + ' ' + (ESTADO_INFO[e]?.label ?? e)}
              </button>
            ))}
          </div>

          {equipamentos.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '48px', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
              <p>Sem equipamentos registados.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {equipamentos.map(eq => {
                const ti = TIPOS_EQUIP[eq.tipo] ?? { label: eq.tipo, icon: '🔧' };
                const es = ESTADO_INFO[eq.estado] ?? { label: eq.estado, cor: '#6b7280', dot: '⚫' };
                const manAtiva = eq.manutencoes?.[0];
                return (
                  <div key={eq.id} style={{ background: '#1e293b', border: `1px solid ${eq.estado === 'avariado' ? '#ef444440' : eq.estado === 'em_manutencao' ? '#f59e0b40' : '#334155'}`, borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{ti.icon}</span>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{eq.nome}</p>
                          <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{ti.label}{eq.localizacao ? ` · ${eq.localizacao}` : ''}</p>
                        </div>
                      </div>
                      <span style={{ background: `${es.cor}20`, color: es.cor, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {es.dot} {es.label}
                      </span>
                    </div>

                    {eq.numeroSerie && <p style={{ color: '#475569', fontSize: 11, margin: '4px 0' }}>S/N: {eq.numeroSerie}</p>}
                    {eq.proximaManutencao && (
                      <p style={{ color: '#94a3b8', fontSize: 11, margin: '4px 0' }}>
                        Próxima manutenção: {new Date(eq.proximaManutencao).toLocaleDateString('pt-PT')}
                      </p>
                    )}

                    {manAtiva && (
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: '6px 10px', marginTop: 8, fontSize: 12 }}>
                        <span style={{ color: PRIORIDADE_COR[manAtiva.prioridade] ?? '#6b7280', fontWeight: 600 }}>
                          {manAtiva.tipo === 'corretiva' ? '🔴 Corretiva' : '🟡 Preventiva'}
                        </span>
                        <span style={{ color: '#64748b', marginLeft: 6 }}>{manAtiva.descricao}</span>
                      </div>
                    )}

                    {podeReportarAvaria && eq.estado === 'operacional' && (
                      <button
                        onClick={() => { setModalMan({ equipamentoId: eq.id, nome: eq.nome }); setFormMan(formManVazio); }}
                        style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
                        Reportar Avaria
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filtro manutenções */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['', 'pendente', 'em_curso', 'concluida', 'cancelada'].map(e => (
              <button key={e} onClick={() => setFiltroManEstado(e)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: filtroManEstado === e ? '#3b82f6' : 'transparent', color: filtroManEstado === e ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                {e === '' ? 'Todas' : e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>

          {manutencoesFiltradas.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '48px', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
              <p>Sem manutenções registadas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {manutencoesFiltradas.map(m => (
                <div key={m.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${PRIORIDADE_COR[m.prioridade] ?? '#6b7280'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {m.tipo === 'corretiva' ? '🔴' : '🟡'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{m.equipamento.nome}</span>
                      <span style={{ background: `${PRIORIDADE_COR[m.prioridade] ?? '#6b7280'}20`, color: PRIORIDADE_COR[m.prioridade] ?? '#6b7280', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{m.prioridade}</span>
                      <span style={{ background: m.estado === 'concluida' ? '#10b98120' : m.estado === 'em_curso' ? '#f59e0b20' : '#3b82f620', color: m.estado === 'concluida' ? '#10b981' : m.estado === 'em_curso' ? '#f59e0b' : '#3b82f6', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                        {m.estado.replace('_', ' ')}
                      </span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{m.descricao}</p>
                    <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      {m.equipamento.localizacao && `${m.equipamento.localizacao} · `}
                      {new Date(m.dataReporte).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {m.reportadoPor && ` · ${m.reportadoPor.nome}`}
                    </p>
                  </div>

                  {podeGerirEquip && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {m.estado === 'pendente' && (
                        <button onClick={() => atualizarManutencao(m.id, 'em_curso')}
                          style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Iniciar
                        </button>
                      )}
                      {m.estado === 'em_curso' && (
                        <button onClick={() => atualizarManutencao(m.id, 'concluida')}
                          style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Concluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Novo Equipamento */}
      {modalEq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalEq(false); }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '28px', width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Novo Equipamento</h2>
              <button onClick={() => setModalEq(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {erroEq && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '8px 12px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>{erroEq}</div>}
            <form onSubmit={criarEquipamento} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Nome *</label>
                <input required value={formEq.nome} onChange={e => setFormEq(f => ({ ...f, nome: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="Ex: Ventilador UCI-01" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Tipo *</label>
                <select value={formEq.tipo} onChange={e => setFormEq(f => ({ ...f, tipo: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}>
                  {Object.entries(TIPOS_EQUIP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Localização</label>
                  <input value={formEq.localizacao} onChange={e => setFormEq(f => ({ ...f, localizacao: e.target.value }))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="Ex: UCI / Ala B" />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Nº de Série</label>
                  <input value={formEq.numeroSerie} onChange={e => setFormEq(f => ({ ...f, numeroSerie: e.target.value }))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    placeholder="SN-XXXXX" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Próxima Manutenção Preventiva</label>
                <input type="date" value={formEq.proximaManutencao} onChange={e => setFormEq(f => ({ ...f, proximaManutencao: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setModalEq(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={criandoEq || !formEq.nome.trim()}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: criandoEq || !formEq.nome.trim() ? 0.5 : 1 }}>
                  {criandoEq ? 'A criar...' : 'Criar Equipamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reportar Avaria / Manutenção */}
      {modalMan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalMan(null); }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '28px', width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Reportar Ocorrência</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{modalMan.nome}</p>
              </div>
              <button onClick={() => setModalMan(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {erroMan && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: '8px 12px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>{erroMan}</div>}
            <form onSubmit={reportarAvaria} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Tipo</label>
                  <select value={formMan.tipo} onChange={e => setFormMan(f => ({ ...f, tipo: e.target.value }))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="corretiva">🔴 Corretiva (avaria)</option>
                    <option value="preventiva">🟡 Preventiva</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Prioridade</label>
                  <select value={formMan.prioridade} onChange={e => setFormMan(f => ({ ...f, prioridade: e.target.value }))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="urgente">🚨 Urgente</option>
                    <option value="alta">⚠️ Alta</option>
                    <option value="normal">Normal</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Descrição *</label>
                <textarea required value={formMan.descricao} onChange={e => setFormMan(f => ({ ...f, descricao: e.target.value }))} rows={3}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder="Descreva o problema ou intervenção necessária..." />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Observações</label>
                <input value={formMan.observacoes} onChange={e => setFormMan(f => ({ ...f, observacoes: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="Informações adicionais (opcional)" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setModalMan(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={criandoMan || !formMan.descricao.trim()}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: criandoMan || !formMan.descricao.trim() ? 0.5 : 1 }}>
                  {criandoMan ? 'A reportar...' : 'Reportar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
