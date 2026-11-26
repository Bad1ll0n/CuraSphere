'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MODULOS_OPCIONAIS, flagDoModulo } from '@org/shared';
import api from '@/lib/api';
import { useModulosDesligados } from '@/lib/hooks/use-modulos';
import { useToast } from '@/components/toast';

/**
 * PROD-20 — ligar e desligar os módulos opcionais desta instalação. Grava a flag `modulo.<id>`
 * (PUT /feature-flags/:key, papel TI/direção). Desligar não apaga dados.
 */
export function ModulosOpcionaisSection() {
  const t = useTranslations('modulos');
  const desligados = useModulosDesligados();
  const qc = useQueryClient();
  const toast = useToast();

  const alternar = useMutation({
    mutationFn: ({ id, ligar }: { id: string; ligar: boolean }) =>
      api.put(`/feature-flags/${flagDoModulo(id)}`, { enabled: ligar, rolloutPercent: 100, descricao: `Módulo opcional: ${id}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
    onError: () => toast.error(t('error')),
  });

  return (
    <section aria-labelledby="modulos-titulo" className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginTop: '40px', padding: '28px 32px' }}>
      <h2 id="modulos-titulo" className="text-lg font-bold text-slate-900">{t('title')}</h2>
      <p className="text-sm text-slate-500" style={{ marginTop: '6px', marginBottom: '16px' }}>{t('intro')}</p>
      <ul className="divide-y divide-slate-100">
        {MODULOS_OPCIONAIS.map((m) => {
          const ligado = !desligados.has(m.id);
          const nome = t(`nome.${m.id}`);
          return (
            <li key={m.id} className="flex items-center justify-between gap-4" style={{ padding: '12px 0' }}>
              <div>
                <p className="text-sm font-semibold text-slate-800">{nome}</p>
                <p className="text-xs text-slate-500">{t(`motivo.${m.id}`)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ligado}
                aria-label={t('toggle', { nome })}
                disabled={alternar.isPending}
                onClick={() => alternar.mutate({ id: m.id, ligar: !ligado })}
                className={`shrink-0 rounded-full text-xs font-semibold ${ligado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                style={{ padding: '6px 14px', minWidth: '88px' }}
              >
                {ligado ? t('on') : t('off')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
