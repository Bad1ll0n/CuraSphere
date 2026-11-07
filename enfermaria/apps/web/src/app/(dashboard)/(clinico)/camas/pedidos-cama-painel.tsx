'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

/**
 * PROD-03 — pedidos de cama (urgência, bloco, consulta, outro serviço): atribuir uma cama
 * (reserva), dar entrada (ocupar → internado, episódio aberto) ou cancelar.
 */
interface CamaLivre { id: string; numero: string; quarto: string; servico?: string | null; sexo?: string | null; isolamento?: boolean; estado: string }
interface Pedido {
  id: string; origem: string; servicoDestino: string; estado: string; prioridade: string;
  sexo?: string | null; isolamento: boolean; diagnostico?: string | null; nomeTemporario?: string | null;
  pedidoEm: string; esperaMinutos: number; camaId?: string | null;
  doente?: { id: string; nome: string; numeroProcesso: string } | null;
  cama?: { numero: string; quarto: string; servico?: string | null } | null;
}

const ORIGEM: Record<string, string> = { urgencia: 'Urgência', bloco: 'Bloco', consulta: 'Consulta', servico: 'Outro serviço', admissao: 'Admissão' };

function espera(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} dias`;
}

function avisos(p: Pedido, c: CamaLivre): string[] {
  const a: string[] = [];
  if (c.sexo && p.sexo && p.sexo !== 'indeterminado' && c.sexo !== p.sexo) a.push(`enfermaria ${c.sexo === 'feminino' ? 'feminina' : 'masculina'}`);
  if (p.isolamento && !c.isolamento) a.push('sem isolamento');
  return a;
}

export function PedidosCamaPainel({ camas, podeGerir, onAlterado }: { camas: CamaLivre[]; podeGerir: boolean; onAlterado: () => void }) {
  const toast = useToast();
  // null = sem acesso à lista (papel sem gestão de camas): o painel não aparece.
  const [pedidos, setPedidos] = useState<Pedido[] | null>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [justificacao, setJustificacao] = useState<Record<string, string>>({});
  const [pedirJustificacao, setPedirJustificacao] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api.get('/pedidos-cama').then((r) => setPedidos(r.data)).catch(() => setPedidos(null));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const depois = () => { carregar(); onAlterado(); };
  const erro = (e: any) => e?.response?.data?.message ?? 'Erro ao guardar';

  const atribuir = async (p: Pedido) => {
    const camaId = escolha[p.id];
    if (!camaId) return;
    setAGuardar(p.id);
    try {
      await api.patch(`/pedidos-cama/${p.id}/atribuir`, { camaId, justificacao: justificacao[p.id]?.trim() || undefined });
      toast.success('Cama reservada para o pedido');
      setPedirJustificacao(null);
      depois();
    } catch (e: any) {
      if (e?.response?.status === 409 && /CAMA_INCOMPATIVEL/.test(erro(e))) setPedirJustificacao(p.id);
      toast.error(erro(e));
    } finally { setAGuardar(null); }
  };

  const ocupar = async (p: Pedido) => {
    setAGuardar(p.id);
    try {
      await api.post(`/pedidos-cama/${p.id}/ocupar`, {});
      toast.success('Doente internado na cama');
      depois();
    } catch (e: any) { toast.error(erro(e)); } finally { setAGuardar(null); }
  };

  const cancelar = async (p: Pedido) => {
    const motivo = window.prompt('Motivo do cancelamento do pedido de cama:');
    if (!motivo?.trim()) return;
    setAGuardar(p.id);
    try {
      await api.patch(`/pedidos-cama/${p.id}/cancelar`, { motivo: motivo.trim() });
      toast.success('Pedido cancelado');
      depois();
    } catch (e: any) { toast.error(erro(e)); } finally { setAGuardar(null); }
  };

  const livres = camas.filter((c) => c.estado === 'livre');
  if (!pedidos) return null;

  return (
    <section aria-labelledby="pedidos-cama-titulo" className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px', marginBottom: '32px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <h2 id="pedidos-cama-titulo" className="text-sm font-bold text-slate-700">Pedidos de cama</h2>
        <span className={`text-xs font-bold rounded-full badge-pad py-0.5 ${pedidos.length ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{pedidos.length}</span>
      </div>
      {pedidos.length === 0 ? (
        <p className="text-sm text-slate-500">Sem doentes à espera de cama.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {p.doente?.nome ?? p.nomeTemporario ?? 'Doente sem registo'}
                    {p.prioridade === 'urgente' && <span className="text-xs font-bold text-red-700 bg-red-100 rounded-full badge-pad py-0.5" style={{ marginLeft: '8px' }}>Urgente</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ORIGEM[p.origem] ?? p.origem} → {p.servicoDestino}
                    {p.sexo && ` · ${p.sexo}`}{p.isolamento && ' · isolamento'}
                    {p.diagnostico && ` · ${p.diagnostico}`}
                  </p>
                  <p className="text-xs text-slate-500">À espera há <strong>{espera(p.esperaMinutos)}</strong>
                    {p.cama && <> · reservada a cama <strong>{p.cama.quarto}/{p.cama.numero}</strong></>}
                  </p>
                </div>
                {podeGerir && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select aria-label={`Cama para ${p.doente?.nome ?? p.nomeTemporario ?? 'o pedido'}`} value={escolha[p.id] ?? ''}
                      onChange={(e) => { setEscolha((s) => ({ ...s, [p.id]: e.target.value })); setPedirJustificacao(null); }}
                      className="text-xs border border-slate-200 rounded-lg bg-white" style={{ padding: '6px 8px', maxWidth: '240px' }}>
                      <option value="">{p.estado === 'atribuida' ? 'Trocar cama…' : 'Escolher cama livre…'}</option>
                      {livres.map((c) => {
                        const av = avisos(p, c);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.quarto}/{c.numero}{c.servico ? ` · ${c.servico}` : ''}{av.length ? ` ⚠ ${av.join(', ')}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <button onClick={() => atribuir(p)} disabled={!escolha[p.id] || aGuardar === p.id}
                      className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '6px 12px' }}>
                      Reservar
                    </button>
                    {p.estado === 'atribuida' && (
                      <button onClick={() => ocupar(p)} disabled={aGuardar === p.id || !p.doente}
                        title={p.doente ? undefined : 'Registe o doente antes de dar entrada'}
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '6px 12px' }}>
                        Dar entrada
                      </button>
                    )}
                    <button onClick={() => cancelar(p)} disabled={aGuardar === p.id}
                      className="text-xs font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-100 rounded-lg" style={{ padding: '6px 12px' }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              {pedirJustificacao === p.id && (
                <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                  <label htmlFor={`just-${p.id}`} className="sr-only">Justificação da excepção de cama</label>
                  <input id={`just-${p.id}`} value={justificacao[p.id] ?? ''} onChange={(e) => setJustificacao((s) => ({ ...s, [p.id]: e.target.value }))}
                    placeholder="Justifique a excepção (ex.: única cama livre, quarto individual)" maxLength={500}
                    className="flex-1 text-xs border border-amber-300 rounded-lg bg-amber-50" style={{ padding: '6px 8px' }} />
                  <button onClick={() => atribuir(p)} disabled={(justificacao[p.id]?.trim().length ?? 0) < 10 || aGuardar === p.id}
                    className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '6px 12px' }}>
                    Reservar com justificação
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
