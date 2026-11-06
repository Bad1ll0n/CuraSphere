'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { FaixaAlergias, type AlergiaResumo } from '@/components/faixa-alergias';

export interface MedicacaoAAdministrar {
  medicacaoId: string;
  nome: string;
  dose: string;
  via?: string | null;
  frequencia?: string | null;
  /** Hora planeada da toma (ISO), quando vem de uma grelha. */
  hora?: string | null;
  altoRisco?: boolean;
}

export interface DoenteAAdministrar {
  id: string;
  nome: string;
  numeroProcesso?: string | null;
  dataNascimento?: string | null;
  cama?: string | null;
  alergias?: AlergiaResumo[] | null;
}

export interface ConfirmacaoAdministracao {
  atestadoPeloEnfermeiro: true;
  observacoes?: string;
}

const CERTOS = [
  { id: 'doente', label: 'Doente certo — confirmei nome e data de nascimento/processo (pulseira)' },
  { id: 'medicamento', label: 'Medicamento certo — o nome na embalagem confere com a prescrição' },
  { id: 'dose', label: 'Dose certa' },
  { id: 'via', label: 'Via certa' },
  { id: 'hora', label: 'Hora certa' },
] as const;

/**
 * UX-01 — o único diálogo para administrar medicação.
 *
 * A timeline do turno administrava com um clique e mostrava "QA" e "Amoxicil…": sem
 * identificação do doente, sem dose, sem alergias e sem os 5 certos que o MAR já pedia.
 * Aqui é igual em todo o lado: identificação dupla, fármaco/dose/via/hora completos,
 * alergias, os 5 certos marcados um a um e, para fármacos de alto risco, a confirmação da
 * dupla verificação por outro profissional (identificado nas observações do registo).
 */
export function AdministrarMedicacaoDialog({
  aberto,
  medicacao,
  doente,
  aGravar,
  onCancelar,
  onConfirmar,
}: {
  aberto: boolean;
  medicacao: MedicacaoAAdministrar | null;
  doente: DoenteAAdministrar | null;
  aGravar: boolean;
  onCancelar: () => void;
  onConfirmar: (c: ConfirmacaoAdministracao) => void;
}) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [duplaVerificacao, setDuplaVerificacao] = useState(false);
  const [segundoVerificador, setSegundoVerificador] = useState('');

  useEffect(() => {
    if (aberto) { setMarcados({}); setDuplaVerificacao(false); setSegundoVerificador(''); }
  }, [aberto, medicacao?.medicacaoId]);

  if (!medicacao || !doente) return null;

  const todosCertos = CERTOS.every((c) => marcados[c.id]);
  const altoRiscoOk = !medicacao.altoRisco || (duplaVerificacao && segundoVerificador.trim().length >= 3);
  const pode = todosCertos && altoRiscoOk && !aGravar;
  const nasc = doente.dataNascimento ? new Date(doente.dataNascimento).toLocaleDateString('pt-PT') : null;
  const hora = medicacao.hora
    ? new Date(medicacao.hora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : null;

  const confirmar = () => {
    if (!pode) return;
    onConfirmar({
      atestadoPeloEnfermeiro: true,
      ...(medicacao.altoRisco
        ? { observacoes: `Alto risco — dupla verificação com ${segundoVerificador.trim()}` }
        : {}),
    });
  };

  return (
    <Modal isOpen={aberto} onClose={onCancelar} titulo="Administrar medicação" maxWidth="520px">
      <div className="flex flex-col gap-3">
        {/* Identificação dupla */}
        <div className="rounded-lg border border-slate-200 bg-slate-50" style={{ padding: '10px 12px' }}>
          <div className="text-sm font-bold text-slate-900">{doente.nome}</div>
          <div className="text-xs text-slate-600">
            {nasc && <>Nasc. {nasc} · </>}
            {doente.numeroProcesso && <>Proc. {doente.numeroProcesso} · </>}
            {doente.cama ? `Cama ${doente.cama}` : 'Sem cama'}
          </div>
        </div>

        <FaixaAlergias alergias={doente.alergias ?? null} compacta />

        {/* Fármaco completo */}
        <div className="rounded-lg border border-slate-200" style={{ padding: '10px 12px' }}>
          <div className="text-sm font-bold text-slate-900">{medicacao.nome}</div>
          <div className="text-xs text-slate-700">
            Dose <strong>{medicacao.dose}</strong>
            {medicacao.via && <> · Via <strong>{medicacao.via}</strong></>}
            {medicacao.frequencia && <> · {medicacao.frequencia}</>}
            {hora && <> · Toma das <strong>{hora}</strong></>}
          </div>
        </div>

        {medicacao.altoRisco && (
          <div role="alert" className="rounded-lg border-2 border-red-400 bg-red-50 text-xs text-red-900" style={{ padding: '10px 12px' }}>
            <div className="font-bold" style={{ marginBottom: '6px' }}>⚠️ Medicamento de ALTO RISCO — dupla verificação obrigatória</div>
            <label className="flex items-start gap-2" style={{ marginBottom: '6px' }}>
              <input type="checkbox" checked={duplaVerificacao} onChange={(e) => setDuplaVerificacao(e.target.checked)} />
              <span>Outro profissional confirmou de forma independente doente, fármaco, dose, via e hora.</span>
            </label>
            <input
              value={segundoVerificador}
              onChange={(e) => setSegundoVerificador(e.target.value)}
              placeholder="Nome ou n.º de funcionário de quem verificou"
              aria-label="Profissional que fez a dupla verificação"
              className="w-full rounded border border-red-200 bg-white text-xs"
              style={{ padding: '6px 8px' }}
            />
          </div>
        )}

        {/* 5 certos */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>5 certos</legend>
          {CERTOS.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!marcados[c.id]}
                onChange={(e) => setMarcados((m) => ({ ...m, [c.id]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
        </fieldset>

        <div className="flex gap-3" style={{ marginTop: '4px' }}>
          <button
            onClick={onCancelar}
            className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
            style={{ padding: '11px', minHeight: '44px' }}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!pode}
            className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ padding: '11px', minHeight: '44px' }}>
            {aGravar ? 'A registar…' : 'Registar administração'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
