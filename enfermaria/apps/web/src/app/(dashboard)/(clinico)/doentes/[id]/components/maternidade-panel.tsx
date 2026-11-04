'use client';
import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from 'recharts';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface Gravidez {
  id: string;
  dataUltimaMenstruacao: string | null;
  dataPrevistaParto: string | null;
  gravida: number | null;
  para: number | null;
  grupoSanguineo: string | null;
  fatoresRisco: string | null;
  estado: string;
  idadeGestacional: { semanas: number; dias: number } | null;
  parto: { id: string; tipo: string; apgar1: number | null; apgar5: number | null; pesoRN: number | null } | null;
}

interface Partograma {
  id: string;
  momento: string;
  dilatacaoCm: number | null;
  fcFetal: number | null;
  contracoes10min: number | null;
  descidaApresentacao: number | null;
  notas: string | null;
}

const podeRegistar = (role?: string) => ['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(role ?? '');

export function MaternidadePanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [gravidez, setGravidez] = useState<Gravidez | null>(null);
  const [partograma, setPartograma] = useState<Partograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [mostrarCriar, setMostrarCriar] = useState(false);
  const [mostrarParto, setMostrarParto] = useState(false);

  // criar gravidez
  const [dum, setDum] = useState('');
  const [gravida, setGravida] = useState('');
  const [para, setPara] = useState('');
  const [grupo, setGrupo] = useState('');
  const [fatores, setFatores] = useState('');

  // registo de partograma
  const [dilatacao, setDilatacao] = useState('');
  const [fcFetal, setFcFetal] = useState('');
  const [contracoes, setContracoes] = useState('');
  const [descida, setDescida] = useState('');

  const editavel = podeRegistar(utilizador?.role);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Gravidez | null>(`/maternidade/doente/${doenteId}/gravidez`);
      setGravidez(data);
      if (data?.id) {
        const p = await api.get<Partograma[]>(`/maternidade/gravidez/${data.id}/partograma`);
        setPartograma(p.data);
      } else {
        setPartograma([]);
      }
    } catch {
      setGravidez(null);
    } finally {
      setLoading(false);
    }
  }, [doenteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarGravidez() {
    setCriando(true);
    try {
      const body: Record<string, string | number> = {};
      if (dum) body.dataUltimaMenstruacao = new Date(dum).toISOString();
      if (gravida) body.gravida = parseInt(gravida, 10);
      if (para) body.para = parseInt(para, 10);
      if (grupo) body.grupoSanguineo = grupo;
      if (fatores) body.fatoresRisco = fatores;
      await api.post(`/maternidade/doente/${doenteId}/gravidez`, body);
      toast.success('Gravidez registada.');
      setMostrarCriar(false);
      setDum(''); setGravida(''); setPara(''); setGrupo(''); setFatores('');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao registar a gravidez.');
    } finally {
      setCriando(false);
    }
  }

  async function adicionarPartograma() {
    if (!gravidez) return;
    const body: Record<string, number> = {};
    if (dilatacao) body.dilatacaoCm = parseInt(dilatacao, 10);
    if (fcFetal) body.fcFetal = parseInt(fcFetal, 10);
    if (contracoes) body.contracoes10min = parseInt(contracoes, 10);
    if (descida) body.descidaApresentacao = parseInt(descida, 10);
    if (Object.keys(body).length === 0) {
      toast.error('Preencha pelo menos um valor.');
      return;
    }
    try {
      await api.post(`/maternidade/gravidez/${gravidez.id}/partograma`, body);
      toast.success('Registo adicionado ao partograma.');
      setDilatacao(''); setFcFetal(''); setContracoes(''); setDescida('');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao adicionar o registo.');
    }
  }

  async function registarParto(dados: { tipo: string; apgar1?: number; apgar5?: number; pesoRN?: number; sexoRN?: string }) {
    if (!gravidez) return;
    try {
      await api.post(`/maternidade/gravidez/${gravidez.id}/parto`, dados);
      toast.success('Parto registado. Gravidez concluída.');
      setMostrarParto(false);
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao registar o parto.');
    }
  }

  const serie = partograma.map((p) => ({
    hora: new Date(p.momento).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    Dilatação: p.dilatacaoCm,
    'FC fetal': p.fcFetal,
  }));

  // ── Estado: a carregar ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900">Maternidade / Obstetrícia</h3>
        <div className="text-sm text-slate-400" style={{ marginTop: '8px' }}>A carregar…</div>
      </div>
    );
  }

  // ── Estado: sem gravidez ativa (cartão fino + opção de registar) ───────────
  if (!gravidez) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Maternidade / Obstetrícia</h3>
            <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Sem gravidez ativa.</p>
          </div>
          {editavel && (
            <button onClick={() => setMostrarCriar((v) => !v)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
              {mostrarCriar ? 'Cancelar' : 'Registar gravidez'}
            </button>
          )}
        </div>
        {mostrarCriar && (
          <div style={{ marginTop: '16px' }}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500 col-span-2">Data da última menstruação (DUM)
                <input value={dum} onChange={(e) => setDum(e.target.value)} type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" style={{ marginTop: '4px' }} />
              </label>
              <input value={gravida} onChange={(e) => setGravida(e.target.value)} type="number" placeholder="Gestações (G)"
                aria-label="Número de gestações" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={para} onChange={(e) => setPara(e.target.value)} type="number" placeholder="Partos (P)"
                aria-label="Número de partos" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Grupo sanguíneo"
                aria-label="Grupo sanguíneo" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={fatores} onChange={(e) => setFatores(e.target.value)} placeholder="Fatores de risco"
                aria-label="Fatores de risco" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={criarGravidez} disabled={criando}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              style={{ marginTop: '10px' }}>
              {criando ? 'A registar…' : 'Registar gravidez'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Estado: gravidez ativa (vista obstétrica completa) ─────────────────────
  const ig = gravidez.idadeGestacional;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-900" style={{ marginBottom: '16px' }}>Maternidade / Obstetrícia</h3>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: '20px' }}>
        <Resumo rotulo="Idade gestacional" valor={ig ? `${ig.semanas}s ${ig.dias}d` : '—'} destaque />
        <Resumo rotulo="DPP" valor={gravidez.dataPrevistaParto ? new Date(gravidez.dataPrevistaParto).toLocaleDateString('pt-PT') : '—'} />
        <Resumo rotulo="G / P" valor={`${gravidez.gravida ?? '—'} / ${gravidez.para ?? '—'}`} />
        <Resumo rotulo="Grupo" valor={gravidez.grupoSanguineo ?? '—'} />
      </div>
      {gravidez.fatoresRisco && (
        <div className="rounded-xl p-3 text-sm" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', marginBottom: '20px' }}>
          <span className="font-medium">Fatores de risco:</span> {gravidez.fatoresRisco}
        </div>
      )}

      {/* Partograma */}
      <div className="border-t border-slate-100" style={{ paddingTop: '16px', marginBottom: '16px' }}>
        <div className="text-xs font-medium text-slate-500" style={{ marginBottom: '8px' }}>
          Partograma — dilatação (cm) e FC fetal (bpm). Zona segura FC fetal: 110–160.
        </div>
        {serie.length === 0 ? (
          <div className="text-sm text-slate-400">Sem registos. Adicione o primeiro ponto abaixo.</div>
        ) : (
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie}>
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="dil" domain={[0, 10]} tick={{ fontSize: 11 }} width={28} />
                <YAxis yAxisId="fc" orientation="right" domain={[80, 200]} tick={{ fontSize: 11 }} width={32} />
                <ReferenceArea yAxisId="fc" y1={110} y2={160} fill="#16a34a" fillOpacity={0.06} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="dil" type="monotone" dataKey="Dilatação" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="fc" type="monotone" dataKey="FC fetal" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Adicionar registo ao partograma */}
      {editavel && (
        <div style={{ marginBottom: '16px' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ marginBottom: '10px' }}>
            <input value={dilatacao} onChange={(e) => setDilatacao(e.target.value)} type="number" placeholder="Dilatação (cm)"
              aria-label="Dilatação em cm" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={fcFetal} onChange={(e) => setFcFetal(e.target.value)} type="number" placeholder="FC fetal (bpm)"
              aria-label="FC fetal em bpm" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={contracoes} onChange={(e) => setContracoes(e.target.value)} type="number" placeholder="Contrações/10min"
              aria-label="Contrações por 10 minutos" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={descida} onChange={(e) => setDescida(e.target.value)} type="number" placeholder="Descida (-3..+3)"
              aria-label="Descida da apresentação" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={adicionarPartograma}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            Adicionar ao partograma
          </button>
        </div>
      )}

      {/* Parto */}
      {gravidez.parto ? (
        <div className="rounded-xl p-3 border-t border-slate-100" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginTop: '4px' }}>
          <div className="text-sm font-semibold text-green-800">Parto registado — {gravidez.parto.tipo}</div>
          <div className="text-xs text-slate-600" style={{ marginTop: '2px' }}>
            Apgar {gravidez.parto.apgar1 ?? '—'}/{gravidez.parto.apgar5 ?? '—'}
            {gravidez.parto.pesoRN != null && ` · RN ${gravidez.parto.pesoRN} kg`}
          </div>
        </div>
      ) : editavel ? (
        <div className="border-t border-slate-100" style={{ paddingTop: '16px' }}>
          {mostrarParto ? (
            <PartoForm onSubmit={registarParto} onCancel={() => setMostrarParto(false)} />
          ) : (
            <button onClick={() => setMostrarParto(true)}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
              Registar parto
            </button>
          )}
        </div>
      ) : null}

      <p className="text-xs text-slate-400" style={{ marginTop: '12px' }}>
        Apoio à decisão — a FC fetal fora de 110–160 bpm gera alerta clínico automático.
      </p>
    </div>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: destaque ? '#eff6ff' : '#f8fafc', border: `1px solid ${destaque ? '#bfdbfe' : '#e2e8f0'}` }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`font-semibold ${destaque ? 'text-blue-700 text-lg' : 'text-slate-900 text-sm'}`} style={{ marginTop: '2px' }}>{valor}</div>
    </div>
  );
}

