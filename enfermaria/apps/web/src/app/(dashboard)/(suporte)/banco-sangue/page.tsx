'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const COMPONENTES: Record<string, string> = {
  concentrado_eritrocitos: 'Concentrado Eritrocitário',
  plasma_fresco_congelado: 'Plasma Fresco Congelado',
  concentrado_plaquetas: 'Concentrado de Plaquetas',
  crioprecipitado: 'Crioprecipitado',
  sangue_total: 'Sangue Total',
};
const ESTADO_COR: Record<string, string> = {
  disponivel: 'bg-green-50 text-green-700 border-green-200',
  reservada: 'bg-amber-50 text-amber-700 border-amber-200',
  transfundida: 'bg-slate-100 text-slate-500 border-slate-200',
  expirada: 'bg-red-50 text-red-600 border-red-200',
  descartada: 'bg-slate-100 text-slate-400 border-slate-200',
};
const GRUPOS = ['A', 'B', 'AB', 'O'];

function grupoLabel(abo: string, rh: string) {
  return `${abo}${rh === 'negativo' ? '−' : '+'}`;
}

export default function BancoSanguePage() {
  const t = useTranslations('bloodBank');
  const tc = useTranslations('common');
  const { utilizador } = useAuth();
  const toast = useToast();
  const role = utilizador?.role ?? '';
  const podeAdicionar = ['farmaceutico', 'ti', 'chefe_enfermeiros'].includes(role) || (utilizador as any)?.subRole === 'chefe_enfermeiros';

  const [bolsas, setBolsas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroComp, setFiltroComp] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ numeroUnidade: '', componente: 'concentrado_eritrocitos', grupoABO: 'O', rhD: 'positivo', volumeMl: '', dataValidade: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroComp) params.set('componente', filtroComp);
    if (filtroGrupo) params.set('grupoABO', filtroGrupo);
    api.get(`/transfusao/banco?${params}`).then(r => setBolsas(r.data ?? [])).catch(() => setBolsas([])).finally(() => setLoading(false));
  }, [filtroComp, filtroGrupo]);
  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async () => {
    if (!form.numeroUnidade.trim() || !form.dataValidade) return;
    setSalvando(true);
    try {
      await api.post('/transfusao/banco', {
        numeroUnidade: form.numeroUnidade,
        componente: form.componente,
        grupoABO: form.grupoABO,
        rhD: form.rhD,
        volumeMl: form.volumeMl ? Number(form.volumeMl) : undefined,
        dataValidade: new Date(form.dataValidade).toISOString(),
      });
      toast.success(t('toastSaved'));
      setModal(false);
      setForm({ numeroUnidade: '', componente: 'concentrado_eritrocitos', grupoABO: 'O', rhD: 'positivo', volumeMl: '', dataValidade: '' });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('toastError'));
    } finally { setSalvando(false); }
  };

  const disponiveis = bolsas.filter(b => b.estado === 'disponivel').length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>{t('subtitle', { count: disponiveis })}</p>
        </div>
        {podeAdicionar && (
          <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors" style={{ padding: '10px 18px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('addBag')}
          </button>
        )}
      </div>

      <div className="flex gap-3" style={{ marginBottom: '20px' }}>
        <select value={filtroComp} onChange={e => setFiltroComp(e.target.value)} className="text-sm border border-slate-200 rounded-xl bg-white" style={{ padding: '8px 12px' }}>
          <option value="">{t('allComponents')}</option>
          {Object.entries(COMPONENTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="text-sm border border-slate-200 rounded-xl bg-white" style={{ padding: '8px 12px' }}>
          <option value="">{t('allGroups')}</option>
          {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>{tc('loading')}</p>
      ) : bolsas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px' }}>
          <p className="text-sm text-slate-400">{t('empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th style={{ padding: '12px 16px' }}>{t('colUnit')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colComponent')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colGroup')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colExpiry')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {bolsas.map(b => {
                  const expira = new Date(b.dataValidade) < new Date(Date.now() + 7 * 864e5);
                  return (
                    <tr key={b.id} className="border-b border-slate-50">
                      <td className="font-mono text-slate-700" style={{ padding: '12px 16px' }}>{b.numeroUnidade}</td>
                      <td className="text-slate-600" style={{ padding: '12px 16px' }}>{COMPONENTES[b.componente] ?? b.componente}</td>
                      <td style={{ padding: '12px 16px' }}><span className="font-bold text-red-600">{grupoLabel(b.grupoABO, b.rhD)}</span></td>
                      <td className={expira && b.estado === 'disponivel' ? 'text-amber-600 font-medium' : 'text-slate-500'} style={{ padding: '12px 16px' }}>
                        {new Date(b.dataValidade).toLocaleDateString('pt-PT')}{expira && b.estado === 'disponivel' ? ' ⚠' : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}><span className={`text-xs font-medium badge-pad py-1 rounded-full border ${ESTADO_COR[b.estado] ?? ''}`}>{b.estado}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '460px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '18px' }}>{t('modalTitle')}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldUnit')}</label>
                <input id="fpage-0" value={form.numeroUnidade} onChange={e => setForm(f => ({ ...f, numeroUnidade: e.target.value }))} placeholder="Ex: U240115-A" className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldComponent')}</label>
                <select id="fpage-1" value={form.componente} onChange={e => setForm(f => ({ ...f, componente: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>
                  {Object.entries(COMPONENTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldAbo')}</label>
                  <select id="fpage-2" value={form.grupoABO} onChange={e => setForm(f => ({ ...f, grupoABO: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}>{GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}</select>
                </div>
                <div>
                  <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldRh')}</label>
                  <select id="fpage-3" value={form.rhD} onChange={e => setForm(f => ({ ...f, rhD: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }}><option value="positivo">+</option><option value="negativo">−</option></select>
                </div>
                <div>
                  <label htmlFor="fpage-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldVolume')}</label>
                  <input id="fpage-4" type="number" value={form.volumeMl} onChange={e => setForm(f => ({ ...f, volumeMl: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }} />
                </div>
              </div>
              <div>
                <label htmlFor="fpage-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{t('fieldExpiry')}</label>
                <input id="fpage-5" type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50" style={{ padding: '10px 14px' }} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: '22px' }}>
              <button onClick={() => setModal(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>{tc('cancel')}</button>
              <button onClick={adicionar} disabled={salvando || !form.numeroUnidade.trim() || !form.dataValidade} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>{salvando ? t('saving') : t('add')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
