'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Breadcrumb } from '@/components/breadcrumb';
import { Modal } from '@/components/ui/modal';
import { ErroCarregamento } from '@/components/erro-carregamento';

type Turno = 'manha' | 'tarde' | 'noite';

interface SlotMed {
  doenteId: string;
  doenteName: string;
  cama: string;
  medicacaoId: string;
  nome: string;
  dose: string;
  administrada: boolean;
  emAtraso?: boolean;
}

interface Slot {
  hora: string;
  total: number;
  medicacoes: SlotMed[];
}

interface TimelineData {
  turno: { inicio: string; fim: string };
  slots: Slot[];
  doentes: { id: string; nome: string; cama: string; medicacoesPendentes: number }[];
}

const TURNOS: { value: Turno; label: string; inicio: number; fim: number }[] = [
  { value: 'manha', label: 'Manhã', inicio: 8, fim: 16 },
  { value: 'tarde', label: 'Tarde', inicio: 16, fim: 24 },
  { value: 'noite', label: 'Noite', inicio: 0, fim: 8 },
];

const SERVICOS = ['Cardiologia', 'Ortopedia', 'Medicina Interna', 'Cirurgia', 'Neurologia', 'UCI'];

export default function TimelineMedicacoesPage() {
  const toast = useToast();
  const t = useTranslations('medication');
  const tc = useTranslations('common');
  const [turno, setTurno] = useState<Turno>('manha');
  const [servico, setServico] = useState(SERVICOS[0]);
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [erroCarga, setErroCarga] = useState(false);
  // Guarda de duplo-submit: id da medicação em curso. Fica activo desde o clique
  // (síncrono) até ao fim do round-trip — o `disabled` derivado de `m.administrada`
  // só reflectiria o servidor depois de recarregar, tarde demais num tablet.
  const [administrando, setAdministrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<SlotMed | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/medicacao/timeline', { params: { servico, turno, data } });
      setTimeline(r.data);
      setErroCarga(false);
    } catch (e: any) {
      // F-08: o toast desaparece em segundos e a timeline anterior fica no ecra como se fosse
      // a actual. Na primeira carga ficava "Sem doentes activos neste servico".
      setErroCarga(true);
      toast.error(e?.response?.data?.message ?? 'Erro ao carregar');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(carregar, 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [servico, turno, data]);

  const administrar = async (med: SlotMed) => {
    // Segunda barreira: mesmo que dois eventos passem o `disabled`, só o primeiro entra.
    if (administrando) return;
    setAdministrando(med.medicacaoId);
    setConfirmar(null);
    try {
      await api.post(`/medicacao/${med.medicacaoId}/administrar`, { doenteId: med.doenteId });
      // Marca localmente antes do recarregamento para o botão não voltar a ficar activo
      // na janela entre a resposta e a chegada da timeline nova.
      setTimeline((prev) =>
        prev
          ? {
              ...prev,
              slots: prev.slots.map((s) => ({
                ...s,
                medicacoes: s.medicacoes.map((m) =>
                  m.medicacaoId === med.medicacaoId ? { ...m, administrada: true } : m,
                ),
              })),
            }
          : prev,
      );
      toast.success('Medicação registada como administrada');
      await carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally {
      setAdministrando(null);
    }
  };

  const turnoInfo = TURNOS.find(t => t.value === turno)!;
  const horas = Array.from({ length: turnoInfo.fim - turnoInfo.inicio }, (_, i) => {
    const h = (turnoInfo.inicio + i) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  });

  const slotMap = new Map<string, SlotMed[]>();
  timeline?.slots.forEach(s => { slotMap.set(s.hora, s.medicacoes); });

  const agora = new Date();
  const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:00`;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[{ label: 'Turno' }, { label: 'Timeline Medicação' }]} />
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timeline de Medicação</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Vista por turno — actualização automática cada 60s</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            style={{ padding: '8px 12px' }} />
          <select value={servico} onChange={e => setServico(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            style={{ padding: '8px 12px' }}>
            {SERVICOS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Selector de turno */}
      <div className="flex gap-2" style={{ marginBottom: '24px' }}>
        {TURNOS.map(t => (
          <button key={t.value} onClick={() => setTurno(t.value)}
            className={`text-sm font-medium rounded-xl border transition-all ${turno === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
            style={{ padding: '8px 20px' }}>
            {t.label} ({String(t.inicio).padStart(2, '0')}h–{String(t.fim % 24).padStart(2, '0')}h)
          </button>
        ))}
      </div>

      {loading && !timeline && (
        <div className="flex items-center justify-center gap-2 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      )}

      {erroCarga && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
          <ErroCarregamento
            titulo="Nao foi possivel carregar a timeline"
            descricao="Isto nao quer dizer que nao haja medicacoes por administrar neste turno. Verifique a ligacao e tente de novo."
            onTentarNovamente={carregar}
          />
        </div>
      )}

      {!erroCarga && timeline && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          {/* Indicador de densidade */}
          <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `160px repeat(${horas.length}, 1fr)` }}>
            <div className="border-r border-slate-100 bg-slate-50" style={{ padding: '10px 16px' }}>
              <span className="text-xs font-semibold text-slate-500">Doente / Cama</span>
            </div>
            {horas.map(h => {
              const meds = slotMap.get(h) ?? [];
              const isNow = h === horaAtual;
              return (
                <div key={h} className={`border-r border-slate-100 text-center ${isNow ? 'bg-blue-50' : 'bg-slate-50'}`} style={{ padding: '6px 4px' }}>
                  <div className={`text-xs font-bold ${isNow ? 'text-blue-600' : 'text-slate-600'}`}>{h}</div>
                  {meds.length > 0 && (
                    <div className="flex items-center justify-center gap-0.5" style={{ marginTop: '2px' }}>
                      {Array.from({ length: Math.min(meds.length, 5) }).map((_, i) => (
                        <div key={i} className="w-1 h-2 rounded-sm bg-violet-400" />
                      ))}
                      {meds.length > 5 && <span className="text-xs text-slate-400">+{meds.length - 5}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Linhas por doente */}
          {timeline.doentes.map(d => (
            <div key={d.id} className="grid border-b border-slate-50 hover:bg-slate-50/50 transition-colors" style={{ gridTemplateColumns: `160px repeat(${horas.length}, 1fr)` }}>
              <div className="border-r border-slate-100" style={{ padding: '10px 16px' }}>
                <div className="text-xs font-semibold text-slate-800 truncate">{d.nome.split(' ')[0]}</div>
                <div className="text-xs text-slate-400">Cama {d.cama}</div>
              </div>
              {horas.map(h => {
                const meds = (slotMap.get(h) ?? []).filter(m => m.doenteId === d.id);
                return (
                  <div key={h} className="border-r border-slate-100 flex items-center justify-center flex-wrap gap-1" style={{ padding: '6px 4px', minHeight: '48px' }}>
                    {meds.map(m => {
                      const cor = m.administrada ? 'bg-green-100 border-green-300 text-green-800' :
                        m.emAtraso ? 'bg-red-100 border-red-300 text-red-800 animate-pulse' :
                          'bg-violet-100 border-violet-300 text-violet-800';
                      return (
                        <button
                          key={m.medicacaoId}
                          onClick={() => setConfirmar(m)}
                          disabled={m.administrada || !!administrando}
                          title={`${m.nome} ${m.dose}`}
                          aria-label={`${m.administrada ? t('administered') : t('administer')}: ${m.nome} ${m.dose} — ${m.doenteName}, cama ${m.cama}, ${h}`}
                          className={`text-xs font-medium rounded border px-1.5 py-0.5 truncate transition-all max-w-full ${cor} ${!m.administrada && !administrando ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} disabled:opacity-60`}>
                          <span aria-hidden="true">{m.nome.slice(0, 8)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {timeline.doentes.length === 0 && (
            <div className="text-center text-slate-400 text-sm" style={{ padding: '48px' }}>
              Sem doentes activos neste serviço
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4" style={{ marginTop: '16px' }}>
        {[
          { cor: 'bg-violet-100 border-violet-300', label: 'Pendente' },
          { cor: 'bg-red-100 border-red-300', label: 'Em atraso' },
          { cor: 'bg-green-100 border-green-300', label: 'Administrada' },
        ].map(({ cor, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${cor}`} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
        <span className="text-xs text-slate-400 ml-auto">Click no bloco → confirmar administração</span>
      </div>

      {/* Confirmação explícita antes de gravar um registo de administração. */}
      <Modal
        isOpen={!!confirmar}
        onClose={() => setConfirmar(null)}
        titulo={t('confirmTitle')}
        maxWidth="420px"
      >
        <p className="text-sm text-slate-600" style={{ marginBottom: '20px' }}>
          {t('confirmBody', {
            farmaco: `${confirmar?.nome ?? ''} ${confirmar?.dose ?? ''}`.trim(),
            doente: confirmar?.doenteName ?? '',
            cama: confirmar?.cama ?? '',
          })}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmar(null)}
            className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            style={{ padding: '11px', minHeight: '44px' }}>
            {tc('cancel')}
          </button>
          <button
            onClick={() => confirmar && administrar(confirmar)}
            disabled={!!administrando}
            className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ padding: '11px', minHeight: '44px' }}>
            {administrando ? t('administering') : t('administer')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
