'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

const TIPOS_EQUIP: Record<string, { label: string; icon: string }> = {
  cama_eletrica:  { label: 'Cama Eléctrica',   icon: '🛏️' },
  ventilador:     { label: 'Ventilador',        icon: '🌬️' },
  monitor:        { label: 'Monitor',           icon: '📺' },
  cadeira_rodas:  { label: 'Cadeira de Rodas',  icon: '♿' },
  bomba_perfusao: { label: 'Bomba de Perfusão', icon: '💉' },
  desfibrilhador: { label: 'Desfibrilhador',   icon: '⚡' },
  outro:          { label: 'Outro',             icon: '🔧' },
};

const ESTADO_INFO: Record<string, { label: string; cor: string; dot: string }> = {
  operacional:   { label: 'Operacional',   cor: '#10b981', dot: '🟢' },
  em_manutencao: { label: 'Em Manutenção', cor: '#f59e0b', dot: '🟡' },
  avariado:      { label: 'Avariado',      cor: '#ef4444', dot: '🔴' },
  abatido:       { label: 'Abatido',       cor: '#6b7280', dot: '⚫' },
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

interface Tecnico {
  id: string;
  nome: string;
  role: string;
  subRole?: string;
}

const formEqVazio = { nome: '', tipo: 'monitor', numeroSerie: '', localizacao: '', proximaManutencao: '' };
const formManVazio = { tipo: 'corretiva', descricao: '', prioridade: 'normal', observacoes: '' };
const formEditarVazio = { nome: '', tipo: 'monitor', numeroSerie: '', localizacao: '', estado: 'operacional', proximaManutencao: '' };

function alertaBadge(eq: Equipamento) {
  if (!eq.proximaManutencao) return null;
  const agora = new Date();
  const data = new Date(eq.proximaManutencao);
  const diff = (data.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0)  return { cor: '#ef4444', label: 'Vencida' };
  if (diff <= 7) return { cor: '#f59e0b', label: `${Math.round(diff)} dias` };
  return { cor: '#eab308', label: `${Math.round(diff)} dias` };
}

export default function EquipamentosPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const role = utilizador?.role ?? '';
  const podeGerirEquip = ['operacional', 'ti'].includes(role);
  const podeVerManutencoes = ['operacional', 'ti', 'direcao', 'administrativo'].includes(role);
  const podeReportarAvaria = ['operacional', 'ti', 'enfermeiro', 'medico', 'auxiliar'].includes(role);

  const [aba, setAba] = useState<'inventario' | 'manutencoes' | 'alertas'>('inventario');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroManEstado, setFiltroManEstado] = useState('');
  const [modalEq, setModalEq] = useState(false);
  const [formEq, setFormEq] = useState(formEqVazio);
  const [modalMan, setModalMan] = useState<{ equipamentoId: string; nome: string } | null>(null);
  const [formMan, setFormMan] = useState(formManVazio);
  const [modalEditarEq, setModalEditarEq] = useState<Equipamento | null>(null);
  const [formEditarEq, setFormEditarEq] = useState(formEditarVazio);
  const [modalAtualizarMan, setModalAtualizarMan] = useState<{ id: string; novoEstado: string; equipamentoNome: string } | null>(null);
  const [tecnicoId, setTecnicoId] = useState('');

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['equipamentos'] });
    qc.invalidateQueries({ queryKey: ['manutencoes'] });
    qc.invalidateQueries({ queryKey: ['alertas-manutencao'] });
  };

  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ['equipamentos', filtroEstado],
    queryFn: () => api.get(`/equipamentos${filtroEstado ? `?estado=${filtroEstado}` : ''}`).then(r => r.data ?? []),
    staleTime: 30_000,
  });

  const { data: manutencoes = [] } = useQuery<Manutencao[]>({
    queryKey: ['manutencoes'],
    queryFn: () => api.get('/equipamentos/manutencoes').then(r => r.data ?? []),
    staleTime: 30_000,
    enabled: podeVerManutencoes,
  });

  const { data: alertasManutencao = [] } = useQuery<Equipamento[]>({
    queryKey: ['alertas-manutencao'],
    queryFn: () => api.get('/equipamentos/alertas-manutencao').then(r => r.data ?? []),
    staleTime: 60_000,
    enabled: aba === 'alertas',
  });

  const { data: tecnicos = [] } = useQuery<Tecnico[]>({
    queryKey: ['tecnicos-equip'],
    queryFn: () => api.get('/utilizadores?roles=operacional,ti').then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d?.utilizadores ?? d?.data ?? []);
    }),
    staleTime: 300_000,
    enabled: podeGerirEquip,
  });

  const mutCriarEq = useMutation({
    mutationFn: (body: typeof formEq) => api.post('/equipamentos', {
      ...body,
      numeroSerie: body.numeroSerie || undefined,
      localizacao: body.localizacao || undefined,
      proximaManutencao: body.proximaManutencao || undefined,
    }),
    onSuccess: () => { setModalEq(false); setFormEq(formEqVazio); invalidar(); },
  });

  const mutEditarEq = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof formEditarEq }) => api.patch(`/equipamentos/${id}`, {
      ...body,
      numeroSerie: body.numeroSerie || undefined,
      localizacao: body.localizacao || undefined,
      proximaManutencao: body.proximaManutencao || undefined,
    }),
    onSuccess: () => { setModalEditarEq(null); setFormEditarEq(formEditarVazio); invalidar(); },
  });

  const mutCriarMan = useMutation({
    mutationFn: (body: typeof formMan) => api.post(`/equipamentos/${modalMan!.equipamentoId}/manutencoes`, {
      ...body,
      observacoes: body.observacoes || undefined,
    }),
    onSuccess: () => { setModalMan(null); setFormMan(formManVazio); invalidar(); },
  });

  const mutAtualizarMan = useMutation({
    mutationFn: ({ id, estado, tecnicoIdVal }: { id: string; estado: string; tecnicoIdVal?: string }) =>
      api.patch(`/equipamentos/manutencoes/${id}`, { estado, tecnicoId: tecnicoIdVal || undefined }),
    onSuccess: () => { setModalAtualizarMan(null); setTecnicoId(''); invalidar(); },
  });

  const manutencoesFiltradas = (manutencoes as Manutencao[]).filter(m => !filtroManEstado || m.estado === filtroManEstado);

  const inputStyle = { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' as const };
  const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: 1 };

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#fff' }}>
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
        {[
          { key: 'inventario',  label: '📦 Inventário' },
          { key: 'manutencoes', label: '🔧 Manutenções' },
          { key: 'alertas',     label: `⚠️ Alertas${(alertasManutencao as Equipamento[]).length > 0 ? ` (${(alertasManutencao as Equipamento[]).length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setAba(t.key as any)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: aba === t.key ? '#334155' : 'transparent', color: aba === t.key ? '#fff' : '#64748b', fontSize: 14, fontWeight: aba === t.key ? 600 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && aba === 'inventario' ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>A carregar...</div>
      ) : aba === 'inventario' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['', 'operacional', 'em_manutencao', 'avariado', 'abatido'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: filtroEstado === e ? '#3b82f6' : 'transparent', color: filtroEstado === e ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                {e === '' ? 'Todos' : ESTADO_INFO[e]?.dot + ' ' + (ESTADO_INFO[e]?.label ?? e)}
              </button>
            ))}
          </div>
          {equipamentos.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 48, textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
              <p>Sem equipamentos registados.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {(equipamentos as Equipamento[]).map(eq => {
                const ti = TIPOS_EQUIP[eq.tipo] ?? { label: eq.tipo, icon: '🔧' };
                const es = ESTADO_INFO[eq.estado] ?? { label: eq.estado, cor: '#6b7280', dot: '⚫' };
                const manAtiva = eq.manutencoes?.[0];
                const alerta = alertaBadge(eq);
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
                      <span style={{ background: `${es.cor}20`, color: es.cor, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{es.dot} {es.label}</span>
                    </div>
                    {eq.numeroSerie && <p style={{ color: '#475569', fontSize: 11, margin: '4px 0' }}>S/N: {eq.numeroSerie}</p>}
                    {eq.proximaManutencao && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                        <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>Próxima manutenção: {new Date(eq.proximaManutencao).toLocaleDateString('pt-PT')}</p>
                        {alerta && <span style={{ background: `${alerta.cor}20`, color: alerta.cor, borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{alerta.label}</span>}
                      </div>
                    )}
                    {manAtiva && (
                      <div style={{ background: '#0f172a', borderRadius: 8, padding: '6px 10px', marginTop: 8, fontSize: 12 }}>
                        <span style={{ color: PRIORIDADE_COR[manAtiva.prioridade] ?? '#6b7280', fontWeight: 600 }}>{manAtiva.tipo === 'corretiva' ? '🔴 Corretiva' : '🟡 Preventiva'}</span>
                        <span style={{ color: '#64748b', marginLeft: 6 }}>{manAtiva.descricao}</span>
                      </div>
                    )}
                    {podeGerirEquip && (
                      <button onClick={() => {
                        setModalEditarEq(eq);
                        setFormEditarEq({
                          nome: eq.nome,
                          tipo: eq.tipo,
                          numeroSerie: eq.numeroSerie ?? '',
                          localizacao: eq.localizacao ?? '',
                          estado: eq.estado,
                          proximaManutencao: eq.proximaManutencao ? new Date(eq.proximaManutencao).toISOString().split('T')[0] : '',
                        });
                      }}
                        style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontSize: 12, cursor: 'pointer' }}>
                        ✏️ Editar
                      </button>
                    )}
                    {podeReportarAvaria && eq.estado === 'operacional' && (
                      <button onClick={() => { setModalMan({ equipamentoId: eq.id, nome: eq.nome }); setFormMan(formManVazio); }}
                        style={{ marginTop: podeGerirEquip ? 6 : 10, width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
                        Reportar Avaria
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : aba === 'manutencoes' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['', 'pendente', 'em_curso', 'concluida', 'cancelada'].map(e => (
              <button key={e} onClick={() => setFiltroManEstado(e)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #334155', background: filtroManEstado === e ? '#3b82f6' : 'transparent', color: filtroManEstado === e ? '#fff' : '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                {e === '' ? 'Todas' : e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
          {manutencoesFiltradas.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 48, textAlign: 'center', color: '#475569' }}>
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
                      {m.tecnico && ` · Técnico: ${m.tecnico.nome}`}
                    </p>
                  </div>
                  {podeGerirEquip && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {m.estado === 'pendente' && (
                        <button onClick={() => { setModalAtualizarMan({ id: m.id, novoEstado: 'em_curso', equipamentoNome: m.equipamento.nome }); setTecnicoId(''); }}
                          style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Iniciar</button>
                      )}
                      {m.estado === 'em_curso' && (
                        <button onClick={() => { setModalAtualizarMan({ id: m.id, novoEstado: 'concluida', equipamentoNome: m.equipamento.nome }); setTecnicoId(''); }}
                          style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Concluir</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // ── Tab Alertas de Manutenção ──────────────────────────────────────────
        <>
          <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#fbbf24' }}>
            Equipamentos com manutenção preventiva a vencer nos próximos 30 dias ou já vencida.
          </div>
          {(alertasManutencao as Equipamento[]).length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 48, textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p>Sem manutenções preventivas a vencer nos próximos 30 dias.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(alertasManutencao as Equipamento[]).map(eq => {
                const ti = TIPOS_EQUIP[eq.tipo] ?? { label: eq.tipo, icon: '🔧' };
                const alerta = alertaBadge(eq)!;
                return (
                  <div key={eq.id} style={{ background: '#1e293b', border: `1px solid ${alerta.cor}40`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${alerta.cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {ti.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{eq.nome}</span>
                        <span style={{ background: `${alerta.cor}20`, color: alerta.cor, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{alerta.label}</span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{ti.label}{eq.localizacao ? ` · ${eq.localizacao}` : ''}</p>
                      <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        Próxima manutenção: <strong style={{ color: alerta.cor }}>{new Date(eq.proximaManutencao!).toLocaleDateString('pt-PT')}</strong>
                      </p>
                    </div>
                    {podeReportarAvaria && (
                      <button onClick={() => { setModalMan({ equipamentoId: eq.id, nome: eq.nome }); setFormMan({ ...formManVazio, tipo: 'preventiva' }); setAba('inventario'); }}
                        style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        Agendar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Novo Equipamento */}
      {modalEq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Novo Equipamento</h2>
              <button onClick={() => setModalEq(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input value={formEq.nome} onChange={e => setFormEq(f => ({ ...f, nome: e.target.value }))} style={inputStyle} placeholder="Ex: Ventilador UCI-01" />
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select value={formEq.tipo} onChange={e => setFormEq(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                  {Object.entries(TIPOS_EQUIP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Localização</label>
                  <input value={formEq.localizacao} onChange={e => setFormEq(f => ({ ...f, localizacao: e.target.value }))} style={inputStyle} placeholder="Ex: UCI / Ala B" />
                </div>
                <div>
                  <label style={labelStyle}>Nº de Série</label>
                  <input value={formEq.numeroSerie} onChange={e => setFormEq(f => ({ ...f, numeroSerie: e.target.value }))} style={inputStyle} placeholder="SN-XXXXX" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Próxima Manutenção Preventiva</label>
                <input type="date" value={formEq.proximaManutencao} onChange={e => setFormEq(f => ({ ...f, proximaManutencao: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalEq(false)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => mutCriarEq.mutate(formEq)} disabled={mutCriarEq.isPending || !formEq.nome.trim()}
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: mutCriarEq.isPending || !formEq.nome.trim() ? 0.5 : 1 }}>
                  {mutCriarEq.isPending ? 'A criar...' : 'Criar Equipamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Equipamento */}
      {modalEditarEq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Editar Equipamento</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{modalEditarEq.nome}</p>
              </div>
              <button onClick={() => setModalEditarEq(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input value={formEditarEq.nome} onChange={e => setFormEditarEq(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={formEditarEq.tipo} onChange={e => setFormEditarEq(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                    {Object.entries(TIPOS_EQUIP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado</label>
                  <select value={formEditarEq.estado} onChange={e => setFormEditarEq(f => ({ ...f, estado: e.target.value }))} style={inputStyle}>
                    {Object.entries(ESTADO_INFO).map(([k, v]) => <option key={k} value={k}>{v.dot} {v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Localização</label>
                  <input value={formEditarEq.localizacao} onChange={e => setFormEditarEq(f => ({ ...f, localizacao: e.target.value }))} style={inputStyle} placeholder="Ex: UCI / Ala B" />
                </div>
                <div>
                  <label style={labelStyle}>Nº de Série</label>
                  <input value={formEditarEq.numeroSerie} onChange={e => setFormEditarEq(f => ({ ...f, numeroSerie: e.target.value }))} style={inputStyle} placeholder="SN-XXXXX" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Próxima Manutenção Preventiva</label>
                <input type="date" value={formEditarEq.proximaManutencao} onChange={e => setFormEditarEq(f => ({ ...f, proximaManutencao: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalEditarEq(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => mutEditarEq.mutate({ id: modalEditarEq.id, body: formEditarEq })} disabled={mutEditarEq.isPending || !formEditarEq.nome.trim()}
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: mutEditarEq.isPending || !formEditarEq.nome.trim() ? 0.5 : 1 }}>
                  {mutEditarEq.isPending ? 'A guardar...' : 'Guardar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atualizar Manutenção (com seleção de técnico) */}
      {modalAtualizarMan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {modalAtualizarMan.novoEstado === 'em_curso' ? '▶️ Iniciar Manutenção' : '✅ Concluir Manutenção'}
                </h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{modalAtualizarMan.equipamentoNome}</p>
              </div>
              <button onClick={() => setModalAtualizarMan(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Técnico Responsável</label>
                <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} style={inputStyle}>
                  <option value="">— Sem atribuição —</option>
                  {(tecnicos as Tecnico[]).map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.role}{t.subRole ? `/${t.subRole}` : ''})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalAtualizarMan(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
                <button
                  onClick={() => mutAtualizarMan.mutate({ id: modalAtualizarMan.id, estado: modalAtualizarMan.novoEstado, tecnicoIdVal: tecnicoId || undefined })}
                  disabled={mutAtualizarMan.isPending}
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: modalAtualizarMan.novoEstado === 'em_curso' ? '#f59e0b' : '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: mutAtualizarMan.isPending ? 0.5 : 1 }}>
                  {mutAtualizarMan.isPending ? 'A actualizar...' : (modalAtualizarMan.novoEstado === 'em_curso' ? 'Iniciar' : 'Concluir')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reportar Avaria */}
      {modalMan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Reportar Ocorrência</h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{modalMan.nome}</p>
              </div>
              <button onClick={() => setModalMan(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={formMan.tipo} onChange={e => setFormMan(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                    <option value="corretiva">🔴 Corretiva</option>
                    <option value="preventiva">🟡 Preventiva</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select value={formMan.prioridade} onChange={e => setFormMan(f => ({ ...f, prioridade: e.target.value }))} style={inputStyle}>
                    <option value="urgente">🚨 Urgente</option>
                    <option value="alta">⚠️ Alta</option>
                    <option value="normal">Normal</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Descrição *</label>
                <textarea value={formMan.descricao} onChange={e => setFormMan(f => ({ ...f, descricao: e.target.value }))} rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Descreva o problema ou intervenção..." />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <input value={formMan.observacoes} onChange={e => setFormMan(f => ({ ...f, observacoes: e.target.value }))} style={inputStyle}
                  placeholder="Informações adicionais (opcional)" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalMan(null)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => mutCriarMan.mutate(formMan)} disabled={mutCriarMan.isPending || !formMan.descricao.trim()}
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: mutCriarMan.isPending || !formMan.descricao.trim() ? 0.5 : 1 }}>
                  {mutCriarMan.isPending ? 'A reportar...' : 'Reportar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
