'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { HelpTooltip } from '@/components/help-tooltip';

interface AlertaSepsis {
  id: string;
  criterio: 'qsofa' | 'sirs';
  score: number;
  criadoEm: string;
  resolvido: boolean;
  hemoculturasColhidas: boolean;
  hemoculturasEm: string | null;
  antibioticosIniciados: boolean;
  antibioticosEm: string | null;
  lactatoMedido: boolean;
  lactatoEm: string | null;
  fluidoterapiaIniciada: boolean;
  fluidoterapiaEm: string | null;
}

const BUNDLE_CAMPOS: { campo: string; emLabel: string; label: string }[] = [
  { campo: 'hemoculturasColhidas', emLabel: 'hemoculturasEm', label: 'Hemoculturas colhidas' },
  { campo: 'antibioticosIniciados', emLabel: 'antibioticosEm', label: 'Antibióticos iniciados' },
  { campo: 'lactatoMedido', emLabel: 'lactatoEm', label: 'Lactato medido' },
  { campo: 'fluidoterapiaIniciada', emLabel: 'fluidoterapiaEm', label: 'Fluidoterapia iniciada' },
];

export function SepsisPanel({ doenteId, utilizador }: { doenteId: string; utilizador: any }) {
  const [alertas, setAlertas] = useState<AlertaSepsis[]>([]);
  const toast = useToast();

  const podeResolver = ['medico', 'chefe_enfermeiros', 'admin'].includes(utilizador?.role ?? '');
  const podeMarcar = ['medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  const carregar = () => {
    api.get(`/sepsis/${doenteId}`).then(r => setAlertas(r.data)).catch(() => {});
  };

  useEffect(() => { carregar(); }, [doenteId]);

  const marcarBundle = async (id: string, campo: string) => {
    try {
      await api.patch(`/sepsis/${id}/bundle`, { campo });
      toast.success('Bundle actualizado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const resolver = async (id: string) => {
    try {
      await api.patch(`/sepsis/${id}/resolver`);
      toast.success('Alerta sépsis resolvido');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const ativos = alertas.filter(a => !a.resolvido);
  if (ativos.length === 0) return null;

  const alerta = ativos[0];
  const cumpridos = BUNDLE_CAMPOS.filter(b => (alerta as any)[b.campo]).length;

  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 animate-pulse-once" style={{ padding: '24px', marginBottom: '24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg">🦠</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-red-800">Alerta Sépsis Activo</h3>
            <p className="text-sm text-red-600">
              {alerta.criterio.toUpperCase()} score {alerta.score} — desde {new Date(alerta.criadoEm).toLocaleString('pt-PT')}
            </p>
          </div>
        </div>
        {podeResolver && (
          <button onClick={() => resolver(alerta.id)}
            className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-100 rounded-xl transition-colors"
            style={{ padding: '6px 14px' }}>
            Resolver
          </button>
        )}
      </div>

      {/* Barra de progresso bundle */}
      <div style={{ marginBottom: '16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
          <span className="text-sm font-semibold text-red-800 flex items-center">Bundle Sépsis <HelpTooltip chave="sepsis_bundle" /></span>
          <span className="text-sm font-bold text-red-700">{cumpridos}/4</span>
        </div>
        <div className="w-full bg-red-200 rounded-full h-2">
          <div
            className="bg-red-600 h-2 rounded-full transition-all"
            style={{ width: `${(cumpridos / 4) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BUNDLE_CAMPOS.map(({ campo, emLabel, label }) => {
          const feito = (alerta as any)[campo] as boolean;
          const quando = (alerta as any)[emLabel] as string | null;
          return (
            <button
              key={campo}
              onClick={() => !feito && podeMarcar && marcarBundle(alerta.id, campo)}
              disabled={feito || !podeMarcar}
              className={`flex items-center gap-3 rounded-xl border-2 transition-all text-left ${
                feito
                  ? 'bg-green-50 border-green-300 cursor-default'
                  : podeMarcar
                    ? 'bg-white border-red-200 hover:border-red-400 cursor-pointer'
                    : 'bg-white border-red-200 cursor-default opacity-70'
              }`}
              style={{ padding: '12px 14px' }}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 ${feito ? 'bg-green-500 text-white' : 'bg-red-200 text-red-700'}`}>
                {feito ? '✓' : '○'}
              </span>
              <div>
                <p className={`text-sm font-semibold ${feito ? 'text-green-800' : 'text-red-800'}`}>{label}</p>
                {quando && (
                  <p className="text-xs text-green-600">{new Date(quando).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
