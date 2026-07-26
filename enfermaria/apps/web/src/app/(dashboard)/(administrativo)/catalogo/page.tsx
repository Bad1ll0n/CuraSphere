'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface CatalogoItem {
  id: string;
  dci: string;
  nomeMarca?: string;
  formaFarmaceutica: string;
  classeTerap: string;
  unidade: string;
  concentracao?: string;
  codigoATC?: string;
  ativo: boolean;
}

const FORMAS = ['comprimido', 'cápsula', 'solução_injectável', 'solução_oral', 'pomada', 'creme', 'supositório', 'inalador', 'patch', 'colírio', 'outro'];
const CLASSES = ['analgésico', 'antibiótico', 'anticoagulante', 'anti-hipertensor', 'antidiabético', 'broncodilatador', 'antieméticos', 'diurético', 'ansiolítico', 'anestésico', 'cardiovascular', 'gastroenterológico', 'outro'];

export default function CatalogoPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'criar' | 'editar' | null>(null);
  const [editItem, setEditItem] = useState<CatalogoItem | null>(null);
  const [form, setForm] = useState({ dci: '', nomeMarca: '', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg', concentracao: '', codigoATC: '' });

  const canEdit = ['farmaceutico', 'administrativo'].includes(utilizador?.role ?? '');

  const { data: catalogo = [], isLoading } = useQuery<CatalogoItem[]>({
    queryKey: ['catalogo', search],
    queryFn: () => api.get(`/catalogo${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.data ?? []),
    staleTime: 60_000,
  });

  const resetForm = () => setForm({ dci: '', nomeMarca: '', formaFarmaceutica: 'comprimido', classeTerap: 'analgésico', unidade: 'mg', concentracao: '', codigoATC: '' });

  const mutCriar = useMutation({
    mutationFn: (body: typeof form) => api.post('/catalogo', body),
    onSuccess: () => { toast.success('Medicamento adicionado ao catálogo'); setModal(null); resetForm(); qc.invalidateQueries({ queryKey: ['catalogo'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao adicionar medicamento'),
  });

  const mutEditar = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.patch(`/catalogo/${editItem!.id}`, body),
    onSuccess: () => { toast.success('Medicamento actualizado'); setModal(null); setEditItem(null); resetForm(); qc.invalidateQueries({ queryKey: ['catalogo'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao actualizar medicamento'),
  });

  const mutDesativar = useMutation({
    mutationFn: (id: string) => api.delete(`/catalogo/${id}`),
    onSuccess: () => { toast.success('Medicamento removido do catálogo'); qc.invalidateQueries({ queryKey: ['catalogo'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao remover medicamento'),
  });

  const abrirEditar = (item: CatalogoItem) => {
    setEditItem(item);
    setForm({ dci: item.dci, nomeMarca: item.nomeMarca ?? '', formaFarmaceutica: item.formaFarmaceutica, classeTerap: item.classeTerap, unidade: item.unidade, concentracao: item.concentracao ?? '', codigoATC: item.codigoATC ?? '' });
    setModal('editar');
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Medicamentos</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Lista padronizada por DCI, forma farmacêutica e classe terapêutica</p>
        </div>
        {canEdit && (
          <button onClick={() => { resetForm(); setModal('criar'); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Adicionar
          </button>
        )}
      </div>

      {/* Pesquisa */}
      <div style={{ marginBottom: '24px', maxWidth: '400px' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por DCI, nome de marca ou classe..."
          className="w-full border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          style={{ padding: '10px 16px' }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {catalogo.length === 0 ? (
            <div className="text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">{search ? 'Nenhum medicamento encontrado.' : 'Catálogo vazio. Adiciona o primeiro medicamento.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px 12px 32px' }}>DCI</th>
                  {['Nome de Marca', 'Forma', 'Classe Terapêutica', 'Concentração', 'Cód. ATC', ''].map(h => (
                    <th key={h} className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalogo.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="font-semibold text-slate-900" style={{ padding: '14px 20px 14px 32px' }}>{item.dci}</td>
                    <td className="text-slate-500" style={{ padding: '14px 20px' }}>{item.nomeMarca || '—'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="text-xs bg-indigo-50 text-indigo-700 badge-pad py-1 rounded-full font-medium">{item.formaFarmaceutica}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="text-xs bg-emerald-50 text-emerald-700 badge-pad py-1 rounded-full font-medium">{item.classeTerap}</span>
                    </td>
                    <td className="text-slate-500" style={{ padding: '14px 20px' }}>{item.concentracao || '—'}</td>
                    <td className="text-slate-400 font-mono text-xs" style={{ padding: '14px 20px' }}>{item.codigoATC || '—'}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button onClick={() => abrirEditar(item)}
                            className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                            style={{ padding: '5px 10px' }}>Editar</button>
                          <button onClick={() => mutDesativar.mutate(item.id)}
                            className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                            style={{ padding: '5px 10px' }}>Remover</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Criar / Editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '500px', padding: '32px', margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">{modal === 'criar' ? 'Adicionar Medicamento' : 'Editar Medicamento'}</h2>
              <button aria-label="Fechar" onClick={() => { setModal(null); setEditItem(null); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="grid gap-4">
              {[
                { label: 'DCI *', key: 'dci', placeholder: 'Ex: Paracetamol' },
                { label: 'Nome de Marca', key: 'nomeMarca', placeholder: 'Ex: Ben-u-ron' },
                { label: 'Unidade', key: 'unidade', placeholder: 'mg, ml, UI, g...' },
                { label: 'Concentração', key: 'concentracao', placeholder: 'Ex: 500mg, 1g/10ml' },
                { label: 'Código ATC', key: 'codigoATC', placeholder: 'Ex: N02BE01' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</span>
                  <input aria-label={label} type="text" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ padding: '10px 14px' }} placeholder={placeholder} />
                </div>
              ))}
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Forma Farmacêutica *</label>
                <select id="fpage-1" value={form.formaFarmaceutica} onChange={e => setForm(f => ({ ...f, formaFarmaceutica: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }}>
                  {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Classe Terapêutica *</label>
                <select id="fpage-2" value={form.classeTerap} onChange={e => setForm(f => ({ ...f, classeTerap: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }}>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => { setModal(null); setEditItem(null); }} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button
                onClick={() => modal === 'criar' ? mutCriar.mutate(form) : mutEditar.mutate(form)}
                disabled={(modal === 'criar' ? mutCriar.isPending : mutEditar.isPending) || !form.dci.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {modal === 'criar' ? 'Adicionar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
