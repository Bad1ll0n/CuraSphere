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

type Estado = 'selecionar' | 'opcoes' | 'sucesso' | 'marcacao' | 'marcacao_confirm' | 'marcacao_sucesso';

export default function QuiosquePage() {
  const [estado, setEstado] = useState<Estado>('selecionar');
  const [tipoSelecionado, setTipoSelecionado] = useState<(typeof SERVICOS)[0] | null>(null);
  const [prioritario, setPrioritario] = useState(false);
  const [senior, setSenior] = useState(false);
  const [nome, setNome] = useState('');
  const [emissao, setEmissao] = useState(false);
  const [ticket, setTicket] = useState<{ numero: string; tipo: string; prioridade: string } | null>(null);

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

          {/* Botão Tenho Marcação */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <button
              onClick={() => setEstado('marcacao')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '14px 36px',
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
