'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface Dose { nome: string; mgPorM2: number; doseMg: number | null; limitada: boolean }
interface Ciclo { id: string; numero: number; dataPrevista: string | null; dataAdministracao: string | null; estado: string; toxicidadeGrau: number | null; notas: string | null }
interface Plano {
  id: string;
  protocoloNome: string;
  ciclosPrevistos: number;
  intervaloDias: number;
  superficieCorporalM2: number | null;
  estado: string;
  ciclos: Ciclo[];
  doses: Dose[];
}
interface FarmacoInput { nome: string; mgPorM2: string; doseMaximaMg: string }

const podeVer = (r?: string) => ['medico', 'enfermeiro', 'farmaceutico'].includes(r ?? '');
const podeCriar = (r?: string) => ['medico', 'farmaceutico'].includes(r ?? '');
const podeAdministrar = (r?: string) => ['medico', 'enfermeiro'].includes(r ?? '');

const ESTADO_COR: Record<string, string> = {
  administrado: 'text-green-700 bg-green-50 border-green-200',
  agendado: 'text-blue-700 bg-blue-50 border-blue-200',
  adiado: 'text-amber-700 bg-amber-50 border-amber-200',
  cancelado: 'text-slate-500 bg-slate-50 border-slate-200',
};

export function OncologiaPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarCriar, setMostrarCriar] = useState(false);
  const [administrar, setAdministrar] = useState<string | null>(null);

  // criar plano
  const [protocolo, setProtocolo] = useState('');
  const [ciclos, setCiclos] = useState('6');
  const [intervalo, setIntervalo] = useState('21');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [farmacos, setFarmacos] = useState<FarmacoInput[]>([{ nome: '', mgPorM2: '', doseMaximaMg: '' }]);
  const [criando, setCriando] = useState(false);

  // administrar ciclo
  const [toxicidade, setToxicidade] = useState('0');
  const [notasAdm, setNotasAdm] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Plano | null>(`/oncologia/doente/${doenteId}/plano`);
      setPlano(data);
    } catch {
      setPlano(null);
    } finally {
      setLoading(false);
    }
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!podeVer(utilizador?.role)) return null;

  async function criarPlano() {
    const fs = farmacos
      .filter((f) => f.nome.trim() && parseFloat(f.mgPorM2) > 0)
      .map((f) => ({ nome: f.nome.trim(), mgPorM2: parseFloat(f.mgPorM2), ...(f.doseMaximaMg ? { doseMaximaMg: parseFloat(f.doseMaximaMg) } : {}) }));
    if (!protocolo.trim() || fs.length === 0) {
      toast.error('Indique o protocolo e pelo menos um fármaco (nome + mg/m²).');
      return;
    }
    setCriando(true);
    try {
      const body: Record<string, unknown> = { protocoloNome: protocolo.trim(), ciclosPrevistos: parseInt(ciclos, 10) || 1, intervaloDias: parseInt(intervalo, 10) || 21, farmacos: fs };
      if (altura) body.alturaCm = parseFloat(altura);
      if (peso) body.pesoKg = parseFloat(peso);
      await api.post(`/oncologia/doente/${doenteId}/plano`, body);
      toast.success('Plano de quimioterapia criado.');
      setMostrarCriar(false);
      setProtocolo(''); setFarmacos([{ nome: '', mgPorM2: '', doseMaximaMg: '' }]); setAltura(''); setPeso('');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao criar o plano.');
    } finally {
      setCriando(false);
    }
  }

  async function agendarCiclo() {
    if (!plano) return;
    try {
      await api.post(`/oncologia/plano/${plano.id}/ciclo`, {});
      toast.success('Ciclo agendado.');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao agendar o ciclo.');
    }
  }

  async function confirmarAdministrar(cicloId: string) {
    try {
      const { data } = await api.post<{ aviso: string | null }>(`/oncologia/ciclo/${cicloId}/administrar`, {
        toxicidadeGrau: parseInt(toxicidade, 10),
        ...(notasAdm ? { notas: notasAdm } : {}),
      });
      toast.success(data?.aviso ? `Administrado. ${data.aviso}` : 'Ciclo administrado.');
      setAdministrar(null); setToxicidade('0'); setNotasAdm('');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao registar a administração.');
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900">Oncologia / Quimioterapia</h3>
        <div className="text-sm text-slate-400" style={{ marginTop: '8px' }}>A carregar…</div>
      </div>
    );
  }

  // ── Sem plano ativo (cartão fino + criar) ──────────────────────────────────
  if (!plano) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Oncologia / Quimioterapia</h3>
            <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Sem plano de quimioterapia ativo.</p>
          </div>
          {podeCriar(utilizador?.role) && (
            <button onClick={() => setMostrarCriar((v) => !v)}
              className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
              {mostrarCriar ? 'Cancelar' : 'Registar plano'}
            </button>
          )}
        </div>
        {mostrarCriar && (
          <CriarPlanoForm {...{ protocolo, setProtocolo, ciclos, setCiclos, intervalo, setIntervalo, altura, setAltura, peso, setPeso, farmacos, setFarmacos, criarPlano, criando }} />
        )}
      </div>
    );
  }

  // ── Plano ativo ────────────────────────────────────────────────────────────
  const administrados = plano.ciclos.filter((c) => c.estado === 'administrado').length;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-900" style={{ marginBottom: '16px' }}>Oncologia / Quimioterapia</h3>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: '20px' }}>
        <Resumo rotulo="Protocolo" valor={plano.protocoloNome} destaque />
        <Resumo rotulo="Ciclos" valor={`${administrados} / ${plano.ciclosPrevistos}`} />
        <Resumo rotulo="Intervalo" valor={`${plano.intervaloDias} dias`} />
        <Resumo rotulo="BSA" valor={plano.superficieCorporalM2 ? `${plano.superficieCorporalM2} m²` : '—'} />
      </div>

      {/* Doses por m² */}
      <div className="border-t border-slate-100" style={{ paddingTop: '16px', marginBottom: '16px' }}>
        <div className="text-xs font-medium text-slate-500" style={{ marginBottom: '8px' }}>Doses calculadas (mg/m² × BSA)</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="font-medium" style={{ paddingBottom: '6px' }}>Fármaco</th>
                <th className="font-medium">mg/m²</th>
                <th className="font-medium">Dose</th>
              </tr>
            </thead>
            <tbody>
              {plano.doses.map((d) => (
                <tr key={d.nome} className="border-t border-slate-50">
                  <td className="text-slate-900" style={{ padding: '6px 0' }}>{d.nome}</td>
                  <td className="text-slate-600">{d.mgPorM2}</td>
                  <td className="font-medium text-slate-900">
                    {d.doseMg != null ? `${d.doseMg} mg` : '— (sem BSA)'}
                    {d.limitada && <span className="text-xs font-medium text-amber-600" style={{ marginLeft: '6px' }}>máx.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ciclos */}
      <div className="border-t border-slate-100" style={{ paddingTop: '16px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
          <div className="text-xs font-medium text-slate-500">Ciclos</div>
          {podeAdministrar(utilizador?.role) && (
            <button onClick={agendarCiclo} className="text-sm font-medium text-blue-600 hover:text-blue-700">+ Agendar ciclo</button>
          )}
        </div>
        {plano.ciclos.length === 0 ? (
          <div className="text-sm text-slate-400">Sem ciclos agendados.</div>
        ) : (
          <div className="space-y-2">
            {plano.ciclos.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">Ciclo {c.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ESTADO_COR[c.estado] ?? ESTADO_COR.cancelado}`}>{c.estado}</span>
                    {c.toxicidadeGrau != null && c.toxicidadeGrau >= 3 && (
                      <span className="text-xs font-medium text-red-600">tox. G{c.toxicidadeGrau}</span>
                    )}
                  </div>
                  {c.estado === 'agendado' && podeAdministrar(utilizador?.role) && (
                    <button onClick={() => setAdministrar(administrar === c.id ? null : c.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      {administrar === c.id ? 'Fechar' : 'Administrar'}
                    </button>
                  )}
                </div>
                {administrar === c.id && (
                  <div className="flex flex-wrap items-end gap-2" style={{ marginTop: '10px' }}>
                    <label className="text-xs text-slate-500">Toxicidade (CTCAE)
                      <select value={toxicidade} onChange={(e) => setToxicidade(e.target.value)}
                        className="block border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" style={{ marginTop: '4px' }}>
                        {[0, 1, 2, 3, 4].map((g) => <option key={g} value={g}>Grau {g}</option>)}
                      </select>
                    </label>
                    <input value={notasAdm} onChange={(e) => setNotasAdm(e.target.value)} placeholder="Notas"
                      aria-label="Notas da administração" className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1" style={{ minWidth: '160px' }} />
                    <button onClick={() => confirmarAdministrar(c.id)}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">Confirmar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400" style={{ marginTop: '12px' }}>
        Apoio à decisão — doses por BSA; toxicidade CTCAE ≥3 gera alerta clínico automático.
      </p>
    </div>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: destaque ? '#eff6ff' : '#f8fafc', border: `1px solid ${destaque ? '#bfdbfe' : '#e2e8f0'}` }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={`font-semibold ${destaque ? 'text-blue-700' : 'text-slate-900'} text-sm`} style={{ marginTop: '2px' }}>{valor}</div>
    </div>
  );
}

interface FormProps {
  protocolo: string; setProtocolo: (v: string) => void;
  ciclos: string; setCiclos: (v: string) => void;
  intervalo: string; setIntervalo: (v: string) => void;
  altura: string; setAltura: (v: string) => void;
  peso: string; setPeso: (v: string) => void;
  farmacos: FarmacoInput[]; setFarmacos: (v: FarmacoInput[]) => void;
  criarPlano: () => void; criando: boolean;
}

function CriarPlanoForm(p: FormProps) {
  const atualizar = (i: number, campo: keyof FarmacoInput, valor: string) => {
    const copia = p.farmacos.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f));
    p.setFarmacos(copia);
  };
  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ marginBottom: '10px' }}>
        <input value={p.protocolo} onChange={(e) => p.setProtocolo(e.target.value)} placeholder="Protocolo (ex: FOLFOX)"
          aria-label="Nome do protocolo" className="border border-slate-200 rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1" />
        <input value={p.ciclos} onChange={(e) => p.setCiclos(e.target.value)} type="number" placeholder="Ciclos previstos"
          aria-label="Ciclos previstos" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <input value={p.intervalo} onChange={(e) => p.setIntervalo(e.target.value)} type="number" placeholder="Intervalo (dias)"
          aria-label="Intervalo em dias" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <input value={p.altura} onChange={(e) => p.setAltura(e.target.value)} type="number" placeholder="Altura (cm)"
          aria-label="Altura em cm" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <input value={p.peso} onChange={(e) => p.setPeso(e.target.value)} type="number" placeholder="Peso (kg)"
          aria-label="Peso em kg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="text-xs font-medium text-slate-500" style={{ marginBottom: '6px' }}>Fármacos</div>
      {p.farmacos.map((f, i) => (
        <div key={i} className="grid grid-cols-3 gap-2" style={{ marginBottom: '6px' }}>
          <input value={f.nome} onChange={(e) => atualizar(i, 'nome', e.target.value)} placeholder="Nome"
            aria-label={`Fármaco ${i + 1} nome`} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={f.mgPorM2} onChange={(e) => atualizar(i, 'mgPorM2', e.target.value)} type="number" placeholder="mg/m²"
            aria-label={`Fármaco ${i + 1} mg por m²`} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={f.doseMaximaMg} onChange={(e) => atualizar(i, 'doseMaximaMg', e.target.value)} type="number" placeholder="Dose máx (opc.)"
            aria-label={`Fármaco ${i + 1} dose máxima`} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      ))}
      <button onClick={() => p.setFarmacos([...p.farmacos, { nome: '', mgPorM2: '', doseMaximaMg: '' }])}
        className="text-sm font-medium text-blue-600 hover:text-blue-700" style={{ marginBottom: '10px' }}>+ Adicionar fármaco</button>
      <div>
        <button onClick={p.criarPlano} disabled={p.criando}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
          {p.criando ? 'A criar…' : 'Criar plano'}
        </button>
      </div>
    </div>
  );
}
