'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { nifValido, numeroSnsValido } from '@org/shared';
import api from '@/lib/api';

/**
 * UX-23 — peças da identificação do utente no registo administrativo:
 *  - "Utente não identificado": regista com identificação provisória (o nome é gerado pela api,
 *    "Desconhecido AAAA-MM-DD #N"), sem NIF, SNS, telefone nem data de nascimento;
 *  - possíveis duplicados enquanto se escreve (NIF, SNS, ou nome + data de nascimento), com o nº
 *    de processo de cada um — antes ninguém via que o utente já existia.
 */
export function AlternarProvisorio({ ativo, onMudar }: { ativo: boolean; onMudar: (v: boolean) => void }) {
  const t = useTranslations('patientRegistration');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #334155' }}>
      <input id="utente-provisorio" type="checkbox" checked={ativo} onChange={(e) => onMudar(e.target.checked)} aria-describedby="utente-provisorio-ajuda" style={{ marginTop: 3 }} />
      <div>
        <label htmlFor="utente-provisorio" style={{ display: 'block', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('unknownTitle')}</label>
        <p id="utente-provisorio-ajuda" style={{ fontSize: 12, color: 'var(--text-soft)', margin: '2px 0 0 0' }}>{t('unknownBody')}</p>
      </div>
    </div>
  );
}

interface Duplicado { id: string; nome: string; numeroProcesso: string; dataNascimento: string | null; motivo: 'nif' | 'sns' | 'nome_e_data' }

export function AvisoDuplicados({ nome, dataNascimento, nif, numeroSNS }: { nome: string; dataNascimento: string; nif: string; numeroSNS: string }) {
  const t = useTranslations('patientRegistration');
  // Espera 400 ms depois da última tecla antes de perguntar (react-query: cache e cancelamento).
  const [params, setParams] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (nif && nifValido(nif)) p['nif'] = nif;
    if (numeroSNS && numeroSnsValido(numeroSNS)) p['numeroSNS'] = numeroSNS;
    if (nome.trim().length >= 3 && dataNascimento) { p['nome'] = nome.trim(); p['dataNascimento'] = dataNascimento; }
    const espera = setTimeout(() => setParams(Object.keys(p).length ? p : null), 400);
    return () => clearTimeout(espera);
  }, [nome, dataNascimento, nif, numeroSNS]);
  const { data: duplicados = [] } = useQuery({
    queryKey: ['possiveis-duplicados', params],
    queryFn: () => api.get<Duplicado[]>('/doentes/possiveis-duplicados', { params: params ?? {} }).then((r) => r.data ?? []),
    enabled: params !== null,
    staleTime: 30_000,
  });

  if (!params || duplicados.length === 0) return null;
  return (
    <div role="alert" style={{ border: '1px solid #f59e0b', background: '#f59e0b1a', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{t('duplicatesTitle', { n: duplicados.length })}</p>
      <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, fontSize: 13 }}>
        {duplicados.map((d) => (
          <li key={d.id}>
            <Link href={`/doentes-admin/${d.id}`} style={{ color: '#93c5fd' }}>{d.nome}</Link>
            {' · '}{t('process', { numero: d.numeroProcesso })}
            {d.dataNascimento ? ` · ${new Date(d.dataNascimento).toLocaleDateString('pt-PT')}` : ''}
            {' · '}{t(`reason.${d.motivo}`)}
          </li>
        ))}
      </ul>
      <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--text-soft)' }}>{t('duplicatesHint')}</p>
    </div>
  );
}
