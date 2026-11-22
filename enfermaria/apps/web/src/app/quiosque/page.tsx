'use client';

import { useState } from 'react';
import { SERVICOS, useReposicaoQuiosque } from '@/components/quiosque/servicos';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { quiosqueFetch } from '@/lib/quiosque-token';
import { IdentificarNif, type UtenteIdentificado } from '@/components/quiosque/identificar-nif';

const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'}/v1`;


type Estado = 'selecionar' | 'opcoes' | 'sucesso' | 'marcacao' | 'marcacao_confirm' | 'marcacao_sucesso' | 'nif' | 'nif_resultado' | 'nif_marcacoes' | 'nova_especialidade' | 'nova_medico' | 'nova_data' | 'nova_slot' | 'nova_confirmar' | 'nova_sucesso';


const SUBROLE_ICONE: Record<string, string> = {
  clinico_geral: '🏥',
  cardiologista: '❤️',
  cirurgiao_geral: '🔬',
  ortopedista: '🦴',
  pediatra: '👶',
  neurologista: '🧠',
  pneumologista: '🫁',
  dermatologista: '🧴',
  triador: '📋',
  generalista: '👨‍⚕️',
};


export default function QuiosquePage() {
  const t = useTranslations('kiosk');
  // Datas e horas no formato do idioma escolhido pelo utente.
  const loc = useLocale() === 'en' ? 'en-GB' : 'pt-PT';
  const especialidade = (s: string) => (s in SUBROLE_ICONE ? t(`specialty.${s}`) : s);
  const [estado, setEstado] = useState<Estado>('selecionar');
  const [tipoSelecionado, setTipoSelecionado] = useState<(typeof SERVICOS)[0] | null>(null);
  const [prioritario, setPrioritario] = useState(false);
  const [senior, setSenior] = useState(false);
  const [nome, setNome] = useState('');
  const [emissao, setEmissao] = useState(false);
  const [ticket, setTicket] = useState<{ numero: string; tipo: string; prioridade: string } | null>(null);

  // NIF
  // SEC-12: identificação por NIF + data de nascimento (ver IdentificarNif); só o nome abreviado.
  const [pacienteNif, setPacienteNif] = useState<UtenteIdentificado | null>(null);
  const comIdentificacao = (): HeadersInit => (pacienteNif ? { 'x-quiosque-identificacao': pacienteNif.identificacao } : {});
  const [marcacoesHoje, setMarcacoesHoje] = useState<Array<{ id: string; dataHora: string; checkinEm?: string; medico: { nome: string; especialidade?: string } }>>([]);
  const [buscandoMarcacoesHoje, setBuscandoMarcacoesHoje] = useState(false);

  // Nova marcação (agendamento self-service)
  type Medico = { id: string; nome: string; subRole: string };
  type Slot = { dataHora: string; disponivel: boolean };
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSelecionado, setSlotSelecionado] = useState<Slot | null>(null);
  const [carregandoMedicos, setCarregandoMedicos] = useState(false);
  const [novaConsulta, setNovaConsulta] = useState<{ codigo: string; dataHora: string; medico: { nome: string } } | null>(null);
  const [erroMarcacao, setErroMarcacao] = useState('');
  const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState('');
  const [slotCache, setSlotCache] = useState<Record<string, Slot[] | null>>({});

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
      const res = await quiosqueFetch(`${API}/quiosque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoSelecionado.tipo, prioridade, nomeUtente: nome || undefined }),
      });
      const data = await res.json();
      setTicket(data);
      setEstado('sucesso');
    } catch {
      alert(t('ticketError'));
    } finally {
      setEmissao(false);
    }
  }

  useReposicaoQuiosque(estado, reiniciar); // UX-26: volta sozinho ao início

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
    setPacienteNif(null);
    setMarcacoesHoje([]);
    setMedicos([]);
    setMedicoSelecionado(null);
    setDataSelecionada('');
    setSlots([]);
    setSlotSelecionado(null);
    setNovaConsulta(null);
    setErroMarcacao('');
    setEspecialidadeSelecionada('');
    setSlotCache({});
  }

  async function iniciarMarcacao() {
    setCarregandoMedicos(true);
    setErroMarcacao('');
    try {
      const res = await quiosqueFetch(`${API}/quiosque/medicos`);
      const data = res.ok ? await res.json() : [];
      setMedicos(data);
      setEstado('nova_especialidade');
    } finally {
      setCarregandoMedicos(false);
    }
  }

  function selecionarMedico(m: Medico) {
    setMedicoSelecionado(m);
    setDataSelecionada('');
    setSlots([]);
    setSlotSelecionado(null);
    setSlotCache({});
    setEstado('nova_data');

    // Pré-carregar disponibilidade dos próximos 28 dias em paralelo
    const hoje = new Date();
    const amanhaUtc = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
    const dias = Array.from({ length: 28 }, (_, i) =>
      new Date(amanhaUtc.getTime() + i * 86400000).toISOString().split('T')[0]
    );
    setSlotCache(Object.fromEntries(dias.map(d => [d, null]))); // null = a carregar

    Promise.allSettled(
      dias.map(dia =>
        quiosqueFetch(`${API}/quiosque/medicos/${m.id}/slots?data=${dia}`)
          .then(r => r.ok ? r.json() : [])
          .then((s: Slot[]) => ({ dia, slots: s.filter(x => x.disponivel) }))
          .catch(() => ({ dia, slots: [] as Slot[] }))
      )
    ).then(results => {
      const cache: Record<string, Slot[]> = {};
      results.forEach(r => { if (r.status === 'fulfilled') cache[r.value.dia] = r.value.slots; });
      setSlotCache(cache);
    });
  }

  function selecionarDiaCalendario(dia: string) {
    const cached = slotCache[dia];
    if (cached === null) return; // ainda a carregar
    if (!cached || cached.length === 0) return; // sem disponibilidade
    setDataSelecionada(dia);
    setSlots(cached);
    setSlotSelecionado(null);
  }

  async function confirmarMarcacao() {
    if (!pacienteNif || !medicoSelecionado || !slotSelecionado) return;
    setEmissao(true);
    setErroMarcacao('');
    try {
      const res = await quiosqueFetch(`${API}/quiosque/marcacao-nova`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...comIdentificacao() },
        body: JSON.stringify({
          medicoId: medicoSelecionado.id,
          dataHora: slotSelecionado.dataHora,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErroMarcacao(err.message ?? t('bookingError'));
        return;
      }
      const consulta = await res.json();
      setNovaConsulta({ codigo: consulta.codigo, dataHora: consulta.dataHora, medico: { nome: medicoSelecionado.nome } });
      setEstado('nova_sucesso');
    } finally {
      setEmissao(false);
    }
  }

  async function verMarcacoesHoje() {
    if (!pacienteNif) return;
    setBuscandoMarcacoesHoje(true);
    try {
      const res = await quiosqueFetch(`${API}/quiosque/identificacao/marcacoes-hoje`, { headers: comIdentificacao() });
      setMarcacoesHoje(res.ok ? await res.json() : []);
      setEstado('nif_marcacoes');
    } finally {
      setBuscandoMarcacoesHoje(false);
    }
  }

  async function checkinMarcacaoNif(consultaId: string) {
    setEmissao(true);
    try {
      const res = await quiosqueFetch(`${API}/quiosque/marcacao/${consultaId}/checkin`, { method: 'POST' });
      const data = await res.json();
      if (data.jaFezCheckin) {
        alert(t('alreadyCheckedIn'));
        return;
      }
      setTicket(data.ticket);
      setEstado('marcacao_sucesso');
    } catch {
      alert(t('checkinError'));
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
      const res = await quiosqueFetch(`${API}/quiosque/marcacao?codigo=${encodeURIComponent(codigoInput.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMarcacaoErro(err.message ?? t('bookingNotFound'));
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
      const res = await quiosqueFetch(`${API}/quiosque/marcacao/${marcacaoEncontrada.id}/checkin`, { method: 'POST' });
      const data = await res.json();
      if (data.jaFezCheckin) {
        setMarcacaoErro(t('alreadyCheckedInBefore'));
        setEstado('marcacao');
        return;
      }
      setTicket(data.ticket);
      setEstado('marcacao_sucesso');
    } catch {
      setMarcacaoErro(t('checkinError'));
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
        <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: -1 }}>CuraSphere</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 18, marginTop: 8 }}>{t('subtitle')}</p>
        {/* UX-07: o utente escolhe o idioma (só no ecrã inicial, para não perder o que já escolheu). */}
        {estado === 'selecionar' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><LanguageSwitcher /></div>}
      </div>

      {/* ESTADO: Selecionar serviço */}
      {estado === 'selecionar' && (
        <div style={{ width: '100%', maxWidth: 720 }}>
          <h2 style={{ color: '#e2e8f0', textAlign: 'center', fontSize: 22, marginBottom: 28 }}>
            {t('chooseService')}
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
                <span style={{ fontSize: 48, fontWeight: 900, color: s.cor, fontFamily: 'monospace' }}>{s.letra}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{t(`service.${s.tipo}`)}</span>
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
                  {t('ticketSeries', { letra: s.letra })}
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
                color: 'var(--text-dim)',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >
              {t('identifyNif')}
            </button>
            <button
              onClick={() => setEstado('marcacao')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: '14px 28px',
                color: 'var(--text-dim)',
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >
              {t('haveBooking')}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Inserir NIF */}
      {estado === 'nif' && (
        <IdentificarNif api={API} onVoltar={reiniciar} onIdentificado={(u) => { setPacienteNif(u); setEstado('nif_resultado'); }} />
      )}

      {/* ESTADO: Paciente identificado por NIF */}
      {estado === 'nif_resultado' && pacienteNif && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #3b82f660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <h2 style={{ color: '#6ee7b7', fontSize: 22, marginBottom: 6 }}>{t('hello')}</h2>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 32 }}>{pacienteNif.nome}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={verMarcacoesHoje} disabled={buscandoMarcacoesHoje}
              style={{ width: '100%', padding: '18px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: buscandoMarcacoesHoje ? 0.7 : 1 }}>
              {buscandoMarcacoesHoje ? t('checking') : t('todayBookings')}
            </button>
            <button onClick={iniciarMarcacao} disabled={carregandoMedicos}
              style={{ width: '100%', padding: '18px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: carregandoMedicos ? 0.7 : 1 }}>
              {carregandoMedicos ? t('loading') : t('book')}
            </button>
            <button onClick={tirarSenhaNif}
              style={{ width: '100%', padding: '18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>
              {t('takeTicket')}
            </button>
            <button onClick={reiniciar}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-dim)', fontSize: 15, cursor: 'pointer' }}>
              {t('back')}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Marcações de hoje via NIF */}
      {estado === 'nif_marcacoes' && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #8b5cf660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 540, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 24 }}>
            {marcacoesHoje.length > 0 ? t('yourToday') : t('noneToday')}
          </h2>
          {marcacoesHoje.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 16, marginBottom: 32 }}>
              {t('noneTodayHint')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {marcacoesHoje.map(m => (
                <div key={m.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '18px 20px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 20 }}>
                        {new Date(m.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{t('doctor', { nome: m.medico.nome })}</div>
                      {m.medico.especialidade && (
                        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{m.medico.especialidade}</div>
                      )}
                    </div>
                    {m.checkinEm ? (
                      <span style={{ background: '#10b981', color: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                        {t('checkedIn')}
                      </span>
                    ) : (
                      <button onClick={() => checkinMarcacaoNif(m.id)} disabled={emissao}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: emissao ? 0.7 : 1 }}>
                        {t('doCheckin')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEstado('nif_resultado')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
              {t('back')}
            </button>
            <button onClick={tirarSenhaNif}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {t('regularTicket')}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Inserir código de marcação */}
      {estado === 'marcacao' && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #8b5cf660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>{t('confirmBooking')}</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 15, marginBottom: 32 }}>
            {t('codeHint')}
          </p>
          <input
            type="text"
            value={codigoInput}
            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setMarcacaoErro(''); }}
            // S-13: os códigos novos têm 8 caracteres (CON-XXXX-XXXX). Os antigos, de 4,
            // continuam a funcionar — a API normaliza hífens, espaços e o prefixo.
            placeholder="CON-XXXX-XXXX"
            maxLength={16}
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
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
              {t('back')}
            </button>
            <button onClick={buscarMarcacao} disabled={buscandoMarcacao || codigoInput.length < 8}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: buscandoMarcacao || codigoInput.length < 8 ? 0.6 : 1 }}>
              {buscandoMarcacao ? t('searching') : t('verifyCode')}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Confirmar check-in */}
      {estado === 'marcacao_confirm' && marcacaoEncontrada && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b98160', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 500, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 24 }}>{t('bookingFound')}</h2>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('code')}</span>
              <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: 16 }}>{marcacaoEncontrada.codigo}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('doctorLabel')}</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('doctor', { nome: marcacaoEncontrada.medico?.nome ?? '' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('specialtyLabel')}</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{marcacaoEncontrada.especialidade}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('time')}</span>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 16 }}>
                {new Date(marcacaoEncontrada.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEstado('marcacao')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
              {t('back')}
            </button>
            <button onClick={confirmarCheckin} disabled={emissao}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: emissao ? 0.6 : 1 }}>
              {emissao ? t('checkingIn') : t('confirmArrival')}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: Sucesso check-in marcação */}
      {estado === 'marcacao_sucesso' && ticket && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b981', borderRadius: 20, padding: '48px 56px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <p style={{ color: '#6ee7b7', fontSize: 18, marginBottom: 12 }}>{t('checkinDone')}</p>
          <div style={{ fontSize: 96, fontWeight: 900, color: '#fff', letterSpacing: -2, lineHeight: 1, marginBottom: 20 }}>
            {ticket.numero}
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 16, marginBottom: 32 }}>
            {t('waitCall')}
          </p>
          <button onClick={reiniciar}
            style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer' }}>
            {t('newTicket')}
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
          <div style={{ fontSize: 64, fontWeight: 900, color: tipoSelecionado.cor, fontFamily: 'monospace', marginBottom: 12 }}>{tipoSelecionado.letra}</div>
          <h2 style={{ color: '#fff', fontSize: 26, marginBottom: 6 }}>{t(`service.${tipoSelecionado.tipo}`)}</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 32, fontSize: 15 }}>
            {t.rich('seriesOf', { letra: tipoSelecionado.letra, b: (c) => <strong style={{ color: tipoSelecionado.cor }}>{c}</strong> })}
          </p>

          {/* Prioridade */}
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('serviceType')}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={prioritario}
                onChange={(e) => { setPrioritario(e.target.checked); if (e.target.checked) setSenior(false); }}
                style={{ width: 20, height: 20, accentColor: '#ef4444' }}
              />
              <span style={{ color: '#fff', fontSize: 16 }}>
                {t('priority')}
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
                {t('senior')}
              </span>
            </label>
          </div>

          {/* Nome opcional */}
          <div style={{ marginBottom: 32 }}>
            <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 13, marginBottom: 8, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('nameOptional')}
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t('namePlaceholder')}
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
                color: 'var(--text-dim)',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              {t('back')}
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
              {emissao ? t('issuing') : t('takeTicket')}
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
          <p style={{ color: '#6ee7b7', fontSize: 18, marginBottom: 12 }}>{t('yourTicket')}</p>
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
              {ticket.prioridade === 'prioritario' ? t('priorityShort') : t('seniorShort')}
            </span>
          )}
          <p style={{ color: 'var(--text-dim)', fontSize: 16, marginBottom: 32, marginTop: ticket.prioridade === 'normal' ? 16 : 0 }}>
            {t('waitCall')}
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
            {t('newTicket')}
          </button>
        </div>
      )}

      {/* ── NOVA MARCAÇÃO: Selecionar Especialidade ── */}
      {estado === 'nova_especialidade' && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h2 style={{ color: '#e2e8f0', textAlign: 'center', fontSize: 24, marginBottom: 8 }}>{t('chooseSpecialty')}</h2>
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 15, marginBottom: 28 }}>
            {t('chooseSpecialtyHint')}
          </p>
          {medicos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0' }}>
              <p style={{ fontSize: 16 }}>{t('noDoctors')}</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>{t('goToReception')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from(new Set(medicos.map(m => m.subRole))).map(subRole => {
                const count = medicos.filter(m => m.subRole === subRole).length;
                return (
                  <button key={subRole}
                    onClick={() => { setEspecialidadeSelecionada(subRole); setEstado('nova_medico'); }}
                    style={{ width: '100%', padding: '22px 28px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{SUBROLE_ICONE[subRole] ?? '👨‍⚕️'} {especialidade(subRole)}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 400 }}>
                      {t('doctorCount', { n: count })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={() => setEstado('nif_resultado')}
            style={{ marginTop: 20, width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
            {t('back')}
          </button>
        </div>
      )}

      {/* ── NOVA MARCAÇÃO: Selecionar Médico ── */}
      {estado === 'nova_medico' && (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h2 style={{ color: '#e2e8f0', textAlign: 'center', fontSize: 22, marginBottom: 4 }}>
            {SUBROLE_ICONE[especialidadeSelecionada] ?? '👨‍⚕️'} {especialidade(especialidadeSelecionada)}
          </h2>
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 15, marginBottom: 28 }}>
            {t('chooseDoctor')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {medicos.filter(m => m.subRole === especialidadeSelecionada).map(m => (
              <button key={m.id} onClick={() => selecionarMedico(m)}
                style={{ width: '100%', padding: '20px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('doctor', { nome: m.nome.replace(/^Dr\.|^Dra\./, '').trim() })}</span>
                <span style={{ color: '#60a5fa', fontSize: 14, fontWeight: 400 }}>{t('seeAvailability')}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setEstado('nova_especialidade')}
            style={{ marginTop: 20, width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
            {t('back')}
          </button>
        </div>
      )}

      {/* ── NOVA MARCAÇÃO: Calendário de Disponibilidade ── */}
      {estado === 'nova_data' && medicoSelecionado && (() => {
        const hojeAgora = new Date();
        const amanhaUtcCal = new Date(Date.UTC(hojeAgora.getFullYear(), hojeAgora.getMonth(), hojeAgora.getDate() + 1));
        const dias = Array.from({ length: 28 }, (_, i) =>
          new Date(amanhaUtcCal.getTime() + i * 86400000)
        );
        const semanas: Date[][] = [dias.slice(0,7), dias.slice(7,14), dias.slice(14,21), dias.slice(21,28)];
        const slotsInline = dataSelecionada ? (slotCache[dataSelecionada] ?? []) : [];
        return (
          <div style={{ width: '100%', maxWidth: 660 }}>
            <h2 style={{ color: '#fff', textAlign: 'center', fontSize: 20, marginBottom: 4 }}>
              {t('doctor', { nome: medicoSelecionado.nome.replace(/^Dr\.|^Dra\./, '').trim() })}
            </h2>
            <p style={{ color: '#60a5fa', textAlign: 'center', fontSize: 15, marginBottom: 24 }}>
              {especialidade(medicoSelecionado.subRole)}
            </p>

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { cor: '#22c55e', label: t('legend.available') },
                { cor: '#334155', label: t('legend.full') },
                { cor: '#3b82f6', label: t('legend.selected') },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: l.cor }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Cabeçalho dias da semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => t(`weekday.${i}`)).map(d => (
                <div key={d} style={{ textAlign: 'center', color: 'var(--text-soft)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{d}</div>
              ))}
            </div>

            {/* Grid calendário — 4 semanas, alinhadas por dia da semana */}
            {semanas.map((semana, si) => {
              // Pad first row if needed
              const firstDow = si === 0 ? amanhaUtcCal.getUTCDay() : 0;
              return (
                <div key={si} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {si === 0 && Array.from({ length: firstDow }, (_, i) => <div key={`pad-${i}`} />)}
                  {semana.map(d => {
                    const iso = d.toISOString().split('T')[0];
                    const cached = slotCache[iso];
                    const temSlots = Array.isArray(cached) && cached.length > 0;
                    const semSlots = Array.isArray(cached) && cached.length === 0;
                    const aCarregar = cached === null;
                    const selecionado = dataSelecionada === iso;
                    return (
                      <button
                        key={iso}
                        onClick={() => selecionarDiaCalendario(iso)}
                        disabled={semSlots || aCarregar}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: `2px solid ${selecionado ? '#3b82f6' : temSlots ? '#22c55e40' : 'transparent'}`,
                          background: selecionado ? '#1d4ed8' : temSlots ? '#15803d30' : semSlots ? '#1e293b' : aCarregar ? '#1e293b' : '#1e293b',
                          color: semSlots || aCarregar ? '#334155' : '#fff',
                          cursor: temSlots ? 'pointer' : 'default',
                          textAlign: 'center',
                          transition: 'all 0.15s',
                          opacity: aCarregar ? 0.5 : 1,
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: selecionado ? '#fff' : temSlots ? '#86efac' : '#475569' }}>
                          {d.getUTCDate()}
                        </div>
                        <div style={{ fontSize: 11, color: selecionado ? '#93c5fd' : temSlots ? '#4ade80' : '#334155', marginTop: 2 }}>
                          {aCarregar ? '···' : temSlots ? t('slots', { n: cached.length }) : semSlots ? t('full') : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Slots inline quando dia selecionado */}
            {dataSelecionada && slotsInline.length > 0 && (
              <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '20px 24px' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                  {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {slotsInline.map(s => (
                    <button
                      key={s.dataHora}
                      onClick={() => { setSlotSelecionado(s); setEstado('nova_confirmar'); }}
                      style={{ padding: '14px 8px', borderRadius: 10, border: '2px solid #22c55e60', background: '#15803d20', color: '#86efac', fontSize: 17, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                    >
                      {new Date(s.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dataSelecionada && slotsInline.length === 0 && slotCache[dataSelecionada] !== null && (
              <p style={{ color: 'var(--text-soft)', textAlign: 'center', marginTop: 20, fontSize: 14 }}>
                {t('noSlotsDay')}
              </p>
            )}

            <button onClick={() => setEstado('nova_medico')}
              style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
              {t('back')}
            </button>
          </div>
        );
      })()}

      {/* ── NOVA MARCAÇÃO: Selecionar Slot ── */}
      {estado === 'nova_slot' && medicoSelecionado && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #8b5cf660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 540 }}>
          <h2 style={{ color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 6 }}>
            {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 15, marginBottom: 24 }}>
            {medicoSelecionado.nome.replace(/^Dr\.|^Dra\./, '').trim()} — {especialidade(medicoSelecionado.subRole)}
          </p>
          {slots.filter(s => s.disponivel).length === 0 ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>{t('noSlots')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
              {slots.filter(s => s.disponivel).map(s => (
                <button key={s.dataHora}
                  onClick={() => { setSlotSelecionado(s); setEstado('nova_confirmar'); }}
                  style={{ padding: '16px 8px', borderRadius: 10, border: `2px solid ${slotSelecionado?.dataHora === s.dataHora ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`, background: slotSelecionado?.dataHora === s.dataHora ? '#3b82f620' : 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                  {new Date(s.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setEstado('nova_data')}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
            {t('back')}
          </button>
        </div>
      )}

      {/* ── NOVA MARCAÇÃO: Confirmar ── */}
      {estado === 'nova_confirmar' && medicoSelecionado && slotSelecionado && pacienteNif && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b98160', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 500, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 24 }}>{t('confirmBooking')}</h2>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '20px', marginBottom: 24, textAlign: 'left' }}>
            {[
              { label: t('patient'), valor: pacienteNif.nome },
              { label: t('specialtyLabel'), valor: especialidade(medicoSelecionado.subRole) },
              { label: t('doctorLabel'), valor: medicoSelecionado.nome },
              { label: t('date'), valor: new Date(dataSelecionada + 'T12:00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: t('time'), valor: new Date(slotSelecionado.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) },
            ].map(({ label, valor }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{label}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, textAlign: 'right', maxWidth: '60%' }}>{valor}</span>
              </div>
            ))}
          </div>
          {erroMarcacao && <p style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>{erroMarcacao}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEstado('nova_data')}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
              {t('back')}
            </button>
            <button onClick={confirmarMarcacao} disabled={emissao}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: emissao ? 0.6 : 1 }}>
              {emissao ? t('booking') : t('confirmBooking')}
            </button>
          </div>
        </div>
      )}

      {/* ── NOVA MARCAÇÃO: Sucesso ── */}
      {estado === 'nova_sucesso' && novaConsulta && (
        <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #10b981', borderRadius: 20, padding: '48px 56px', width: '100%', maxWidth: 500, textAlign: 'center' }}>
          <h2 style={{ color: '#6ee7b7', fontSize: 22, marginBottom: 8 }}>{t('bookingConfirmed')}</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 15, marginBottom: 24 }}>
            {t('whenWith', {
              data: new Date(novaConsulta.dataHora).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }),
              hora: new Date(novaConsulta.dataHora).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
              medico: novaConsulta.medico.nome,
            })}
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 }}>{t('keepCode')}</p>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 4, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
            {novaConsulta.codigo}
          </div>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, marginBottom: 32 }}>
            {t('keepCodeHint')}
          </p>
          <button onClick={reiniciar}
            style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 18, fontWeight: 600, cursor: 'pointer' }}>
            {t('done')}
          </button>
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', marginTop: 40, fontSize: 13 }}>{t('footer')}</p>
    </div>
  );
}
