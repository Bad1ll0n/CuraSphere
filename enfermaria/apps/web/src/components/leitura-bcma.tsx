'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';

/**
 * UX-08 — leitura por código à cabeceira (BCMA): pulseira do doente e embalagem/unidose.
 *
 * - Leitor USB/Bluetooth em modo teclado: o campo tem foco e o leitor "escreve" o código
 *   seguido de Enter.
 * - Câmara do tablet: `BarcodeDetector` (QR, DataMatrix, Code128, EAN-13) quando o browser o
 *   tem; senão, fica o leitor por teclado.
 * O servidor confirma cada leitura contra o doente e a prescrição; o que não confere bloqueia.
 */
export interface ResultadoLeitura { ok: boolean; motivo: string; lote?: string | null; validade?: string | null }
export interface EstadoLeitura {
  pulseira: { codigo: string; resultado: ResultadoLeitura } | null;
  medicamento: { codigo: string; resultado: ResultadoLeitura } | null;
  excecao: string;
}
export const LEITURA_VAZIA: EstadoLeitura = { pulseira: null, medicamento: null, excecao: '' };

/** Campos a enviar com a administração. */
export function camposLeitura(e: EstadoLeitura) {
  return {
    ...(e.pulseira ? { leituraPulseira: e.pulseira.codigo } : {}),
    ...(e.medicamento ? { leituraMedicamento: e.medicamento.codigo } : {}),
    ...(e.excecao.trim() ? { leituraExcecao: e.excecao.trim() } : {}),
  };
}

/** A leitura bloqueia se alguma coisa lida não confere. */
export function leituraBloqueia(e: EstadoLeitura) {
  return (!!e.pulseira && !e.pulseira.resultado.ok) || (!!e.medicamento && !e.medicamento.resultado.ok);
}

type DetectorCtor = new (o?: { formats?: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function CampoLeitura({ id, rotulo, aguarda, resultado, onLido }: {
  id: string; rotulo: string; aguarda: boolean; resultado: ResultadoLeitura | null; onLido: (codigo: string) => void;
}) {
  const t = useTranslations('bcma');
  const [valor, setValor] = useState('');
  const [camara, setCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const Detector = typeof window !== 'undefined' ? (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector : undefined;

  useEffect(() => {
    if (!camara || !Detector) return;
    let stream: MediaStream | null = null;
    let parar = false;
    const detector = new Detector({ formats: ['qr_code', 'data_matrix', 'code_128', 'ean_13', 'ean_8'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        while (!parar) {
          const r = await detector.detect(videoRef.current).catch(() => []);
          if (r[0]?.rawValue) { onLido(r[0].rawValue); setCamara(false); break; }
          await new Promise((res) => setTimeout(res, 250));
        }
      } catch { setCamara(false); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camara, Detector, onLido]);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>{rotulo}</label>
      <div className="flex gap-2">
        <input id={id} value={valor} disabled={aguarda} autoComplete="off"
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valor.trim()) { e.preventDefault(); onLido(valor.trim()); setValor(''); } }}
          placeholder={t('scanPlaceholder')}
          className="flex-1 border border-slate-300 rounded-lg text-sm font-mono" style={{ padding: '8px 10px' }} />
        {Detector && (
          <button type="button" onClick={() => setCamara((v) => !v)} className="text-xs font-semibold border border-slate-300 rounded-lg" style={{ padding: '6px 10px' }}>
            {camara ? t('closeCamera') : t('camera')}
          </button>
        )}
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- vídeo da câmara para leitura de códigos, sem áudio */}
      {camara && <video ref={videoRef} className="w-full rounded-lg bg-black" style={{ marginTop: '6px', maxHeight: '200px' }} muted playsInline />}
      {aguarda && <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{t('checking')}</p>}
      {resultado && (
        <p role={resultado.ok ? 'status' : 'alert'} className={`text-xs font-semibold rounded ${resultado.ok ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}`} style={{ marginTop: '4px', padding: '4px 8px' }}>
          {resultado.ok ? '✓ ' : '⛔ '}{resultado.motivo}
          {resultado.lote && t('lot', { lote: resultado.lote })}{resultado.validade && t('expiry', { data: String(resultado.validade).slice(0, 10) })}
        </p>
      )}
    </div>
  );
}

export function LeituraBcma({ medicacaoId, doenteId, estado, onChange }: {
  medicacaoId: string; doenteId: string; estado: EstadoLeitura; onChange: (e: EstadoLeitura) => void;
}) {
  const t = useTranslations('bcma');
  const [aVerificar, setAVerificar] = useState<'pulseira' | 'medicamento' | null>(null);
  const [semLeitura, setSemLeitura] = useState(false);

  const verificar = async (tipo: 'pulseira' | 'medicamento', codigo: string) => {
    setAVerificar(tipo);
    try {
      const r = await api.post(`/medicacao/${medicacaoId}/verificar-leitura`, { doenteId, [tipo]: codigo });
      onChange({ ...estado, [tipo]: { codigo, resultado: r.data[tipo] } });
    } catch (e: any) {
      onChange({ ...estado, [tipo]: { codigo, resultado: { ok: false, motivo: e?.response?.data?.message ?? t('verifyError') } } });
    } finally { setAVerificar(null); }
  };

  return (
    <fieldset className="rounded-lg border border-blue-200 bg-blue-50/40 flex flex-col gap-3" style={{ padding: '10px 12px' }}>
      <legend className="text-xs font-semibold text-blue-900 uppercase tracking-wide">{t('title')}</legend>
      <CampoLeitura id={`bcma-pulseira-${medicacaoId}`} rotulo={t('wristband')} aguarda={aVerificar === 'pulseira'}
        resultado={estado.pulseira?.resultado ?? null} onLido={(c) => verificar('pulseira', c)} />
      <CampoLeitura id={`bcma-med-${medicacaoId}`} rotulo={t('pack')} aguarda={aVerificar === 'medicamento'}
        resultado={estado.medicamento?.resultado ?? null} onLido={(c) => verificar('medicamento', c)} />
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={semLeitura} onChange={(e) => { setSemLeitura(e.target.checked); if (!e.target.checked) onChange({ ...estado, excecao: '' }); }} />
        {t('cantScan')}
      </label>
      {semLeitura && (
        <input aria-label={t('whyLabel')} value={estado.excecao} maxLength={500}
          onChange={(e) => onChange({ ...estado, excecao: e.target.value })}
          placeholder={t('whyPlaceholder')} className="border border-amber-300 bg-amber-50 rounded-lg text-sm" style={{ padding: '8px 10px' }} />
      )}
    </fieldset>
  );
}
