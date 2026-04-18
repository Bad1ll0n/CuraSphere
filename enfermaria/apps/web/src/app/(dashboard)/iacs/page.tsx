'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

interface DoenteIsolado {
  id: string;
  nome: string;
  emIsolamento: boolean;
  motivoIsolamento: string | null;
  cama: { numero: string; quarto: string };
  diagnosticoPrincipal: string;
  estado: string;
}

const MOTIVOS_PRESET = [
  'MRSA (Staphylococcus aureus resistente à meticilina)',
  'VRE (Enterococcus resistente à vancomicina)',
  'ESBL (Enterobactérias produtoras de ESBL)',
  'Clostridioides difficile',
  'Acinetobacter baumannii multirresistente',
  'Pseudomonas aeruginosa multirresistente',
  'Tuberculose pulmonar ativa',
  'Precauções de contacto — outro motivo',
  'Precauções de gotículas',
  'Precauções de via aérea',
];

export default function IacsPage() {
  const { utilizador } = useAuth();
  const [isolados, setIsolados] = useState<DoenteIsolado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/doentes/iacs/isolados')
      .then(r => setIsolados(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const podeEditar = ['medico', 'enfermeiro', 'chefe_turno', 'enf_uci'].includes(utilizador?.role ?? '');

  const ativarIsolamento = (d: DoenteIsolado) => {
    setMotivo('');
    setModal({ id: d.id, nome: d.nome });
  };

  const confirmarIsolamento = async () => {
    if (!modal) return;
    setSalvando(true);
    try {
      await api.patch(`/doentes/${modal.id}/isolamento`, { emIsolamento: true, motivoIsolamento: motivo || undefined });
      setModal(null);
      carregar();
    } finally { setSalvando(false); }
  };

  const levantarIsolamento = async (id: string) => {
    await api.patch(`/doentes/${id}/isolamento`, { emIsolamento: false });
    carregar();
  };

  const estadoCor: Record<string, string> = {
    estavel: 'bg-green-50 text-green-700',
    grave: 'bg-amber-50 text-amber-700',
    critico: 'bg-red-50 text-red-700',
    alta_prevista: 'bg-blue-50 text-blue-700',
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Controlo IACS</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            Doentes em isolamento por Infeções Associadas aos Cuidados de Saúde
          </p>
        </div>
        <button onClick={carregar} className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2" style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Aviso de precauções */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3" style={{ padding: '16px 20px', marginBottom: '28px' }}>
        <svg className="w-5 h-5 text-amber-600 shrink-0" style={{ marginTop: '1px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">Equipamento de Proteção Individual obrigatório</p>
          <p className="text-xs text-amber-700" style={{ marginTop: '2px' }}>
            Usar luvas, bata e máscara antes de entrar em quartos de isolamento. Higienizar mãos antes e após contacto.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar doentes em isolamento...</span>
        </div>
      ) : isolados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold">Nenhum doente em isolamento</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Sem casos IACS ativos de momento</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {isolados.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/doentes/${d.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-sm">
                        {d.nome}
                      </Link>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoCor[d.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {d.estado.replace('_', ' ')}
                      </span>
                      <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">ISOLAMENTO</span>
                    </div>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                      Quarto {d.cama.quarto} · Cama {d.cama.numero} · {d.diagnosticoPrincipal}
                    </p>
                    {d.motivoIsolamento && (
                      <p className="text-sm text-orange-700 font-medium" style={{ marginTop: '8px' }}>
                        {d.motivoIsolamento}
                      </p>
                    )}
                  </div>
                </div>
                {podeEditar && (
                  <button
                    onClick={() => levantarIsolamento(d.id)}
                    className="shrink-0 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    style={{ padding: '8px 14px' }}>
                    Levantar isolamento
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB para ativar isolamento via pesquisa de doente */}
      {podeEditar && (
        <div style={{ marginTop: '32px' }}>
          <p className="text-xs text-slate-400 text-center">
            Para colocar um doente em isolamento, aceda à sua{' '}
            <Link href="/doentes" className="text-blue-500 hover:underline">ficha individual</Link>{' '}
            e utilize a opção "Isolamento IACS".
          </p>
        </div>
      )}

      {/* Modal: Ativar isolamento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '4px' }}>Ativar Isolamento IACS</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{modal.nome}</p>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo de Isolamento</label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ padding: '10px 14px', marginBottom: '10px' }}>
              <option value="">Selecionar motivo...</option>
              {MOTIVOS_PRESET.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ou escrever motivo personalizado..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ padding: '10px 14px', marginBottom: '24px' }}
            />

            <div className="flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={confirmarIsolamento} disabled={salvando}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A ativar...' : 'Ativar Isolamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
