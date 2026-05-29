'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import type { EstadoDoente, Turno as SharedTurno } from '@org/shared';

interface Turno extends SharedTurno {
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
const ESTADO_TAREFA: Record<string, { label: string; bg: string; text: string }> = {
  pendente:    { label: 'Pendente',    bg: '#fef2f2', text: '#991b1b' },
  em_progresso: { label: 'Em progresso', bg: '#fffbeb', text: '#92400e' },
  concluida:   { label: 'Concluída',   bg: '#f0fdf4', text: '#166534' },
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

function gerarTextoResumo(turno: Turno | null, dados: DadosDoente[]): string {
  const agora = new Date().toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
  const tipoLabel = turno ? (TIPO_LABEL[turno.tipo] ?? turno.tipo) : '';
  let texto = `PASSAGEM DE TURNO — ${agora}\nTurno: ${tipoLabel}\n`;
  if (turno?.chefeTurno) texto += `Chefe: ${turno.chefeTurno.nome}\n`;
  texto += `\n${'─'.repeat(40)}\n`;

  for (const { doente, tarefasPendentes, notasAnteriores, medicacoesAtivas } of dados) {
    const cama = doente.cama ? `Cama ${doente.cama.numero} (${doente.cama.quarto})` : '';
    texto += `\nDOENTE: ${doente.nome}${cama ? ' — ' + cama : ''}\n`;
    if (doente.diagnosticoPrincipal) texto += `  Diagnóstico: ${doente.diagnosticoPrincipal}\n`;
    if (tarefasPendentes.length > 0) {
      texto += `  Tarefas pendentes (${tarefasPendentes.length}):\n`;
      for (const t of tarefasPendentes) {
        const estado = t.estado === 'em_progresso' ? 'em progresso' : t.estado;
        texto += `    • ${t.titulo} [${estado}]\n`;
      }
    } else {
      texto += `  Tarefas: nenhuma pendente\n`;
    }
    if (medicacoesAtivas.length > 0) {
      texto += `  Medicações activas (${medicacoesAtivas.length}):\n`;
      for (const m of medicacoesAtivas) {
        texto += `    • ${m.nome} ${m.dose} ${m.via} — ${m.frequencia}\n`;
      }
    }
    if (notasAnteriores.length > 0) {
      texto += `  Notas:\n`;
      for (const n of notasAnteriores.slice(0, 3)) {
        const hora = horaFmt(n.criadaEm);
        texto += `    [${hora}] ${n.autor.nome}: ${n.texto}\n`;
      }
    }
  }

  return texto;
}

export default function PassagemTurnoPage() {
  const toast = useToast();
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
  const [modalFechar, setModalFechar] = useState(false);
  const [copiado, setCopiado] = useState(false);

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
      toast.success('Check-in realizado');
      setFezCheckin(true);
      await carregar();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Erro ao fazer check-in';
      if (msg.includes('já realizado')) { setFezCheckin(true); await carregar(); }
      else { setErroCheckin(msg); toast.error(msg); }
    } finally {
      setCheckinLoading(false);
    }
  }

  async function confirmarPassagem() {
    setConfirmarLoading(true);
    try {
      await api.post('/turnos/confirmar-passagem');
      setConfirmou(true);
      toast.success('Passagem de turno confirmada');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao confirmar passagem');
    } finally { setConfirmarLoading(false); }
  }

  async function adicionarNota(doenteId: string, turnoId: string) {
    if (!textoNota.trim()) return;
    setSalvandoNota(true);
    try {
      await api.post('/turnos/nota', { turnoId, doenteId, texto: textoNota.trim() });
      toast.success('Nota adicionada');
      setNotaAberta(null);
      setTextoNota('');
      await carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar nota');
    } finally { setSalvandoNota(false); }
  }

