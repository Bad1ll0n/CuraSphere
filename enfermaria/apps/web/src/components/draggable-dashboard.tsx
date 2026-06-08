'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import GridLayout, { Layout, LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '@/lib/api';

export interface WidgetDef {
  id: string;
  label: string;
  defaultX: number;
  defaultY: number;
  defaultW: number;
  defaultH: number;
  component: React.ReactNode;
}

interface SavedWidget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

function toLayout(widgets: WidgetDef[], saved: SavedWidget[] | null): LayoutItem[] {
  return widgets.map(w => {
    const s = saved?.find(s => s.id === w.id);
    return { i: w.id, x: s?.x ?? w.defaultX, y: s?.y ?? w.defaultY, w: s?.w ?? w.defaultW, h: s?.h ?? w.defaultH };
  });
}

function isVisible(id: string, saved: SavedWidget[] | null): boolean {
  if (!saved) return true;
  const s = saved.find(s => s.id === id);
  return s ? s.visible : true;
}

interface DraggableDashboardProps {
  widgets: WidgetDef[];
  cols?: number;
  rowHeight?: number;
}

export function DraggableDashboard({ widgets, cols = 12, rowHeight = 120 }: DraggableDashboardProps) {
  const [saved, setSaved] = useState<SavedWidget[] | null>(null);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [width, setWidth] = useState(1280);
  const [editMode, setEditMode] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/dashboard-config').then(r => {
      const data: SavedWidget[] | null = r.data;
      setSaved(data);
      setLayout(toLayout(widgets, data));
    }).catch(() => {
      setLayout(toLayout(widgets, null));
    });
  }, []);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const persistLayout = useCallback((newLayout: Layout, currentSaved: SavedWidget[] | null) => {
    const updated: SavedWidget[] = [...newLayout].map(l => ({
      id: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      visible: isVisible(l.i, currentSaved),
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.put('/dashboard-config', { widgets: updated }).catch(() => null);
      setSaved(updated);
    }, 1000);
  }, []);

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    setLayout([...newLayout]);
    persistLayout(newLayout, saved);
  }, [saved, persistLayout]);

  const toggleWidget = (id: string) => {
    const updatedSaved: SavedWidget[] = widgets.map(w => {
      const existing = saved?.find(s => s.id === w.id);
      const vis = w.id === id ? !isVisible(id, saved) : isVisible(w.id, saved);
      return { id: w.id, x: existing?.x ?? w.defaultX, y: existing?.y ?? w.defaultY, w: existing?.w ?? w.defaultW, h: existing?.h ?? w.defaultH, visible: vis };
    });
    setSaved(updatedSaved);
    api.put('/dashboard-config', { widgets: updatedSaved }).catch(() => null);
  };

  const resetLayout = async () => {
    await api.delete('/dashboard-config').catch(() => null);
    setSaved(null);
    setLayout(toLayout(widgets, null));
  };

  const visibleWidgets = widgets.filter(w => isVisible(w.id, saved));
  const visibleLayout: Layout = layout.filter(l => visibleWidgets.some(w => w.id === l.i));

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2" style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setEditMode(v => !v)}
          className={`text-xs font-semibold rounded-xl border transition-colors ${editMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
          style={{ padding: '6px 14px' }}
        >
          {editMode ? 'Concluir edição' : 'Personalizar dashboard'}
        </button>
        {editMode && (
          <button
            onClick={resetLayout}
            className="text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl"
            style={{ padding: '6px 14px' }}
          >
            Repor layout
          </button>
        )}
      </div>

      {/* Widget visibility toggles in edit mode */}
      {editMode && (
        <div className="flex flex-wrap gap-2 bg-slate-50 rounded-2xl border border-slate-200" style={{ padding: '12px 16px', marginBottom: '16px' }}>
          <span className="text-xs font-semibold text-slate-500 self-center" style={{ marginRight: '4px' }}>Widgets:</span>
          {widgets.map(w => {
            const vis = isVisible(w.id, saved);
            return (
              <button key={w.id} onClick={() => toggleWidget(w.id)}
                className={`text-xs font-semibold rounded-lg border transition-colors ${vis ? 'bg-white text-slate-700 border-slate-300' : 'bg-slate-200 text-slate-400 border-slate-200 line-through'}`}
                style={{ padding: '4px 10px' }}>
                {w.label}
              </button>
            );
          })}
        </div>
      )}

      <GridLayout
        layout={visibleLayout}
        width={width}
        gridConfig={{ cols, rowHeight, margin: [16, 16] }}
        dragConfig={{ enabled: editMode, handle: '.widget-drag-handle', bounded: false, threshold: 3 }}
        resizeConfig={{ enabled: editMode, handles: ['se'] }}
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map(w => (
          <div key={w.id} style={{ overflow: 'hidden', position: 'relative' }}>
            {editMode && (
              <div className="widget-drag-handle" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)', zIndex: 10, fontSize: '10px', color: '#6366f1', fontWeight: 600, borderRadius: '12px 12px 0 0' }}>
                ⠿ {w.label}
              </div>
            )}
            <div style={editMode ? { paddingTop: '24px', height: '100%' } : { height: '100%' }}>
              {w.component}
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
