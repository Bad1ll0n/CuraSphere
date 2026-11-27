'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';

/**
 * SEC-19 — consentimento e oposição do doente ao tratamento de dados que vai além do cuidado
 * directo: partilha com familiares, conta no portal e IA clínica. Registo presencial; o próprio
 * doente também os gere no portal.
 */
interface Finalidade {
  finalidade: 'partilha_familiares' | 'portal_doente' | 'ia_clinica';
  regime: 'consentimento' | 'oposicao';
  descricao: string;
  decisao: 'consentimento' | 'oposicao' | null;
  registadoEm: string | null;
  origem: string | null;
  permitido: boolean;
}
interface Historico {
  id: string; finalidade: string; decisao: string; origem: string; observacoes: string | null;
  registadoEm: string; revogadoEm: string | null; origemRevogacao: string | null;
  registadoPor: { nome: string } | null; revogadoPor: { nome: string } | null;
}

const PAPEIS_VER = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo', 'direcao'];
const PAPEIS_REGISTAR = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'administrativo'];
const NOME: Record<string, string> = {
  partilha_familiares: 'Partilha com familiares', portal_doente: 'Portal do doente', ia_clinica: 'IA clínica',
};
const data = (d: string) => new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

function estadoTexto(f: Finalidade) {
  if (f.regime === 'oposicao') return f.decisao === 'oposicao' ? 'Oposição registada' : 'Sem oposição';
  if (f.decisao === 'consentimento') return 'Consentimento dado';
  if (f.decisao === 'oposicao') return 'Recusado';
  return 'Sem registo';
}

