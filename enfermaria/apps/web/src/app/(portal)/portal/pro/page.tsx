'use client';
import { useState, useEffect } from 'react';
import { PortalAuthProvider, usePortalAuth } from '../../portal-auth-context';
import { useRouter } from 'next/navigation';

const API = `${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')}/v1`;

interface CampoPRO {
  id: string;
  label: string;
  tipo: 'scale' | 'bool' | 'text';
  min?: number;
  max?: number;
}

interface Template {
  id: string;
  nome: string;
  campos: CampoPRO[];
}

interface Registo {
  id: string;
  criadoEm: string;
  respostas: Record<string, unknown>;
  template: { nome: string; campos: CampoPRO[] };
}

function PROContent() {
  const { user, token, loading: authLoading } = usePortalAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSel, setTemplateSel] = useState<Template | null>(null);
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [historico, setHistorico] = useState<Registo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [tab, setTab] = useState<'registar' | 'historico'>('registar');

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/portal/login'); return; }
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API}/portal/pro/templates`, { headers: h })
      .then(r => r.json()).then(setTemplates).catch(() => { /* vazio */ });
    fetch(`${API}/portal/pro/historico`, { headers: h })
      .then(r => r.json()).then(setHistorico).catch(() => { /* vazio */ });
  }, [token, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSel) return;
    setSubmitting(true);
    setMensagem('');
    try {
      const r = await fetch(`${API}/portal/pro/submeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ templateId: templateSel.id, respostas }),
      });
      if (!r.ok) throw new Error();
      setMensagem('Obrigado! O seu registo foi guardado.');
      setRespostas({});
      setTemplateSel(null);
      const h = { Authorization: `Bearer ${token}` };
      fetch(`${API}/portal/pro/historico`, { headers: h }).then(r2 => r2.json()).then(setHistorico).catch(() => { /* vazio */ });
    } catch {
      setMensagem('Erro ao guardar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 className="text-2xl font-bold text-slate-900" style={{ marginBottom: '8px' }}>Como se sente?</h1>
      <p className="text-slate-500 text-sm" style={{ marginBottom: '28px' }}>Registe os seus sintomas e bem-estar. Estes dados são partilhados com a sua equipa clínica.</p>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px' }}>
        {(['registar', 'historico'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-sm font-semibold rounded-lg transition-colors ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px' }}>
            {t === 'registar' ? 'Novo Registo' : 'Histórico'}
          </button>
        ))}
      </div>

      {tab === 'registar' && (
        <div>
          {!templateSel ? (
            <div>
              <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Seleccione um questionário:</p>
              {templates.length === 0 && <p className="text-slate-400 text-sm">Sem questionários disponíveis.</p>}
              <div className="space-y-3">
                {templates.map(t => (
                  <button key={t.id} onClick={() => { setTemplateSel(t); setRespostas({}); }}
                    className="w-full text-left bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-sm transition-all"
                    style={{ padding: '16px 20px' }}>
                    <p className="font-semibold text-slate-800">{t.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{t.campos.length} perguntas</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
                <button type="button" onClick={() => setTemplateSel(null)} className="text-slate-400 hover:text-slate-600">←</button>
                <h2 className="font-bold text-slate-800">{templateSel.nome}</h2>
              </div>

              <div className="space-y-6">
                {templateSel.campos.map(campo => (
                  <div key={campo.id}>
                    <span className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '10px' }}>{campo.label}</span>
                    {campo.tipo === 'scale' && (
                      <div>
                        <input aria-label={campo.label} type="range"
                          min={campo.min ?? 0} max={campo.max ?? 10} step={1}
                          value={(respostas[campo.id] as number) ?? Math.floor(((campo.max ?? 10) + (campo.min ?? 0)) / 2)}
                          onChange={e => setRespostas(r => ({ ...r, [campo.id]: parseInt(e.target.value) }))}
                          className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400" style={{ marginTop: '4px' }}>
                          <span>{campo.min ?? 0}</span>
                          <span className="font-bold text-blue-600 text-base">{(respostas[campo.id] as number) ?? Math.floor(((campo.max ?? 10) + (campo.min ?? 0)) / 2)}</span>
                          <span>{campo.max ?? 10}</span>
                        </div>
                      </div>
                    )}
                    {campo.tipo === 'bool' && (
                      <div className="flex gap-3">
                        {[true, false].map(v => (
                          <button key={String(v)} type="button"
                            onClick={() => setRespostas(r => ({ ...r, [campo.id]: v }))}
                            className={`flex-1 font-semibold rounded-xl border transition-colors ${respostas[campo.id] === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}
                            style={{ padding: '10px' }}>
                            {v ? 'Sim' : 'Não'}
                          </button>
                        ))}
                      </div>
                    )}
                    {campo.tipo === 'text' && (
                      <textarea
                        value={(respostas[campo.id] as string) ?? ''}
                        onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.value }))}
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                        style={{ padding: '10px 14px' }}
                        placeholder="Escreva aqui..."
                      />
                    )}
                  </div>
                ))}
              </div>

              {mensagem && (
                <div className={`text-sm rounded-xl ${mensagem.includes('Erro') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}
                  style={{ padding: '10px 14px', marginTop: '20px' }}>
                  {mensagem}
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-60 transition-colors"
                style={{ padding: '12px', marginTop: '24px' }}>
                {submitting ? 'A guardar...' : 'Guardar Registo'}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div>
          {historico.length === 0 && <p className="text-slate-400 text-sm">Sem registos anteriores.</p>}
          <div className="space-y-4">
            {historico.map(r => (
              <div key={r.id} className="bg-white border border-slate-100 rounded-2xl" style={{ padding: '16px 20px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <span className="font-semibold text-slate-800">{r.template.nome}</span>
                  <span className="text-xs text-slate-400">{new Date(r.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="space-y-2">
                  {r.template.campos.map(campo => {
                    const valor = r.respostas[campo.id];
                    if (valor === undefined || valor === null) return null;
                    return (
                      <div key={campo.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{campo.label}</span>
                        <span className="font-semibold text-slate-800">
                          {campo.tipo === 'bool' ? (valor ? 'Sim' : 'Não') : String(valor)}
                          {campo.tipo === 'scale' && <span className="text-slate-400 font-normal">/{campo.max ?? 10}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PROPage() {
  return <PortalAuthProvider><PROContent /></PortalAuthProvider>;
}
