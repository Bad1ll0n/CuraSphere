'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Anuncio {
  id: string;
  titulo: string;
  texto: string;
  servico?: string;
  criadoEm: string;
  expiraEm?: string;
  autor: { id: string; nome: string; role: string };
}

interface Mensagem {
  id: string;
  assunto?: string;
  texto: string;
  lida: boolean;
  criadaEm: string;
  remetente: { id: string; nome: string; role: string; servico: string };
}

const ROLES_ANUNCIO = ['enfermeiro', 'medico', 'administrativo', 'direcao'];

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

  const [salvando, setSalvando] = useState(false);

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
      await api.post('/comunicacao/mensagens', mensagemForm);
      setMensagemModal(false);
      setMensagemForm({ destinatarioId: '', assunto: '', texto: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const marcarLida = async (id: string) => {
    await api.patch(`/comunicacao/mensagens/${id}/lida`);
    setMensagens(prev => prev.map(m => m.id === id ? { ...m, lida: true } : m));
    setNaoLidas(prev => Math.max(0, prev - 1));
  };

  const podePublicar = ROLES_ANUNCIO.includes(utilizador?.role ?? '');

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comunicação Interna</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Anúncios do serviço e mensagens internas</p>
        </div>
        <div className="flex items-center gap-3">
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
          ) : mensagensEnviadas.map(m => (
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
            </div>
          ))}
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
                  {a.servico && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{a.servico}</span>}
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

      {/* Modal: Publicar Anúncio */}
      {anuncioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Publicar Anúncio</h2>
              <button onClick={() => setAnuncioModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título *</label>
              <input value={anuncioForm.titulo} onChange={e => setAnuncioForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="Título do anúncio" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Mensagem *</label>
              <textarea value={anuncioForm.texto} onChange={e => setAnuncioForm(f => ({ ...f, texto: e.target.value }))}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Conteúdo do anúncio..." />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço (vazio = todos)</label>
              <select value={anuncioForm.servico} onChange={e => setAnuncioForm(f => ({ ...f, servico: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Todos os serviços</option>
                {['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Expira em (opcional)</label>
              <input type="datetime-local" value={anuncioForm.expiraEm} onChange={e => setAnuncioForm(f => ({ ...f, expiraEm: e.target.value }))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Mensagem</h2>
              <button onClick={() => setMensagemModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>ID do Destinatário *</label>
              <input value={mensagemForm.destinatarioId} onChange={e => setMensagemForm(f => ({ ...f, destinatarioId: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="UUID do utilizador" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Assunto</label>
              <input value={mensagemForm.assunto} onChange={e => setMensagemForm(f => ({ ...f, assunto: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} placeholder="Assunto da mensagem (opcional)" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Mensagem *</label>
              <textarea value={mensagemForm.texto} onChange={e => setMensagemForm(f => ({ ...f, texto: e.target.value }))}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Escreva a sua mensagem..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMensagemModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={enviarMensagem} disabled={salvando || !mensagemForm.destinatarioId.trim() || !mensagemForm.texto.trim()}
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