export function ConsentimentosTratamentoPanel({ doenteId, utilizador }: { doenteId: string; utilizador: { role: string } | null }) {
  const role = utilizador?.role ?? '';
  const toast = useToast();
  const [finalidades, setFinalidades] = useState<Finalidade[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [verHistorico, setVerHistorico] = useState(false);
  const [aGuardar, setAGuardar] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; mensagem: string; accao: () => Promise<void> } | null>(null);

  const carregar = useCallback(() => {
    api.get(`/consentimentos-tratamento/doente/${doenteId}`)
      .then((r) => { setFinalidades(r.data.finalidades); setHistorico(r.data.historico); })
      .catch(() => { setFinalidades([]); setHistorico([]); });
  }, [doenteId]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!PAPEIS_VER.includes(role)) return null;
  const podeRegistar = PAPEIS_REGISTAR.includes(role);

  const executar = async (chave: string, fn: () => Promise<unknown>, sucesso: string) => {
    setAGuardar(chave);
    try { await fn(); toast.success(sucesso); carregar(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao guardar'); }
    finally { setAGuardar(null); }
  };
  const registar = (f: Finalidade, decisao: 'consentimento' | 'oposicao') =>
    executar(f.finalidade, () => api.post(`/consentimentos-tratamento/doente/${doenteId}`, { finalidade: f.finalidade, decisao }), 'Decisão registada');
  const revogar = (f: Finalidade) =>
    executar(f.finalidade, () => api.post(`/consentimentos-tratamento/doente/${doenteId}/revogar/${f.finalidade}`), 'Decisão revogada');

  const pedirConfirmacao = (f: Finalidade, decisao: 'consentimento' | 'oposicao' | 'revogar') => {
    const efeito =
      f.finalidade === 'partilha_familiares' && decisao !== 'consentimento' ? ' Os links de familiares activos deixam de funcionar.'
        : f.finalidade === 'portal_doente' && decisao !== 'consentimento' ? ' A conta do portal é desactivada.' : '';
    const verbo = decisao === 'revogar' ? (f.regime === 'oposicao' ? 'Retirar a oposição' : 'Revogar o consentimento')
      : decisao === 'consentimento' ? 'Registar o consentimento' : f.regime === 'oposicao' ? 'Registar a oposição' : 'Registar a recusa';
    setConfirmar({
      titulo: `${verbo} — ${NOME[f.finalidade]}`,
      mensagem: `Confirma que o doente manifestou esta vontade? Fica registado em seu nome, com data e hora.${efeito}`,
      accao: () => (decisao === 'revogar' ? revogar(f) : registar(f, decisao)),
    });
  };

  return (
    <>
      <section aria-labelledby="titulo-consentimentos-rgpd" className="bg-surface rounded-2xl border border-borda shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
          <h3 id="titulo-consentimentos-rgpd" className="text-base font-bold text-main">Consentimentos (RGPD)</h3>
          <button onClick={() => setVerHistorico((v) => !v)} className="text-xs font-semibold text-blue-600 hover:underline" style={{ marginLeft: 'auto' }}>
            {verHistorico ? 'Ocultar histórico' : `Histórico (${historico.length})`}
          </button>
        </div>
        <ul className="flex flex-col" style={{ gap: '12px' }}>
          {finalidades.map((f) => (
            <li key={f.finalidade} className="rounded-xl border border-borda" style={{ padding: '12px 16px' }}>
              <div className="flex flex-wrap items-center" style={{ gap: '8px' }}>
                <span className="text-sm font-semibold text-main">{NOME[f.finalidade]}</span>
                <span className={`text-xs font-semibold rounded-full ${f.permitido ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`} style={{ padding: '2px 10px' }}>
                  {estadoTexto(f)}
                </span>
                {f.registadoEm && <span className="text-xs text-muted">{data(f.registadoEm)} · {f.origem === 'portal' ? 'pelo doente no portal' : 'presencial'}</span>}
              </div>
              <p className="text-xs text-muted" style={{ marginTop: '4px' }}>{f.descricao}</p>
              {podeRegistar && (
                <div className="flex flex-wrap" style={{ gap: '8px', marginTop: '10px' }}>
                  {f.regime === 'consentimento' && f.decisao !== 'consentimento' && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => pedirConfirmacao(f, 'consentimento')}
                      className="text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" style={{ padding: '6px 12px' }}>
                      Registar consentimento
                    </button>
                  )}
                  {f.decisao !== 'oposicao' && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => pedirConfirmacao(f, 'oposicao')}
                      className="text-xs font-semibold rounded-lg border border-borda text-main hover:bg-page disabled:opacity-50" style={{ padding: '6px 12px' }}>
                      {f.regime === 'oposicao' ? 'Registar oposição' : 'Registar recusa'}
                    </button>
                  )}
                  {f.decisao && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => pedirConfirmacao(f, 'revogar')}
                      className="text-xs font-semibold rounded-lg border border-borda text-main hover:bg-page disabled:opacity-50" style={{ padding: '6px 12px' }}>
                      {f.regime === 'oposicao' ? 'Retirar oposição' : f.decisao === 'consentimento' ? 'Revogar consentimento' : 'Anular recusa'}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {verHistorico && (
          <ol className="flex flex-col" style={{ gap: '6px', marginTop: '16px' }}>
            {historico.length === 0 && <li className="text-xs text-muted">Sem registos.</li>}
            {historico.map((h) => (
              <li key={h.id} className="text-xs text-muted">
                <span className="font-semibold text-main">{NOME[h.finalidade] ?? h.finalidade}</span>: {h.decisao === 'consentimento' ? 'consentimento' : 'oposição/recusa'}
                {' '}em {data(h.registadoEm)} ({h.origem === 'portal' ? 'portal' : h.registadoPor?.nome ?? 'presencial'})
                {h.revogadoEm && <> — revogado em {data(h.revogadoEm)} ({h.origemRevogacao === 'portal' ? 'portal' : h.revogadoPor?.nome ?? 'presencial'})</>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <ConfirmModal
        isOpen={!!confirmar}
        titulo={confirmar?.titulo ?? ''}
        mensagem={confirmar?.mensagem ?? ''}
        variant="warning"
        onConfirmar={() => { const a = confirmar?.accao; setConfirmar(null); void a?.(); }}
        onCancelar={() => setConfirmar(null)}
      />
    </>
  );
}
