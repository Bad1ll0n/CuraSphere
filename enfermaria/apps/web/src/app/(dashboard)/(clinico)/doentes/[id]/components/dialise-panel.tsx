'use client';
import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface Sessao {
  id: string;
  data: string;
  modalidade: string;
  duracaoMin: number | null;
  pesoSecoKg: number | null;
  pesoPreKg: number | null;
  pesoPosKg: number | null;
  ultrafiltracaoMl: number | null;
  acessoVascular: string | null;
  complicacoes: string | null;
  ganhoInterdialitico: number | null;
  ufObjetivoMl: number | null;
}

const podeVer = (r?: string) => ['medico', 'enfermeiro'].includes(r ?? '');
const MODALIDADE_LABEL: Record<string, string> = { hemodialise: 'Hemodiálise', dialise_peritoneal: 'Diálise peritoneal' };

export function DialisePanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [modalidade, setModalidade] = useState('hemodialise');
  const [pesoSeco, setPesoSeco] = useState('');
  const [pesoPre, setPesoPre] = useState('');
  const [pesoPos, setPesoPos] = useState('');
  const [uf, setUf] = useState('');
  const [duracao, setDuracao] = useState('');
  const [acesso, setAcesso] = useState('fistula');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Sessao[]>(`/dialise/doente/${doenteId}/sessoes`);
      setSessoes(data);
    } catch {
      setSessoes([]);
    } finally {
      setLoading(false);
    }
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!podeVer(utilizador?.role)) return null;

  async function registar() {
    if (!(parseFloat(pesoPre) > 0) && !(parseFloat(pesoPos) > 0)) {
      toast.error('Indique pelo menos o peso pré ou pós-sessão.');
      return;
    }
    setGuardando(true);
    try {
      const body: Record<string, string | number> = { modalidade };
      if (pesoSeco) body.pesoSecoKg = parseFloat(pesoSeco);
      if (pesoPre) body.pesoPreKg = parseFloat(pesoPre);
      if (pesoPos) body.pesoPosKg = parseFloat(pesoPos);
      if (uf) body.ultrafiltracaoMl = parseInt(uf, 10);
      if (duracao) body.duracaoMin = parseInt(duracao, 10);
      if (acesso) body.acessoVascular = acesso;
      const { data } = await api.post<{ ganhoInterdialitico: number | null }>(`/dialise/doente/${doenteId}/sessao`, body);
      toast.success(
        data?.ganhoInterdialitico != null
          ? `Sessão registada. Ganho interdialítico: ${data.ganhoInterdialitico} kg.`
          : 'Sessão registada.',
      );
      setMostrarForm(false);
      setPesoPre(''); setPesoPos(''); setUf(''); setDuracao('');
      await carregar();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao registar a sessão.');
    } finally {
      setGuardando(false);
    }
  }

  const ultima = sessoes[0];
  const serie = [...sessoes].reverse().map((s) => ({
    data: new Date(s.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
    'Peso pré': s.pesoPreKg,
    'Peso pós': s.pesoPosKg,
  }));
  const ganhoExcessivo = ultima?.ganhoInterdialitico != null && ultima.ganhoInterdialitico > 2.5;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-900">Diálise / Nefrologia</h3>
        <div className="text-sm text-slate-400" style={{ marginTop: '8px' }}>A carregar…</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-3" style={{ marginBottom: sessoes.length ? '16px' : '0' }}>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Diálise / Nefrologia</h3>
          {sessoes.length === 0 && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Sem sessões registadas.</p>}
        </div>
        <button onClick={() => setMostrarForm((v) => !v)}
          className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors">
          {mostrarForm ? 'Cancelar' : 'Registar sessão'}
        </button>
      </div>

      {mostrarForm && (
        <div style={{ marginBottom: sessoes.length ? '20px' : '0', marginTop: '16px' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2" style={{ marginBottom: '10px' }}>
            <label className="text-xs text-slate-500">Modalidade
              <select value={modalidade} onChange={(e) => setModalidade(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" style={{ marginTop: '4px' }}>
                <option value="hemodialise">Hemodiálise</option>
                <option value="dialise_peritoneal">Diálise peritoneal</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">Acesso vascular
              <select value={acesso} onChange={(e) => setAcesso(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" style={{ marginTop: '4px' }}>
                <option value="fistula">Fístula</option>
                <option value="cateter">Cateter</option>
                <option value="protese">Prótese</option>
              </select>
            </label>
            <input value={duracao} onChange={(e) => setDuracao(e.target.value)} type="number" placeholder="Duração (min)"
              aria-label="Duração em minutos" className="border border-slate-200 rounded-lg px-3 py-2 text-sm self-end" />
            <input value={pesoSeco} onChange={(e) => setPesoSeco(e.target.value)} type="number" placeholder="Peso seco (kg)"
              aria-label="Peso seco em kg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={pesoPre} onChange={(e) => setPesoPre(e.target.value)} type="number" placeholder="Peso pré (kg)"
              aria-label="Peso pré-sessão em kg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={pesoPos} onChange={(e) => setPesoPos(e.target.value)} type="number" placeholder="Peso pós (kg)"
              aria-label="Peso pós-sessão em kg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input value={uf} onChange={(e) => setUf(e.target.value)} type="number" placeholder="Ultrafiltração (mL)"
              aria-label="Ultrafiltração em mL" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={registar} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
            {guardando ? 'A guardar…' : 'Guardar sessão'}
          </button>
        </div>
      )}

      {sessoes.length > 0 && (
        <>
          {/* Resumo da última sessão */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: '20px' }}>
            <Resumo rotulo="Modalidade" valor={MODALIDADE_LABEL[ultima.modalidade] ?? ultima.modalidade} />
            <div className="rounded-xl p-3" style={{ background: ganhoExcessivo ? '#fef2f2' : '#f0fdf4', border: `1px solid ${ganhoExcessivo ? '#fecaca' : '#bbf7d0'}` }}>
              <div className="text-xs text-slate-500">Ganho interdialítico</div>
              <div className="font-semibold text-sm" style={{ color: ganhoExcessivo ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                {ultima.ganhoInterdialitico != null ? `${ultima.ganhoInterdialitico} kg` : '—'}{ganhoExcessivo && ' ⚠'}
              </div>
            </div>
            <Resumo rotulo="UF objetivo" valor={ultima.ufObjetivoMl != null ? `${ultima.ufObjetivoMl} mL` : '—'} />
            <Resumo rotulo="Acesso" valor={ultima.acessoVascular ?? '—'} />
          </div>

          {/* Tendência de peso */}
          {serie.length > 1 && (
            <div style={{ height: '180px', marginBottom: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie}>
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Peso pré" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="Peso pós" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lista compacta */}
          <div className="space-y-2">
            {sessoes.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-t border-slate-50" style={{ padding: '6px 0' }}>
                <span className="text-slate-600">{new Date(s.data).toLocaleDateString('pt-PT')}</span>
                <span className="text-slate-500 text-xs">
                  {s.pesoPreKg ?? '—'}→{s.pesoPosKg ?? '—'} kg
                  {s.ultrafiltracaoMl != null && ` · UF ${s.ultrafiltracaoMl} mL`}
                  {s.complicacoes && ` · ⚠ ${s.complicacoes}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400" style={{ marginTop: '12px' }}>
        Apoio à decisão — ganho interdialítico &gt; 2.5 kg (ou &gt; 4% do peso seco) gera alerta clínico.
      </p>
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="font-semibold text-slate-900 text-sm" style={{ marginTop: '2px' }}>{valor}</div>
    </div>
  );
}
