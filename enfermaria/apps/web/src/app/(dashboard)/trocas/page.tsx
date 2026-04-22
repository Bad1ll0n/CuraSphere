'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Utilizador { id: string; nome: string; role: string; equipa?: string }
interface HorarioTurno { id: string; tipo: string; data: string }
interface Pedido {
  id: string;
  estado: string;
  criadoEm: string;
  solicitante: Utilizador;
  destinatario: Utilizador;
  turno: HorarioTurno;
  aprovadoPor?: Utilizador;
}

const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const tipoCor: Record<string, string> = {
  manha: 'bg-amber-50 text-amber-700 border-amber-200',
  tarde: 'bg-orange-50 text-orange-700 border-orange-200',
  noite: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};
const estadoConfig: Record<string, { label: string; cor: string }> = {
  pendente_destinatario: { label: 'Aguarda resposta',  cor: 'bg-amber-50 text-amber-700 border border-amber-200' },
  pendente_chefe:        { label: 'Aguarda aprovação', cor: 'bg-blue-50 text-blue-700 border border-blue-200' },
  aprovado:              { label: 'Aprovado',          cor: 'bg-green-50 text-green-700 border border-green-200' },
  rejeitado:             { label: 'Rejeitado',         cor: 'bg-red-50 text-red-700 border border-red-200' },
};

