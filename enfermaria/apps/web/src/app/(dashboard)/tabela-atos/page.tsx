'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface AtoClinico {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string;
  precoBase: number;
  especialidade: string | null;
  ativo: boolean;
}

const CATEGORIAS = [
  { value: 'consulta',     label: 'Consulta' },
  { value: 'exame',        label: 'Exame' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'medicacao',    label: 'Medicação' },
  { value: 'outro',        label: 'Outro' },
];

const ESPECIALIDADES = [
  { value: 'clinico_geral',       label: 'Clínica Geral' },
  { value: 'cardiologista',       label: 'Cardiologia' },
  { value: 'urologista',          label: 'Urologia' },
  { value: 'ortopedista',         label: 'Ortopedia' },
  { value: 'neurologista',        label: 'Neurologia' },
  { value: 'ginecologista',       label: 'Ginecologia' },
  { value: 'pediatra',            label: 'Pediatria' },
  { value: 'oncologista',         label: 'Oncologia' },
  { value: 'cirurgiao_geral',     label: 'Cirurgia Geral' },
  { value: 'medico_anestesia',    label: 'Anestesiologia' },
  { value: 'medico_imagem',       label: 'Imagiologia' },
  { value: 'anatomia_patologica', label: 'Anatomia Patológica' },
];

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  consulta:     { bg: 'bg-blue-50',    text: 'text-blue-700' },
  exame:        { bg: 'bg-purple-50',  text: 'text-purple-700' },
  procedimento: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  medicacao:    { bg: 'bg-green-50',   text: 'text-green-700' },
  outro:        { bg: 'bg-slate-100',  text: 'text-slate-600' },
};

const TABS = ['todos', 'consulta', 'exame', 'procedimento', 'medicacao', 'outro'] as const;

const FORM_VAZIO = { codigo: '', descricao: '', categoria: 'consulta', precoBase: '', especialidade: '', ativo: true };

export default function TabelaAtosPage() {
  const [atos, setAtos] = useState<AtoClinico[]>([]);
  const [tab, setTab] = useState<typeof TABS[number]>('todos');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<AtoClinico | null>(null);
  const [form, setForm] = useState<typeof FORM_VAZIO>({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const res = await api.get('/atos-clinicos?todos=true');
      setAtos(res.data);
    } catch {}
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_VAZIO });
    setErro('');
    setModal(true);
  };

  const abrirEditar = (ato: AtoClinico) => {
    setEditando(ato);
    setForm({
      codigo: ato.codigo,
      descricao: ato.descricao,
      categoria: ato.categoria,
      precoBase: String(ato.precoBase),
      especialidade: ato.especialidade ?? '',
      ativo: ato.ativo,
    });
    setErro('');
    setModal(true);
  };

  const guardar = async () => {
    if (!form.codigo.trim() || !form.descricao.trim() || !form.precoBase) {
      setErro('Código, descrição e preço são obrigatórios'); return;
    }
    const preco = parseFloat(form.precoBase);
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return; }

    setSalvando(true); setErro('');
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        descricao: form.descricao.trim(),
        categoria: form.categoria,
        precoBase: preco,
        especialidade: form.especialidade || null,
        ativo: form.ativo,
      };
      if (editando) {
        await api.patch(`/atos-clinicos/${editando.id}`, payload);
      } else {
        await api.post('/atos-clinicos', payload);
      }
      setModal(false);
      carregar();
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const desativar = async (ato: AtoClinico) => {
    if (!confirm(`Desativar "${ato.descricao}"?`)) return;
    try {
      await api.delete(`/atos-clinicos/${ato.id}`);
      carregar();
    } catch {}
  };

  const reativar = async (ato: AtoClinico) => {
    try {
      await api.patch(`/atos-clinicos/${ato.id}`, { ativo: true });
      carregar();
    } catch {}
  };

  const atosFiltrados = atos.filter(a => tab === 'todos' || a.categoria === tab);

  return (
    <div className="bg-slate-50 min-h-screen" style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tabela de Atos Clínicos</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
            Preços predefinidos para consultas, exames e procedimentos
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Ato
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm" style={{ padding: '6px', marginBottom: '20px', display: 'inline-flex' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm font-medium rounded-lg transition-all ${tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
            style={{ padding: '6px 16px' }}
          >
            {t === 'todos' ? 'Todos' : CATEGORIAS.find(c => c.value === t)?.label ?? t}
            <span className={`text-xs font-semibold rounded-full ml-1.5 ${tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`} style={{ padding: '1px 6px' }}>
              {t === 'todos' ? atos.length : atos.filter(a => a.categoria === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {atosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-slate-400" style={{ padding: '60px 24px' }}>
            <svg className="w-10 h-10" style={{ marginBottom: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Nenhum ato nesta categoria</p>
            <button onClick={abrirNovo} className="text-xs text-blue-600 hover:underline" style={{ marginTop: '8px' }}>+ Criar o primeiro ato</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 20px 12px 32px' }}>Código</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 16px' }}>Descrição</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 16px' }}>Categoria</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 16px' }}>Especialidade (auto)</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 16px' }}>Preço Base</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 16px' }}>Estado</th>
                <th style={{ padding: '12px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {atosFiltrados.map((ato, i) => {
                const catStyle = CAT_BADGE[ato.categoria] ?? CAT_BADGE['outro'];
                const espLabel = ESPECIALIDADES.find(e => e.value === ato.especialidade)?.label;
                return (
                  <tr key={ato.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!ato.ativo ? 'opacity-50' : ''}`}>
                    <td className="font-mono text-xs text-slate-600 font-semibold" style={{ padding: '14px 20px 14px 32px' }}>{ato.codigo}</td>
                    <td className="text-slate-800 font-medium" style={{ padding: '14px 16px' }}>{ato.descricao}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}>
                        {CATEGORIAS.find(c => c.value === ato.categoria)?.label ?? ato.categoria}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs" style={{ padding: '14px 16px' }}>
                      {espLabel ? <span className="font-medium text-slate-700">{espLabel}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-right font-semibold text-slate-800" style={{ padding: '14px 16px' }}>
                      {ato.precoBase.toFixed(2)} €
                    </td>
                    <td className="text-center" style={{ padding: '14px 16px' }}>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ato.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {ato.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => abrirEditar(ato)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {ato.ativo ? (
                          <button onClick={() => desativar(ato)} className="text-slate-400 hover:text-red-500 transition-colors" title="Desativar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        ) : (
                          <button onClick={() => reativar(ato)} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Reativar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Criar/Editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '28px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">{editando ? 'Editar Ato' : 'Novo Ato Clínico'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Código */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Código *</label>
                <input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  placeholder="ex: CONS-001"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Categoria *</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                >
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Descrição */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="ex: Consulta de Clínica Geral"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {/* Preço Base */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Preço Base (€) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precoBase}
                  onChange={e => setForm(f => ({ ...f, precoBase: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {/* Especialidade */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Especialidade (auto-fatura)</label>
                <select
                  value={form.especialidade}
                  onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                >
                  <option value="">— Nenhuma —</option>
                  {ESPECIALIDADES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>

              {/* Ativo */}
              <div className="col-span-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.ativo ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-slate-600">Ato ativo</span>
              </div>
            </div>

            {erro && <p className="text-sm text-red-600" style={{ marginTop: '12px' }}>{erro}</p>}

            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={guardar} disabled={salvando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
