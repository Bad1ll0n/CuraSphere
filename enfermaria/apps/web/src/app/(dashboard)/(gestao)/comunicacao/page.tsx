'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface Anuncio {
  id: string;
  titulo: string;
  texto: string;
  servico?: string;
  criadoEm: string;
  expiraEm?: string;
  autor: { id: string; nome: string; role: string };
}

interface Anexo {
  id: string;
  nome: string;
  url: string;
  mimeType: string;
  tamanho: number;
}

interface Mensagem {
  id: string;
  assunto?: string;
  texto: string;
  lida: boolean;
  criadaEm: string;
  remetente: { id: string; nome: string; role: string; servico: string };
  anexos?: Anexo[];
}

interface UtilizadorItem {
  id: string;
  nome: string;
  role: string;
  servico: string;
}

const ROLES_ANUNCIO = ['enfermeiro', 'medico', 'administrativo', 'direcao'];

const ROLE_LABEL: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', administrativo: 'Administrativo',
  tecnico: 'Técnico', direcao: 'Direção', qualidade: 'Qualidade',
  ti: 'TI', farmacia: 'Farmácia', fisioterapia: 'Fisioterapia',
};

export default function ComunicacaoPage() {
  const { utilizador } = useAuth();
  const [tab, setTab] = useState<'anuncios' | 'mensagens' | 'enviadas'>('anuncios');
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [mensagensEnviadas, setMensagensEnviadas] = useState<Array<Mensagem & { destinatario?: { nome: string } }>>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  const [anuncioModal, setAnuncioModal] = useState(false);
  const [anuncioForm, setAnuncioForm] = useState({ titulo: '', texto: '', servico: '', expiraEm: '' });

  const [mensagemModal, setMensagemModal] = useState(false);
  const [mensagemForm, setMensagemForm] = useState({ destinatarioId: '', assunto: '', texto: '' });
  const [utilizadores, setUtilizadores] = useState<UtilizadorItem[]>([]);
  const [destNome, setDestNome] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const pesquisaRef = useRef<HTMLInputElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);
  const [anexoFile, setAnexoFile] = useState<File | null>(null);

  const [salvando, setSalvando] = useState(false);

  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ servicoAlvo: '', roleAlvo: '', assunto: '', texto: '' });
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [broadcastResultado, setBroadcastResultado] = useState<number | null>(null);

  const carregar = async () => {
    try {
      const [a, m, nl, env] = await Promise.all([
        api.get('/comunicacao/anuncios'),
        api.get('/comunicacao/mensagens'),
        api.get('/comunicacao/mensagens/nao-lidas'),
        api.get('/comunicacao/mensagens/enviadas'),
      ]);
      setAnuncios(a.data);
      setMensagens(m.data);
      setNaoLidas(nl.data.naoLidas);
      setMensagensEnviadas(env.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (mensagemModal && utilizadores.length === 0) {
      api.get('/utilizadores?limit=200').then(r => setUtilizadores(r.data.data ?? [])).catch(() => {});
    }
    if (!mensagemModal) {
      setMensagemForm({ destinatarioId: '', assunto: '', texto: '' });
      setDestNome('');
      setPesquisa('');
      setDropdownAberto(false);
      setAnexoFile(null);
    }
  }, [mensagemModal]);

  const publicarAnuncio = async () => {
    if (!anuncioForm.titulo.trim() || !anuncioForm.texto.trim()) return;
    setSalvando(true);
    try {
      await api.post('/comunicacao/anuncios', { ...anuncioForm, servico: anuncioForm.servico || undefined, expiraEm: anuncioForm.expiraEm || undefined });
      setAnuncioModal(false);
      setAnuncioForm({ titulo: '', texto: '', servico: '', expiraEm: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const enviarMensagem = async () => {
    if (!mensagemForm.destinatarioId.trim() || !mensagemForm.texto.trim()) return;
    setSalvando(true);
    try {
      const { data } = await api.post('/comunicacao/mensagens', mensagemForm);
      if (anexoFile && data?.id) {
        const fd = new FormData();
        fd.append('file', anexoFile);
        await api.post(`/comunicacao/mensagens/${data.id}/anexo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setMensagemModal(false);
      setMensagemForm({ destinatarioId: '', assunto: '', texto: '' });
      setAnexoFile(null);
      carregar();
    } finally { setSalvando(false); }
  };

  const enviarBroadcast = async () => {
    if (!broadcastForm.texto.trim()) return;
    setEnviandoBroadcast(true);
    try {
      const r = await api.post('/comunicacao/broadcast', {
        servicoAlvo: broadcastForm.servicoAlvo || undefined,
        roleAlvo: broadcastForm.roleAlvo || undefined,
        assunto: broadcastForm.assunto || undefined,
        texto: broadcastForm.texto,
      });
      setBroadcastResultado(r.data.enviadas);
      setBroadcastForm({ servicoAlvo: '', roleAlvo: '', assunto: '', texto: '' });
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Erro ao enviar broadcast');
    } finally { setEnviandoBroadcast(false); }
  };

  const marcarLida = async (id: string) => {
    await api.patch(`/comunicacao/mensagens/${id}/lida`);
    setMensagens(prev => prev.map(m => m.id === id ? { ...m, lida: true } : m));
    setNaoLidas(prev => Math.max(0, prev - 1));
  };

  const podePublicar = ROLES_ANUNCIO.includes(utilizador?.role ?? '');
  const podeBroadcast = ['medico', 'enfermeiro', 'administrativo', 'direcao'].includes(utilizador?.role ?? '');

  const SERVICO_LABEL: Record<string, string> = {
    internamento: 'Internamento', urgencia: 'Urgência', bloco_operatorio: 'Bloco Operatório',
    consultas_externas: 'Consultas Externas', farmacia: 'Farmácia', fisioterapia: 'Fisioterapia',
    transporte: 'Transporte', administrativo: 'Administrativo',
  };
  const SERVICOS = Object.keys(SERVICO_LABEL);

  return (
    <div style={{ padding: '32px 40px' }}>
      {broadcastResultado !== null && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl" style={{ padding: '14px 20px', marginBottom: '20px' }}>
          <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-700 text-sm flex-1">Broadcast enviado para <strong>{broadcastResultado}</strong> utilizadores.</p>
          <button aria-label="Fechar" onClick={() => setBroadcastResultado(null)} className="text-green-400 hover:text-green-600 text-lg font-bold">✕</button>
        </div>
      )}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comunicação Interna</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Anúncios do serviço e mensagens internas</p>
        </div>
        <div className="flex items-center gap-3">
          {podeBroadcast && (
            <button onClick={() => setBroadcastModal(true)}
              className="flex items-center gap-2 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 20px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Broadcast
            </button>
          )}
          <button onClick={() => setMensagemModal(true)}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Enviar Mensagem
          </button>
          {podePublicar && (
            <button onClick={() => setAnuncioModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 20px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              Publicar Anúncio
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {[
          { id: 'anuncios',  label: 'Anúncios',   badge: 0 },
          { id: 'mensagens', label: 'Recebidas',   badge: naoLidas },
          { id: 'enviadas',  label: 'Enviadas',    badge: 0 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 font-semibold text-sm rounded-lg transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 16px' }}>
            {t.label}
            {t.badge > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : tab === 'enviadas' ? (
        <div className="grid gap-3">
          {mensagensEnviadas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Não enviou nenhuma mensagem.</p>
            </div>
          ) : mensagensEnviadas.map(m => {
            const lida = (m as any).lida as boolean;
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 flex items-start gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                    <p className="text-sm font-semibold text-slate-700">{m.assunto ?? '(sem assunto)'}</p>
                  </div>
                  <p className="text-slate-600 text-sm" style={{ marginBottom: '8px' }}>{m.texto}</p>
                  <p className="text-slate-400 text-xs">
                    Para {(m as any).destinatario?.nome ?? '—'} · {new Date(m.criadaEm).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {lida ? (
                    <>
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-xs font-semibold text-green-600">Lida</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      <span className="text-xs font-semibold text-slate-400">Não lida</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'anuncios' ? (
        <div className="grid gap-4">
          {anuncios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhum anúncio activo para o seu serviço.</p>
            </div>
          ) : anuncios.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200" style={{ padding: '24px 28px' }}>
              <div className="flex items-start justify-between gap-4" style={{ marginBottom: '12px' }}>
                <h3 className="font-bold text-slate-900">{a.titulo}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {a.servico && <span className="text-xs text-slate-400 bg-slate-100 badge-pad py-0.5 rounded-full">{a.servico}</span>}
                  <span className="text-xs text-slate-400">{new Date(a.criadoEm).toLocaleDateString('pt-PT')}</span>
                </div>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{a.texto}</p>
              <p className="text-slate-400 text-xs" style={{ marginTop: '12px' }}>Publicado por {a.autor?.nome}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {mensagens.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">A sua caixa de entrada está vazia.</p>
            </div>
          ) : mensagens.map(m => (
            <div key={m.id} className={`rounded-2xl border flex items-start justify-between gap-4 ${m.lida ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-200'}`} style={{ padding: '20px 24px' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  {!m.lida && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  <p className={`text-sm font-semibold ${m.lida ? 'text-slate-700' : 'text-slate-900'}`}>
                    {m.assunto ?? '(sem assunto)'}
                  </p>
                </div>
                <p className="text-slate-600 text-sm" style={{ marginBottom: '8px' }}>{m.texto}</p>
                {m.anexos && m.anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2" style={{ marginBottom: '8px' }}>
                    {m.anexos.map(a => (
                      <a key={a.id} href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}${a.url}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        style={{ padding: '4px 10px' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {a.nome}
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-slate-400 text-xs">De {m.remetente?.nome} · {new Date(m.criadaEm).toLocaleDateString('pt-PT')}</p>
              </div>
              {!m.lida && (
                <button onClick={() => marcarLida(m.id)}
                  className="text-xs font-semibold border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shrink-0"
                  style={{ padding: '7px 14px' }}>
                  Marcar como lida
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Broadcast */}
      {broadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '500px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <h2 className="text-lg font-bold text-slate-900">Enviar Broadcast</h2>
              <button onClick={() => { setBroadcastModal(false); setBroadcastForm({ servicoAlvo: '', roleAlvo: '', assunto: '', texto: '' }); }}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold" aria-label="Fechar">✕</button>
            </div>
            <p className="text-slate-400 text-sm" style={{ marginBottom: '24px' }}>Envia uma mensagem para todos os utilizadores que correspondam ao filtro.</p>

            <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço</label>
                <select id="fpage-0" value={broadcastForm.servicoAlvo} onChange={e => setBroadcastForm(f => ({ ...f, servicoAlvo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Todos os serviços</option>
                  {SERVICOS.map(s => <option key={s} value={s}>{SERVICO_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Função</label>
                <select id="fpage-1" value={broadcastForm.roleAlvo} onChange={e => setBroadcastForm(f => ({ ...f, roleAlvo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Todas as funções</option>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Assunto</label>
              <input id="fpage-2" value={broadcastForm.assunto} onChange={e => setBroadcastForm(f => ({ ...f, assunto: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ padding: '10px 14px' }} placeholder="Assunto (opcional)" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Mensagem *</label>
              <textarea id="fpage-3" value={broadcastForm.texto} onChange={e => setBroadcastForm(f => ({ ...f, texto: e.target.value }))}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Escreva a mensagem a difundir..." />
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-2" style={{ padding: '12px 14px', marginBottom: '20px' }}>
              <svg className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-orange-700 text-xs">
                Sem filtros seleccionados, a mensagem é enviada para <strong>todos os utilizadores</strong> da plataforma.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setBroadcastModal(false); setBroadcastForm({ servicoAlvo: '', roleAlvo: '', assunto: '', texto: '' }); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={async () => { await enviarBroadcast(); setBroadcastModal(false); }}
                disabled={enviandoBroadcast || !broadcastForm.texto.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {enviandoBroadcast ? 'A enviar...' : 'Enviar Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publicar Anúncio */}
      {anuncioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Publicar Anúncio</h2>
              <button aria-label="Fechar" onClick={() => setAnuncioModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título *</label>
              <input id="fpage-4" value={anuncioForm.titulo} onChange={e => setAnuncioForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="Título do anúncio" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Mensagem *</label>
              <textarea id="fpage-5" value={anuncioForm.texto} onChange={e => setAnuncioForm(f => ({ ...f, texto: e.target.value }))}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Conteúdo do anúncio..." />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço (vazio = todos)</label>
              <select id="fpage-6" value={anuncioForm.servico} onChange={e => setAnuncioForm(f => ({ ...f, servico: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Todos os serviços</option>
                {['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-7" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Expira em (opcional)</label>
              <input id="fpage-7" type="datetime-local" value={anuncioForm.expiraEm} onChange={e => setAnuncioForm(f => ({ ...f, expiraEm: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAnuncioModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={publicarAnuncio} disabled={salvando || !anuncioForm.titulo.trim() || !anuncioForm.texto.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A publicar...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar Mensagem */}
      {mensagemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDropdownAberto(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '460px', padding: '32px', margin: '0 16px' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Mensagem</h2>
              <button aria-label="Fechar" onClick={() => setMensagemModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            {/* Destinatário com pesquisa */}
            <div style={{ marginBottom: '14px', position: 'relative' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Destinatário *</label>
              {mensagemForm.destinatarioId ? (
                <div className="flex items-center justify-between border border-blue-300 bg-blue-50 rounded-xl"
                  style={{ padding: '10px 14px' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-bold" style={{ fontSize: '10px' }}>
                        {destNome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{destNome}</span>
                  </div>
                  <button onClick={() => { setMensagemForm(f => ({ ...f, destinatarioId: '' })); setDestNome(''); setPesquisa(''); setTimeout(() => pesquisaRef.current?.focus(), 50); }}
                    className="text-slate-400 hover:text-slate-600 font-bold text-base leading-none" aria-label="Fechar">✕</button>
                </div>
              ) : (
                <>
                  <input
                    ref={pesquisaRef}
                    value={pesquisa}
                    onChange={e => { setPesquisa(e.target.value); setDropdownAberto(true); }}
                    onFocus={() => setDropdownAberto(true)}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }}
                    placeholder="Pesquisar por nome ou função..."
                    autoFocus
                  />
                  {dropdownAberto && (
                    <div className="absolute left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden"
                      style={{ top: 'calc(100% + 4px)', maxHeight: '220px', overflowY: 'auto' }}>
                      {utilizadores
                        .filter(u => u.id !== utilizador?.id &&
                          (pesquisa === '' || u.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
                            (ROLE_LABEL[u.role] ?? u.role).toLowerCase().includes(pesquisa.toLowerCase())))
                        .slice(0, 8)
                        .map(u => (
                          <button key={u.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setMensagemForm(f => ({ ...f, destinatarioId: u.id })); setDestNome(u.nome); setDropdownAberto(false); }}
                            className="w-full flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                            style={{ padding: '10px 14px' }}>
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <span className="text-slate-500 font-bold" style={{ fontSize: '11px' }}>
                                {u.nome.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{u.nome}</p>
                              <p className="text-xs text-slate-400 truncate">{ROLE_LABEL[u.role] ?? u.role} · {u.servico}</p>
                            </div>
                          </button>
                        ))}
                      {utilizadores.filter(u => u.id !== utilizador?.id && (pesquisa === '' || u.nome.toLowerCase().includes(pesquisa.toLowerCase()) || (ROLE_LABEL[u.role] ?? u.role).toLowerCase().includes(pesquisa.toLowerCase()))).length === 0 && (
                        <p className="text-sm text-slate-400 text-center" style={{ padding: '16px' }}>Nenhum utilizador encontrado</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-9" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Assunto</label>
              <input id="fpage-9" value={mensagemForm.assunto} onChange={e => setMensagemForm(f => ({ ...f, assunto: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="Assunto da mensagem (opcional)" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fpage-10" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Mensagem *</label>
              <textarea id="fpage-10" value={mensagemForm.texto} onChange={e => setMensagemForm(f => ({ ...f, texto: e.target.value }))}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Escreva a sua mensagem..." />
            </div>

            {/* Anexo */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-11" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Anexo (opcional)</label>
              <input id="fpage-11" ref={anexoInputRef} type="file" className="hidden"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={e => setAnexoFile(e.target.files?.[0] ?? null)} />
              {anexoFile ? (
                <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-xl" style={{ padding: '10px 14px' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-slate-700 truncate">{anexoFile.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">({(anexoFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button onClick={() => { setAnexoFile(null); if (anexoInputRef.current) anexoInputRef.current.value = ''; }}
                    className="text-slate-400 hover:text-red-500 font-bold ml-2 shrink-0" aria-label="Fechar">✕</button>
                </div>
              ) : (
                <button onClick={() => anexoInputRef.current?.click()}
                  className="flex items-center gap-2 border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 rounded-xl text-sm font-medium transition-colors w-full justify-center"
                  style={{ padding: '10px 14px' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Adicionar anexo (PDF, imagem, Word, Excel — máx. 10 MB)
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMensagemModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={enviarMensagem} disabled={salvando || !mensagemForm.destinatarioId || !mensagemForm.texto.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A enviar...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
