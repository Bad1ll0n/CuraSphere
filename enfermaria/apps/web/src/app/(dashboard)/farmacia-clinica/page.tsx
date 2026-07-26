'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Breadcrumb } from '@/components/breadcrumb';

type Tab = 'prescricoes' | 'interacoes' | 'reconciliacao';

interface PrescricaoAtiva {
  id: string;
  nome: string;
  cama: { numero: string; quarto?: string } | null;
  medicacoes: { id: string; nome: string; dose: string; via: string; ultimaAdmin: string | null }[];
}

interface Interacao {
  doenteId: string;
  doente: { nome: string; cama: { numero: string } | null };
  med1: string;
  med2: string;
  severidade: string;
  descricao: string;
}

interface Reconciliacao {
  id: string;
  doenteId: string;
  doente: { nome: string; cama: { numero: string } | null };
  criadaEm: string;
  medicacaoCasa: string;
  discrepancias: string;
  criadoPor: { nome: string; role: string };
}

export default function FarmaciaPage() {
  const { utilizador } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('prescricoes');
  const [prescricoes, setPrescricoes] = useState<PrescricaoAtiva[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [reconciliacoes, setReconciliacoes] = useState<Reconciliacao[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado formulário nova reconciliação
  const [modalRec, setModalRec] = useState(false);
  const [doenteIdRec, setDoenteIdRec] = useState('');
  const [medsCasa, setMedsCasa] = useState([{ nome: '', dose: '', frequencia: '' }]);
  const [discrepancias, setDiscrepancias] = useState('');
  const [salvandoRec, setSalvandoRec] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'prescricoes') {
        const r = await api.get('/medicacao/prescricoes-ativas');
        setPrescricoes(r.data);
      } else if (tab === 'interacoes') {
        // Carregar interacções de todos os doentes — a API retorna interacções gerais
        const r = await api.get('/medicacao/interacoes');
        setInteracoes(r.data);
      } else {
        const r = await api.get('/reconciliacao-medicacao/pendentes/aprovacao');
        setReconciliacoes(r.data);
      }
    } catch {
      // sem dados ainda
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { carregar(); }, [carregar]);

  const aprovar = async (id: string) => {
    try {
      await api.patch(`/reconciliacao-medicacao/${id}/aprovar`);
      toast.success('Reconciliação aprovada');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const submeterReconciliacao = async () => {
    if (!doenteIdRec.trim()) { toast.error('Introduza o ID do doente'); return; }
    setSalvandoRec(true);
    try {
      const medicacaoCasa = JSON.stringify(medsCasa.filter(m => m.nome.trim()));
      const disc = discrepancias.trim() ? JSON.stringify([{ descricao: discrepancias, resolvida: false }]) : '[]';
      await api.post(`/reconciliacao-medicacao/${doenteIdRec}`, { medicacaoCasa, discrepancias: disc });
      toast.success('Reconciliação criada');
      setModalRec(false);
      setDoenteIdRec('');
      setMedsCasa([{ nome: '', dose: '', frequencia: '' }]);
      setDiscrepancias('');
      if (tab === 'reconciliacao') carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally { setSalvandoRec(false); }
  };

  const TABS: { value: Tab; label: string }[] = [
    { value: 'prescricoes', label: 'Prescrições Activas' },
    { value: 'interacoes', label: 'Interacções' },
    { value: 'reconciliacao', label: 'Reconciliação' },
  ];

  const SEV_COR: Record<string, string> = {
    alta: 'bg-red-50 text-red-700 border-red-200',
    media: 'bg-amber-50 text-amber-700 border-amber-200',
    baixa: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[{ label: 'Farmácia Clínica' }]} />
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Farmácia Clínica</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Prescrições, interacções medicamentosas e reconciliação</p>
        </div>
        {tab === 'reconciliacao' && (
          <button onClick={() => setModalRec(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            + Nova Reconciliação
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`text-sm font-medium rounded-lg transition-all ${tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 20px' }}>
            {t.label}
            {t.value === 'interacoes' && interacoes.filter(i => i.severidade === 'alta').length > 0 && tab !== 'interacoes' && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold">
                {interacoes.filter(i => i.severidade === 'alta').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-slate-400" style={{ paddingTop: '40px' }}>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Tab: Prescrições */}
      {tab === 'prescricoes' && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left font-semibold text-slate-500 text-xs uppercase tracking-wide" style={{ padding: '12px 20px' }}>Doente</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Cama</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Medicações Activas</th>
              </tr>
            </thead>
            <tbody>
              {prescricoes.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/doentes/${p.id}`)}>
                  <td className="font-medium text-slate-800" style={{ padding: '14px 20px' }}>{p.nome}</td>
                  <td className="text-slate-500" style={{ padding: '14px 16px' }}>{p.cama?.numero ?? '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div className="flex flex-wrap gap-1">
                      {p.medicacoes.slice(0, 4).map(m => (
                        <span key={m.id} className="inline-block text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-lg" style={{ padding: '2px 8px' }}>
                          {m.nome} {m.dose}
                        </span>
                      ))}
                      {p.medicacoes.length > 4 && (
                        <span className="text-xs text-slate-400">+{p.medicacoes.length - 4}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {prescricoes.length === 0 && (
                <tr><td colSpan={3} className="text-center text-slate-400 text-sm" style={{ padding: '40px' }}>Sem prescrições activas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Interacções */}
      {tab === 'interacoes' && !loading && (
        <div className="flex flex-col gap-3">
          {interacoes.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400 text-sm" style={{ padding: '48px' }}>
              Nenhuma interacção medicamentosa activa detectada
            </div>
          )}
          {interacoes.map((i, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between" style={{ marginBottom: '10px' }}>
                <div>
                  <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                    <span className={`text-xs font-bold border rounded-lg ${SEV_COR[i.severidade] ?? SEV_COR.baixa}`} style={{ padding: '2px 10px' }}>
                      {i.severidade.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{i.med1} + {i.med2}</span>
                  </div>
                  <p className="text-sm text-slate-500">{i.descricao}</p>
                </div>
                <button onClick={() => router.push(`/doentes/${i.doenteId}`)}
                  className="text-xs text-blue-600 hover:underline shrink-0" style={{ marginLeft: '16px' }}>
                  Ver doente →
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>Doente:</span>
                <span className="font-medium text-slate-600">{i.doente?.nome}</span>
                {i.doente?.cama && <span>· Cama {i.doente.cama.numero}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Reconciliação */}
      {tab === 'reconciliacao' && !loading && (
        <div className="flex flex-col gap-3">
          {reconciliacoes.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400 text-sm" style={{ padding: '48px' }}>
              Sem reconciliações pendentes de aprovação
            </div>
          )}
          {reconciliacoes.map(r => {
            let medsCasaParsed: any[] = [];
            let discParsed: any[] = [];
            try { medsCasaParsed = JSON.parse(r.medicacaoCasa); } catch {}
            try { discParsed = JSON.parse(r.discrepancias); } catch {}
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm" style={{ padding: '20px 24px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{r.doente?.nome}</span>
                      {r.doente?.cama && <span className="text-xs text-slate-400">Cama {r.doente.cama.numero}</span>}
                    </div>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                      Por {r.criadoPor?.nome} · {new Date(r.criadaEm).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  {utilizador?.role === 'medico' && (
                    <button onClick={() => aprovar(r.id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
                      style={{ padding: '7px 16px' }}>
                      Aprovar
                    </button>
                  )}
                </div>
                {medsCasaParsed.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Medicação em Casa</p>
                    <div className="flex flex-wrap gap-1">
                      {medsCasaParsed.map((m: any, i: number) => (
                        <span key={i} className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg" style={{ padding: '2px 8px' }}>
                          {m.nome} {m.dose}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {discParsed.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Discrepâncias</p>
                    {discParsed.map((d: any, i: number) => (
                      <p key={i} className="text-xs text-amber-700">• {d.descricao}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Reconciliação */}
      {modalRec && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', maxHeight: '90vh', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Reconciliação de Medicação</h2>
              <button aria-label="Fechar" onClick={() => setModalRec(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>ID do Doente *</label>
              <input value={doenteIdRec} onChange={e => setDoenteIdRec(e.target.value)}
                placeholder="ID do doente no sistema"
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '9px 12px' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Medicação em Casa</label>
              {medsCasa.map((m, i) => (
                <div key={i} className="grid grid-cols-3 gap-2" style={{ marginBottom: '6px' }}>
                  <input value={m.nome} onChange={e => { const n = [...medsCasa]; n[i].nome = e.target.value; setMedsCasa(n); }}
                    placeholder="Nome" className="border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '7px 10px' }} />
                  <input value={m.dose} onChange={e => { const n = [...medsCasa]; n[i].dose = e.target.value; setMedsCasa(n); }}
                    placeholder="Dose" className="border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '7px 10px' }} />
                  <input value={m.frequencia} onChange={e => { const n = [...medsCasa]; n[i].frequencia = e.target.value; setMedsCasa(n); }}
                    placeholder="Frequência" className="border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '7px 10px' }} />
                </div>
              ))}
              <button onClick={() => setMedsCasa([...medsCasa, { nome: '', dose: '', frequencia: '' }])}
                className="text-xs text-blue-600 hover:underline" style={{ marginTop: '4px' }}>
                + Adicionar medicamento
              </button>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Discrepâncias encontradas</label>
              <textarea value={discrepancias} onChange={e => setDiscrepancias(e.target.value)}
                rows={3} placeholder="Descreva as discrepâncias encontradas..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none resize-none"
                style={{ padding: '9px 12px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRec(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterReconciliacao} disabled={salvandoRec}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoRec ? 'A guardar...' : 'Criar Reconciliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
