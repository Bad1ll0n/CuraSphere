'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ErroCarregamento } from '@/components/erro-carregamento';

/**
 * UX-22 — passagem de turno ÚNICA, por doente, em ISBAR (Identificação, Situação,
 * Background, Avaliação, Recomendações — recomendação DGS para as transições de cuidados).
 * Substitui as duas páginas que existiam ("Passagem de Turno" e "Passagem Turno Pro", com
 * backends diferentes). Cada doente vem pré-preenchido a partir do registo; quem sai revê e
 * entrega; quem entra confirma a receção.
 */
type Turno = 'manha' | 'tarde' | 'noite';
interface Isbar { identificacao: string; situacao: string; antecedentes: string; avaliacao: string; recomendacoes: string }
interface Passagem extends Isbar { id: string; estado: 'rascunho' | 'entregue' | 'recebida'; autorId: string; entregueEm?: string | null; recebidaEm?: string | null }
interface Linha {
  doente: { id: string; nome: string; numeroProcesso: string; estado: string; cama?: { numero: string; quarto: string; servico?: string | null } | null };
  passagem: Passagem | null;
  recebida: Passagem | null;
}
interface Lista { data: string; turno: Turno; anterior: { data: string; turno: Turno }; podeVerServico: boolean; doentes: Linha[] }

const TURNO: Record<Turno, string> = { manha: 'Manhã (08–16)', tarde: 'Tarde (16–24)', noite: 'Noite (00–08)' };
const SECCOES: { k: keyof Isbar; letra: string; titulo: string }[] = [
  { k: 'identificacao', letra: 'I', titulo: 'Identificação' },
  { k: 'situacao', letra: 'S', titulo: 'Situação' },
  { k: 'antecedentes', letra: 'B', titulo: 'Background — antecedentes' },
  { k: 'avaliacao', letra: 'A', titulo: 'Avaliação' },
  { k: 'recomendacoes', letra: 'R', titulo: 'Recomendações' },
];
const ESTADO: Record<string, string> = { rascunho: 'Rascunho', entregue: 'Entregue', recebida: 'Recebida' };
const ESTADO_COR: Record<string, string> = { rascunho: 'bg-slate-100 text-slate-600', entregue: 'bg-blue-100 text-blue-700', recebida: 'bg-green-100 text-green-700' };

