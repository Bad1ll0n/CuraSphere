'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { role: string } | null;
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement;
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    return () => previousFocus?.focus();
  }, []);
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         style={{ backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-titulo"
           className="bg-white rounded-2xl shadow-2xl w-full"
           style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-titulo" className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, labelConfirm }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean; disabled: boolean; labelConfirm: string;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        style={{ padding: '11px' }}>Cancelar</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        style={{ padding: '11px' }}>
        {loading ? 'A guardar...' : labelConfirm}
      </button>
    </div>
  );
}

const TIPO_COR: Record<string, string> = {
  principal: 'bg-red-50 text-red-700', comorbilidade: 'bg-blue-50 text-blue-700',
  cirurgico: 'bg-purple-50 text-purple-700', cronico: 'bg-amber-50 text-amber-700',
  agudo: 'bg-orange-50 text-orange-700',
};
const TIPO_LABEL: Record<string, string> = {
  principal: 'Principal', comorbilidade: 'Comorbilidade',
  cirurgico: 'Cirúrgico', cronico: 'Crónico', agudo: 'Agudo',
};

export function ProblemasPanel({ doenteId, utilizador }: Props) {
  const role = utilizador?.role ?? '';
  const visivel = ['medico', 'enfermeiro', 'auxiliar'].includes(role);
  const podeCriar = role === 'medico';
  const toast = useToast();

  const [problemas, setProblemas] = useState<any[]>([]);
  const [modalProblema, setModalProblema] = useState(false);
  const [probDescricao, setProbDescricao] = useState('');
  const [probTipo, setProbTipo] = useState('comorbilidade');
  const [probDataInicio, setProbDataInicio] = useState('');
  const [salvandoProb, setSalvandoProb] = useState(false);

  const carregar = useCallback(() => {
    api.get(`/doentes/${doenteId}/problemas`)
      .then(r => setProblemas(r.data ?? []))
      .catch(() => setProblemas([]));
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const submeterProblema = async () => {
    if (!probDescricao.trim()) return;
    setSalvandoProb(true);
    try {
      await api.post(`/doentes/${doenteId}/problemas`, {
        descricao: probDescricao, tipo: probTipo,
        dataInicio: probDataInicio || undefined,
      });
      toast.success('Guardado com sucesso');
      setModalProblema(false);
      setProbDescricao(''); setProbTipo('comorbilidade'); setProbDataInicio('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoProb(false); }
  };

  const resolverProblema = async (probId: string) => {
    try {
      await api.patch(`/doentes/${doenteId}/problemas/${probId}`, { estado: 'resolvido', dataFim: new Date().toISOString().split('T')[0] });
      toast.success('Guardado com sucesso');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
  };

  if (!visivel) return null;

  const ativos = problemas.filter((p: any) => p.estado === 'ativo');
  const cronicos = problemas.filter((p: any) => p.estado === 'cronico');
  const resolvidos = problemas.filter((p: any) => p.estado === 'resolvido');

  return (
    <>
      <div className="rounded-2xl shadow-sm border" style={{ padding: '20px 24px', background: 'var(--bg-card)', borderColor: 'var(--border)', marginBottom: '20px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: ativos.length + cronicos.length + resolvidos.length === 0 ? 0 : '14px' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Lista de Problemas</span>
            {ativos.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 rounded-full badge-pad py-0.5 font-medium">{ativos.length} ativo(s)</span>
            )}
          </div>
          {podeCriar && (
            <button onClick={() => setModalProblema(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3 py-1.5 font-medium transition-colors">
              + Adicionar
            </button>
          )}
        </div>

        {problemas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '12px 0' }}>Sem problemas registados</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...ativos, ...cronicos].map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg" style={{ padding: '8px 12px', background: 'var(--bg-page)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs rounded-full badge-pad py-0.5 font-medium shrink-0 ${TIPO_COR[p.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                    {TIPO_LABEL[p.tipo] ?? p.tipo}
                  </span>
                  <span className="text-sm text-slate-700 truncate">{p.descricao}</span>
                  {p.dataInicio && <span className="text-xs text-slate-400 shrink-0">{new Date(p.dataInicio).toLocaleDateString('pt-PT')}</span>}
                </div>
                {podeCriar && (
                  <button onClick={() => resolverProblema(p.id)}
                    className="text-xs text-slate-400 hover:text-emerald-600 shrink-0 ml-2 transition-colors">
                    ✓ Resolver
                  </button>
                )}
              </div>
            ))}
            {resolvidos.length > 0 && (
              <details className="text-xs text-slate-400" style={{ marginTop: 4 }}>
                <summary className="cursor-pointer hover:text-slate-600">{resolvidos.length} problema(s) resolvido(s)</summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {resolvidos.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg" style={{ padding: '6px 10px', background: '#f1f5f9', opacity: 0.6 }}>
                      <span className="line-through text-xs text-slate-400">{p.descricao}</span>
                      {p.dataFim && <span className="text-xs text-slate-300">{new Date(p.dataFim).toLocaleDateString('pt-PT')}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {modalProblema && (
        <Modal titulo="Adicionar Problema Clínico" onClose={() => setModalProblema(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="fproblema-0" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Descrição *</label>
              <input id="fproblema-0" value={probDescricao} onChange={e => setProbDescricao(e.target.value)} autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Ex: Diabetes mellitus tipo 2, HTA, IRC grau 3..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="fproblema-1" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Tipo</label>
                <select id="fproblema-1" value={probTipo} onChange={e => setProbTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="comorbilidade">Comorbilidade</option>
                  <option value="principal">Principal</option>
                  <option value="agudo">Agudo</option>
                  <option value="cirurgico">Cirúrgico</option>
                  <option value="cronico">Crónico</option>
                </select>
              </div>
              <div>
                <label htmlFor="fproblema-2" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Data Início</label>
                <input id="fproblema-2" type="date" value={probDataInicio} onChange={e => setProbDataInicio(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <ModalFooter
              onCancel={() => setModalProblema(false)}
              onConfirm={submeterProblema}
              loading={salvandoProb}
              disabled={salvandoProb || !probDescricao.trim()}
              labelConfirm="Adicionar Problema"
            />
          </div>
        </Modal>
      )}
    </>
  );
}
