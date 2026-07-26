'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { DicomViewer } from '@/components/dicom-viewer';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface Documento {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  dataDocumento: string;
  origem: string;
  formato: string;
  mimeType: string;
  tamanhoBytes?: number;
  modalidadeDicom?: string;
  verificado: boolean;
  fhirResourceId?: string;
  storageKey?: string;
  urlExterna?: string;
  assinadoEm?: string | null;
  assinadoPor?: { id: string; nome: string } | null;
  sistemaOrigem?: { nome: string; tipo: string } | null;
  registadoPor?: { nome: string } | null;
}

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'radiologia', label: 'Radiologia', tipos: ['rx', 'tc', 'rmn', 'eco', 'ecg'] },
  { key: 'lab', label: 'Laboratório', tipos: ['lab'] },
  { key: 'relatorios', label: 'Relatórios', tipos: ['alta', 'patologia'] },
  { key: 'outros', label: 'Outros', tipos: ['prescricao', 'vacinacao', 'outro'] },
];

const TIPO_ICONS: Record<string, string> = {
  rx: '🦴', tc: '🧠', rmn: '🧲', eco: '🫀', ecg: '📈',
  lab: '🧪', alta: '📋', prescricao: '💊', vacinacao: '💉',
  patologia: '🔬', outro: '📄',
};

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function DocumentosSaudePanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const role = utilizador?.role ?? '';
  const podeUpload = ['medico', 'enfermeiro', 'tecnico_saude'].includes(role);
  const podeSincronizar = ['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(role);
  const podeApagar = ['medico', 'chefe_enfermeiros', 'it_admin'].includes(role);
  const podeAssinar = ['medico', 'chefe_enfermeiros', 'direcao'].includes(role);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tabAtiva, setTabAtiva] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [docAberto, setDocAberto] = useState<{ url: string; titulo: string; mimeType: string } | null>(null);
  const [dicomViewer, setDicomViewer] = useState<{ url: string; titulo: string } | null>(null);
  const [modalUpload, setModalUpload] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    tipo: 'outro', titulo: '', dataDocumento: new Date().toISOString().slice(0, 10), origem: 'Upload manual',
  });
  const [fileSeleccionado, setFileSeleccionado] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    api.get(`/documentos-saude/doente/${doenteId}`)
      .then(r => setDocumentos(r.data))
      .catch(() => setDocumentos([]));
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const tabInfo = TABS.find(t => t.key === tabAtiva);
  const docsVisiveis = tabInfo?.tipos
    ? documentos.filter(d => tabInfo.tipos!.includes(d.tipo))
    : documentos;

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await api.post(`/documentos-saude/doente/${doenteId}/sincronizar`);
      toast.success(r.data.mensagem ?? 'Sincronização concluída');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao sincronizar');
    } finally { setSincronizando(false); }
  };

  const abrirDocumento = async (doc: Documento) => {
    try {
      const r = await api.get(`/documentos-saude/${doc.id}/download`);
      if (isDicomSimples(doc)) {
        setDicomViewer({ url: r.data.url, titulo: r.data.titulo });
      } else {
        setDocAberto({ url: r.data.url, titulo: r.data.titulo, mimeType: r.data.mimeType });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao abrir documento');
    }
  };

  const apagarDocumento = async (docId: string) => {
    if (!confirm('Apagar este documento permanentemente?')) return;
    try {
      await api.delete(`/documentos-saude/${docId}`);
      toast.success('Documento apagado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao apagar');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFileSeleccionado(f); setUploadForm(prev => ({ ...prev, titulo: f.name.replace(/\.[^.]+$/, '') })); }
  };

  const submeterUpload = async () => {
    if (!fileSeleccionado) { toast.error('Selecciona um ficheiro'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', fileSeleccionado);
      fd.append('tipo', uploadForm.tipo);
      fd.append('titulo', uploadForm.titulo);
      fd.append('dataDocumento', uploadForm.dataDocumento);
      fd.append('origem', uploadForm.origem);
      await api.post(`/documentos-saude/doente/${doenteId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Documento carregado');
      setModalUpload(false);
      setFileSeleccionado(null);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao carregar');
    } finally { setEnviando(false); }
  };

  const assinarDocumento = async (docId: string) => {
    if (!confirm('Assinar digitalmente este documento? Esta acção não pode ser revertida.')) return;
    try {
      await api.post(`/documentos-saude/${docId}/assinar`);
      toast.success('Documento assinado com sucesso');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao assinar documento');
    }
  };

  const isExternalOrigin = (doc: Documento) => !!doc.fhirResourceId || !!doc.sistemaOrigem;
  const isDicomSimples = (doc: Documento) => doc.formato === 'dicom' && ['CR', 'DX'].includes(doc.modalidadeDicom ?? '');
  const isDicomComplexo = (doc: Documento) => doc.formato === 'dicom' && !['CR', 'DX'].includes(doc.modalidadeDicom ?? '');

  return (
    <>
      {dicomViewer && (
        <DicomViewer
          url={dicomViewer.url}
          titulo={dicomViewer.titulo}
          onClose={() => setDicomViewer(null)}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        {/* Header */}
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Dossier de Saúde</span>
          {documentos.length > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {documentos.length}
            </span>
          )}
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            {podeSincronizar && (
              <button
                onClick={sincronizar}
                disabled={sincronizando}
                title="Sincronizar com sistemas externos"
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors disabled:opacity-50"
                style={{ padding: '5px 10px' }}
              >
                <svg className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {sincronizando ? 'A sincronizar...' : 'Sincronizar'}
              </button>
            )}
            {podeUpload && (
              <button
                onClick={() => setModalUpload(true)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                title="Carregar documento"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto" style={{ marginBottom: '16px' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTabAtiva(t.key)}
              className={`text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors ${
                tabAtiva === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
              {t.tipos && (
                <span className="ml-1 opacity-70">
                  ({documentos.filter(d => t.tipos!.includes(d.tipo)).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {docsVisiveis.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>
            {podeUpload ? 'Sem documentos — sincroniza ou carrega em +' : 'Sem documentos de saúde registados'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {docsVisiveis.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 transition-colors"
                style={{ padding: '12px 14px' }}
              >
                <span className="text-xl shrink-0" title={doc.tipo}>{TIPO_ICONS[doc.tipo] ?? '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700 truncate">{doc.titulo}</p>
                    {isExternalOrigin(doc) ? (
                      <span className="shrink-0 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                        {doc.sistemaOrigem?.nome ?? 'Externo'}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Upload</span>
                    )}
                    {doc.modalidadeDicom && (
                      <span className="shrink-0 text-xs font-mono text-purple-600 bg-purple-50 rounded px-1.5 py-0.5">{doc.modalidadeDicom}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                    {new Date(doc.dataDocumento).toLocaleDateString('pt-PT')}
                    {doc.tamanhoBytes ? ` · ${formatBytes(doc.tamanhoBytes)}` : ''}
                    {doc.origem ? ` · ${doc.origem}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isDicomComplexo(doc) && doc.urlExterna ? (
                    <button
                      onClick={() => window.open(doc.urlExterna, '_blank')}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 border border-purple-200 rounded-lg transition-colors"
                      style={{ padding: '4px 10px' }}
                    >
                      Abrir Viewer
                    </button>
                  ) : (
                    <button
                      onClick={() => abrirDocumento(doc)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg transition-colors"
                      style={{ padding: '4px 10px' }}
                    >
                      Ver
                    </button>
                  )}
                  {podeAssinar && !doc.assinadoEm && (
                    <button
                      onClick={() => assinarDocumento(doc.id)}
                      title="Assinar digitalmente"
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                      style={{ padding: '4px 10px' }}
                    >
                      ✍️ Assinar
                    </button>
                  )}
                  {doc.assinadoEm && (
                    <span
                      title={`Assinado por ${doc.assinadoPor?.nome ?? '—'} em ${new Date(doc.assinadoEm).toLocaleDateString('pt-PT')}`}
                      className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg cursor-default"
                      style={{ padding: '4px 8px' }}
                    >
                      ✓ Assinado
                    </span>
                  )}
                  {podeApagar && (
                    <button
                      onClick={() => apagarDocumento(doc.id)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      style={{ padding: '4px 8px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Visualizador de Documento */}
      {docAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '90vw', height: '90vh', maxWidth: '1200px' }}>
            <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <span className="text-sm font-semibold text-slate-700 truncate">{docAberto.titulo}</span>
              <button
                onClick={() => setDocAberto(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden" style={{ padding: '8px' }}>
              {docAberto.mimeType === 'application/pdf' ? (
                <iframe
                  src={docAberto.url}
                  className="w-full h-full rounded-xl border border-slate-100"
                  title={docAberto.titulo}
                />
              ) : docAberto.mimeType.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl">
                  <img
                    src={docAberto.url}
                    alt={docAberto.titulo}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-xl">
                  <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-slate-500">Pré-visualização não disponível para este tipo de ficheiro.</p>
                  <a
                    href={docAberto.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl transition-colors"
                    style={{ padding: '10px 20px' }}
                  >
                    Descarregar ficheiro
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload */}
      {modalUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Carregar Documento</h2>
              <button onClick={() => { setModalUpload(false); setFileSeleccionado(null); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Drag and drop */}
            <div
              ref={dragRef}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              style={{ padding: '32px', marginBottom: '20px' }}
            >
              {fileSeleccionado ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">{fileSeleccionado.name}</p>
                  <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{formatBytes(fileSeleccionado.size)}</p>
                </div>
              ) : (
                <>
                  <svg className="w-8 h-8 text-slate-300" style={{ marginBottom: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-500">Arrasta ou clica para seleccionar</p>
                  <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>PDF, JPEG, PNG, DICOM — até 50 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.dcm,application/dicom,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setFileSeleccionado(f); setUploadForm(prev => ({ ...prev, titulo: f.name.replace(/\.[^.]+$/, '') })); }
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fdocument-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título</label>
              <input id="fdocument-0"
                value={uploadForm.titulo}
                onChange={e => setUploadForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '10px 12px' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fdocument-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                <select id="fdocument-1" value={uploadForm.tipo} onChange={e => setUploadForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ padding: '10px 12px' }}>
                  <option value="rx">RX</option>
                  <option value="tc">TC</option>
                  <option value="rmn">RMN</option>
                  <option value="eco">Ecografia</option>
                  <option value="ecg">ECG</option>
                  <option value="lab">Lab</option>
                  <option value="alta">Alta</option>
                  <option value="prescricao">Prescrição</option>
                  <option value="vacinacao">Vacinação</option>
                  <option value="patologia">Patologia</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label htmlFor="fdocument-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data</label>
                <input id="fdocument-2"
                  type="date"
                  value={uploadForm.dataDocumento}
                  onChange={e => setUploadForm(f => ({ ...f, dataDocumento: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ padding: '10px 12px' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fdocument-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Origem</label>
              <input id="fdocument-3"
                value={uploadForm.origem}
                onChange={e => setUploadForm(f => ({ ...f, origem: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '10px 12px' }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalUpload(false); setFileSeleccionado(null); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterUpload}
                disabled={enviando || !fileSeleccionado || !uploadForm.titulo.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {enviando ? 'A carregar...' : 'Carregar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
