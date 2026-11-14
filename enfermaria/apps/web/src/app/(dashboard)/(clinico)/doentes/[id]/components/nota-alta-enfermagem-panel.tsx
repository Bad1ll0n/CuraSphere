'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

/**
 * PROD-12 — nota de alta de enfermagem (continuidade de cuidados para os CSP/RNCCI):
 * autonomia, necessidades, ensinos, dispositivos, feridas, cuidador e referenciação.
 * Pré-preenchida a partir do registo (dispositivos activos, feridas, Barthel, alergias).
 */
type Campos = { autonomia: string; necessidades: string; ensinos: string; dispositivos: string; feridas: string; cuidador: string; referenciacao: string; observacoes: string };
const VAZIO: Campos = { autonomia: '', necessidades: '', ensinos: '', dispositivos: '', feridas: '', cuidador: '', referenciacao: 'nenhuma', observacoes: '' };
const CAMPOS: { k: keyof Campos; label: string; linhas: number }[] = [
  { k: 'autonomia', label: 'Autonomia / autocuidado', linhas: 2 },
  { k: 'necessidades', label: 'Necessidades de cuidados após a alta', linhas: 2 },
  { k: 'ensinos', label: 'Ensinos ao doente e ao cuidador', linhas: 2 },
  { k: 'dispositivos', label: 'Dispositivos (tipo, local, data de inserção/troca)', linhas: 2 },
  { k: 'feridas', label: 'Feridas e tratamento', linhas: 2 },
  { k: 'observacoes', label: 'Observações', linhas: 2 },
];

export function NotaAltaEnfermagemPanel({ doenteId, utilizador }: { doenteId: string; utilizador: { role: string } | null }) {
  const toast = useToast();
  const [carregado, setCarregado] = useState(false);
  const [existe, setExiste] = useState(false);
  const [semInternamento, setSemInternamento] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const podeEditar = utilizador?.role === 'enfermeiro';

  const carregar = useCallback(() => {
    api.get(`/doentes/${doenteId}/nota-alta-enfermagem`).then((r) => {
      const { nota, sugestao, episodioId } = r.data ?? {};
      setSemInternamento(!episodioId);
      setExiste(!!nota);
      const base = nota ?? sugestao ?? {};
      setCampos({ ...VAZIO, ...Object.fromEntries(Object.entries(base).filter(([k, v]) => k in VAZIO && v != null)) } as Campos);
      setCarregado(true);
    }).catch(() => setCarregado(false));
  }, [doenteId]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!carregado || semInternamento) return null;

  const guardar = async () => {
    setAGuardar(true);
    try {
      await api.put(`/doentes/${doenteId}/nota-alta-enfermagem`, Object.fromEntries(
        Object.entries(campos).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]),
      ));
      toast.success('Nota de alta de enfermagem guardada');
      setAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setAGuardar(false); }
  };

  return (
    <section aria-labelledby="nota-alta-enf-titulo" className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
      <div className="flex items-center gap-2">
        <h2 id="nota-alta-enf-titulo" className="text-sm font-semibold text-slate-700">Nota de alta de enfermagem</h2>
        <span className={`text-xs font-semibold rounded-full badge-pad py-0.5 ${existe ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
          {existe ? 'Registada' : 'Por registar'}
        </span>
        <button onClick={() => setAberto((x) => !x)} className="text-xs font-semibold text-blue-700 hover:underline" style={{ marginLeft: 'auto' }}>
          {aberto ? 'Fechar' : existe ? 'Ver / editar' : podeEditar ? 'Preencher' : 'Ver'}
        </button>
      </div>
      {aberto && (
        <div style={{ marginTop: '14px' }}>
          {!existe && <p className="text-xs text-slate-500" style={{ marginBottom: '10px' }}>Pré-preenchida a partir do registo — reveja antes de guardar.</p>}
          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map(({ k, label, linhas }) => (
              <div key={k}>
                <label htmlFor={`nae-${k}`} className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{label}</label>
                <textarea id={`nae-${k}`} rows={linhas} value={campos[k]} disabled={!podeEditar} maxLength={4000}
                  onChange={(e) => setCampos((c) => ({ ...c, [k]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg text-sm disabled:bg-slate-50" style={{ padding: '8px 10px' }} />
              </div>
            ))}
            <div>
              <label htmlFor="nae-cuidador" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Cuidador de referência</label>
              <input id="nae-cuidador" value={campos.cuidador} disabled={!podeEditar} maxLength={300}
                onChange={(e) => setCampos((c) => ({ ...c, cuidador: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg text-sm disabled:bg-slate-50" style={{ padding: '8px 10px' }} />
            </div>
            <div>
              <label htmlFor="nae-ref" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Referenciação</label>
              <select id="nae-ref" value={campos.referenciacao} disabled={!podeEditar}
                onChange={(e) => setCampos((c) => ({ ...c, referenciacao: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50" style={{ padding: '8px 10px' }}>
                <option value="nenhuma">Nenhuma</option>
                <option value="csp">Cuidados de saúde primários (USF/UCC)</option>
                <option value="rncci">RNCCI</option>
                <option value="outra">Outra</option>
              </select>
            </div>
          </div>
          {podeEditar && (
            <div className="flex justify-end" style={{ marginTop: '12px' }}>
              <button onClick={guardar} disabled={aGuardar}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '8px 16px' }}>
                {aGuardar ? 'A guardar...' : 'Guardar nota'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
