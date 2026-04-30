'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const SERVICOS = [
  { tipo: 'admissao', letra: 'A', label: 'Admissão', icon: '🏥', cor: '#3b82f6' },
  { tipo: 'consulta', letra: 'C', label: 'Consulta', icon: '👨‍⚕️', cor: '#8b5cf6' },
  { tipo: 'faturacao', letra: 'F', label: 'Faturação', icon: '💳', cor: '#f59e0b' },
  { tipo: 'farmacia', letra: 'R', label: 'Farmácia', icon: '💊', cor: '#10b981' },
  { tipo: 'exames', letra: 'E', label: 'Exames', icon: '🔬', cor: '#06b6d4' },
  { tipo: 'urgencia', letra: 'U', label: 'Urgência', icon: '🚨', cor: '#ef4444' },
  { tipo: 'geral', letra: 'G', label: 'Informações', icon: 'ℹ️', cor: '#6b7280' },
];

type Estado = 'selecionar' | 'opcoes' | 'sucesso' | 'marcacao' | 'marcacao_confirm' | 'marcacao_sucesso' | 'nif' | 'nif_resultado' | 'nif_marcacoes';

export default function QuiosquePage() {
  const [estado, setEstado] = useState<Estado>('selecionar');
  const [tipoSelecionado, setTipoSelecionado] = useState<(typeof SERVICOS)[0] | null>(null);
  const [prioritario, setPrioritario] = useState(false);
  const [senior, setSenior] = useState(false);
  const [nome, setNome] = useState('');
  const [emissao, setEmissao] = useState(false);
  const [ticket, setTicket] = useState<{ numero: string; tipo: string; prioridade: string } | null>(null);

  // NIF
  const [nifInput, setNifInput] = useState('');
  const [nifErro, setNifErro] = useState('');
  const [buscandoNif, setBuscandoNif] = useState(false);
  const [pacienteNif, setPacienteNif] = useState<{ id: string; nome: string; dataNascimento?: string } | null>(null);
  const [marcacoesHoje, setMarcacoesHoje] = useState<Array<{ id: string; dataHora: string; checkinEm?: string; medico: { nome: string; especialidade?: string } }>>([]);
  const [buscandoMarcacoesHoje, setBuscandoMarcacoesHoje] = useState(false);

  // Marcação
  const [codigoInput, setCodigoInput] = useState('');
  const [marcacaoEncontrada, setMarcacaoEncontrada] = useState<{
    id: string; codigo: string; especialidade: string; dataHora: string;
    medico: { nome: string }; nomeDoente?: string; doente?: { nome: string };
  } | null>(null);
  const [marcacaoErro, setMarcacaoErro] = useState('');
  const [buscandoMarcacao, setBuscandoMarcacao] = useState(false);

  function selecionarServico(s: (typeof SERVICOS)[0]) {
    setTipoSelecionado(s);
    setEstado('opcoes');
  }

  async function tirarSenha() {
    if (!tipoSelecionado) return;
    setEmissao(true);
    try {
      const prioridade = prioritario ? 'prioritario' : senior ? 'senior' : 'normal';
      const res = await fetch(`${API}/quiosque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoSelecionado.tipo, prioridade, nomeUtente: nome || undefined }),
      });
      const data = await res.json();
      setTicket(data);
      setEstado('sucesso');
    } catch {
      alert('Erro ao emitir senha. Tente novamente.');
    } finally {
      setEmissao(false);
    }
  }

  function reiniciar() {
    setEstado('selecionar');
    setTipoSelecionado(null);
    setPrioritario(false);
    setSenior(false);
    setNome('');
    setTicket(null);
    setCodigoInput('');
    setMarcacaoEncontrada(null);
    setMarcacaoErro('');
    setNifInput('');
    setNifErro('');
    setPacienteNif(null);
    setMarcacoesHoje([]);
  }

  async function buscarPacientePorNif() {
    if (nifInput.trim().length < 9) return;
    setBuscandoNif(true);
    setNifErro('');
    try {
      const res = await fetch(`${API}/quiosque/paciente?nif=${nifInput.trim()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNifErro(err.message ?? 'Nenhum utente encontrado com esse NIF');
        return;
      }
      setPacienteNif(await res.json());
      setEstado('nif_resultado');
    } finally {
      setBuscandoNif(false);
    }
  }

  async function verMarcacoesHoje() {
    if (!pacienteNif) return;
    setBuscandoMarcacoesHoje(true);
    try {
      const res = await fetch(`${API}/quiosque/paciente/${pacienteNif.id}/marcacoes-hoje`);
      setMarcacoesHoje(res.ok ? await res.json() : []);
      setEstado('nif_marcacoes');
    } finally {
      setBuscandoMarcacoesHoje(false);
    }
  }

  async function checkinMarcacaoNif(consultaId: string) {
    setEmissao(true);
    try {
      const res = await fetch(`${API}/quiosque/marcacao/${consultaId}/checkin`, { method: 'POST' });
      const data = await res.json();
      if (data.jaFezCheckin) {
        alert('Este utente já fez check-in nesta marcação.');
        return;
      }
      setTicket(data.ticket);
      setEstado('marcacao_sucesso');
    } catch {
      alert('Erro ao fazer check-in. Tente novamente.');
    } finally {
      setEmissao(false);
    }
  }

  async function tirarSenhaNif() {
    if (!pacienteNif) return;
    setEstado('opcoes');
    setTipoSelecionado(SERVICOS[0]);
    setNome(pacienteNif.nome);
  }

  async function buscarMarcacao() {
    if (!codigoInput.trim()) return;
    setBuscandoMarcacao(true);
    setMarcacaoErro('');
    try {
      const res = await fetch(`${API}/quiosque/marcacao?codigo=${codigoInput.trim().toUpperCase()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMarcacaoErro(err.message ?? 'Marcação não encontrada');
        return;
      }
      setMarcacaoEncontrada(await res.json());
      setEstado('marcacao_confirm');
    } finally {
      setBuscandoMarcacao(false);
    }
  }

  async function confirmarCheckin() {
    if (!marcacaoEncontrada) return;
    setEmissao(true);
    try {
      const res = await fetch(`${API}/quiosque/marcacao/${marcacaoEncontrada.id}/checkin`, { method: 'POST' });
      const data = await res.json();
      if (data.jaFezCheckin) {
        setMarcacaoErro('Este utente já fez check-in anteriormente.');
        setEstado('marcacao');
        return;
      }
      setTicket(data.ticket);
      setEstado('marcacao_sucesso');
    } catch {
      setMarcacaoErro('Erro ao fazer check-in. Tente novamente.');
    } finally {
      setEmissao(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏥</div>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 700, margin: 0 }}>CuraSphere</h1>
        <p style={{ color: '#94a3b8', fontSize: 18, marginTop: 6 }}>Sistema de Gestão de Filas</p>
      </div>

      {/* ESTADO: Selecionar serviço */}
      {estado === 'selecionar' && (
        <div style={{ width: '100%', maxWidth: 720 }}>
          <h2 style={{ color: '#e2e8f0', textAlign: 'center', fontSize: 22, marginBottom: 28 }}>
            Seleccione o serviço pretendido
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {SERVICOS.map((s) => (
              <button
                key={s.tipo}
                onClick={() => selecionarServico(s)}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: `2px solid ${s.cor}40`,
                  borderRadius: 16,
                  padding: '32px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${s.cor}22`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = s.cor;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${s.cor}40`;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: 48 }}>{s.icon}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{s.label}</span>
                <span
                  style={{
                    background: s.cor,
                    color: '#fff',
                    borderRadius: 8,
                    padding: '2px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Senha {s.letra}
                </span>
              </button>
            ))}
          </div>

          {/* Botões secundários */}
          <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setEstado('nif')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '14px 28px',
                color: '#94a3b8',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >
              🪪 Identificar pelo NIF
            </button>
            <button
              onClick={() => setEstado('marcacao')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '14px 28px',
                color: '#94a3b8',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >
              📋 Já tenho marcação
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Inserir NIF */}
      {estado === 'nif' && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #3b82f660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🪪</div>
          <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>Identificar pelo NIF</h2>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 32 }}>
            Introduza o seu Número de Identificação Fiscal para ser identificado automaticamente.
          </p>
          <input
            type="tel"
            value={nifInput}
            onChange={e => { setNifInput(e.target.value.replace(/\D/g, '')); setNifErro(''); }}
            placeholder="000000000"
            maxLength={9}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12, padding: '16px', color: '#fff', fontSize: 32, fontWeight: 800,
              textAlign: 'center', letterSpacing: 6, boxSizing: 'border-box', marginBottom: 16,
              fontFamily: 'monospace',
            }}
            onKeyDown={e => { if (e.key === 'Enter') buscarPacientePorNif(); }}
          />
          {nifErro && <p style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>{nifErro}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reiniciar}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={buscarPacientePorNif} disabled={buscandoNif || nifInput.length < 9}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: buscandoNif || nifInput.length < 9 ? 0.6 : 1 }}>
              {buscandoNif ? 'A procurar...' : 'Identificar'}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Paciente identificado por NIF */}
      {estado === 'nif_resultado' && pacienteNif && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #3b82f660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
          <h2 style={{ color: '#6ee7b7', fontSize: 22, marginBottom: 6 }}>Olá,</h2>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 32 }}>{pacienteNif.nome}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={verMarcacoesHoje} disabled={buscandoMarcacoesHoje}
              style={{ width: '100%', padding: '18px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: buscandoMarcacoesHoje ? 0.7 : 1 }}>
              {buscandoMarcacoesHoje ? 'A verificar...' : '📋 Ver Marcações de Hoje'}
            </button>
            <button onClick={tirarSenhaNif}
              style={{ width: '100%', padding: '18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>
              🎟️ Tirar Senha
            </button>
            <button onClick={reiniciar}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 15, cursor: 'pointer' }}>
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Marcações de hoje via NIF */}
      {estado === 'nif_marcacoes' && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #8b5cf660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 540, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 24 }}>
            {marcacoesHoje.length > 0 ? 'As suas consultas de hoje' : 'Sem marcações para hoje'}
          </h2>
          {marcacoesHoje.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32 }}>
              Não tem consultas agendadas para hoje. Pode tirar uma senha normal abaixo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {marcacoesHoje.map(m => (
                <div key={m.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '18px 20px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 20 }}>
                        {new Date(m.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Dr. {m.medico.nome}</div>
                      {m.medico.especialidade && (
                        <div style={{ color: '#94a3b8', fontSize: 13 }}>{m.medico.especialidade}</div>
                      )}
                    </div>
                    {m.checkinEm ? (
                      <span style={{ background: '#10b981', color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                        ✓ Check-in feito
                      </span>
                    ) : (
                      <button onClick={() => checkinMarcacaoNif(m.id)} disabled={emissao}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: emissao ? 0.7 : 1 }}>
                        Fazer Check-in
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEstado('nif_resultado')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={tirarSenhaNif}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              🎟️ Tirar Senha Normal
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Inserir código de marcação */}
      {estado === 'marcacao' && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #8b5cf660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
          <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>Confirmar Marcação</h2>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 32 }}>
            Introduza o código que recebeu quando fez a marcação.
          </p>
          <input
            type="text"
            value={codigoInput}
            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setMarcacaoErro(''); }}
            placeholder="CON-XXXX"
            maxLength={8}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12, padding: '16px', color: '#fff', fontSize: 28, fontWeight: 800,
              textAlign: 'center', letterSpacing: 4, boxSizing: 'border-box', marginBottom: 16,
              fontFamily: 'monospace',
            }}
            onKeyDown={e => { if (e.key === 'Enter') buscarMarcacao(); }}
          />
          {marcacaoErro && <p style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>{marcacaoErro}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reiniciar}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={buscarMarcacao} disabled={buscandoMarcacao || codigoInput.length < 8}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: buscandoMarcacao || codigoInput.length < 8 ? 0.6 : 1 }}>
              {buscandoMarcacao ? 'A procurar...' : 'Verificar Código'}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Confirmar check-in */}
      {estado === 'marcacao_confirm' && marcacaoEncontrada && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b98160', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 24 }}>Marcação Encontrada</h2>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>Código</span>
              <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: 16 }}>{marcacaoEncontrada.codigo}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>Médico</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Dr. {marcacaoEncontrada.medico?.nome}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>Especialidade</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{marcacaoEncontrada.especialidade}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>Hora</span>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>
                {new Date(marcacaoEncontrada.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEstado('marcacao')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 16, cursor: 'pointer' }}>
              ← Voltar
            </button>
            <button onClick={confirmarCheckin} disabled={emissao}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: emissao ? 0.6 : 1 }}>
              {emissao ? 'A fazer check-in...' : 'Confirmar Chegada'}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Sucesso check-in marcação */}
      {estado === 'marcacao_sucesso' && ticket && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b981', borderRadius: 20, padding: '48px 56px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <p style={{ color: '#6ee7b7', fontSize: 18, marginBottom: 12 }}>Check-in confirmado! A sua senha é</p>
          <div style={{ fontSize: 96, fontWeight: 900, color: '#fff', letterSpacing: -2, lineHeight: 1, marginBottom: 20 }}>
            {ticket.numero}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32 }}>
            Aguarde ser chamado. Siga o ecrã de chamadas.
          </p>
          <button onClick={reiniciar}
            style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer' }}>
            Nova Senha
          </button>
        </div>
      )}

      {/* ESTADO: Opções */}
      {estado === 'opcoes' && tipoSelecionado && (
        <div
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `2px solid ${tipoSelecionado.cor}60`,
            borderRadius: 20,
            padding: '40px 48px',
            width: '100%',
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 12 }}>{tipoSelecionado.icon}</div>
          <h2 style={{ color: '#fff', fontSize: 26, marginBottom: 6 }}>{tipoSelecionado.label}</h2>
          <p style={{ color: '#94a3b8', marginBottom: 32, fontSize: 15 }}>
            Senhas da série <strong style={{ color: tipoSelecionado.cor }}>{tipoSelecionado.letra}</strong>
          </p>

          {/* Prioridade */}
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tipo de atendimento
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={prioritario}
                onChange={(e) => { setPrioritario(e.target.checked); if (e.target.checked) setSenior(false); }}
                style={{ width: 20, height: 20, accentColor: '#ef4444' }}
              />
              <span style={{ color: '#fff', fontSize: 16 }}>
                🔴 Prioridade — Grávida / Emergência / Mobilidade Reduzida
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={senior}
                onChange={(e) => { setSenior(e.target.checked); if (e.target.checked) setPrioritario(false); }}
                style={{ width: 20, height: 20, accentColor: '#f59e0b' }}
              />
              <span style={{ color: '#fff', fontSize: 16 }}>
                🟡 Sénior — Pessoa com mais de 65 anos
              </span>
            </label>
          </div>

          {/* Nome opcional */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>
              Nome (opcional)
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="O seu nome..."
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                padding: '12px 16px',
                color: '#fff',
                fontSize: 16,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={reiniciar}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
            <button
              onClick={tirarSenha}
              disabled={emissao}
              style={{
                flex: 2,
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: tipoSelecionado.cor,
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
                cursor: emissao ? 'not-allowed' : 'pointer',
                opacity: emissao ? 0.7 : 1,
              }}
            >
              {emissao ? 'A emitir...' : 'Tirar Senha'}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Sucesso */}
      {estado === 'sucesso' && ticket && (
        <div
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '2px solid #10b981',
            borderRadius: 20,
            padding: '48px 56px',
            width: '100%',
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <p style={{ color: '#6ee7b7', fontSize: 18, marginBottom: 12 }}>A sua senha é</p>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: -2,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {ticket.numero}
          </div>
          {ticket.prioridade !== 'normal' && (
            <span
              style={{
                display: 'inline-block',
                background: ticket.prioridade === 'prioritario' ? '#ef4444' : '#f59e0b',
                color: '#fff',
                borderRadius: 20,
                padding: '4px 16px',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              {ticket.prioridade === 'prioritario' ? '🔴 Prioritário' : '🟡 Sénior'}
            </span>
          )}
          <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32, marginTop: ticket.prioridade === 'normal' ? 16 : 0 }}>
            Aguarde ser chamado. Siga o ecrã de chamadas.
          </p>
          <button
            onClick={reiniciar}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 12,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Nova Senha
          </button>
        </div>
      )}

      <p style={{ color: '#475569', marginTop: 40, fontSize: 13 }}>CuraSphere — Sistema de Gestão Hospitalar</p>
    </div>
  );
}