  function copiarResumo() {
    const texto = gerarTextoResumo(turno, dados);
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  // Alertas clínicos: doentes em estado critico ou grave
  const alertasClinicos = dados.filter(d => d.doente.estado === 'critico' || d.doente.estado === 'grave');

  // KPIs calculados a partir dos dados existentes
  const totalDoentes = dados.length;
  const totalTarefasPendentes = dados.reduce((s, d) => s + d.tarefasPendentes.filter(t => t.estado !== 'concluida').length, 0);
  const totalMedicacoes = dados.reduce((s, d) => s + d.medicacoesAtivas.length, 0);
  const doentesComNotas = dados.filter(d => d.notasAnteriores.length > 0).length;

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
    <div style={{ padding: '32px 40px', maxWidth: 920, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: tipoCores.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={20} height={20} fill="none" stroke={tipoCores.text} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Passagem de Turno</h1>
          </div>

          {dados.length > 0 && (
            <button
              onClick={() => setModalFechar(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', color: 'var(--text-main)', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Fechar Turno
            </button>
          )}
        </div>

        {turno && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 52, marginTop: 6 }}>
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
        )}

        {!turno && (
          <p style={{ fontSize: 13, color: '#64748b', marginLeft: 52, marginTop: 6 }}>Sem turno ativo neste momento</p>
        )}
      </div>

      {/* Alertas clínicos activos */}
      {alertasClinicos.length > 0 && (
        <div style={{ borderRadius: 14, border: '1px solid #fca5a5', background: '#fef2f2', padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 10 }}>
            ⚠ {alertasClinicos.length} doente{alertasClinicos.length > 1 ? 's' : ''} em estado crítico ou grave
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertasClinicos.map(({ doente }) => (
              <div key={doente.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: doente.estado === 'critico' ? '#dc2626' : '#f97316', color: '#fff' }}>
                  {ESTADO_COR[doente.estado].label}
                </span>
                <span style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 600 }}>{doente.nome}</span>
                {doente.cama && <span style={{ fontSize: 12, color: '#b91c1c' }}>Cama {doente.cama.numero}</span>}
                {doente.diagnosticoPrincipal && <span style={{ fontSize: 12, color: '#b91c1c' }}>· {doente.diagnosticoPrincipal}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards — só mostrar quando há doentes */}
      {dados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Doentes', valor: totalDoentes, cor: '#3b82f6', bg: '#eff6ff', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { label: 'Tarefas pendentes', valor: totalTarefasPendentes, cor: totalTarefasPendentes > 0 ? '#f97316' : '#16a34a', bg: totalTarefasPendentes > 0 ? '#fff7ed' : '#f0fdf4', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
            { label: 'Medicações activas', valor: totalMedicacoes, cor: '#7c3aed', bg: '#f5f3ff', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
            { label: 'Com notas', valor: doentesComNotas, cor: '#0891b2', bg: '#ecfeff', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          ].map((k) => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.cor}20`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${k.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={16} height={16} fill="none" stroke={k.cor} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={k.icon} />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: k.cor, margin: 0, lineHeight: 1 }}>{k.valor}</p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0, marginTop: 2 }}>{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {erroGeral && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#dc2626' }}>
          {erroGeral}
        </div>
      )}

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

          {/* Confirmação */}
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
              const pendentesCount = tarefasPendentes.filter(t => t.estado !== 'concluida').length;

              return (
                <div key={doente.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>

                  {/* Header */}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {pendentesCount > 0 && (
                        <span style={{ fontSize: 11, background: '#fef2f2', color: '#991b1b', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                          {pendentesCount} tarefa{pendentesCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {medicacoesAtivas.length > 0 && (
                        <span style={{ fontSize: 11, background: '#ede9fe', color: '#5b21b6', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                          {medicacoesAtivas.length} med.
                        </span>
                      )}
                      {notasAnteriores.length > 0 && (
                        <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                          {notasAnteriores.length} nota{notasAnteriores.length > 1 ? 's' : ''}
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

                      {/* Tarefas pendentes */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                          Tarefas
                        </p>
                        {tarefasPendentes.length === 0 ? (
                          <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sem tarefas pendentes.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {tarefasPendentes.map(t => {
                              const cfg = ESTADO_TAREFA[t.estado] ?? ESTADO_TAREFA['pendente'];
                              return (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORIDADE_COR[t.prioridade ?? 'normal'] ?? '#94a3b8', flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, color: '#334155', flex: 1 }}>{t.titulo}</span>
                                  <span style={{ fontSize: 11, background: cfg.bg, color: cfg.text, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                                    {cfg.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

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

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Fechar Turno */}
      {modalFechar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalFechar(false)}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: '0 16px' }}>

            {/* Header modal */}
            <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Resumo do Turno</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginTop: 4 }}>{totalDoentes} doentes · {totalTarefasPendentes} tarefas pendentes · {totalMedicacoes} medicações</p>
              </div>
              <button onClick={() => setModalFechar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Lista compacta */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
              {dados.map(({ doente, tarefasPendentes, notasAnteriores, medicacoesAtivas }) => {
                const pendentes = tarefasPendentes.filter(t => t.estado !== 'concluida');
                const estadoCfg = ESTADO_COR[doente.estado] ?? ESTADO_COR['estavel'];
                return (
                  <div key={doente.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{doente.nome}</span>
                      {doente.cama && <span style={{ fontSize: 12, color: '#64748b' }}>— Cama {doente.cama.numero}</span>}
                      <span style={{ fontSize: 11, background: estadoCfg.bg, color: estadoCfg.text, borderRadius: 20, padding: '1px 8px', fontWeight: 600, marginLeft: 'auto' }}>{estadoCfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                      {pendentes.length > 0 ? (
                        <span style={{ color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '2px 8px' }}>
                          {pendentes.length} tarefa{pendentes.length > 1 ? 's' : ''} pendente{pendentes.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', background: '#f0fdf4', borderRadius: 6, padding: '2px 8px' }}>Sem pendentes</span>
                      )}
                      {medicacoesAtivas.length > 0 && (
                        <span style={{ color: '#7c3aed', background: '#f5f3ff', borderRadius: 6, padding: '2px 8px' }}>
                          {medicacoesAtivas.length} medicação{medicacoesAtivas.length > 1 ? 'ões' : ''}
                        </span>
                      )}
                      {notasAnteriores.length > 0 && (
                        <span style={{ color: '#0369a1', background: '#e0f2fe', borderRadius: 6, padding: '2px 8px' }}>
                          {notasAnteriores.length} nota{notasAnteriores.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
              <button
                onClick={copiarResumo}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: copiado ? '#f0fdf4' : '#f8fafc', border: `1px solid ${copiado ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 10, padding: '10px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: copiado ? '#16a34a' : '#334155', transition: 'all 0.2s' }}
              >
                <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {copiado
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  }
                </svg>
                {copiado ? 'Copiado!' : 'Copiar Resumo'}
              </button>
              <button
                onClick={() => setModalFechar(false)}
                style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-main)', border: 'none', borderRadius: 10, padding: '10px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Fechar Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