function PartoForm({ onSubmit, onCancel }: { onSubmit: (d: { tipo: string; apgar1?: number; apgar5?: number; pesoRN?: number; sexoRN?: string }) => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState('eutocico');
  const [apgar1, setApgar1] = useState('');
  const [apgar5, setApgar5] = useState('');
  const [pesoRN, setPesoRN] = useState('');
  const [sexoRN, setSexoRN] = useState('');
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ marginBottom: '10px' }}>
        <label className="text-xs text-slate-500">Tipo de parto
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" style={{ marginTop: '4px' }}>
            <option value="eutocico">Eutócico</option>
            <option value="cesariana">Cesariana</option>
            <option value="ventosa">Ventosa</option>
            <option value="forceps">Fórceps</option>
          </select>
        </label>
        <input value={apgar1} onChange={(e) => setApgar1(e.target.value)} type="number" placeholder="Apgar 1'"
          aria-label="Apgar ao 1 minuto" className="border border-slate-200 rounded-lg px-3 py-2 text-sm self-end" />
        <input value={apgar5} onChange={(e) => setApgar5(e.target.value)} type="number" placeholder="Apgar 5'"
          aria-label="Apgar aos 5 minutos" className="border border-slate-200 rounded-lg px-3 py-2 text-sm self-end" />
        <input value={pesoRN} onChange={(e) => setPesoRN(e.target.value)} type="number" placeholder="Peso RN (kg)"
          aria-label="Peso do recém-nascido em kg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <input value={sexoRN} onChange={(e) => setSexoRN(e.target.value)} placeholder="Sexo RN"
          aria-label="Sexo do recém-nascido" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({
            tipo,
            apgar1: apgar1 ? parseInt(apgar1, 10) : undefined,
            apgar5: apgar5 ? parseInt(apgar5, 10) : undefined,
            pesoRN: pesoRN ? parseFloat(pesoRN) : undefined,
            sexoRN: sexoRN || undefined,
          })}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
          Confirmar parto
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
}
