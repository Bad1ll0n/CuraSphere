'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useEtiquetaUnidose } from '@/lib/hooks';

/**
 * UX-08 — etiqueta de unidose. O QR é assinado pelo servidor (não é JSON do cliente);
 * à cabeceira, ler a etiqueta confirma que a unidose é desta prescrição, com esta dose e via.
 */
export default function EtiquetaUnidosePage() {
  const { id } = useParams<{ id: string }>();
  const { data: e, error } = useEtiquetaUnidose(id);
  const erro = error ? ((error as any)?.response?.data?.message ?? 'Não foi possível gerar a etiqueta.') : null;
  useEffect(() => {
    if (!e) return undefined;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [e]);

  if (erro) return <p role="alert" style={{ padding: 24, color: '#b91c1c' }}>{erro}</p>;
  if (!e) return <p style={{ padding: 24 }}>A gerar a etiqueta…</p>;

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print { .no-print { display: none !important; } @page { size: 60mm 40mm; margin: 2mm; } body { margin: 0; } }
      `}</style>
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <button onClick={() => window.print()} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Imprimir etiqueta
        </button>
        <button onClick={() => window.close()} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
      </div>
      <div data-testid="etiqueta-unidose" style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px dashed #94a3b8', borderRadius: 6, padding: 6, width: 'fit-content' }}>
        <QRCode value={e.qrPayload} size={110} />
        <div style={{ lineHeight: 1.3, fontSize: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{e.nome}</div>
          <div>{e.dose} · {e.via} · {e.frequencia}</div>
          <div style={{ marginTop: 4 }}>{e.doente.nome}</div>
          <div>Proc. {e.doente.numeroProcesso}</div>
          <div style={{ color: '#64748b' }}>Emitida {new Date(e.emitidoEm).toLocaleString('pt-PT')}</div>
        </div>
      </div>
    </div>
  );
}