function CartaoDoente({ linha, onAlterado }: { linha: Linha; onAlterado: () => void }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [isbar, setIsbar] = useState<Isbar | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const p = linha.passagem;
  const fixa = p?.estado === 'recebida';

  const abrir = async () => {
    setAberto((x) => !x);
    if (isbar) return;
    if (p) { setIsbar({ identificacao: p.identificacao, situacao: p.situacao, antecedentes: p.antecedentes, avaliacao: p.avaliacao, recomendacoes: p.recomendacoes }); return; }
    try {
      const r = await api.get(`/passagem-isbar/doente/${linha.doente.id}/sugestao`);
      setIsbar(r.data);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao preparar a passagem'); }
  };

  const guardar = async (entregar: boolean) => {
    if (!isbar) return;
    setAGuardar(true);
    try {
      await api.put(`/passagem-isbar/doente/${linha.doente.id}`, { ...isbar, entregar });
      toast.success(entregar ? 'Passagem entregue' : 'Rascunho guardado');
      if (entregar) setAberto(false);
      onAlterado();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao guardar'); } finally { setAGuardar(false); }
  };

  const receber = async (id: string) => {
    try {
      await api.post(`/passagem-isbar/${id}/receber`, {});
      toast.success('Receção confirmada');
      onAlterado();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao confirmar'); }
  };

  const completo = !!isbar && SECCOES.every(({ k }) => isbar[k]?.trim());

  return (
    <li className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {linha.doente.cama ? `${linha.doente.cama.quarto}/${linha.doente.cama.numero} · ` : ''}{linha.doente.nome}
          </p>
          <p className="text-xs text-slate-500">Processo {linha.doente.numeroProcesso}{linha.doente.cama?.servico ? ` · ${linha.doente.cama.servico}` : ''}</p>
        </div>
        {linha.recebida && (
          <button onClick={() => receber(linha.recebida!.id)}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" style={{ padding: '6px 12px' }}>
            Confirmar receção do turno anterior
          </button>
        )}
        <span className={`text-xs font-semibold rounded-full badge-pad py-0.5 ${ESTADO_COR[p?.estado ?? 'rascunho']}`}>
          {p ? ESTADO[p.estado] : 'Por fazer'}
        </span>
        <button onClick={abrir} aria-expanded={aberto} className="text-xs font-semibold text-blue-700 hover:underline">
          {aberto ? 'Fechar' : fixa ? 'Ver' : p ? 'Editar' : 'Preparar ISBAR'}
        </button>
      </div>

      {linha.recebida && (
        <details style={{ marginTop: '10px' }}>
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Ler a passagem recebida</summary>
          <dl className="text-sm text-slate-700" style={{ marginTop: '6px' }}>
            {SECCOES.map(({ k, letra, titulo }) => (
              <div key={k} style={{ marginBottom: '6px' }}>
                <dt className="text-xs font-bold text-slate-500">{letra} — {titulo}</dt>
                <dd className="whitespace-pre-wrap">{linha.recebida![k]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {aberto && isbar && (
        <div style={{ marginTop: '14px' }}>
          {!p && <p className="text-xs text-slate-500" style={{ marginBottom: '10px' }}>Pré-preenchido a partir do registo — reveja e complete antes de entregar.</p>}
          {SECCOES.map(({ k, letra, titulo }) => (
            <div key={k} style={{ marginBottom: '10px' }}>
              <label htmlFor={`isbar-${linha.doente.id}-${k}`} className="flex items-center gap-2 text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>
                <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">{letra}</span>
                {titulo}
              </label>
              <textarea id={`isbar-${linha.doente.id}-${k}`} rows={3} value={isbar[k]} disabled={fixa} maxLength={4000}
                onChange={(e) => setIsbar((x) => (x ? { ...x, [k]: e.target.value } : x))}
                className="w-full border border-slate-200 rounded-lg text-sm disabled:bg-slate-50" style={{ padding: '8px 10px' }} />
            </div>
          ))}
          {!fixa && (
            <div className="flex gap-2 justify-end">
              <button onClick={() => guardar(false)} disabled={aGuardar}
                className="text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50" style={{ padding: '8px 14px' }}>
                Guardar rascunho
              </button>
              <button onClick={() => guardar(true)} disabled={aGuardar || !completo}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50" style={{ padding: '8px 14px' }}>
                {p?.estado === 'entregue' ? 'Actualizar entrega' : 'Entregar passagem'}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function PassagemTurnoPage() {
  const toast = useToast();
  const [lista, setLista] = useState<Lista | null>(null);
  const [erro, setErro] = useState(false);
  const [servico, setServico] = useState('');
  const [servicos, setServicos] = useState<string[]>([]);
  const [aFazerCheckin, setAFazerCheckin] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/passagem-isbar', { params: servico ? { servico } : {} });
      setLista(r.data);
      setErro(false);
    } catch { setErro(true); }
  }, [servico]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    api.get('/camas').then((r) => setServicos([...new Set((r.data as any[]).map((c) => c.servico).filter(Boolean))].sort() as string[])).catch(() => undefined);
  }, []);

  const checkIn = async () => {
    setAFazerCheckin(true);
    try {
      await api.post('/turnos/check-in');
      toast.success('Check-in realizado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao fazer check-in');
    } finally { setAFazerCheckin(false); }
  };

  const linhas = lista?.doentes ?? [];
  const entregues = linhas.filter((l) => l.passagem && l.passagem.estado !== 'rascunho').length;
  const porReceber = linhas.filter((l) => l.recebida).length;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1080px', margin: '0 auto' }}>
      <div className="flex items-start justify-between flex-wrap gap-4" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Passagem de Turno</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '6px' }}>
            ISBAR por doente{lista ? ` · ${TURNO[lista.turno]} de ${new Date(`${lista.data}T12:00:00`).toLocaleDateString('pt-PT')}` : ''}
            {lista && ` · ${entregues}/${linhas.length} entregues`}{porReceber > 0 && ` · ${porReceber} por receber`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="pt-servico" className="sr-only">Serviço</label>
          <select id="pt-servico" value={servico} onChange={(e) => setServico(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm bg-white" style={{ padding: '8px 12px' }}>
            <option value="">Os meus doentes</option>
            {servicos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={checkIn} disabled={aFazerCheckin}
            className="text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50" style={{ padding: '8px 14px' }}>
            Check-in no turno
          </button>
        </div>
      </div>

      {erro ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ErroCarregamento titulo="Não foi possível carregar a passagem de turno" descricao="Verifique a ligação e tente de novo." onTentarNovamente={carregar} />
        </div>
      ) : !lista ? (
        <p className="text-sm text-slate-500">A carregar...</p>
      ) : linhas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px' }}>
          <p className="text-sm text-slate-600">
            {servico ? 'Sem doentes internados neste serviço.' : 'Não tem doentes atribuídos neste turno.'}
          </p>
          <p className="text-xs text-slate-500" style={{ marginTop: '6px' }}>
            Escolha um serviço acima, ou veja as <Link href="/atribuicoes" className="text-blue-700 hover:underline">atribuições</Link>.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {linhas.map((l) => <CartaoDoente key={l.doente.id} linha={l} onAlterado={carregar} />)}
        </ul>
      )}
    </div>
  );
}
