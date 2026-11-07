'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

/**
 * PROD-02 / PROD-03 — internamentos do doente: o episódio em curso (serviço, cama, origem),
 * a transferência interna de cama/serviço, as alergias de internamentos anteriores por rever
 * e o histórico de episódios com os movimentos.
 */
interface Movimento { id: string; tipo: string; deServico?: string | null; paraServico?: string | null; motivo: string; em: string }
interface Episodio {
  id: string; numero: number; origem: string; estado: string; servico?: string | null;
  diagnosticoPrincipal?: string | null; dataAdmissao: string; dataAlta?: string | null;
  motivoAlta?: string | null; destinoAlta?: string | null; alergiasRevistasEm?: string | null;
  movimentos: Movimento[];
}
interface CamaLivre { id: string; numero: string; quarto: string; servico?: string | null; sexo?: string | null; isolamento?: boolean; estado: string }

const ORIGEM: Record<string, string> = {
  admissao: 'Admissão', registo: 'Registo administrativo', urgencia: 'Urgência', reinternamento: 'Reinternamento',
  pedido_cama: 'Pedido de cama', migracao: 'Registo anterior',
};
const data = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-PT') : '—');
const diasEntre = (a: string, b?: string | null) => Math.max(0, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86_400_000));

export function InternamentosPanel({ doenteId, utilizador, onAlterado }: {
  doenteId: string; utilizador: { role: string } | null; onAlterado: () => void;
}) {
  const toast = useToast();
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [aTransferir, setATransferir] = useState(false);
  const [camasLivres, setCamasLivres] = useState<CamaLivre[]>([]);
  const [camaId, setCamaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [justificacao, setJustificacao] = useState('');
  const [pedeJustificacao, setPedeJustificacao] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = useCallback(() => {
    api.get(`/doentes/${doenteId}/episodios`).then((r) => setEpisodios(r.data ?? [])).catch(() => setEpisodios([]));
  }, [doenteId]);
  useEffect(() => { carregar(); }, [carregar]);

  const papel = utilizador?.role ?? '';
  const podeTransferir = ['medico', 'enfermeiro', 'administrativo'].includes(papel);
  const podeRever = ['medico', 'enfermeiro'].includes(papel);
  const ativo = episodios.find((e) => e.estado === 'ativo');
  const anteriores = episodios.filter((e) => e.estado !== 'ativo');
  const alergiasPorRever = ativo && !ativo.alergiasRevistasEm;

  const abrirTransferencia = () => {
    setATransferir(true); setCamaId(''); setMotivo(''); setJustificacao(''); setPedeJustificacao(false);
    api.get('/camas').then((r) => setCamasLivres((r.data as CamaLivre[]).filter((c) => c.estado === 'livre'))).catch(() => setCamasLivres([]));
  };

  const transferir = async () => {
    setAGuardar(true);
    try {
      await api.post(`/doentes/${doenteId}/transferir`, { camaId, motivo: motivo.trim(), justificacaoCama: justificacao.trim() || undefined });
      toast.success('Transferência registada');
      setATransferir(false);
      carregar(); onAlterado();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao transferir';
      if (e?.response?.status === 409 && /CAMA_INCOMPATIVEL/.test(msg)) setPedeJustificacao(true);
      toast.error(msg);
    } finally { setAGuardar(false); }
  };

  const marcarAlergiasRevistas = async () => {
    try {
      await api.post(`/doentes/${doenteId}/episodio/alergias-revistas`, {});
      toast.success('Alergias revistas neste internamento');
      carregar();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao guardar'); }
  };

  if (!episodios.length) return null;

  return (
    <section aria-labelledby="internamentos-titulo" className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
        <h2 id="internamentos-titulo" className="text-sm font-semibold text-slate-700">Internamentos</h2>
        <span className="text-xs text-slate-500">{episodios.length} {episodios.length === 1 ? 'episódio' : 'episódios'}</span>
        {ativo && podeTransferir && !aTransferir && (
          <button onClick={abrirTransferencia} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
            style={{ marginLeft: 'auto', padding: '6px 12px' }}>
            Transferir cama/serviço
          </button>
        )}
      </div>

      {alergiasPorRever && (
        <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 flex-wrap" style={{ padding: '12px 14px', marginBottom: '14px' }}>
          <p className="text-sm text-amber-800 flex-1">
            <strong>Reinternamento:</strong> as alergias vêm do internamento anterior. Confirme-as com o doente/família.
          </p>
          {podeRever && (
            <button onClick={marcarAlergiasRevistas} className="text-xs font-semibold bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100" style={{ padding: '6px 12px' }}>
              Alergias revistas
            </button>
          )}
        </div>
      )}

      {ativo && (
        <div className="rounded-xl bg-slate-50" style={{ padding: '12px 14px', marginBottom: '12px' }}>
          <p className="text-sm font-semibold text-slate-800">
            Episódio n.º {ativo.numero} — em curso{ativo.servico ? ` · ${ativo.servico}` : ''}
          </p>
          <p className="text-xs text-slate-500">
            {ORIGEM[ativo.origem] ?? ativo.origem} em {data(ativo.dataAdmissao)} · {diasEntre(ativo.dataAdmissao)} dias
            {ativo.diagnosticoPrincipal && ` · ${ativo.diagnosticoPrincipal}`}
          </p>
          {ativo.movimentos.length > 0 && (
            <ul className="text-xs text-slate-600" style={{ marginTop: '6px' }}>
              {ativo.movimentos.map((m) => (
                <li key={m.id}>
                  {new Date(m.em).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} —{' '}
                  {m.tipo === 'servico' ? `${m.deServico ?? '?'} → ${m.paraServico ?? '?'}` : 'mudança de cama'}: {m.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aTransferir && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40" style={{ padding: '14px', marginBottom: '12px' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="transf-cama" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Cama de destino</label>
              <select id="transf-cama" value={camaId} onChange={(e) => { setCamaId(e.target.value); setPedeJustificacao(false); }}
                className="w-full border border-slate-200 rounded-lg text-sm bg-white" style={{ padding: '8px 10px' }}>
                <option value="">Escolher cama livre…</option>
                {camasLivres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.quarto}/{c.numero}{c.servico ? ` · ${c.servico}` : ''}{c.sexo ? ` · ${c.sexo === 'feminino' ? 'F' : 'M'}` : ''}{c.isolamento ? ' · isolamento' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="transf-motivo" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Motivo</label>
              <input id="transf-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
                placeholder="Ex.: agravamento, isolamento, pedido do serviço" className="w-full border border-slate-200 rounded-lg text-sm bg-white" style={{ padding: '8px 10px' }} />
            </div>
          </div>
          {pedeJustificacao && (
            <div style={{ marginTop: '10px' }}>
              <label htmlFor="transf-just" className="block text-xs font-semibold text-amber-700" style={{ marginBottom: '4px' }}>Justificação da excepção de cama</label>
              <input id="transf-just" value={justificacao} onChange={(e) => setJustificacao(e.target.value)} maxLength={500}
                className="w-full border border-amber-300 rounded-lg text-sm bg-amber-50" style={{ padding: '8px 10px' }} />
            </div>
          )}
          <div className="flex gap-2 justify-end" style={{ marginTop: '12px' }}>
            <button onClick={() => setATransferir(false)} className="text-xs font-semibold text-slate-600 border border-slate-200 bg-white rounded-lg" style={{ padding: '7px 14px' }}>Cancelar</button>
            <button onClick={transferir}
              disabled={aGuardar || !camaId || motivo.trim().length < 5 || (pedeJustificacao && justificacao.trim().length < 10)}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '7px 14px' }}>
              {aGuardar ? 'A transferir...' : 'Transferir'}
            </button>
          </div>
        </div>
      )}

      {anteriores.length > 0 && (
        <details>
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Internamentos anteriores ({anteriores.length})</summary>
          <ul className="flex flex-col gap-1" style={{ marginTop: '8px' }}>
            {anteriores.map((e) => (
              <li key={e.id} className="text-xs text-slate-600">
                N.º {e.numero}: {data(e.dataAdmissao)} – {data(e.dataAlta)} ({diasEntre(e.dataAdmissao, e.dataAlta)} dias)
                {e.servico && ` · ${e.servico}`}{e.diagnosticoPrincipal && ` · ${e.diagnosticoPrincipal}`}
                {e.motivoAlta && ` · alta: ${e.motivoAlta}`}{e.destinoAlta && ` → ${e.destinoAlta}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
