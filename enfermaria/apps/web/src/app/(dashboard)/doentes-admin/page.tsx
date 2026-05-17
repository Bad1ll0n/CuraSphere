'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estadoRegisto: string;
  tipoVisita?: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama?: { numero: string; quarto: string };
}

const ESTADO_REGISTO_LABEL: Record<string, string> = {
  internado: 'Internado',
  ambulatorio: 'Ambulatório',
  pendente_cama: 'Aguarda Cama',
};

const ESTADO_REGISTO_COR: Record<string, string> = {
  internado:    'bg-blue-100 text-blue-700',
  ambulatorio:  'bg-green-100 text-green-700',
  pendente_cama:'bg-amber-100 text-amber-700',
};

const TIPO_VISITA_LABEL: Record<string, string> = {
  consulta: 'Consulta', exame: 'Exame', urgencia: 'Urgência',
  farmacia: 'Farmácia', internamento: 'Internamento', outro: 'Outro',
};

export default function DoentesAdminPage() {
  const { utilizador } = useAuth();
  const router = useRouter();
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesquisa, setPesquisa] = useState('');

  const carregar = useCallback(async () => {
    try {
      const res = await api.get('/doentes');
      const lista: Doente[] = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      setDoentes(lista.filter((d: Doente) => d.estadoRegisto !== 'alta'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (utilizador?.role !== 'administrativo') return null;

  const filtrados = doentes.filter(d =>
    d.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    d.numeroProcesso?.toLowerCase().includes(pesquisa.toLowerCase()) ||
    d.cama?.quarto?.toLowerCase().includes(pesquisa.toLowerCase())
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Doentes</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            Informação administrativa — {filtrados.length} utente{filtrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <input
          type="text"
          placeholder="Pesquisar nome, processo ou quarto..."
          value={pesquisa}
          onChange={e => setPesquisa(e.target.value)}
          className="border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          style={{ padding: '10px 16px', width: '280px' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '60px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px' }}>
          <p className="text-slate-400 text-sm">{pesquisa ? 'Sem resultados para a pesquisa.' : 'Sem utentes registados.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '14px 20px 14px 32px' }}>Utente</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '14px 12px' }}>Localização</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '14px 12px' }}>Estado</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '14px 12px' }}>Admissão</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '14px 12px' }}>Alta Prevista</th>
                <th style={{ padding: '14px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d, i) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid #f8fafc' : 'none' }}
                  onClick={() => router.push(`/doentes-admin/${d.id}`)}
                >
                  <td style={{ padding: '16px 20px 16px 32px' }}>
                    <p className="font-semibold text-slate-800">{d.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Proc. {d.numeroProcesso}</p>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    {d.cama ? (
                      <div>
                        <p className="font-medium text-slate-700">Quarto {d.cama.quarto}</p>
                        <p className="text-xs text-slate-400">Cama {d.cama.numero}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Sem cama</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${ESTADO_REGISTO_COR[d.estadoRegisto] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ESTADO_REGISTO_LABEL[d.estadoRegisto] ?? d.estadoRegisto}
                      </span>
                      {d.tipoVisita && (
                        <span className="text-xs text-slate-400">{TIPO_VISITA_LABEL[d.tipoVisita] ?? d.tipoVisita}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <span className="text-slate-600">
                      {new Date(d.dataAdmissao).toLocaleDateString('pt-PT')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    {d.dataAltaPrevista ? (
                      <span className="text-slate-600">{new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT')}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <span className="text-xs font-medium text-blue-600 hover:text-blue-700">Ver →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