function TurnoBadge({ turno }: { turno: HorarioTurno }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border ${tipoCor[turno.tipo]}`}>
      {tipoLabel[turno.tipo]} · {new Date(turno.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
    </span>
  );
}

export default function TrocasPage() {
  const { utilizador } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  // O servidor já filtra — se há pendente_chefe que o user não é parte, é porque é chefe desse turno
  const isChefe = pedidos.some(
    (p) => p.estado === 'pendente_chefe' && p.solicitante.id !== utilizador?.id && p.destinatario.id !== utilizador?.id
  );

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [meusTurnos, setMeusTurnos] = useState<HorarioTurno[]>([]);
  const [turnoSelecionado, setTurnoSelecionado] = useState<HorarioTurno | null>(null);
  const [colegas, setColegas] = useState<Utilizador[]>([]);
  const [colegaSelecionado, setColegaSelecionado] = useState<Utilizador | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try { setPedidos((await api.get('/trocas')).data); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = async () => {
    const hoje = new Date();
    const r = await api.get(`/horarios/meu?mes=${hoje.getMonth() + 1}&ano=${hoje.getFullYear()}`);
    const futuros = r.data
      .map((h: any) => h.horarioTurno)
      .filter((t: HorarioTurno) => new Date(t.data) >= hoje);
    setMeusTurnos(futuros);
    setTurnoSelecionado(null);
    setColegas([]);
    setColegaSelecionado(null);
    setErro('');
    setModalAberto(true);
  };

  const selecionarTurno = async (turno: HorarioTurno) => {
    setTurnoSelecionado(turno);
    setColegaSelecionado(null);
    setColegas([]);
    setErro('');
    try {
      const r = await api.get(`/trocas/colegas?turnoId=${turno.id}`);
      setColegas(r.data);
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao carregar colegas');
    }
  };

  const submeter = async () => {
    if (!turnoSelecionado || !colegaSelecionado) return;
    setSalvando(true);
    setErro('');
    try {
      await api.post('/trocas', { turnoId: turnoSelecionado.id, destinatarioId: colegaSelecionado.id });
      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao enviar pedido');
    } finally { setSalvando(false); }
  };

  const pendentesResposta = pedidos.filter((p) => p.estado === 'pendente_destinatario' && p.destinatario.id === utilizador?.id);
  const meusEnviados = pedidos.filter((p) => p.solicitante.id === utilizador?.id && !['aprovado', 'rejeitado'].includes(p.estado));
  const pendentesAprovacao = pedidos.filter((p) => p.estado === 'pendente_chefe');
  const historico = pedidos.filter((p) => ['aprovado', 'rejeitado'].includes(p.estado));

  return (
    <div style={{ padding: '40px 48px', maxWidth: '900px', margin: '0 auto' }}>

      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trocas de Turno</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            Pede a um colega para cobrir o teu turno
          </p>
        </div>
        <button onClick={abrirModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
            style={{ padding: '11px 22px', fontSize: '14px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Pedir Cobertura
          </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* Chefe — pendentes aprovação */}
          {isChefe && (
            <Section titulo="Pedidos Pendentes de Aprovação" count={pendentesAprovacao.length} cor="blue">
              {pendentesAprovacao.length === 0 ? <Empty texto="Sem pedidos pendentes" /> :
                pendentesAprovacao.map((p) => (
                  <PedidoRow key={p.id} pedido={p} utilizadorId={utilizador?.id ?? ''}>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={async () => { await api.patch(`/trocas/${p.id}/aprovar`, { aprovar: false }); carregar(); }}
                        className="border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>Rejeitar</button>
                      <button onClick={async () => { await api.patch(`/trocas/${p.id}/aprovar`, { aprovar: true }); carregar(); }}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>Aprovar</button>
                    </div>
                  </PedidoRow>
                ))
              }
            </Section>
          )}

          {/* Pedidos recebidos */}
          {pendentesResposta.length > 0 && (
            <Section titulo="Pedidos Recebidos" count={pendentesResposta.length} cor="amber">
              {pendentesResposta.map((p) => (
                <PedidoRow key={p.id} pedido={p} utilizadorId={utilizador?.id ?? ''}>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={async () => { await api.patch(`/trocas/${p.id}/responder`, { aceitar: false }); carregar(); }}
                      className="border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                      style={{ padding: '6px 14px' }}>Recusar</button>
                    <button onClick={async () => { await api.patch(`/trocas/${p.id}/responder`, { aceitar: true }); carregar(); }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      style={{ padding: '6px 14px' }}>Aceitar</button>
                  </div>
                </PedidoRow>
              ))}
            </Section>
          )}

          {/* Meus pedidos enviados */}
          <Section titulo="Meus Pedidos" count={meusEnviados.length} cor="slate">
              {meusEnviados.length === 0 ? <Empty texto="Sem pedidos enviados" /> :
                meusEnviados.map((p) => (
                  <PedidoRow key={p.id} pedido={p} utilizadorId={utilizador?.id ?? ''}>
                    {p.estado === 'pendente_destinatario' && (
                      <button onClick={async () => { await api.delete(`/trocas/${p.id}`); carregar(); }}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors shrink-0"
                        style={{ padding: '6px 14px' }}>Cancelar</button>
                    )}
                  </PedidoRow>
                ))
              }
            </Section>

          {/* Histórico */}
          {historico.length > 0 && (
            <Section titulo="Histórico" count={historico.length} cor="slate">
              {historico.map((p) => <PedidoRow key={p.id} pedido={p} utilizadorId={utilizador?.id ?? ''} />)}
            </Section>
          )}

          {pedidos.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium" style={{ marginBottom: '6px' }}>Sem pedidos</p>
              <p className="text-slate-400 text-sm">Clica em "Pedir Cobertura" para pedir a um colega que faça o teu turno</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '500px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Pedir Cobertura de Turno</h2>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Escolhe o turno e o colega que queres que te cubra</p>
            </div>

            {/* Passo 1 */}
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                1. O teu turno
              </label>
              {meusTurnos.length === 0 ? (
                <p className="text-sm text-slate-400">Sem turnos futuros disponíveis</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {meusTurnos.map((t) => (
                    <button key={t.id} onClick={() => selecionarTurno(t)}
                      className={`text-xs font-medium px-3 py-2 rounded-lg border-2 transition-all ${
                        turnoSelecionado?.id === t.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {tipoLabel[t.tipo]} · {new Date(t.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Passo 2 */}
            {turnoSelecionado && (
              <div style={{ marginBottom: '24px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
                  2. Quem te vai cobrir
                </label>
                {colegas.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem colegas disponíveis</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {colegas.map((c, i) => (
                      <div key={c.id} onClick={() => setColegaSelecionado(c)}
                        className={`flex items-center justify-between cursor-pointer transition-colors ${
                          colegaSelecionado?.id === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        style={{ padding: '12px 16px', borderBottom: i < colegas.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                          {c.equipa && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Equipa {c.equipa}</p>}
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          colegaSelecionado?.id === c.id ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {colegaSelecionado?.id === c.id && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '16px' }}>
                {erro}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalAberto(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeter} disabled={!turnoSelecionado || !colegaSelecionado || salvando}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}>
                {salvando ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ titulo, count, cor, children }: { titulo: string; count: number; cor: string; children: React.ReactNode }) {
  const countCor = cor === 'blue' ? 'bg-blue-100 text-blue-700' : cor === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
        <h2 className="font-semibold text-slate-800 text-sm">{titulo}</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${countCor}`}>{count}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ texto }: { texto: string }) {
  return <p className="text-sm text-slate-400 text-center" style={{ padding: '28px' }}>{texto}</p>;
}

function PedidoRow({ pedido, utilizadorId, children }: { pedido: Pedido; utilizadorId: string; children?: React.ReactNode }) {
  const cfg = estadoConfig[pedido.estado];
  const euSolicitei = pedido.solicitante.id === utilizadorId;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 last:border-0" style={{ padding: '16px 24px' }}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <TurnoBadge turno={pedido.turno} />
        <div className="min-w-0">
          <p className="text-sm text-slate-700">
            {euSolicitei
              ? <><span className="font-semibold">Tu</span> → <span className="font-medium">{pedido.destinatario.nome}</span></>
              : <><span className="font-medium">{pedido.solicitante.nome}</span> pediu-te cobertura</>
            }
          </p>
          <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
            {new Date(pedido.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 ${cfg.cor}`}>{cfg.label}</span>
      </div>
      {children}
    </div>
  );
}
