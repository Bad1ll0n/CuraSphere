'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface PlanoAlta {
  id: string;
  doenteId: string;
  dataAlvoDia: string | null;
  afebrилApenas24h: boolean;
  mobilidadeAdequada: boolean;
  alimentacaoOral: boolean;
  doresControladas: boolean;
  familiaInformada: boolean;
  transporteAssegurado: boolean;
  medicacaoPreparada: boolean;
  consultaSegAlt: boolean;
  notas: string | null;
}

const CRITERIOS: { campo: keyof PlanoAlta; label: string }[] = [
  { campo: 'afebrилApenas24h',     label: 'Afebril >24h' },
  { campo: 'mobilidadeAdequada',   label: 'Mobilidade adequada' },
  { campo: 'alimentacaoOral',      label: 'Alimentação oral' },
  { campo: 'doresControladas',     label: 'Dores controladas' },
  { campo: 'familiaInformada',     label: 'Família informada' },
  { campo: 'transporteAssegurado', label: 'Transporte assegurado' },
  { campo: 'medicacaoPreparada',   label: 'Medicação preparada' },
  { campo: 'consultaSegAlt',       label: 'Consulta seguimento' },
];

export function PlanoAltaPanel({ doenteId, utilizador }: { doenteId: string; utilizador: any }) {
  const [plano, setPlano] = useState<PlanoAlta | null>(null);
  const [aberto, setAberto] = useState(false);
  const [dataAlvo, setDataAlvo] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  const podeEditar = ['medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  const carregar = () => {
    api.get(`/plano-alta/${doenteId}`).then(r => {
      setPlano(r.data);
      setDataAlvo(r.data?.dataAlvoDia ? r.data.dataAlvoDia.split('T')[0] : '');
      setNotas(r.data?.notas ?? '');
    }).catch(() => {});
  };

  useEffect(() => { carregar(); }, [doenteId]);

  const toggler = async (campo: string, valor: boolean) => {
    if (!podeEditar) return;
    try {
      await api.patch(`/plano-alta/${doenteId}`, { [campo]: valor });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const guardar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/plano-alta/${doenteId}`, {
        dataAlvoDia: dataAlvo || undefined,
        notas: notas || undefined,
      });
      toast.success('Plano de alta guardado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally { setSalvando(false); }
  };

  if (!plano) return null;

  const cumpridos = CRITERIOS.filter(c => plano[c.campo] === true).length;
  const progresso = Math.round((cumpridos / CRITERIOS.length) * 100);

  const atrasado = plano.dataAlvoDia && new Date(plano.dataAlvoDia) < new Date() && progresso < 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between"
        style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-base">🏠</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Plano de Alta</span>
              {atrasado && (
                <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg" style={{ padding: '2px 8px' }}>
                  Data alvo ultrapassada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: '4px' }}>
              <div className="w-28 bg-slate-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <span className="text-xs text-slate-500">{cumpridos}/{CRITERIOS.length} critérios</span>
            </div>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div style={{ padding: '0 24px 24px' }}>
          <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '16px' }}>
            {CRITERIOS.map(({ campo, label }) => {
              const feito = plano[campo] as boolean;
              return (
                <button
                  key={campo}
                  onClick={() => toggler(campo as string, !feito)}
                  disabled={!podeEditar}
                  className={`flex items-center gap-2 rounded-xl border transition-all text-left ${
                    feito ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200 hover:border-blue-200'
                  } ${podeEditar ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{ padding: '10px 12px' }}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${feito ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {feito ? '✓' : ''}
                  </span>
                  <span className={`text-sm font-medium ${feito ? 'text-green-800' : 'text-slate-600'}`}>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3" style={{ marginBottom: '12px' }}>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>
                Data Alvo de Alta
              </label>
              <input
                type="date"
                value={dataAlvo}
                onChange={e => setDataAlvo(e.target.value)}
                disabled={!podeEditar}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                style={{ padding: '8px 12px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              disabled={!podeEditar}
              rows={2}
              className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 resize-none"
              style={{ padding: '8px 12px' }}
            />
          </div>

          {podeEditar && (
            <button onClick={guardar} disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ padding: '9px 20px' }}>
              {salvando ? 'A guardar...' : 'Guardar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
