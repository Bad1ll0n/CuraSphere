'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface JitsiAPI {
  addEventListener: (event: string, handler: () => void) => void;
  dispose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: Record<string, unknown>) => JitsiAPI;
  }
}

export default function TeleconsultaPage() {
  const params = useParams();
  const router = useRouter();
  const { utilizador } = useAuth();
  const consultaId = params.consultaId as string;

  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [terminando, setTerminando] = useState(false);
  const [jitsiPronto, setJitsiPronto] = useState(false);

  useEffect(() => {
    api.get(`/consultas/${consultaId}/video/entrar`)
      .then(({ data }) => setRoomId(data.videoRoomId))
      .catch(() => setErro('Não foi possível obter os dados da videochamada.'));
  }, [consultaId]);

  const montarJitsi = useCallback(() => {
    if (!roomId || !containerRef.current || apiRef.current) return;
    const domain = process.env['NEXT_PUBLIC_JITSI_SERVER']?.replace('https://', '') ?? 'meet.jit.si';
    apiRef.current = new window.JitsiMeetExternalAPI(domain, {
      roomName: roomId,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      userInfo: { displayName: utilizador?.nome ?? 'CuraSphere' },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen', 'fodeviceselection', 'hangup', 'chat', 'recording', 'raisehand', 'videoquality', 'filmstrip', 'tileview'],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
      },
    });
    apiRef.current.addEventListener('videoConferenceLeft', () => {
      handleTerminar();
    });
  }, [roomId, utilizador?.nome]);

  useEffect(() => {
    if (jitsiPronto && roomId) montarJitsi();
  }, [jitsiPronto, roomId, montarJitsi]);

  useEffect(() => {
    return () => { apiRef.current?.dispose(); };
  }, []);

  const handleTerminar = async () => {
    if (terminando) return;
    setTerminando(true);
    try {
      if (utilizador?.role === 'medico') {
        await api.post(`/consultas/${consultaId}/video/terminar`);
      }
    } catch { /* vazio */ }
    apiRef.current?.dispose();
    router.push('/consultas');
  };

  if (erro) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>📹</div>
        <p style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 18 }}>{erro}</p>
        <button
          onClick={() => router.push('/consultas')}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          Voltar às Consultas
        </button>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://meet.jit.si/external_api.js"
        strategy="afterInteractive"
        onLoad={() => setJitsiPronto(true)}
      />
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
        {/* Barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📹</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>Teleconsulta CuraSphere</span>
            {roomId && <span style={{ color: 'var(--text-soft)', fontSize: 12, fontFamily: 'monospace' }}>#{roomId}</span>}
          </div>
          <button
            onClick={handleTerminar}
            disabled={terminando}
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: terminando ? 0.6 : 1 }}
          >
            {terminando ? 'A terminar...' : '✕ Terminar'}
          </button>
        </div>

        {/* Container Jitsi */}
        <div ref={containerRef} style={{ flex: 1, width: '100%' }}>
          {(!jitsiPronto || !roomId) && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #3b82f6', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>A carregar videochamada...</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
