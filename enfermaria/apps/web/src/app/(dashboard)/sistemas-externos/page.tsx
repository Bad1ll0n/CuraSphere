'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Breadcrumb } from '@/components/breadcrumb';

interface Sistema {
  id: string;
  nome: string;
  tipo: string;
  endpoint?: string;
  authTipo: string;
  ativo: boolean;
  ultimaSincronizacao?: string;
}

const TIPO_LABELS: Record<string, string> = {
  fhir_r4: 'FHIR R4',
  dicom_wado: 'DICOM WADO-RS',
  hl7_v2: 'HL7 v2',
  upload_manual: 'Upload Manual',
};

const DEFAULT_FORM = { nome: '', tipo: 'fhir_r4', endpoint: '', authTipo: 'api_key', authConfig: '', ativo: true };

export default function SistemasExternosPage() {
  const toast = useToast();
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [modal, setModal] = useState<Sistema | 'novo' | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<Record<string, { sucesso: boolean; latenciaMs?: number; erro?: string }>>({});

  const carregar = () =>
    api.get('/sistemas-externos').then(r => setSistemas(r.data)).catch(() => { /* vazio */ });

  useEffect(() => { carregar(); }, []);

  const abrirCriar = () => { setForm(DEFAULT_FORM); setModal('novo'); };
  const abrirEditar = (s: Sistema) => {
    setForm({ nome: s.nome, tipo: s.tipo, endpoint: s.endpoint ?? '', authTipo: s.authTipo, authConfig: '', ativo: s.ativo });
    setModal(s);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = { ...form, endpoint: form.endpoint || undefined, authConfig: form.authConfig || undefined };
      if (modal === 'novo') {
        await api.post('/sistemas-externos', payload);
        toast.success('Sistema criado');
      } else if (modal) {
        await api.patch(`/sistemas-externos/${(modal as Sistema).id}`, payload);
        toast.success('Sistema actualizado');
      }
      setModal(null);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este conector permanentemente?')) return;
    try {
      await api.delete(`/sistemas-externos/${id}`);
      toast.success('Conector removido');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  const testar = async (id: string) => {
    setTestando(id);
    try {
      const r = await api.post(`/sistemas-externos/${id}/testar`);
      setResultadoTeste(prev => ({ ...prev, [id]: r.data }));
    } catch (e: any) {
      setResultadoTeste(prev => ({ ...prev, [id]: { sucesso: false, erro: e?.response?.data?.message ?? 'Erro' } }));
    } finally { setTestando(null); }
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[{ label: 'Gestão' }, { label: 'Conectores Externos' }]} />
      </div>
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conectores Externos</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Sistemas de saúde externos — FHIR R4, PACS, HL7</p>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Conector
        </button>
      </div>

      {sistemas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '60px 32px' }}>
          <svg className="w-12 h-12 text-slate-200 mx-auto" style={{ marginBottom: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-500 text-sm">Sem conectores externos configurados</p>
          <p className="text-slate-400 text-xs" style={{ marginTop: '4px' }}>Adiciona um sistema para integrar documentos FHIR ou DICOM</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sistemas.map(s => {
            const teste = resultadoTeste[s.id];
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${s.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                          {TIPO_LABELS[s.tipo] ?? s.tipo}
                        </span>
                        {!s.ativo && <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Inactivo</span>}
                      </div>
                      {s.endpoint && (
                        <p className="text-xs text-slate-400 font-mono" style={{ marginTop: '4px' }}>{s.endpoint}</p>
                      )}
                      {s.ultimaSincronizacao && (
                        <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                          Última sync: {new Date(s.ultimaSincronizacao).toLocaleString('pt-PT')}
                        </p>
                      )}
                      {teste && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium mt-2 ${teste.sucesso ? 'text-emerald-600' : 'text-red-500'}`}>
                          <span>{teste.sucesso ? '✓' : '✕'}</span>
                          {teste.sucesso ? `Online · ${teste.latenciaMs}ms` : teste.erro}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.endpoint && (
                      <button
                        onClick={() => testar(s.id)}
                        disabled={testando === s.id}
                        className="text-xs text-slate-500 hover:text-emerald-600 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
                        style={{ padding: '5px 10px' }}
                      >
                        {testando === s.id ? 'A testar...' : 'Testar Ligação'}
                      </button>
                    )}
                    <button
                      onClick={() => abrirEditar(s)}
                      className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 rounded-lg transition-colors"
                      style={{ padding: '5px 10px' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remover(s.id)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      style={{ padding: '5px 8px' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">{modal === 'novo' ? 'Novo Conector' : 'Editar Conector'}</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {[
              { key: 'nome', label: 'Nome', placeholder: 'Ex: Hospital Santa Maria' },
              { key: 'endpoint', label: 'Endpoint (URL)', placeholder: 'https://fhir.hospital.pt/api/v1' },
              { key: 'authConfig', label: 'Credenciais (JSON)', placeholder: '{"token": "Bearer xyz"}' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</span>
                <input aria-label={label}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ padding: '10px 12px' }}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                <select id="fpage-1" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ padding: '10px 12px' }}>
                  <option value="fhir_r4">FHIR R4</option>
                  <option value="dicom_wado">DICOM WADO-RS</option>
                  <option value="hl7_v2">HL7 v2</option>
                  <option value="upload_manual">Upload Manual</option>
                </select>
              </div>
              <div>
                <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Autenticação</label>
                <select id="fpage-2" value={form.authTipo} onChange={e => setForm(f => ({ ...f, authTipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ padding: '10px 12px' }}>
                  <option value="api_key">API Key</option>
                  <option value="oauth2">OAuth2</option>
                  <option value="none">Sem Auth</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
              <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4 rounded" />
              <label htmlFor="ativo" className="text-sm text-slate-600">Sistema activo</label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()}
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
