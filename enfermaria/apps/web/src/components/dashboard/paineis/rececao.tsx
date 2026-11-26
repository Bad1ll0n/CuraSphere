'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { StatCard, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';
import { Button } from '@/components/ui';

export function DashboardRececao({ utilizador }: { utilizador: any }) {
  const [enviandoLembretes, setEnviandoLembretes] = useState(false);
  const [lembretesEnviados, setLembretesEnviados] = useState<number | null>(null);

  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  // ARQ-23: só as consultas de hoje (antes pedia todas as de sempre e filtrava no browser).
  const hojeStr = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local

  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-rececao'],
    queryFn: async () => {
      const hoje = new Date().toDateString();
      const [r, ra] = await Promise.all([
        api.get(`/consultas?data=${hojeStr}`).catch(() => ({ data: [] })),
        api.get(`/consultas?data=${amanhaStr}`).catch(() => ({ data: [] })),
      ]);
      return {
        consultas: (r.data ?? []).filter((c: any) => new Date(c.dataHora).toDateString() === hoje),
        consultasAmanha: (ra.data ?? []).filter((c: any) => c.estado === 'agendada').length,
      };
    },
    staleTime: 60_000,
  });

  const { data: salaStats } = useQuery({
    queryKey: ['dash-sala-espera'],
    queryFn: () => api.get('/sala-espera/estatisticas').then(r => r.data).catch(() => null),
    refetchInterval: 30_000,
  });

  const enviarLembretes = async () => {
    setEnviandoLembretes(true);
    try {
      const res = await api.post('/consultas/lembretes');
      setLembretesEnviados(res.data?.enviados ?? 0);
    } catch {
      setLembretesEnviados(0);
    } finally { setEnviandoLembretes(false); }
  };

  const consultas: any[] = (data as any).consultas ?? [];
  const consultasAmanha: number = (data as any).consultasAmanha ?? 0;

  const realizadas = consultas.filter((c: any) => c.estado === 'realizada');
  const faltaram = consultas.filter((c: any) => c.estado === 'faltou');
  const agendadas = consultas.filter((c: any) => c.estado === 'agendada');

  const estadoConsulta: Record<string, { badge: string; label: string }> = {
    agendada: { badge: 'bg-blue-100 text-blue-700', label: 'Agendada' },
    realizada: { badge: 'bg-emerald-100 text-emerald-700', label: 'Realizada' },
    faltou: { badge: 'bg-red-100 text-red-700', label: 'Faltou' },
    cancelada: { badge: 'bg-slate-100 text-slate-600', label: 'Cancelada' },
  };

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Consultas Hoje" value={consultas.length} color="bg-pink-600" />
        <StatCard label="Realizadas" value={realizadas.length} color="bg-emerald-500" />
        <StatCard label="Agendadas" value={agendadas.length} color="bg-blue-500" />
        <StatCard label="Faltaram" value={faltaram.length} color={faltaram.length > 0 ? 'bg-red-500' : 'bg-slate-400'} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Consultas de Hoje" count={consultas.length} />
          {consultas.length === 0 ? <Vazio msg="Sem consultas para hoje" /> : (
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {consultas.sort((a: any, b: any) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < consultas.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.nomeDoente ?? c.doente?.nome ?? 'Doente'}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {c.especialidade} · {c.medico?.nome?.split(' ')[0] ?? 'Médico'}
                    </p>
                  </div>
                  <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ${estadoConsulta[c.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                    {estadoConsulta[c.estado]?.label ?? c.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* ── Sala de Espera em Tempo Real ── */}
          <Link href="/sala-espera" className="block">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-shadow" style={{ padding: '20px 24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <p className="text-sm font-semibold text-slate-800">Sala de Espera</p>
                </div>
                <span className="text-xs text-slate-500">Tempo real</span>
              </div>
              {salaStats ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'A aguardar', value: salaStats.aguardando, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Em atendimento', value: salaStats.em_atendimento, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Atendidos hoje', value: salaStats.atendidos, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Tempo médio', value: salaStats.tempoMedioMin !== null ? `${salaStats.tempoMedioMin}min` : '—', color: 'text-slate-600', bg: 'bg-slate-50' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl flex flex-col items-center justify-center`} style={{ padding: '10px 8px' }}>
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center text-slate-500 text-sm" style={{ padding: '20px 0' }}>A carregar...</div>
              )}
            </div>
          </Link>

          {/* ── Confirmação Automática ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
              <p className="text-sm font-semibold text-slate-800">Confirmação Automática</p>
              <span className="text-xs font-medium badge-pad py-0.5 rounded-full bg-blue-50 text-blue-600">{consultasAmanha} amanhã</span>
            </div>
            <p className="text-xs text-slate-500" style={{ marginBottom: '14px' }}>
              Envia um lembrete interno a todos os médicos com consultas marcadas para amanhã.
            </p>
            {lembretesEnviados !== null && (
              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl text-emerald-700 text-xs font-medium" style={{ padding: '8px 12px', marginBottom: '10px' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {lembretesEnviados} lembrete{lembretesEnviados !== 1 ? 's' : ''} enviado{lembretesEnviados !== 1 ? 's' : ''}
              </div>
            )}
            <Button variant="primary" fullWidth
              onClick={enviarLembretes}
              disabled={enviandoLembretes || consultasAmanha === 0}
              
              style={{ padding: '10px' }}
            >
              {enviandoLembretes ? 'A enviar...' : 'Enviar Lembretes'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
