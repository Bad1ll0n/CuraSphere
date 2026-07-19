'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';


interface Consulta {
  id: string;
  especialidade: string;
  dataHora: string;
  duracao: number;
  estado: string;
  tipo?: string;
  videoRoomId?: string | null;
  notas?: string;
  diagnostico?: string;
  proximaConsulta?: string;
  nomeDoente?: string;
  codigo?: string;
  checkinEm?: string;
  doente?: { id: string; nome: string };
  medico: { id: string; nome: string; subRole?: string };
}

interface AgendaRegra {
  id: string;
  medicoId: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoSlot: number;
  ativo: boolean;
}

interface Slot { dataHora: string; disponivel: boolean }
interface Medico { id: string; nome: string; subRole?: string }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const ESTADO_CONFIG: Record<string, { label: string; cor: string }> = {
  agendada:  { label: 'Agendada',  cor: '#3b82f6' },
  realizada: { label: 'Realizada', cor: '#10b981' },
  faltou:    { label: 'Faltou',    cor: '#ef4444' },
  cancelada: { label: 'Cancelada', cor: '#94a3b8' },
};

type Tab = 'marcacoes' | 'agenda';

export default function ConsultasPage() {
  const { utilizador } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('marcacoes');

  // ─── Marcações state ──────────────────────────────────────────────────────
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [realizarModal, setRealizarModal] = useState<Consulta | null>(null);
  const [realizarForm, setRealizarForm] = useState({ notas: '', diagnostico: '', proximaConsulta: '' });
  const [salvando, setSalvando] = useState(false);
  const [atosDisponiveis, setAtosDisponiveis] = useState<any[]>([]);
  const [atosAdicionados, setAtosAdicionados] = useState<any[]>([]);
  const [atoSelecionado, setAtoSelecionado] = useState('');
  const [adicionandoAto, setAdicionandoAto] = useState(false);

  // ─── Nova marcação state ──────────────────────────────────────────────────
  const [modalNova, setModalNova] = useState(false);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [novaForm, setNovaForm] = useState({
    medicoId: '', especialidade: '', dataMarcacao: new Date().toISOString().split('T')[0],
    slotSelecionado: '', nomeDoente: '', doenteId: '', duracao: 20, tipo: 'presencial',
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [carregandoSlots, setCarregandoSlots] = useState(false);

  // ─── Agenda state ─────────────────────────────────────────────────────────
  const [agendaMedicoId, setAgendaMedicoId] = useState('');
  const [agendaRegras, setAgendaRegras] = useState<AgendaRegra[]>([]);
  const [modalAgenda, setModalAgenda] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ medicoId: '', diaSemana: 1, horaInicio: '09:00', horaFim: '13:00', duracaoSlot: 20 });

  const podeAgendar = ['medico', 'administrativo', 'direcao'].includes(utilizador?.role ?? '');
  const eAdmin = utilizador?.role === 'administrativo' || utilizador?.role === 'direcao';

  // ─── Carregar marcações ───────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/consultas', { params: { data: dataFiltro } });
      setConsultas(data);
    } finally { setLoading(false); }
  }, [dataFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  // ─── Carregar médicos (para selects) ──────────────────────────────────────
  useEffect(() => {
    api.get('/utilizadores', { params: { role: 'medico', limit: 200 } })
      .then(({ data }) => setMedicos(Array.isArray(data) ? data : data.data ?? []))
      .catch(() => {});
  }, []);

  // ─── Carregar slots quando médico + data mudam ────────────────────────────
  useEffect(() => {
    if (!novaForm.medicoId || !novaForm.dataMarcacao) { setSlots([]); return; }
    setCarregandoSlots(true);
    setNovaForm(f => ({ ...f, slotSelecionado: '' }));
    api.get('/consultas/slots', { params: { medicoId: novaForm.medicoId, data: novaForm.dataMarcacao } })
      .then(({ data }) => setSlots(data))
      .catch(() => setSlots([]))
      .finally(() => setCarregandoSlots(false));
  }, [novaForm.medicoId, novaForm.dataMarcacao]);

  // ─── Carregar agenda do médico seleccionado ───────────────────────────────
  useEffect(() => {
    if (!agendaMedicoId) { setAgendaRegras([]); return; }
    api.get(`/consultas/agenda/${agendaMedicoId}`)
      .then(({ data }) => setAgendaRegras(data))
      .catch(() => setAgendaRegras([]));
  }, [agendaMedicoId]);

  // ─── Agendar consulta ─────────────────────────────────────────────────────
  const agendar = async () => {
    if (!novaForm.medicoId || !novaForm.especialidade || !novaForm.slotSelecionado) return;
    setSalvando(true);
    try {
      await api.post('/consultas', {
        medicoId: novaForm.medicoId,
        especialidade: novaForm.especialidade,
        dataHora: novaForm.slotSelecionado,
        duracao: novaForm.duracao,
        nomeDoente: novaForm.nomeDoente || undefined,
        doenteId: novaForm.doenteId || undefined,
        tipo: novaForm.tipo,
      });
      setModalNova(false);
      setNovaForm({ medicoId: '', especialidade: '', dataMarcacao: new Date().toISOString().split('T')[0], slotSelecionado: '', nomeDoente: '', doenteId: '', duracao: 20, tipo: 'presencial' });
      carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao agendar');
    } finally { setSalvando(false); }
  };

  // ─── Realizar consulta ────────────────────────────────────────────────────
  const realizar = async () => {
    if (!realizarModal) return;
    setSalvando(true);
    try {
      await api.patch(`/consultas/${realizarModal.id}/realizar`, realizarForm);
      setRealizarModal(null);
      carregar();
    } finally { setSalvando(false); }
  };

  // ─── Check-in ─────────────────────────────────────────────────────────────
  const checkin = async (id: string) => {
    try {
      const { data } = await api.post(`/consultas/${id}/checkin`);
      if (data.ticket) alert(`✅ Check-in feito! Senha: ${data.ticket.numero}`);
      carregar();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro no check-in');
    }
  };

  // ─── Agenda: guardar regra ────────────────────────────────────────────────
  const guardarAgenda = async () => {
    if (!agendaForm.medicoId) return;
    setSalvando(true);
    try {
      await api.post('/consultas/agenda', agendaForm);
      setModalAgenda(false);
      // reload agenda
      const { data } = await api.get(`/consultas/agenda/${agendaForm.medicoId}`);
      setAgendaRegras(data);
      if (!agendaMedicoId) setAgendaMedicoId(agendaForm.medicoId);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao guardar agenda');
    } finally { setSalvando(false); }
  };

  const removerAgenda = async (id: string) => {
    if (!confirm('Remover esta regra de disponibilidade?')) return;
    await api.delete(`/consultas/agenda/${id}`);
    setAgendaRegras(r => r.filter(x => x.id !== id));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: 'var(--bg-page)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>Consultas Externas</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, marginTop: 4 }}>Agenda e marcações por especialidade</p>
        </div>
        {podeAgendar && tab === 'marcacoes' && (
          <button
            onClick={() => setModalNova(true)}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 18 }}>+</span> Nova Marcação
          </button>
        )}
        {eAdmin && tab === 'agenda' && (
          <button
            onClick={() => { setAgendaForm(f => ({ ...f, medicoId: agendaMedicoId })); setModalAgenda(true); }}
            style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
          >
            + Definir Disponibilidade
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 28 }}>
        {([['marcacoes', '📅 Marcações'], ['agenda', '🗓️ Agenda dos Médicos']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? '#1e293b' : '#64748b',
              fontWeight: tab === key ? 700 : 500,
              fontSize: 14, boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Marcações ─────────────────────────────────────────────────── */}
      {tab === 'marcacoes' && (
        <>
          {/* Filtro data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontSize: 14, color: 'var(--text-soft)', fontWeight: 600 }}>Dia:</label>
            <input
              type="date" value={dataFiltro}
              onChange={e => setDataFiltro(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 14px', fontSize: 14, background: 'var(--bg-card)' }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>
              {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-dim)' }}>A carregar...</div>
          ) : consultas.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center', padding: '64px 40px' }}>
              <div style={{ fontSize: 48 }}>📭</div>
              <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: 12 }}>Sem consultas para este dia</p>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4 }}>Use o botão "Nova Marcação" para agendar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...consultas].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()).map(c => {
                const cfg = ESTADO_CONFIG[c.estado] ?? ESTADO_CONFIG.agendada;
                const hora = new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={c.id} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
                      <div style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-hi)' }}>{hora}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.duracao}min</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-hi)', fontSize: 15 }}>
                          {c.doente?.nome ?? c.nomeDoente ?? 'Utente externo'}
                        </div>
                        <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 2 }}>{c.especialidade} · Dr. {c.medico?.nome}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ background: `${cfg.cor}15`, color: cfg.cor, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                            {cfg.label}
                          </span>
                          {c.codigo && (
                            <span style={{ background: '#f1f5f9', color: 'var(--text-muted)', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                              {c.codigo}
                            </span>
                          )}
                          {c.tipo === 'teleconsulta' && (
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                              📹 Teleconsulta
                            </span>
                          )}
                          {c.checkinEm && (
                            <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                              ✅ Check-in: {new Date(c.checkinEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {c.estado === 'agendada' && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {c.tipo === 'teleconsulta' && utilizador?.role === 'medico' && !c.videoRoomId && (
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/consultas/${c.id}/video/iniciar`);
                                router.push(`/teleconsulta/${c.id}`);
                              } catch (e: any) {
                                alert(e?.response?.data?.message ?? 'Erro ao iniciar vídeo');
                              }
                            }}
                            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            📹 Iniciar
                          </button>
                        )}
                        {c.tipo === 'teleconsulta' && c.videoRoomId && (
                          <button
                            onClick={() => router.push(`/teleconsulta/${c.id}`)}
                            style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            📹 Entrar
                          </button>
                        )}
                        {eAdmin && !c.checkinEm && (
                          <button
                            onClick={() => checkin(c.id)}
                            style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Check-in
                          </button>
                        )}
                        <button
                          onClick={async () => {
  setRealizarModal(c);
  setRealizarForm({ notas: c.notas ?? '', diagnostico: c.diagnostico ?? '', proximaConsulta: '' });
  setAtoSelecionado('');
  setAtosAdicionados([]);
  try {
    const [atosRes, adicionadosRes] = await Promise.all([
      api.get('/atos-clinicos'),
      api.get(`/consultas/${c.id}/atos`),
    ]);
    setAtosDisponiveis(atosRes.data);
    setAtosAdicionados(adicionadosRes.data);
  } catch {}
}}
                          style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Realizar
                        </button>
                        <button
                          onClick={() => api.patch(`/consultas/${c.id}/estado`, { estado: 'faltou' }).then(carregar)}
                          style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Faltou
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── TAB: Agenda ────────────────────────────────────────────────────── */}
      {tab === 'agenda' && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-soft)' }}>Médico:</label>
            <select
              value={agendaMedicoId}
              onChange={e => setAgendaMedicoId(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 14px', fontSize: 14, background: 'var(--bg-card)', minWidth: 280 }}
            >
              <option value="">Seleccionar médico...</option>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.subRole ? ` (${m.subRole})` : ''}</option>)}
            </select>
          </div>

          {!agendaMedicoId ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center', padding: '64px 40px', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: 48 }}>👨‍⚕️</div>
              <p style={{ marginTop: 12 }}>Seleccione um médico para ver ou editar a disponibilidade semanal</p>
            </div>
          ) : (
            <div>
              {/* Grelha semanal */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 24 }}>
                {DIAS_FULL.map((dia, idx) => {
                  const regra = agendaRegras.find(r => r.diaSemana === idx);
                  return (
                    <div
                      key={idx}
                      style={{
                        background: regra?.ativo ? '#f0fdf4' : '#fff',
                        border: `1px solid ${regra?.ativo ? '#86efac' : '#e2e8f0'}`,
                        borderRadius: 14,
                        padding: '16px 14px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{DIAS[idx]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{dia}</div>
                      {regra?.ativo ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', margin: '8px 0' }}>
                            {regra.horaInicio}–{regra.horaFim}
                          </div>
                          <div style={{ fontSize: 11, color: '#15803d', marginBottom: 10 }}>
                            Slots de {regra.duracaoSlot}min
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                            ~{Math.floor((parseInt(regra.horaFim.split(':')[0]) * 60 + parseInt(regra.horaFim.split(':')[1]) - parseInt(regra.horaInicio.split(':')[0]) * 60 - parseInt(regra.horaInicio.split(':')[1])) / regra.duracaoSlot)} consultas/dia
                          </div>
                          <button
                            onClick={() => removerAgenda(regra.id)}
                            style={{ background: 'transparent', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                          >
                            Remover
                          </button>
                        </>
                      ) : (
                        <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 12 }}>Sem agenda</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <p style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                  Use o botão <strong>"Definir Disponibilidade"</strong> para adicionar ou actualizar um dia da semana.
                  Os slots são gerados automaticamente com base no horário e duração configurados.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ Modal: Nova Marcação ══════════════════════════════════════════ */}
      {modalNova && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 560, padding: '32px', margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>Nova Marcação</h2>
              <button onClick={() => setModalNova(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
            </div>

            {/* Médico */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Médico *</label>
              <select
                value={novaForm.medicoId}
                onChange={e => setNovaForm(f => ({ ...f, medicoId: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)' }}
              >
                <option value="">Seleccionar médico...</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.subRole ? ` — ${m.subRole}` : ''}</option>)}
              </select>
            </div>

            {/* Especialidade */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Especialidade *</label>
              <input
                type="text"
                value={novaForm.especialidade}
                onChange={e => setNovaForm(f => ({ ...f, especialidade: e.target.value }))}
                placeholder="Ex: Cardiologia"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Nome do utente */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nome do Utente (opcional)</label>
              <input
                type="text"
                value={novaForm.nomeDoente}
                onChange={e => setNovaForm(f => ({ ...f, nomeDoente: e.target.value }))}
                placeholder="Para utentes sem registo no sistema"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Tipo de consulta */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tipo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['presencial', 'teleconsulta'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNovaForm(f => ({ ...f, tipo: t }))}
                    style={{
                      flex: 1, borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: novaForm.tipo === t ? (t === 'teleconsulta' ? '#3b82f6' : '#0f172a') : '#f1f5f9',
                      color: novaForm.tipo === t ? '#fff' : '#64748b',
                      border: novaForm.tipo === t ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    {t === 'presencial' ? '🏥 Presencial' : '📹 Teleconsulta'}
                  </button>
                ))}
              </div>
            </div>

            {/* Data */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Data *</label>
              <input
                type="date"
                value={novaForm.dataMarcacao}
                onChange={e => setNovaForm(f => ({ ...f, dataMarcacao: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }}
              />
            </div>

            {/* Slots disponíveis */}
            {novaForm.medicoId && novaForm.dataMarcacao && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  Horário disponível *
                </label>
                {carregandoSlots ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>A carregar slots...</div>
                ) : slots.length === 0 ? (
                  <div style={{ background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', color: '#92400e', fontSize: 13 }}>
                    Médico sem agenda definida para este dia. Configure a disponibilidade na tab "Agenda dos Médicos".
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {slots.map(s => {
                      const hora = new Date(s.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                      const selecionado = novaForm.slotSelecionado === s.dataHora;
                      return (
                        <button
                          key={s.dataHora}
                          disabled={!s.disponivel}
                          onClick={() => setNovaForm(f => ({ ...f, slotSelecionado: s.dataHora }))}
                          style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: s.disponivel ? 'pointer' : 'not-allowed',
                            background: selecionado ? '#3b82f6' : s.disponivel ? '#f1f5f9' : '#f1f5f9',
                            color: selecionado ? '#fff' : s.disponivel ? '#374151' : '#cbd5e1',
                            border: selecionado ? '2px solid #3b82f6' : s.disponivel ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                            textDecoration: !s.disponivel ? 'line-through' : 'none',
                            opacity: !s.disponivel ? 0.5 : 1,
                          }}
                        >
                          {hora}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setModalNova(false)}
                style={{ flex: 1, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: 'var(--text-soft)', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={agendar}
                disabled={salvando || !novaForm.medicoId || !novaForm.especialidade || !novaForm.slotSelecionado}
                style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', opacity: salvando || !novaForm.slotSelecionado ? 0.5 : 1 }}
              >
                {salvando ? 'A agendar...' : 'Confirmar Marcação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal: Realizar ══════════════════════════════════════════════ */}
      {realizarModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 520, padding: '32px', margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>Registar Consulta Realizada</h2>
              <button onClick={() => setRealizarModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 20 }}>
              {realizarModal.doente?.nome ?? realizarModal.nomeDoente} — {realizarModal.especialidade}
            </p>
            {[
              { label: 'Notas da Consulta', key: 'notas', rows: 3, placeholder: 'Observações...' },
              { label: 'Diagnóstico', key: 'diagnostico', rows: 2, placeholder: 'Diagnóstico registado...' },
            ].map(({ label, key, rows, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
                <textarea
                  value={(realizarForm as any)[key]}
                  onChange={e => setRealizarForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={rows}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, resize: 'none', background: 'var(--bg-page)', boxSizing: 'border-box' }}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Próxima Consulta</label>
              <input
                type="datetime-local"
                value={realizarForm.proximaConsulta}
                onChange={e => setRealizarForm(f => ({ ...f, proximaConsulta: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }}
              />
            </div>
            {/* Atos Clínicos */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Atos Clínicos</p>
              {/* Adicionar ato */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select
                  value={atoSelecionado}
                  onChange={e => setAtoSelecionado(e.target.value)}
                  style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, background: 'var(--bg-page)', color: atoSelecionado ? '#0f172a' : '#94a3b8' }}
                >
                  <option value="">Selecionar ato...</option>
                  {atosDisponiveis.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.descricao} — {a.precoBase.toFixed(2)} €</option>
                  ))}
                </select>
                <button
                  disabled={!atoSelecionado || adicionandoAto}
                  onClick={async () => {
                    if (!atoSelecionado || !realizarModal) return;
                    setAdicionandoAto(true);
                    try {
                      const res = await api.post(`/consultas/${realizarModal.id}/atos`, { atoId: atoSelecionado });
                      setAtosAdicionados(prev => [...prev, res.data]);
                      setAtoSelecionado('');
                    } finally { setAdicionandoAto(false); }
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', opacity: (!atoSelecionado || adicionandoAto) ? 0.5 : 1, whiteSpace: 'nowrap', fontSize: 13 }}
                >
                  + Adicionar
                </button>
              </div>
              {/* Lista de atos adicionados */}
              {atosAdicionados.length > 0 && (
                <div style={{ background: 'var(--bg-page)', border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                  {atosAdicionados.map((ac: any) => (
                    <div key={ac.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 13, color: '#334155' }}>{ac.ato?.descricao ?? ac.descricao}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-hi)' }}>{(ac.precoUnitario ?? 0).toFixed(2)} €</span>
                        <button
                          onClick={async () => {
                            try {
                              await api.delete(`/consultas/${realizarModal!.id}/atos/${ac.id}`);
                              setAtosAdicionados(prev => prev.filter(a => a.id !== ac.id));
                            } catch {}
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}
                        >✕</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', background: '#f1f5f9' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-hi)' }}>
                      Total: {atosAdicionados.reduce((s: number, a: any) => s + (a.precoUnitario ?? 0) * (a.quantidade ?? 1), 0).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>ℹ️ Estes atos serão adicionados automaticamente à fatura.</p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRealizarModal(null)} style={{ flex: 1, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: 'var(--text-soft)', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={realizar} disabled={salvando} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal: Definir Agenda ════════════════════════════════════════ */}
      {modalAgenda && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 440, padding: '32px', margin: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>Definir Disponibilidade</h2>
              <button onClick={() => setModalAgenda(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Médico *</label>
              <select value={agendaForm.medicoId} onChange={e => setAgendaForm(f => ({ ...f, medicoId: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)' }}>
                <option value="">Seleccionar...</option>
                {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Dia da Semana *</label>
              <select value={agendaForm.diaSemana} onChange={e => setAgendaForm(f => ({ ...f, diaSemana: Number(e.target.value) }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)' }}>
                {DIAS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Hora Início</label>
                <input type="time" value={agendaForm.horaInicio} onChange={e => setAgendaForm(f => ({ ...f, horaInicio: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Hora Fim</label>
                <input type="time" value={agendaForm.horaFim} onChange={e => setAgendaForm(f => ({ ...f, horaFim: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Duração por Slot (minutos)</label>
              <select value={agendaForm.duracaoSlot} onChange={e => setAgendaForm(f => ({ ...f, duracaoSlot: Number(e.target.value) }))}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, background: 'var(--bg-page)' }}>
                {[10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} minutos</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setModalAgenda(false)} style={{ flex: 1, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: 'var(--text-soft)', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarAgenda} disabled={salvando || !agendaForm.medicoId}
                style={{ flex: 1, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', opacity: salvando || !agendaForm.medicoId ? 0.5 : 1 }}>
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
