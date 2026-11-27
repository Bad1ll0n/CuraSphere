'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMeuTurno } from '@/lib/hooks';
import type { LinhaMeuTurno } from '@org/shared';
import { ErroCarregamento } from '@/components/erro-carregamento';
import { useModosTurno, type ModoNoturno } from '@/lib/modos-turno';

/**
 * UX-30 — "O meu turno": a casa do enfermeiro. Os meus doentes por cama, com o que pede acção
 * agora (medicação devida/em atraso, vitais e escalas em atraso, NEWS2 a subir, tarefas) e um
 * toque para a ficha ou para o MAR. Antes era preciso juntar 5 ecrãs (MAR, Timeline, Tarefas,
 * Doentes, Passagem).
 */
type Linha = LinhaMeuTurno; // ARQ-12: contrato partilhado com a api

function Chip({ tom, children, rotulo }: { tom: 'vermelho' | 'ambar' | 'azul' | 'cinza'; children: React.ReactNode; rotulo?: string }) {
  const cores = {
    vermelho: 'bg-red-100 text-red-800 border-red-200',
    ambar: 'bg-amber-100 text-amber-900 border-amber-200',
    azul: 'bg-blue-100 text-blue-800 border-blue-200',
    cinza: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tom];
  return <span aria-label={rotulo} className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full ${cores}`} style={{ padding: '4px 10px' }}>{children}</span>;
}

export function MeuTurnoCliente() {
  const t = useTranslations('myShift');
  const tc = useTranslations('common');
  // ARQ-13: react-query (atualiza a cada minuto e quando se administra no MAR).
  const { data, isError: erro, refetch } = useMeuTurno();
  const linhas: Linha[] | null = data ? data.doentes : null;
  const carregar = () => { void refetch(); };
  const { cabeceira, setCabeceira, noturno, setNoturno } = useModosTurno();

  const totais = (linhas ?? []).reduce((a, l) => ({
    med: a.med + l.medicacao.devidas + l.medicacao.emAtraso,
    obs: a.obs + l.observacoesEmAtraso.length,
    tar: a.tar + l.tarefas.pendentes,
  }), { med: 0, obs: 0, tar: 0 });

  return (
    <div style={{ padding: '24px 24px 48px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="flex items-start justify-between flex-wrap gap-4" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
          {linhas && (
            <p className="text-sm text-slate-600" style={{ marginTop: '6px' }}>
              {t('summary', { doentes: linhas.length, tomas: totais.med, obs: totais.obs, tarefas: totais.tar })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap" role="group" aria-label={t('workMode')}>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={cabeceira} onChange={(e) => setCabeceira(e.target.checked)} className="w-5 h-5" />
            {t('bedsideMode')}
          </label>
          <label htmlFor="modo-noturno" className="text-sm text-slate-700">{t('nightMode')}</label>
          <select id="modo-noturno" value={noturno} onChange={(e) => setNoturno(e.target.value as ModoNoturno)}
            className="border border-slate-200 rounded-lg text-sm bg-white" style={{ padding: '6px 10px' }}>
            <option value="desligado">{t('night.desligado')}</option>
            <option value="automatico">{t('night.automatico')}</option>
            <option value="ligado">{t('night.ligado')}</option>
          </select>
        </div>
      </div>

      {erro ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ErroCarregamento titulo={t('loadErrorTitle')} descricao={t('loadErrorBody')} onTentarNovamente={carregar} />
        </div>
      ) : !linhas ? (
        <p className="text-sm text-slate-500">{tc('loading')}</p>
      ) : linhas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px' }}>
          <p className="text-base text-slate-700">{t('empty')}</p>
          <p className="text-sm text-slate-500" style={{ marginTop: '6px' }}>
            {t.rich('emptyHint', {
              assign: (c) => <Link href="/atribuicoes" className="text-blue-700 hover:underline">{c}</Link>,
              patients: (c) => <Link href="/doentes" className="text-blue-700 hover:underline">{c}</Link>,
            })}
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
                    <p className="text-xs text-slate-600">{t('bed')}</p>
                    <p className="text-lg font-bold text-slate-900">{d.cama ? `${d.cama.quarto}/${d.cama.numero}` : '—'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-900">{d.nome}</p>
                    <p className="text-xs text-slate-600">{t('ageRecord', { idade: d.idade != null ? String(d.idade) : 'none', processo: d.numeroProcesso })}</p>
                    <p className={`text-xs font-semibold ${d.alergias === null ? 'text-amber-800' : d.alergias.length ? 'text-red-700' : 'text-green-700'}`} style={{ marginTop: '2px' }}>
                      {d.alergias === null ? t('allergiesNotAssessed') : d.alergias.length ? t('allergiesList', { lista: d.alergias.join(', ') }) : t('noKnownAllergies')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" style={{ marginTop: '12px' }}>
                  {d.naoReanimar && <Chip tom="vermelho">DNR</Chip>}
                  {d.isolamento && <Chip tom="ambar">{t('isolation')}</Chip>}
                  {l.medicacao.emAtraso > 0 && <Chip tom="vermelho">{t('medOverdue', { n: l.medicacao.emAtraso })}</Chip>}
                  {l.medicacao.devidas > 0 && <Chip tom="azul">{t('medNow', { n: l.medicacao.devidas })}</Chip>}
                  {l.observacoesEmAtraso.length > 0 && (
                    <Chip tom="ambar" rotulo={l.observacoesEmAtraso.map((o) => o.motivo).join('; ')}>{t('obsOverdue', { n: l.observacoesEmAtraso.length })}</Chip>
                  )}
                  {news != null && (
                    <Chip tom={news >= 7 ? 'vermelho' : news >= 5 ? 'ambar' : 'cinza'}>
                      NEWS2 {news}{l.news2?.tendencia === 'sobe' ? ' ↑' : l.news2?.tendencia === 'desce' ? ' ↓' : ''}
                    </Chip>
                  )}
                  {l.tarefas.pendentes > 0 && <Chip tom={l.tarefas.urgentes ? 'ambar' : 'cinza'}>{t('tasks', { n: l.tarefas.pendentes })}</Chip>}
                </div>

                <div className="flex gap-2 mt-auto" style={{ paddingTop: '14px' }}>
                  <Link href={`/doentes/${d.id}`} className="botao flex-1 text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center" style={{ padding: '10px' }}>
                    {t('chart')}
                  </Link>
                  <Link href={`/mar?doente=${d.id}`} className="botao flex-1 text-center text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl flex items-center justify-center" style={{ padding: '10px' }}>
                    {t('administer')}
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
