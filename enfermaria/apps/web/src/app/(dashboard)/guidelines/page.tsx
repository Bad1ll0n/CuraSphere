'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Breadcrumb } from '@/components/breadcrumb';
import { useAuth } from '@/lib/auth-context';

interface Guideline {
  id: string;
  titulo: string;
  categoria: string;
  fonte: string;
  versao?: string;
  conteudo: string;
  ativo: boolean;
  criadoEm: string;
}

const CATEGORIAS = [
  { value: 'sepsis', label: 'Sépsis', color: 'bg-red-100 text-red-700' },
  { value: 'antibioterapia', label: 'Antibioterapia', color: 'bg-orange-100 text-orange-700' },
  { value: 'feridas', label: 'Feridas', color: 'bg-rose-100 text-rose-700' },
  { value: 'isolamento', label: 'Isolamento', color: 'bg-amber-100 text-amber-700' },
  { value: 'dor', label: 'Dor', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'medicacao', label: 'Medicação', color: 'bg-blue-100 text-blue-700' },
  { value: 'geral', label: 'Geral', color: 'bg-slate-100 text-slate-600' },
];

const catInfo = (cat: string) => CATEGORIAS.find(c => c.value === cat) ?? { label: cat, color: 'bg-slate-100 text-slate-600' };

const EMPTY_FORM = { titulo: '', categoria: 'geral', fonte: '', versao: '', conteudo: '' };

export default function GuidelinesPage() {
  const toast = useToast();
  const { utilizador } = useAuth();
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [salvando, setSalvando] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const podeGerir = ['it_admin', 'direcao'].includes(utilizador?.role ?? '');

  const carregar = (categoria?: string) =>
    api.get('/guidelines', { params: categoria ? { categoria } : {} })
      .then(r => setGuidelines(r.data))
      .catch(() => { /* vazio */ });

  useEffect(() => { carregar(filtroCategoria || undefined); }, [filtroCategoria]);

  const salvar = async () => {
    if (!form.titulo.trim() || !form.fonte.trim() || !form.conteudo.trim()) {
      toast.error('Título, fonte e conteúdo são obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/guidelines', {
        titulo: form.titulo,
        categoria: form.categoria,
        fonte: form.fonte,
        versao: form.versao || undefined,
        conteudo: form.conteudo,
      });
      toast.success('Guideline criada');
      setModal(false);
      carregar(filtroCategoria || undefined);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const remover = async (id: string) => {
    try {
      await api.delete(`/guidelines/${id}`);
      toast.success('Guideline removida');
      carregar(filtroCategoria || undefined);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  const uploadPdf = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Apenas ficheiros PDF'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('Ficheiro demasiado grande (máx 20 MB)'); return; }
    const titulo = prompt('Título do documento PDF:');
    if (!titulo) return;
    const fonte = prompt('Fonte (ex: DGS 2024, NICE 2023):');
    if (!fonte) return;
    const categoriaInput = prompt(`Categoria (${CATEGORIAS.map(c => c.value).join(', ')}):`) ?? 'geral';
    setUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('titulo', titulo);
      fd.append('fonte', fonte);
      fd.append('categoria', categoriaInput);
      await api.post('/guidelines/upload-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('PDF processado e chunks indexados');
      carregar(filtroCategoria || undefined);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao processar PDF');
    } finally { setUploadingPdf(false); }
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[{ label: 'Guidelines Clínicas' }]} />
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guidelines Clínicas</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Base de conhecimento usada pela IA Clínica para contextualizar análises</p>
        </div>
        {podeGerir && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              ref={pdfInputRef}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }}
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploadingPdf}
              className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              style={{ padding: '10px 16px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploadingPdf ? 'A processar...' : 'Upload PDF'}
            </button>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setModal(true); }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              style={{ padding: '10px 18px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nova Guideline
            </button>
          </div>
        )}
      </div>

      {/* Filtro por categoria */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setFiltroCategoria('')}
          className={`text-xs font-semibold rounded-lg border transition-all ${!filtroCategoria ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
          style={{ padding: '5px 12px' }}>
          Todas
        </button>
        {CATEGORIAS.map(cat => (
          <button key={cat.value}
            onClick={() => setFiltroCategoria(filtroCategoria === cat.value ? '' : cat.value)}
            className={`text-xs font-semibold rounded-lg border transition-all ${filtroCategoria === cat.value ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
            style={{ padding: '5px 12px' }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {guidelines.length === 0 ? (
        <div className="text-center text-slate-400 text-sm" style={{ padding: '60px 0' }}>
          Nenhuma guideline encontrada
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {guidelines.map((g) => {
            const cat = catInfo(g.categoria);
            return (
              <div key={g.id} className="bg-white rounded-xl border border-slate-100 shadow-sm" style={{ padding: '16px 20px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
                      <span className={`text-xs font-semibold rounded-lg ${cat.color}`} style={{ padding: '2px 8px' }}>{cat.label}</span>
                      <span className="text-xs text-slate-400 font-medium">{g.fonte}{g.versao ? ` · ${g.versao}` : ''}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{g.titulo}</p>
                    <p className="text-xs text-slate-400 line-clamp-2" style={{ marginTop: '4px' }}>{g.conteudo.slice(0, 160)}...</p>
                  </div>
                  {podeGerir && (
                    <button onClick={() => remover(g.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors"
                      title="Remover guideline">
                      <svg className="w-4 h-4 text-slate-300 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Guideline */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '540px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Nova Guideline Clínica</h2>
              <button onClick={() => setModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título *</label>
              <input id="fpage-0" type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Protocolo de Sépsis - DGS 2024"
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                style={{ padding: '10px 14px' }} maxLength={200} />
            </div>

            <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Categoria *</label>
                <select id="fpage-1" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition"
                  style={{ padding: '10px 14px' }}>
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Fonte *</label>
                <input id="fpage-2" type="text" value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))}
                  placeholder="DGS 2024, NICE 2023..."
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition"
                  style={{ padding: '10px 14px' }} maxLength={100} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Versão (opcional)</label>
              <input id="fpage-3" type="text" value={form.versao} onChange={e => setForm(f => ({ ...f, versao: e.target.value }))}
                placeholder="Ex: 1.2, 2024-Q1"
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition"
                style={{ padding: '10px 14px' }} maxLength={50} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Conteúdo *</label>
              <textarea id="fpage-4" value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                rows={8} maxLength={3000}
                placeholder="Texto clínico relevante — máx. 2000 tokens (~3000 caracteres)..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition"
                style={{ padding: '10px 14px' }} />
              <p className="text-xs text-slate-400 text-right" style={{ marginTop: '4px' }}>{form.conteudo.length}/3000</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.fonte.trim() || !form.conteudo.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Criar Guideline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
