'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama: { numero: string; quarto: string };
}

const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:      { badge: 'bg-green-50 text-green-700 border border-green-200',   dot: 'bg-green-500' },
  grave:        { badge: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  critico:      { badge: 'bg-red-50 text-red-700 border border-red-200',          dot: 'bg-red-500' },
  alta_prevista:{ badge: 'bg-blue-50 text-blue-700 border border-blue-200',       dot: 'bg-blue-500' },
};

const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};


export default function DoentesPagina() {
  const { utilizador } = useAuth();
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesquisa, setPesquisa] = useState('');

  const podeAdmitir = ['administrativo', 'chefe_enfermeiros', 'chefe_turno'].includes(utilizador?.role ?? '');

  useEffect(() => {
    api.get('/doentes').then((r) => setDoentes(r.data)).finally(() => setLoading(false));
  }, []);

  const filtrados = doentes.filter((d) =>
    d.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    d.numeroProcesso.includes(pesquisa) ||
    d.cama.numero.includes(pesquisa),
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Doentes</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {doentes.length} {doentes.length === 1 ? 'doente internado' : 'doentes internados'}
          </p>
        </div>
        {podeAdmitir && (
          <Link
            href="/doentes/admitir"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
            style={{ padding: '11px 22px', fontSize: '14px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Admitir Doente
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Barra de pesquisa */}
        <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por nome, processo ou cama..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {pesquisa && (
            <button onClick={() => setPesquisa('')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '64px' }}>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar...</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px' }}>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm" style={{ marginBottom: '4px' }}>
              {pesquisa ? 'Nenhum doente encontrado' : 'Sem doentes internados'}
            </p>
            <p className="text-slate-400 text-xs">
              {pesquisa ? 'Tente outro termo de pesquisa' : 'Os doentes admitidos aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 24px' }}>Doente</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Processo</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Cama</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Diagnóstico</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Estado</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Admissão</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Alta Prevista</th>
                  <th style={{ padding: '13px 24px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d, i) => (
                  <tr key={d.id}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid #f8fafc' : undefined }}>
                    <td style={{ padding: '16px 24px' }}>
                      <span className="font-semibold text-slate-800">{d.nome}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 font-mono text-xs">{d.numeroProcesso}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-600 font-medium">
                        Quarto {d.cama.quarto} · Cama {d.cama.numero}
                      </span>
                    </td>
                    <td style={{ padding: '16px', maxWidth: '200px' }}>
                      <span className="text-slate-500 truncate block">{d.diagnosticoPrincipal}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-500'}`} style={{ padding: '5px 10px' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${estadoCor[d.estado]?.dot ?? 'bg-slate-400'}`} />
                        {estadoLabel[d.estado] ?? d.estado}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 text-xs">{new Date(d.dataAdmissao).toLocaleDateString('pt-PT')}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 text-xs">
                        {d.dataAltaPrevista ? new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <Link href={`/doentes/${d.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                        Ver
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
