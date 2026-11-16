'use client';
import dynamic from 'next/dynamic';

/**
 * PERF-10 — o gerador de QR (react-qr-code) só se descarrega quando um QR é mostrado
 * (diálogos de QR do doente e da cama, etiqueta de unidose), não no primeiro carregamento.
 */
export const QRCode = dynamic(() => import('react-qr-code'), { ssr: false });
