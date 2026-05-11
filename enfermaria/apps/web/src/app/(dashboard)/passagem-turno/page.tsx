'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';

type EstadoDoente = 'estavel' | 'grave' | 'critico' | 'alta_prevista';

interface Turno {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  chefeTurno?: { nome: string };
  horariosEntrada?: { utilizadorId: string; passagemTurnoVista: boolean }[];
}

interface Nota {
  id: string;
  texto: string;
  criadaEm: string;
  autor: { nome: string; role: string };
}

interface Tarefa {
  id: string;
  titulo: string;
  estado: string;
  prioridade?: string;
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
}

interface DadosDoente {
  doente: {
    id: string;
    nome: string;
    estado: EstadoDoente;
    diagnosticoPrincipal?: string;
    cama?: { numero: string; quarto: string };
    notasTurno: Nota[];
    tarefas: Tarefa[];
    medicacoes: Medicacao[];
  };
  tarefasPendentes: Tarefa[];
  notasAnteriores: Nota[];
  medicacoesAtivas: Medicacao[];
}

const TIPO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const TIPO_COR: Record<string, { bg: string; text: string; dot: string }> = {
  manha: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  tarde: { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  noite: { bg: '#eef2ff', text: '#3730a3', dot: '#6366f1' },
};
const ESTADO_COR: Record<EstadoDoente, { bg: string; text: string; label: string }> = {
  estavel:       { bg: '#f0fdf4', text: '#166534', label: 'Estável' },
  grave:         { bg: '#fff7ed', text: '#9a3412', label: 'Grave' },
  critico:       { bg: '#fef2f2', text: '#991b1b', label: 'Crítico' },
  alta_prevista: { bg: '#eff6ff', text: '#1e40af', label: 'Alta Prevista' },
};
const PRIORIDADE_COR: Record<string, string> = {
  urgente: '#dc2626', alta: '#f97316', normal: '#64748b', baixa: '#94a3b8',
};

function horaFmt(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function SpinnerInline() {
  return (
    <svg className="animate-spin w-4 h-4 inline" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function PassagemTurnoPage() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [dados, setDados] = useState<DadosDoente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroGeral, setErroGeral] = useState('');

  const [fezCheckin, setFezCheckin] = useState(false);
  const [confirmou, setConfirmou] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [confirmarLoading, setConfirmarLoading] = useState(false);
  const [erroCheckin, setErroCheckin] = useState('');

  const [notaAberta, setNotaAberta] = useState<string | null>(null);
  const [textoNota, setTextoNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErroGeral('');
    try {
      const turnoRes = await api.get('/turnos/ativo');
      const turnoAtivo: Turno | null = turnoRes.data;
      setTurno(turnoAtivo);

      if (!turnoAtivo) { setLoading(false); return; }

      const passagemRes = await api.get('/turnos/passagem-turno');
      setDados(passagemRes.data ?? []);

      // Expandir todos por defeito
      const exp: Record<string, boolean> = {};
      (passagemRes.data ?? []).forEach((d: DadosDoente) => { exp[d.doente.id] = true; });
      setExpandido(exp);
    } catch (e: any) {
      if (e.response?.status !== 400) setErroGeral('Erro ao carregar dados do turno.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function fazerCheckin() {
    setCheckinLoading(true);
    setErroCheckin('');
    try {
      await api.post('/turnos/check-in');
      setFezCheckin(true);
      await carregar();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Erro ao fazer check-in';
      if (msg.includes('já realizado')) { setFezCheckin(true); await carregar(); }
      else setErroCheckin(msg);
    } finally {
      setCheckinLoading(false);
    }
  }

  async function confirmarPassagem() {
    setConfirmarLoading(true);
    try {
      await api.post('/turnos/confirmar-passagem');
      setConfirmou(true);
    } catch { }
    finally { setConfirmarLoading(false); }
  }

  async function adicionarNota(doenteId: string, turnoId: string) {
    if (!textoNota.trim()) return;
    setSalvandoNota(true);
    try {
      await api.post('/turnos/nota', { turnoId, doenteId, texto: textoNota.trim() });
      setNotaAberta(null);
      setTextoNota('');
      await carregar();
    } catch { }
    finally { setSalvandoNota(false); }
  }

  if (loading) return (
    <div style={{ padding: '40px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', paddingTop: 60 }}>
        <SpinnerInline />
        <span style={{ fontSize: 14 }}>A carregar passagem de turno...</span>
      </div>
    </div>
  );

  const tipoCores = turno ? (TIPO_COR[turno.tipo] ?? TIPO_COR['manha']) : TIPO_COR['manha'];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: tipoCores.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={20} height={20} fill="none" stroke={tipoCores.text} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Passagem de Turno</h1>
        </div>

        {turno ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 52 }}>
            <span style={{ fontSize: 13, background: tipoCores.bg, color: tipoCores.text, borderRadius: 20, padding: '3px 12px', fontWeight: 600 }}>
              {TIPO_LABEL[turno.tipo] ?? turno.tipo}
            </span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {horaFmt(turno.dataInicio)} – {horaFmt(turno.dataFim)}
            </span>
            {turno.chefeTurno && (
              <span style={{ fontSize: 13, color: '#94a3b8' }}>· Chefe: {turno.chefeTurno.nome}</span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', marginLeft: 52 }}>Sem turno ativo neste momento</p>
        )}
      </div>

      {erroGeral && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#dc2626' }}>
          {erroGeral}
        </div>
      )}

      {/* Sem turno */}
      {!turno && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width={22} height={22} fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>Sem turno ativo</p>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Não existe nenhum turno em curso de momento.</p>
        </div>
      )}

      {turno && (
        <>
          {/* Check-in */}
          {!fezCheckin && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>Fazer Check-in no Turno</p>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Regista a tua entrada e recebe a passagem de turno dos doentes atribuídos.
                  </p>
                </div>
                <button
                  onClick={fazerCheckin}
                  disabled={checkinLoading}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: checkinLoading ? 0.7 : 1 }}
                >
                  {checkinLoading && <SpinnerInline />}
                  {checkinLoading ? 'A registar...' : 'Fazer Check-in'}
                </button>
              </div>
              {erroCheckin && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#dc2626' }}>
                  {erroCheckin}
                </div>
              )}
            </div>
          )}

          {/* Confirmação de passagem */}
          {fezCheckin && !confirmou && dados.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: '#166534', fontWeight: 500, margin: 0 }}>
                Revê os doentes abaixo e confirma que tomaste conhecimento da passagem de turno.
              </p>
              <button
                onClick={confirmarPassagem}
                disabled={confirmarLoading}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                {confirmarLoading && <SpinnerInline />}
                Confirmar Passagem
              </button>
            </div>
          )}

          {confirmou && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width={18} height={18} fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: 14, color: '#166534', fontWeight: 600, margin: 0 }}>Passagem de turno confirmada.</p>
            </div>
          )}

          {/* Sem doentes atribuídos */}
          {dados.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width={22} height={22} fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>Sem doentes atribuídos</p>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Não tens doentes atribuídos neste turno.</p>
            </div>
          )}

          {/* Lista de doentes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dados.map(({ doente, notasAnteriores, tarefasPendentes, medicacoesAtivas }) => {
              const estadoCfg = ESTADO_COR[doente.estado] ?? ESTADO_COR['estavel'];
              const aberto = expandido[doente.id] ?? true;

              return (
                <div key={doente.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>

                  {/* Header do doente */}
                  <div
                    onClick={() => setExpandido(e => ({ ...e, [doente.id]: !e[doente.id] }))}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', cursor: 'pointer', background: aberto ? '#fafafa' : '#fff', borderBottom: aberto ? '1px solid #f1f5f9' : 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: estadoCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width={18} height={18} fill="none" stroke={estadoCfg.text} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{doente.nome}</span>
                          <span style={{ fontSize: 12, background: estadoCfg.bg, color: estadoCfg.text, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                            {estadoCfg.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                          {doente.cama && (
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Cama {doente.cama.numero} · {doente.cama.quarto}
                            </span>
                          )}
                          {doente.diagnosticoPrincipal && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{doente.diagnosticoPrincipal}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {tarefasPendentes.length > 0 && (
                        <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                          {tarefasPendentes.length} tarefa{tarefasPendentes.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {medicacoesAtivas.length > 0 && (
                        <span style={{ fontSize: 12, background: '#ede9fe', color: '#5b21b6', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                          {medicacoesAtivas.length} med.
                        </span>
                      )}
                      <svg width={16} height={16} fill="none" stroke="#94a3b8" viewBox="0 0 24 24"
                        style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {aberto && (
                    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                      {/* Notas do turno anterior */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                          Notas do Turno Anterior
                        </p>
                        {notasAnteriores.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sem notas do turno anterior.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {notasAnteriores.map(nota => (
                              <div key={nota.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #cbd5e1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{nota.autor.nome}</span>
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                    {new Date(nota.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>{nota.texto}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Adicionar nota */}
                        {notaAberta === doente.id ? (
                          <div style={{ marginTop: 10 }}>
                            <textarea
                              value={textoNota}
                              onChange={e => setTextoNota(e.target.value)}
                              placeholder="Escreve uma nota para o próximo turno..."
                              rows={3}
                              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button onClick={() => { setNotaAberta(null); setTextoNota(''); }}
                                style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                                Cancelar
                              </button>
                              <button onClick={() => adicionarNota(doente.id, turno.id)}
                                disabled={salvandoNota || !textoNota.trim()}
                                style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: salvandoNota || !textoNota.trim() ? 0.6 : 1 }}>
                                {salvandoNota && <SpinnerInline />}
                                Guardar Nota
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setNotaAberta(doente.id); setTextoNota(''); }}
                            style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Adicionar nota
                          </button>
                        )}
                      </div>

                      {/* Tarefas pendentes */}
                      {tarefasPendentes.length > 0 && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                            Tarefas Pendentes
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {tarefasPendentes.map(t => (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORIDADE_COR[t.prioridade ?? 'normal'] ?? '#94a3b8', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: '#334155', flex: 1 }}>{t.titulo}</span>
                                <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                                  {t.estado === 'em_progresso' ? 'Em progresso' : 'Pendente'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Medicações ativas */}
                      {medicacoesAtivas.length > 0 && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                            Medicações Ativas
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {medicacoesAtivas.map(m => (
                              <div key={m.id} style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
                                <span style={{ fontWeight: 600, color: '#5b21b6' }}>{m.nome}</span>
                                <span style={{ color: '#7c3aed', marginLeft: 6 }}>{m.dose} · {m.via} · {m.frequencia}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
