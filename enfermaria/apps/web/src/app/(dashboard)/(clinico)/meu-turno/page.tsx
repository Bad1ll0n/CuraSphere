'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { ErroCarregamento } from '@/components/erro-carregamento';
import { useModosTurno, type ModoNoturno } from '@/lib/modos-turno';

/**
 * UX-30 — "O meu turno": a casa do enfermeiro. Os meus doentes por cama, com o que pede acção
 * agora (medicação devida/em atraso, vitais e escalas em atraso, NEWS2 a subir, tarefas) e um
 * toque para a ficha ou para o MAR. Antes era preciso juntar 5 ecrãs (MAR, Timeline, Tarefas,
 * Doentes, Passagem).
 */
interface Linha {
  doente: {
    id: string; nome: string; numeroProcesso: string; idade: number | null; estado: string;
    cama?: { numero: string; quarto: string; servico?: string | null } | null;
    isolamento: boolean; naoReanimar: boolean; alergias: string[] | null;
  };
  medicacao: { devidas: number; emAtraso: number };
  observacoesEmAtraso: { tipo: string; motivo: string; atrasoMinutos: number }[];
  news2: { valor: number | null; em: string; tendencia: 'sobe' | 'desce' | 'igual' | null } | null;
  tarefas: { pendentes: number; urgentes: number };
}

function Chip({ tom, children, rotulo }: { tom: 'vermelho' | 'ambar' | 'azul' | 'cinza'; children: React.ReactNode; rotulo?: string }) {
  const cores = {
    vermelho: 'bg-red-100 text-red-800 border-red-200',
    ambar: 'bg-amber-100 text-amber-900 border-amber-200',
    azul: 'bg-blue-100 text-blue-800 border-blue-200',
    cinza: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tom];
  return <span aria-label={rotulo} className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full ${cores}`} style={{ padding: '4px 10px' }}>{children}</span>;
}

export default function MeuTurnoPage() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState(false);
  const { cabeceira, setCabeceira, noturno, setNoturno } = useModosTurno();

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/resumo/meu-turno');
      setLinhas(r.data?.doentes ?? []);
      setErro(false);
    } catch { setErro(true); }
  }, []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const totais = (linhas ?? []).reduce((a, l) => ({
    med: a.med + l.medicacao.devidas + l.medicacao.emAtraso,
    obs: a.obs + l.observacoesEmAtraso.length,
    tar: a.tar + l.tarefas.pendentes,
  }), { med: 0, obs: 0, tar: 0 });

  return (
    <div style={{ padding: '24px 24px 48px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="flex items-start justify-between flex-wrap gap-4" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">O meu turno</h1>
          {linhas && (
            <p className="text-sm text-slate-600" style={{ marginTop: '6px' }}>
              {linhas.length} doente(s) · {totais.med} toma(s) por fazer · {totais.obs} observação(ões) em atraso · {totais.tar} tarefa(s)
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Modo de trabalho">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={cabeceira} onChange={(e) => setCabeceira(e.target.checked)} className="w-5 h-5" />
            Modo cabeceira
          </label>
          <label htmlFor="modo-noturno" className="text-sm text-slate-700">Modo noturno</label>
          <select id="modo-noturno" value={noturno} onChange={(e) => setNoturno(e.target.value as ModoNoturno)}
            className="border border-slate-200 rounded-lg text-sm bg-white" style={{ padding: '6px 10px' }}>
            <option value="desligado">Desligado</option>
            <option value="automatico">Automático (00–08)</option>
            <option value="ligado">Ligado</option>
          </select>
        </div>
      </div>

      {erro ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ErroCarregamento titulo="Não foi possível carregar o seu turno" descricao="Verifique a ligação e tente de novo." onTentarNovamente={carregar} />
        </div>
      ) : !linhas ? (
        <p className="text-sm text-slate-500">A carregar...</p>
      ) : linhas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px' }}>
          <p className="text-base text-slate-700">Não tem doentes atribuídos neste turno.</p>
          <p className="text-sm text-slate-500" style={{ marginTop: '6px' }}>
            Veja as <Link href="/atribuicoes" className="text-blue-700 hover:underline">atribuições</Link> ou a lista de <Link href="/doentes" className="text-blue-700 hover:underline">doentes</Link>.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {linhas.map((l) => {
            const d = l.doente;
            const news = l.news2?.valor;
            return (
              <li key={d.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col" style={{ padding: '16px 18px' }}>
                <div className="flex items-start gap-3">
                  <div className="text-center shrink-0 rounded-xl bg-slate-100" style={{ padding: '6px 10px', minWidth: '64px' }}>
                    <p className="text-xs text-slate-600">Cama</p>
                    <p className="text-lg font-bold text-slate-900">{d.cama ? `${d.cama.quarto}/${d.cama.numero}` : '—'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-900">{d.nome}</p>
                    <p className="text-xs text-slate-600">{d.idade != null ? `${d.idade} anos · ` : ''}Processo {d.numeroProcesso}</p>
                    <p className={`text-xs font-semibold ${d.alergias === null ? 'text-amber-800' : d.alergias.length ? 'text-red-700' : 'text-green-700'}`} style={{ marginTop: '2px' }}>
                      {d.alergias === null ? 'Alergias não avaliadas' : d.alergias.length ? `Alergias: ${d.alergias.join(', ')}` : 'Sem alergias conhecidas'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" style={{ marginTop: '12px' }}>
                  {d.naoReanimar && <Chip tom="vermelho">DNR</Chip>}
                  {d.isolamento && <Chip tom="ambar">Isolamento</Chip>}
                  {l.medicacao.emAtraso > 0 && <Chip tom="vermelho">Medicação em atraso ({l.medicacao.emAtraso})</Chip>}
                  {l.medicacao.devidas > 0 && <Chip tom="azul">Medicação agora ({l.medicacao.devidas})</Chip>}
                  {l.observacoesEmAtraso.length > 0 && (
                    <Chip tom="ambar" rotulo={l.observacoesEmAtraso.map((o) => o.motivo).join('; ')}>Vitais/escalas em atraso ({l.observacoesEmAtraso.length})</Chip>
                  )}
                  {news != null && (
                    <Chip tom={news >= 7 ? 'vermelho' : news >= 5 ? 'ambar' : 'cinza'}>
                      NEWS2 {news}{l.news2?.tendencia === 'sobe' ? ' ↑' : l.news2?.tendencia === 'desce' ? ' ↓' : ''}
                    </Chip>
                  )}
                  {l.tarefas.pendentes > 0 && <Chip tom={l.tarefas.urgentes ? 'ambar' : 'cinza'}>Tarefas ({l.tarefas.pendentes})</Chip>}
                </div>

                <div className="flex gap-2 mt-auto" style={{ paddingTop: '14px' }}>
                  <Link href={`/doentes/${d.id}`} className="botao flex-1 text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center" style={{ padding: '10px' }}>
                    Ficha
                  </Link>
                  <Link href={`/mar?doente=${d.id}`} className="botao flex-1 text-center text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl flex items-center justify-center" style={{ padding: '10px' }}>
                    Administrar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
