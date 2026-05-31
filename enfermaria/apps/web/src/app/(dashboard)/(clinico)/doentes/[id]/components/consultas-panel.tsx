'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Consulta {
  id: string;
  dataHora: string;
  estado: string;
  codigo: string;
  especialidade: string;
  diagnostico?: string;
  medico?: { nome: string };
}

interface Props {
  doenteId: string;
  utilizador: { role: string } | null;
}

const ESTADO_BADGE: Record<string, string> = {
  agendada: 'bg-blue-50 text-blue-700',
  realizada: 'bg-green-50 text-green-700',
  faltou: 'bg-orange-50 text-orange-700',
  cancelada: 'bg-slate-100 text-slate-500',
};
const ESTADO_LABEL: Record<string, string> = {
  agendada: 'Agendada', realizada: 'Realizada', faltou: 'Faltou', cancelada: 'Cancelada',
};

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function ConsultaRow({ c }: { c: Consulta }) {
  return (
    <div className="flex flex-col gap-1 border border-slate-100 rounded-xl" style={{ padding: '12px 16px' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-800">{fmtData(c.dataHora)}</span>
        <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>
          {ESTADO_LABEL[c.estado] ?? c.estado}
        </span>
        <span className="text-xs text-slate-400 font-mono">{c.codigo}</span>
      </div>
      <div className="text-xs text-slate-500">
        {c.especialidade}{c.medico?.nome ? ` · ${c.medico.nome}` : ''}
      </div>
      {c.diagnostico && (
        <p className="text-xs text-slate-500 italic" style={{ marginTop: '2px' }}>{c.diagnostico}</p>
      )}
    </div>
  );
}

export function ConsultasPanel({ doenteId, utilizador }: Props) {
  const [consultas, setConsultas] = useState<Consulta[]>([]);

  useEffect(() => {
    api.get(`/consultas?doenteId=${doenteId}`)
      .then(r => setConsultas(r.data ?? []))
      .catch(() => setConsultas([]));
  }, [doenteId]);

  if (!['medico', 'enfermeiro', 'administrativo'].includes(utilizador?.role ?? '')) return null;

  const proximas = consultas
    .filter(c => c.estado === 'agendada')
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
  const historico = consultas
    .filter(c => c.estado !== 'agendada')
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-700">Consultas</span>
        {consultas.length > 0 && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
            {consultas.length}
          </span>
        )}
      </div>

      {consultas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem consultas registadas</p>
      ) : (
        <div className="flex flex-col gap-4">
          {proximas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Próximas</p>
              <div className="flex flex-col gap-2">
                {proximas.map(c => <ConsultaRow key={c.id} c={c} />)}
              </div>
            </div>
          )}
          {historico.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Histórico</p>
              <div className="flex flex-col gap-2">
                {historico.map(c => <ConsultaRow key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
