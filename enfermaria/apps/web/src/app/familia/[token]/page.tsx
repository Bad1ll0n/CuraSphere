'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

interface PortalData {
  nomeContacto: string;
  doente: {
    nome: string;
    internamentoDesde: string;
    servico: string;
    estadoGeral: string;
    ultimaAvaliacao: string | null;
  };
}

export default function FamiliaPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<PortalData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/familia/portal/${token}`)
      .then(r => setDados(r.data))
      .catch(e => setErro(e?.response?.data?.message ?? 'Acesso inválido ou expirado'))
      .finally(() => setLoading(false));
  }, [token]);

  const estadoCor: Record<string, { bg: string; text: string; dot: string }> = {
    'estável':                   { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-500' },
    'sob observação':            { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
    'a ser acompanhado de perto':{ bg: 'bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500' },
  };
  const cor = dados ? (estadoCor[dados.doente.estadoGeral] ?? estadoCor['estável']) : estadoCor['estável'];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" style={{ padding: '24px' }}>
      <div className="w-full" style={{ maxWidth: '480px' }}>
        {/* Logo / Header */}
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg" style={{ marginBottom: '12px' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Portal de Família</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>CuraSphere — Acesso seguro</p>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px' }}>
            <svg className="animate-spin w-8 h-8 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-400" style={{ marginTop: '12px' }}>A verificar acesso...</p>
          </div>
        )}

        {erro && !loading && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm" style={{ padding: '32px' }}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-red-800" style={{ marginBottom: '8px' }}>Acesso não disponível</h2>
              <p className="text-sm text-red-600">{erro}</p>
              <p className="text-xs text-slate-400" style={{ marginTop: '12px' }}>
                O link pode ter expirado (válido 7 dias) ou sido revogado. Contacte o serviço de enfermagem para obter um novo link.
              </p>
            </div>
          </div>
        )}

        {dados && !loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '32px' }}>
            <p className="text-slate-500 text-sm" style={{ marginBottom: '24px' }}>
              Olá, <strong className="text-slate-800">{dados.nomeContacto}</strong>. Aqui encontra o estado geral do seu familiar.
            </p>

            {/* Estado principal */}
            <div className={`rounded-2xl ${cor.bg} border border-slate-200`} style={{ padding: '24px', marginBottom: '24px' }}>
              <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
                <div className={`w-3 h-3 rounded-full ${cor.dot}`} />
                <h2 className={`text-lg font-bold ${cor.text}`}>{dados.doente.nome}</h2>
              </div>
              <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                <span className={`text-sm font-semibold ${cor.text}`}>Estado:</span>
                <span className={`text-sm ${cor.text}`}>{dados.doente.estadoGeral}</span>
              </div>
              {dados.doente.ultimaAvaliacao && (
                <p className="text-xs text-slate-500">
                  Última avaliação: {new Date(dados.doente.ultimaAvaliacao).toLocaleString('pt-PT', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100" style={{ paddingBottom: '12px' }}>
                <span className="text-sm text-slate-500">Serviço</span>
                <span className="text-sm font-medium text-slate-800">{dados.doente.servico}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Internamento desde</span>
                <span className="text-sm font-medium text-slate-800">
                  {new Date(dados.doente.internamentoDesde).toLocaleDateString('pt-PT')}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-600" style={{ padding: '12px 16px', marginTop: '24px' }}>
              Este portal apresenta apenas informação geral. Para questões clínicas detalhadas, contacte directamente o serviço.
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400" style={{ marginTop: '24px' }}>
          CuraSphere — Acesso seguro e privado. Este link expira ao fim de 7 dias.
        </p>
      </div>
    </div>
  );
}
