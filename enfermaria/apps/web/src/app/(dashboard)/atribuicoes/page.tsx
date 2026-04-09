'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Utilizador {
  id: string;
  nome: string;
  role: string;
  ordemExperiencia?: number;
  equipa?: string;
}

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  cama: { numero: string; quarto: string };
}

interface Atribuicao {
  doenteId: string;
  utilizadorId: string;
  doente: Doente;
  utilizador: Utilizador;
}

interface HorarioTurno {
  id: string;
  tipo: string;
  data: string;
  profissionais: { utilizadorId: string; utilizador: Utilizador }[];
  atribuicoes: Atribuicao[];
}

const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const tipoCor: Record<string, { bg: string; text: string; border: string }> = {
  manha: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  tarde: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  noite: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};
const estadoCor: Record<string, string> = {
  estavel: 'bg-green-50 text-green-700 border border-green-200',
  grave: 'bg-orange-50 text-orange-700 border border-orange-200',
  critico: 'bg-red-50 text-red-700 border border-red-200',
  alta_prevista: 'bg-blue-50 text-blue-700 border border-blue-200',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

export default function AtribuicoesPage() {
  const { utilizador } = useAuth();
  const [turnos, setTurnos] = useState<HorarioTurno[]>([]);
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [turnoSelecionado, setTurnoSelecionado] = useState<HorarioTurno | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [turnosR, doentesR] = await Promise.all([
        api.get('/atribuicoes/turnos'),
        api.get('/doentes?todos=true'),
      ]);
      setTurnos(turnosR.data);
      setDoentes(doentesR.data);
      if (turnosR.data.length > 0 && !turnoSelecionado) {
        setTurnoSelecionado(turnosR.data[0]);
      } else if (turnoSelecionado) {
        const atualizado = turnosR.data.find((t: HorarioTurno) => t.id === turnoSelecionado.id);
        if (atualizado) setTurnoSelecionado(atualizado);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const chefeDeTurno = (turno: HorarioTurno): Utilizador | null => {
    const enfermeiros = turno.profissionais
      .filter((p) => p.utilizador.role === 'enfermeiro')
      .sort((a, b) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999));
    return enfermeiros[0]?.utilizador ?? null;
  };

  const souChefe = turnoSelecionado ? chefeDeTurno(turnoSelecionado)?.id === utilizador?.id : false;

  const atribuicaoDe = (doenteId: string): Atribuicao | undefined =>
    turnoSelecionado?.atribuicoes.find((a) => a.doenteId === doenteId);

  const atribuir = async (doenteId: string, utilizadorId: string) => {
    if (!turnoSelecionado) return;
    setSalvando(true);
    try {
      // Se já tem alguém diferente, remover primeiro
      const atual = atribuicaoDe(doenteId);
      if (atual && atual.utilizadorId !== utilizadorId) {
        await api.delete(`/atribuicoes/turno/${turnoSelecionado.id}`, {
          data: { doenteId, utilizadorId: atual.utilizadorId },
        });
      }
      if (!atual || atual.utilizadorId !== utilizadorId) {
        await api.post(`/atribuicoes/turno/${turnoSelecionado.id}`, { doenteId, utilizadorId });
      } else {
        // Clicou no mesmo — remove
        await api.delete(`/atribuicoes/turno/${turnoSelecionado.id}`, {
          data: { doenteId, utilizadorId },
        });
      }
      await carregar();
    } finally {
      setSalvando(false);
    }
  };

  const enfermeirosDoTurno = turnoSelecionado?.profissionais
    .filter((p) => p.utilizador.role === 'enfermeiro')
    .sort((a, b) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999)) ?? [];

  const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atribuições de Turno</h1>
          <p className="text-slate-500 text-sm capitalize" style={{ marginTop: '6px' }}>{hoje}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : turnos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px' }}>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium" style={{ marginBottom: '6px' }}>Sem turnos hoje</p>
          <p className="text-slate-400 text-sm">Não existem turnos agendados para hoje</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-6">

          {/* Coluna esquerda — seleção de turno */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Turnos de hoje</p>
            <div className="flex flex-col gap-3">
              {(['manha', 'tarde', 'noite'] as const).map((tipo) => {
                const turno = turnos.find((t) => t.tipo === tipo);
                if (!turno) return null;
                const chefe = chefeDeTurno(turno);
                const cor = tipoCor[tipo];
                const ativo = turnoSelecionado?.id === turno.id;
                return (
                  <button
                    key={turno.id}
                    onClick={() => setTurnoSelecionado(turno)}
                    className={`text-left rounded-2xl border transition-all ${ativo ? `${cor.bg} ${cor.border}` : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    style={{ padding: '16px 18px' }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                      <span className={`text-sm font-bold ${ativo ? cor.text : 'text-slate-700'}`}>{tipoLabel[tipo]}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${ativo ? `${cor.bg} ${cor.text} border ${cor.border}` : 'bg-slate-100 text-slate-500'}`}>
                        {turno.atribuicoes.length} atrib.
                      </span>
                    </div>
                    <p className="text-xs text-slate-400" style={{ marginBottom: '4px' }}>
                      {turno.profissionais.filter(p => p.utilizador.role === 'enfermeiro').length} enfermeiros
                    </p>
                    {chefe && (
                      <p className="text-xs font-medium text-slate-500">
                        Chefe: <span className="text-slate-700">{chefe.nome.split(' ')[0]}</span>
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna direita — tabela de atribuições */}
          <div className="col-span-3">
            {turnoSelecionado && (
              <>
                {/* Info turno */}
                <div className={`rounded-2xl border ${tipoCor[turnoSelecionado.tipo].bg} ${tipoCor[turnoSelecionado.tipo].border} flex items-center justify-between`} style={{ padding: '14px 20px', marginBottom: '20px' }}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-base ${tipoCor[turnoSelecionado.tipo].text}`}>
                      Turno da {tipoLabel[turnoSelecionado.tipo]}
                    </span>
                    {souChefe && (
                      <span className="text-xs font-semibold bg-white/70 text-slate-600 px-2 py-0.5 rounded-md border border-white/80">
                        És o chefe deste turno
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">{doentes.length} doentes</span>
                    <span className="text-slate-500">{enfermeirosDoTurno.length} enfermeiros</span>
                  </div>
                </div>

                {!souChefe && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-sm text-amber-700" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Apenas o chefe de turno ({chefeDeTurno(turnoSelecionado)?.nome ?? '—'}) pode fazer atribuições.
                  </div>
                )}

                {doentes.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '60px' }}>
                    <p className="text-slate-400 text-sm">Sem doentes internados</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 24px' }}>Doente</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Estado</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Cama</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Enfermeiro Atribuído</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doentes.map((d, i) => {
                          const atrib = atribuicaoDe(d.id);
                          return (
                            <tr key={d.id} className="hover:bg-slate-50 transition-colors" style={{ borderTop: i > 0 ? '1px solid #f8fafc' : undefined }}>
                              <td style={{ padding: '14px 24px' }}>
                                <p className="font-semibold text-slate-800">{d.nome}</p>
                                <p className="text-xs text-slate-400 font-mono" style={{ marginTop: '2px' }}>{d.numeroProcesso}</p>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span className={`text-xs font-medium rounded-lg ${estadoCor[d.estado]}`} style={{ padding: '4px 8px' }}>
                                  {estadoLabel[d.estado]}
                                </span>
                              </td>
                              <td className="text-slate-500 text-sm" style={{ padding: '14px 16px' }}>
                                Q{d.cama.quarto} · C{d.cama.numero}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                {souChefe ? (
                                  <div className="flex flex-wrap gap-2">
                                    {enfermeirosDoTurno.map((p) => {
                                      const selecionado = atrib?.utilizadorId === p.utilizadorId;
                                      return (
                                        <button
                                          key={p.utilizadorId}
                                          onClick={() => atribuir(d.id, p.utilizadorId)}
                                          disabled={salvando}
                                          className={`text-xs font-medium rounded-lg border transition-all ${
                                            selecionado
                                              ? 'bg-blue-600 text-white border-blue-600'
                                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                          }`}
                                          style={{ padding: '5px 10px' }}
                                        >
                                          {p.utilizador.nome.split(' ')[0]}
                                          {p.utilizador.equipa ? ` · ${p.utilizador.equipa}` : ''}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  atrib ? (
                                    <span className="text-slate-700 font-medium text-sm">{atrib.utilizador.nome}</span>
                                  ) : (
                                    <span className="text-slate-300 text-sm">Não atribuído</span>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
