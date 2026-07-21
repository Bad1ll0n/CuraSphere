'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string } | null;
}

const COMPONENTES: Record<string, string> = {
  concentrado_eritrocitos: 'Concentrado Eritrocitário',
  plasma_fresco_congelado: 'Plasma Fresco Congelado',
  concentrado_plaquetas: 'Concentrado de Plaquetas',
  crioprecipitado: 'Crioprecipitado',
  sangue_total: 'Sangue Total',
};
const ESTADO_COR: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  reservado: 'bg-blue-50 text-blue-700',
  administrado: 'bg-green-50 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
};
const URGENCIA_COR: Record<string, string> = {
  rotina: 'bg-slate-100 text-slate-600',
  urgente: 'bg-orange-50 text-orange-700',
  emergencia: 'bg-red-50 text-red-700',
};

const CERTOS = [
  'Doente certo + grupo ABO/Rh compatível conferido',
  'Nº da unidade confere com a etiqueta da bolsa',
  'Bolsa dentro da validade',
];

export function TransfusaoPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const role = utilizador?.role ?? '';
  const podePrescrever = role === 'medico';
  const podeAdministrar = ['medico', 'enfermeiro'].includes(role);

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalPedido, setModalPedido] = useState(false);
  const [form, setForm] = useState({ componente: 'concentrado_eritrocitos', numeroUnidades: 1, grupoABO: '', rhD: '', urgencia: 'rotina', indicacao: '' });
  const [salvando, setSalvando] = useState(false);

  const [modalAdmin, setModalAdmin] = useState<any | null>(null); // pedido a administrar
  const [compativeis, setCompativeis] = useState<any[]>([]);
  const [bolsaSel, setBolsaSel] = useState('');
  const [certos, setCertos] = useState([false, false, false]);

  const [modalReacao, setModalReacao] = useState<string | null>(null); // registoId
  const [reacao, setReacao] = useState({ tipo: 'febril_nao_hemolitica', gravidade: 'ligeira', sintomas: '', medidas: '' });

  const carregar = useCallback(() => {
    setLoading(true);
    api.get(`/transfusao/doente/${doenteId}`)
      .then(r => setPedidos(r.data ?? []))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, [doenteId]);
  useEffect(() => { carregar(); }, [carregar]);

  const criarPedido = async () => {
    if (!form.indicacao.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/transfusao/doente/${doenteId}/pedido`, {
        componente: form.componente,
        numeroUnidades: Number(form.numeroUnidades),
        grupoABO: form.grupoABO || undefined,
        rhD: form.rhD || undefined,
        urgencia: form.urgencia,
        indicacao: form.indicacao,
      });
      toast.success('Pedido de transfusão criado');
      setModalPedido(false);
      setForm({ componente: 'concentrado_eritrocitos', numeroUnidades: 1, grupoABO: '', rhD: '', urgencia: 'rotina', indicacao: '' });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar pedido');
    } finally { setSalvando(false); }
  };

  const abrirAdmin = async (pedido: any) => {
    setModalAdmin(pedido); setBolsaSel(''); setCertos([false, false, false]); setCompativeis([]);
    try {
      const r = await api.get(`/transfusao/pedido/${pedido.id}/compativeis`);
      setCompativeis(r.data ?? []);
    } catch { setCompativeis([]); }
  };

  const administrar = async () => {
    if (!modalAdmin || !bolsaSel || !certos.every(Boolean)) return;
    setSalvando(true);
    try {
      await api.post(`/transfusao/pedido/${modalAdmin.id}/administrar`, {
        bolsaId: bolsaSel,
        verificacaoABO: certos[0], verificacaoUnidade: certos[1], verificacaoValidade: certos[2],
      });
      toast.success('Transfusão registada');
      setModalAdmin(null);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao administrar');
    } finally { setSalvando(false); }
  };

  const submeterReacao = async () => {
    if (!modalReacao || !reacao.sintomas.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/transfusao/registo/${modalReacao}/reacao`, reacao);
      toast.success('Reação registada');
      setModalReacao(null);
      setReacao({ tipo: 'febril_nao_hemolitica', gravidade: 'ligeira', sintomas: '', medidas: '' });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao registar reação');
    } finally { setSalvando(false); }
  };

  const todosCertos = certos.every(Boolean);

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 0C9 7 6 10 6 14a6 6 0 0012 0c0-4-3-7-6-10z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Sangue e Transfusão</span>
          {pedidos.length > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>{pedidos.length}</span>
          )}
          {podePrescrever && (
            <button onClick={() => setModalPedido(true)} aria-label="Pedir transfusão"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" style={{ marginLeft: 'auto' }}>
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>A carregar...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem pedidos de transfusão</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pedidos.map((p) => (
              <div key={p.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{COMPONENTES[p.componente] ?? p.componente}</span>
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${ESTADO_COR[p.estado] ?? ''}`}>{p.estado}</span>
                      {p.urgencia !== 'rotina' && <span className={`text-xs font-semibold badge-pad py-0.5 rounded-full ${URGENCIA_COR[p.urgencia]}`}>{p.urgencia}</span>}
                    </div>
                    <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{p.numeroUnidades} unidade(s){p.grupoABO ? ` · grupo ${p.grupoABO}${p.rhD === 'negativo' ? '-' : p.rhD === 'positivo' ? '+' : ''}` : ''}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{p.indicacao}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Prescrito por {p.prescritoPor?.nome}</p>
                    {p.registos?.map((r: any) => (
                      <div key={r.id} className="bg-green-50 rounded-lg" style={{ padding: '8px 10px', marginTop: '6px' }}>
                        <p className="text-xs font-semibold text-green-700">Transfundida — unidade {r.bolsa?.numeroUnidade} ({r.bolsa?.grupoABO}{r.bolsa?.rhD === 'negativo' ? '-' : '+'})</p>
                        <p className="text-xs text-green-700">Por {r.administradoPor?.nome} · {new Date(r.iniciadoEm).toLocaleString('pt-PT')}</p>
                        {r.reacao ? (
                          <p className="text-xs font-semibold text-red-600" style={{ marginTop: '2px' }}>⚠ Reação: {r.reacao.tipo.replace(/_/g, ' ')} ({r.reacao.gravidade})</p>
                        ) : podeAdministrar && (
                          <button onClick={() => setModalReacao(r.id)} className="text-xs font-medium text-red-600 hover:text-red-800 underline" style={{ marginTop: '2px' }}>Registar reação</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {podeAdministrar && ['pendente', 'reservado'].includes(p.estado) && (
                    <button onClick={() => abrirAdmin(p)}
                      className="shrink-0 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors" style={{ padding: '6px 12px' }}>
                      Administrar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Pedir transfusão */}
      {modalPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '20px' }}>Pedir Transfusão</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Componente *</label>
                <select value={form.componente} onChange={e => setForm(f => ({ ...f, componente: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>
                  {Object.entries(COMPONENTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Unidades *</label>
                  <input type="number" min={1} max={20} value={form.numeroUnidades} onChange={e => setForm(f => ({ ...f, numeroUnidades: Number(e.target.value) }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Grupo ABO</label>
                  <select value={form.grupoABO} onChange={e => setForm(f => ({ ...f, grupoABO: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>
                    <option value="">—</option>{['A', 'B', 'AB', 'O'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Rh</label>
                  <select value={form.rhD} onChange={e => setForm(f => ({ ...f, rhD: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>
                    <option value="">—</option><option value="positivo">+</option><option value="negativo">−</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Urgência</label>
                <select value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>
                  <option value="rotina">Rotina</option><option value="urgente">Urgente</option><option value="emergencia">Emergência</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Indicação clínica *</label>
                <textarea value={form.indicacao} onChange={e => setForm(f => ({ ...f, indicacao: e.target.value }))} rows={2} placeholder="Ex: Anemia sintomática, Hb 6.8 g/dL" className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 resize-none" style={{ padding: '10px 14px' }} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalPedido(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criarPedido} disabled={salvando || !form.indicacao.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>{salvando ? 'A guardar...' : 'Pedir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Administrar (dupla verificação) */}
      {modalAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '4px' }}>Administrar Transfusão</h2>
            <p className="text-xs text-slate-500" style={{ marginBottom: '18px' }}>{COMPONENTES[modalAdmin.componente]} · {modalAdmin.numeroUnidades} un.</p>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Bolsa compatível *</label>
            {compativeis.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700" style={{ padding: '12px 14px', marginBottom: '18px' }}>
                Sem bolsas compatíveis disponíveis no banco de sangue para este doente/componente.
              </div>
            ) : (
              <div className="flex flex-col gap-2" style={{ marginBottom: '18px' }}>
                {compativeis.map((b) => (
                  <label key={b.id} className={`flex items-center gap-3 rounded-xl border cursor-pointer transition-colors ${bolsaSel === b.id ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`} style={{ padding: '10px 14px' }}>
                    <input type="radio" name="bolsa" checked={bolsaSel === b.id} onChange={() => setBolsaSel(b.id)} className="accent-red-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">Unidade {b.numeroUnidade} · {b.grupoABO}{b.rhD === 'negativo' ? '-' : '+'}</p>
                      <p className="text-xs text-slate-400">Validade {new Date(b.dataValidade).toLocaleDateString('pt-PT')}{b.compat?.motivo ? ` · ${b.compat.motivo}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Dupla-verificação à cabeceira *</label>
            <div className="flex flex-col gap-2" style={{ marginBottom: '20px' }}>
              {CERTOS.map((c, i) => (
                <label key={i} className={`flex items-start gap-3 rounded-xl border cursor-pointer transition-colors ${certos[i] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`} style={{ padding: '10px 14px' }}>
                  <input type="checkbox" checked={certos[i]} onChange={e => setCertos(prev => prev.map((v, idx) => idx === i ? e.target.checked : v))} className="mt-0.5 accent-emerald-600" />
                  <span className="text-sm text-slate-700">{c}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAdmin(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={administrar} disabled={salvando || !bolsaSel || !todosCertos} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvando ? 'A registar...' : todosCertos && bolsaSel ? 'Confirmar Transfusão' : 'Confirme bolsa + 3 certos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reação */}
      {modalReacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '18px' }}>Registar Reação Transfusional</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                  <select value={reacao.tipo} onChange={e => setReacao(r => ({ ...r, tipo: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 12px' }}>
                    {['febril_nao_hemolitica', 'alergica', 'hemolitica_aguda', 'trali', 'taco', 'contaminacao_bacteriana', 'outra'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Gravidade</label>
                  <select value={reacao.gravidade} onChange={e => setReacao(r => ({ ...r, gravidade: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 12px' }}>
                    {['ligeira', 'moderada', 'grave', 'fatal'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Sintomas *</label>
                <textarea value={reacao.sintomas} onChange={e => setReacao(r => ({ ...r, sintomas: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 resize-none" style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Medidas tomadas</label>
                <input value={reacao.medidas} onChange={e => setReacao(r => ({ ...r, medidas: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: '22px' }}>
              <button onClick={() => setModalReacao(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterReacao} disabled={salvando || !reacao.sintomas.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>{salvando ? 'A guardar...' : 'Registar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
