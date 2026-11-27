'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * PROD-10 — observações em atraso (sinais vitais segundo o NEWS2, Braden/Morse, reavaliação da
 * dor depois de analgesia). Para o enfermeiro: os doentes atribuídos no turno; para chefias: o
 * serviço todo (decidido no servidor).
 */
const ROTULO: Record<string, string> = {
  sinais_vitais: 'Sinais vitais',
  braden: 'Braden',
  morse: 'Morse',
  dor_pos_analgesia: 'Dor pós-analgesia',
};

function formatarAtraso(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} dias`;
}

export function VigilanciaEmAtraso() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['vigilancia-em-atraso'],
    queryFn: async () => (await api.get('/vigilancia/em-atraso')).data as any[],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading || isError) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px', marginBottom: '24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <p className="text-sm font-semibold text-slate-700">Observações em atraso</p>
        <span className={`text-xs font-bold rounded-full badge-pad py-0.5 ${data.length ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {data.length}
        </span>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Todas as observações estão em dia.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.slice(0, 12).map((o) => (
            <li key={`${o.doenteId}-${o.tipo}`}>
              <Link href={`/doentes/${o.doenteId}`} className="flex items-center gap-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors" style={{ padding: '8px 12px' }}>
                <span className="text-xs font-semibold text-slate-500 w-16 shrink-0">{o.cama ?? '—'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{o.doente}</span>
                  <span className="block text-xs text-slate-500 truncate">{ROTULO[o.tipo] ?? o.tipo} · {o.motivo}</span>
                </span>
                <span className="text-xs font-bold text-red-600 shrink-0">+{formatarAtraso(o.atrasoMinutos)}</span>
              </Link>
            </li>
          ))}
          {data.length > 12 && <li className="text-xs text-slate-500">e mais {data.length - 12}…</li>}
        </ul>
      )}
    </div>
  );
}
