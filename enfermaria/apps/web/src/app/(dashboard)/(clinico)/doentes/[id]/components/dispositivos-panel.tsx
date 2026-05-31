'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';

interface Props {
  doenteId: string;
  utilizador: { role: string } | null;
}

function BtnAdd({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
      style={{ marginLeft: 'auto' }}>
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
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

const TIPOS_DISP: Record<string, string> = {
  cateter_venoso_central: 'CVC', cateter_venoso_periferico: 'CVP', cateter_arterial: 'Cateter Arterial',
  sonda_vesical: 'Sonda Vesical', tubo_orotaqueal: 'TOT', traqueostomia: 'Traqueostomia',
  dreno_toracico: 'Dreno Torácico', sonda_nasogastrica: 'SNG', linha_epidural: 'Linha Epidural', outro: 'Outro',
};
const COR_TIPO: Record<string, string> = {
  cateter_venoso_central: 'bg-blue-50 text-blue-700', cateter_venoso_periferico: 'bg-sky-50 text-sky-700',
  cateter_arterial: 'bg-red-50 text-red-700', sonda_vesical: 'bg-yellow-50 text-yellow-700',
  tubo_orotaqueal: 'bg-orange-50 text-orange-700', traqueostomia: 'bg-orange-50 text-orange-700',
  dreno_toracico: 'bg-purple-50 text-purple-700', sonda_nasogastrica: 'bg-teal-50 text-teal-700',
  linha_epidural: 'bg-green-50 text-green-700', outro: 'bg-slate-100 text-slate-600',
};

export function DispositivosPanel({ doenteId, utilizador }: Props) {
  const role = utilizador?.role ?? '';
  const visivel = ['enfermeiro', 'medico'].includes(role);
  const podeRegistar = ['enfermeiro', 'medico'].includes(role);
  const toast = useToast();

  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [modalDispositivo, setModalDispositivo] = useState(false);
  const [dispTipo, setDispTipo] = useState('cateter_venoso_central');
  const [dispLocalizacao, setDispLocalizacao] = useState('');
  const [dispObservacoes, setDispObservacoes] = useState('');
  const [salvandoDisp, setSalvandoDisp] = useState(false);
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  const carregar = useCallback(() => {
    api.get(`/dispositivos-invasivos/doente/${doenteId}`)
      .then(r => setDispositivos(r.data))
      .catch(() => setDispositivos([]));
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const submeterDispositivo = async () => {
    setSalvandoDisp(true);
    try {
      await api.post(`/dispositivos-invasivos/doente/${doenteId}`, {
        tipo: dispTipo, localizacao: dispLocalizacao || undefined, observacoes: dispObservacoes || undefined,
      });
      toast.success('Guardado com sucesso');
      setModalDispositivo(false);
      setDispLocalizacao(''); setDispObservacoes('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoDisp(false); }
  };

  const removerDispositivo = (dispId: string) => {
    setConfirmarAcao({
      titulo: 'Remover Dispositivo',
      mensagem: 'Confirmar remoção deste dispositivo invasivo? O registo ficará marcado como removido.',
      variant: 'warning',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.patch(`/dispositivos-invasivos/${dispId}/remover`);
          toast.success('Dispositivo removido');
          carregar();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  if (!visivel) return null;

  const ativos = dispositivos.filter((d: any) => d.ativo);
  const diasInsercao = (data: string) => Math.floor((Date.now() - new Date(data).getTime()) / 86400000);

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Dispositivos Invasivos</span>
          {ativos.length > 0 && (
            <span className="text-xs font-medium text-teal-600 bg-teal-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
            </span>
          )}
          {podeRegistar && (
            <BtnAdd label="Registar dispositivo invasivo" onClick={() => { setDispTipo('cateter_venoso_central'); setDispLocalizacao(''); setDispObservacoes(''); setModalDispositivo(true); }} />
          )}
        </div>
        {ativos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem dispositivos invasivos ativos</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ativos.map((d: any) => {
              const dias = diasInsercao(d.dataInsercao);
              return (
                <div key={d.id} className="flex items-center gap-3 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
                  <span className={`text-xs font-semibold badge-pad py-1 rounded-lg shrink-0 ${COR_TIPO[d.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                    {TIPOS_DISP[d.tipo] ?? d.tipo}
                  </span>
                  <div className="flex-1 min-w-0">
                    {d.localizacao && <p className="text-xs text-slate-600">{d.localizacao}</p>}
                    <p className="text-xs text-slate-400">
                      Inserido há {dias} dia{dias !== 1 ? 's' : ''} · {d.inseridoPor?.nome}
                    </p>
                    {dias >= 3 && (
                      <p className="text-xs text-amber-600 font-medium" style={{ marginTop: '2px' }}>⚠ Avaliar substituição</p>
                    )}
                  </div>
                  {podeRegistar && (
                    <button onClick={() => removerDispositivo(d.id)}
                      className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                      style={{ padding: '5px 10px' }}>Remover</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalDispositivo && (
        <Modal titulo="Registar Dispositivo Invasivo" onClose={() => setModalDispositivo(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="disp-tipo" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo *</label>
            <select id="disp-tipo" value={dispTipo} onChange={(e) => setDispTipo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {[
                ['cateter_venoso_central','Cateter Venoso Central (CVC)'],
                ['cateter_venoso_periferico','Cateter Venoso Periférico (CVP)'],
                ['cateter_arterial','Cateter Arterial'],
                ['sonda_vesical','Sonda Vesical'],
                ['tubo_orotaqueal','Tubo Orotaqueal (TOT)'],
                ['traqueostomia','Traqueostomia'],
                ['dreno_toracico','Dreno Torácico'],
                ['sonda_nasogastrica','Sonda Nasogástrica (SNG)'],
                ['linha_epidural','Linha Epidural'],
                ['outro','Outro'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="disp-localizacao" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Localização / Acesso</label>
            <input id="disp-localizacao" type="text" value={dispLocalizacao} onChange={(e) => setDispLocalizacao(e.target.value)}
              placeholder="Ex: Subclávia D, Femoral E, Dorso mão esq..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="disp-obs" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
            <textarea id="disp-obs" value={dispObservacoes} onChange={(e) => setDispObservacoes(e.target.value)}
              placeholder="Calibre, lúmen, intercorrências..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={2} />
          </div>
          <ModalFooter onCancel={() => setModalDispositivo(false)} onConfirm={submeterDispositivo}
            loading={salvandoDisp} disabled={salvandoDisp} labelConfirm="Registar Dispositivo" />
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => {})}
        onCancelar={() => setConfirmarAcao(null)}
      />
    </>
  );
}
