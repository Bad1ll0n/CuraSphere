'use client';

/**
 * PROD-12 — requisitos da alta e reconciliação terapêutica de saída, por linha.
 * Cada prescrição activa recebe uma decisão (manter, alterar, suspender); podem juntar-se
 * medicamentos novos. A prescrição de saída é gerada no servidor a partir destas linhas.
 */
export interface RequisitosAlta {
  exigidos: string[];
  prescricoesAtivas: { id: string; nome: string; dose?: string | null; via?: string | null; frequencia?: string | null }[];
  notaEnfermagem: { id: string; atualizadaEm: string } | null;
  plano: { cumpridos: number; total: number };
}
export interface Decisao { decisao: string; dose?: string; notas?: string }
export interface Nova { nome: string; dose: string; via: string; frequencia: string }

const ROTULO_REQ: Record<string, string> = { reconciliacao: 'Reconciliação terapêutica', nota_enfermagem: 'Nota de alta de enfermagem', plano: 'Plano de alta completo' };

export function ReconciliacaoAlta({ requisitos, decisoes, setDecisoes, novas, setNovas }: {
  requisitos: RequisitosAlta;
  decisoes: Record<string, Decisao>;
  setDecisoes: (f: (d: Record<string, Decisao>) => Record<string, Decisao>) => void;
  novas: Nova[];
  setNovas: (f: (n: Nova[]) => Nova[]) => void;
}) {
  const estado = (r: string) =>
    r === 'reconciliacao' ? requisitos.prescricoesAtivas.every((p) => decisoes[p.id]?.decisao)
      : r === 'nota_enfermagem' ? !!requisitos.notaEnfermagem
        : requisitos.plano.cumpridos === requisitos.plano.total;
  const input = 'border border-slate-200 rounded-lg text-xs bg-white';

  return (
    <div style={{ marginBottom: '20px' }}>
      {requisitos.exigidos.length > 0 && (
        <ul className="flex flex-wrap gap-2" style={{ marginBottom: '12px' }} aria-label="Requisitos da alta">
          {requisitos.exigidos.map((r) => (
            <li key={r} className={`text-xs font-semibold rounded-full badge-pad py-1 ${estado(r) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
              {estado(r) ? '✓' : '•'} {ROTULO_REQ[r] ?? r}
              {r === 'plano' && ` (${requisitos.plano.cumpridos}/${requisitos.plano.total})`}
            </li>
          ))}
        </ul>
      )}

      <span className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Reconciliação terapêutica de saída</span>
      {requisitos.prescricoesAtivas.length === 0 ? (
        <p className="text-xs text-slate-500" style={{ marginBottom: '8px' }}>Sem prescrições activas.</p>
      ) : (
        <ul className="flex flex-col gap-2" style={{ marginBottom: '8px' }}>
          {requisitos.prescricoesAtivas.map((p) => {
            const d = decisoes[p.id];
            return (
              <li key={p.id} className="rounded-lg bg-slate-50" style={{ padding: '8px 10px' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-800 flex-1">{p.nome} <span className="font-normal text-slate-500">{[p.dose, p.via, p.frequencia].filter(Boolean).join(' · ')}</span></span>
                  <label className="sr-only" htmlFor={`rec-${p.id}`}>Decisão para {p.nome}</label>
                  <select id={`rec-${p.id}`} value={d?.decisao ?? ''} className={input} style={{ padding: '4px 6px' }}
                    onChange={(e) => setDecisoes((x) => ({ ...x, [p.id]: { ...x[p.id], decisao: e.target.value } }))}>
                    <option value="">Decidir…</option>
                    <option value="manter">Manter</option>
                    <option value="alterar">Alterar</option>
                    <option value="suspender">Suspender</option>
                  </select>
                </div>
                {d?.decisao === 'alterar' && (
                  <input aria-label={`Nova dose de ${p.nome}`} placeholder="Nova dose / posologia" value={d.dose ?? ''} className={`${input} w-full`} style={{ padding: '4px 6px', marginTop: '6px' }}
                    onChange={(e) => setDecisoes((x) => ({ ...x, [p.id]: { ...x[p.id], dose: e.target.value } }))} />
                )}
                {(d?.decisao === 'suspender' || d?.decisao === 'alterar') && (
                  <input aria-label={`Motivo para ${p.nome}`} placeholder="Motivo" value={d.notas ?? ''} className={`${input} w-full`} style={{ padding: '4px 6px', marginTop: '6px' }}
                    onChange={(e) => setDecisoes((x) => ({ ...x, [p.id]: { ...x[p.id], notas: e.target.value } }))} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {novas.map((n, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: '6px' }}>
          {(['nome', 'dose', 'via', 'frequencia'] as const).map((campo) => (
            <input key={campo} aria-label={`Medicamento novo ${i + 1}: ${campo}`} placeholder={campo === 'nome' ? 'Medicamento novo' : campo}
              value={n[campo]} className={input} style={{ padding: '4px 6px' }}
              onChange={(e) => setNovas((xs) => xs.map((x, k) => (k === i ? { ...x, [campo]: e.target.value } : x)))} />
          ))}
        </div>
      ))}
      <button type="button" onClick={() => setNovas((xs) => [...xs, { nome: '', dose: '', via: 'oral', frequencia: '' }])}
        className="text-xs font-semibold text-blue-700 hover:underline">
        + Medicamento novo na saída
      </button>
    </div>
  );
}
