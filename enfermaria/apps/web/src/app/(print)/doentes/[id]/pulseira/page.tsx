'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import api from '@/lib/api';

interface Pulseira {
  conteudo: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: string | null;
  sexo: string | null;
  temAlergias: boolean;
  alergiasAvaliadas: boolean;
}

/**
 * UX-08 — pulseira do doente para impressão. O QR leva o n.º de processo e a data de
 * nascimento (dois identificadores, como pede a norma); o leitor à cabeceira confirma-os
 * no servidor contra o doente da prescrição.
 */
export default function PulseiraPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Pulseira | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/resumo/doente/${id}/pulseira`)
      .then((r) => { setP(r.data); setTimeout(() => window.print(), 600); })
      .catch((e) => setErro(e?.response?.data?.message ?? 'Não foi possível obter os dados da pulseira.'));
  }, [id]);

  if (erro) return <p role="alert" style={{ padding: 24, color: '#b91c1c' }}>{erro}</p>;
  if (!p) return <p style={{ padding: 24 }}>A preparar a pulseira…</p>;

  const nasc = p.dataNascimento ? new Date(p.dataNascimento).toLocaleDateString('pt-PT', { timeZone: 'UTC' }) : '—';
  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print { .no-print { display: none !important; } @page { size: 250mm 30mm; margin: 2mm; } body { margin: 0; } }
      `}</style>
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <button onClick={() => window.print()} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Imprimir pulseira
        </button>
        <button onClick={() => window.close()} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
      </div>
      <div data-testid="pulseira" style={{ display: 'flex', alignItems: 'center', gap: 16, border: '1px dashed #94a3b8', borderRadius: 6, padding: '6px 12px', width: 'fit-content' }}>
        <QRCode value={p.conteudo} size={88} />
        <div style={{ lineHeight: 1.35 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{p.nome}</div>
          <div style={{ fontSize: 13 }}>Processo <strong>{p.numeroProcesso}</strong> · Nasc. <strong>{nasc}</strong>{p.sexo ? ` · ${p.sexo}` : ''}</div>
          {p.temAlergias && <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>⚠ ALERGIAS — confirmar na ficha</div>}
          {!p.alergiasAvaliadas && <div style={{ fontSize: 12, color: '#92400e' }}>Alergias por avaliar</div>}
        </div>
      </div>
    </div>
  );
}
