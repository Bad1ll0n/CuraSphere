'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  url: string;
  titulo: string;
  onClose: () => void;
}

interface PixelCache {
  rows: number;
  cols: number;
  pixels: Int16Array | Uint16Array | Uint8Array;
}

export function DicomViewer({ url, titulo, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wc, setWc] = useState(127);
  const [ww, setWw] = useState(256);
  const pixelCache = useRef<PixelCache | null>(null);

  const renderToCanvas = useCallback((center: number, width: number) => {
    const cache = pixelCache.current;
    const canvas = canvasRef.current;
    if (!cache || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { rows, cols, pixels } = cache;
    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;
    const lower = center - width / 2;
    const scale = 255 / width;

    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      const val = p <= lower ? 0 : p >= lower + width ? 255 : Math.round((p - lower) * scale);
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();

        const dp = await import('dicom-parser');
        const parseDicom = (dp as any).default?.parseDicom ?? (dp as any).parseDicom;
        const dataSet = parseDicom(new Uint8Array(buffer));

        const rows: number = dataSet.uint16('x00280010') ?? 512;
        const cols: number = dataSet.uint16('x00280011') ?? 512;
        const bitsStored: number = dataSet.uint16('x00280101') ?? 12;
        const isSigned: boolean = (dataSet.uint16('x00280103') ?? 0) === 1;

        const el = dataSet.elements['x7fe00010'];
        if (!el) throw new Error('Pixel data não encontrado no ficheiro DICOM');

        const pixelBuf = buffer.slice(el.dataOffset, el.dataOffset + el.length);
        let pixels: Int16Array | Uint16Array | Uint8Array;
        if (bitsStored <= 8) {
          pixels = new Uint8Array(pixelBuf);
        } else {
          pixels = isSigned ? new Int16Array(pixelBuf) : new Uint16Array(pixelBuf);
        }

        // Compute min/max for default window
        let min = pixels[0] ?? 0;
        let max = pixels[0] ?? 0;
        for (let i = 1; i < pixels.length; i++) {
          if (pixels[i] < min) min = pixels[i];
          if (pixels[i] > max) max = pixels[i];
        }

        const defaultWC = dataSet.floatString('x00281050') ?? (min + max) / 2;
        const defaultWW = dataSet.floatString('x00281051') ?? (max - min || 256);

        pixelCache.current = { rows, cols, pixels };

        const canvas = canvasRef.current;
        if (canvas && !cancelled) {
          canvas.width = cols;
          canvas.height = rows;
        }

        if (!cancelled) {
          setWc(defaultWC);
          setWw(defaultWW);
          setLoading(false);
          renderToCanvas(defaultWC, defaultWW);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Erro ao processar ficheiro DICOM');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [url, renderToCanvas]);

  const handleWcChange = (v: number) => { setWc(v); renderToCanvas(v, ww); };
  const handleWwChange = (v: number) => { setWw(v); renderToCanvas(wc, v); };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#000' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ backgroundColor: 'rgba(15,15,15,0.92)', padding: '10px 16px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-mono uppercase tracking-wide">DICOM</span>
          <span className="text-white text-sm font-medium">{titulo}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Fechar viewer"
        >
          ✕
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar imagem DICOM...</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '32px' }}>
            <span className="text-4xl">⚠</span>
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <p className="text-slate-500 text-xs">Verifique se o ficheiro é um DICOM válido (modalidade CR ou DX)</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: loading || error ? 'none' : 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Window/Level controls */}
      {!loading && !error && (
        <div
          className="shrink-0 flex items-center gap-6"
          style={{ backgroundColor: 'rgba(15,15,15,0.92)', padding: '10px 20px' }}
        >
          <div className="flex items-center gap-3 flex-1">
            <span className="text-slate-400 text-xs font-mono w-6 shrink-0">WC</span>
            <input
              type="range" min={-2048} max={4096} step={1} value={wc}
              onChange={e => handleWcChange(parseInt(e.target.value))}
              className="flex-1 accent-blue-400 h-1"
            />
            <span className="text-slate-300 text-xs font-mono w-14 text-right shrink-0">{Math.round(wc)}</span>
          </div>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-slate-400 text-xs font-mono w-6 shrink-0">WW</span>
            <input
              type="range" min={1} max={8192} step={1} value={ww}
              onChange={e => handleWwChange(parseInt(e.target.value))}
              className="flex-1 accent-blue-400 h-1"
            />
            <span className="text-slate-300 text-xs font-mono w-14 text-right shrink-0">{Math.round(ww)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
