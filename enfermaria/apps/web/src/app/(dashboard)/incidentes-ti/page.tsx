'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

const TIPOS = [
  { value: 'infraestrutura', label: 'Infraestrutura / Servidores' },
  { value: 'rede', label: 'Rede' },
  { value: 'his_erp', label: 'HIS / ERP' },
  { value: 'base_dados', label: 'Base de Dados' },
  { value: 'seguranca', label: 'Segurança / Cibersegurança' },
  { value: 'dados_clinicos', label: 'Dados Clínicos / BI' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa', cor: 'bg-green-100 text-green-700' },
  { value: 'media', label: 'Média', cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'alta', label: 'Alta', cor: 'bg-orange-100 text-orange-700' },
  { value: 'critica', label: 'Crítica', cor: 'bg-red-100 text-red-700' },
];

const ESTADOS = [
  { value: 'aberto', label: 'Aberto', cor: 'bg-red-100 text-red-700' },
  { value: 'em_analise', label: 'Em Análise', cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'resolvido', label: 'Resolvido', cor: 'bg-green-100 text-green-700' },
  { value: 'fechado', label: 'Fechado', cor: 'bg-slate-100 text-slate-500' },
];

const ROLES_TI = ['it_admin', 'diretor_ti', 'analista_sistemas', 'dba', 'ciberseguranca', 'bi_analyst'];

interface Incidente {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  subRoleAlvo: string | null;
  prioridade: string;
  estado: string;
  criadoEm: string;
  criadoPor: { id: string; nome: string; role: string } | null;
  responsavel: { id: string; nome: string; role: string } | null;
}

function Badge({ value, options }: { value: string; options: { value: string; label: string; cor: string }[] }) {
  const opt = options.find(o => o.value === value);
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${opt?.cor ?? 'bg-slate-100 text-slate-500'}`}>
      {opt?.label ?? value}
    </span>
  );
}

export default function IncidentesTIPage() {
  const { utilizador } = useAuth();
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('infraestrutura');
  const [prioridade, setPrioridade] = useState('media');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const { data } = await api.get('/incidentes-ti');
      setIncidentes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const criarIncidente = async () => {
    if (!titulo.trim() || !descricao.trim()) { setErro('Título e descrição são obrigatórios'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/incidentes-ti', { titulo, descricao, tipo, prioridade });
      setModalAberto(false);
      setTitulo(''); setDescricao(''); setTipo('infraestrutura'); setPrioridade('media');
      await carregar();
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao criar incidente');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarEstado = async (id: string, estado: string) => {
    try {
      await api.patch(`/incidentes-ti/${id}`, { estado });
      await carregar();
    } catch { /* silencioso */ }
  };

  const eTI = utilizador && ROLES_TI.includes(utilizador.role);

  const visiveis = incidentes.filter(i => {
    if (filtroEstado && i.estado !== filtroEstado) return false;
    if (filtroTipo && i.tipo !== filtroTipo) return false;
    return true;
  });

  const tipoLabel = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidentes TI</h1>
          <p className="text-slate-500 text-sm mt-1">Reporte e acompanhe problemas técnicos</p>
        </div>
        <button
          onClick={() => { setModalAberto(true); setErro(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          + Novo Incidente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os estados</option>
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filtroEstado || filtroTipo) && (
          <button onClick={() => { setFiltroEstado(''); setFiltroTipo(''); }} className="text-slate-400 hover:text-slate-600 text-sm">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">A carregar...</div>
      ) : visiveis.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">Nenhum incidente encontrado</p>
          <p className="text-sm mt-1">Crie um novo incidente para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Incidente</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Prioridade</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Criado por</th>
                {eTI && <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((inc, i) => (
                <tr key={inc.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i === visiveis.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900 text-sm">{inc.titulo}</p>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{inc.descricao}</p>
                    <p className="text-slate-300 text-xs mt-0.5">{new Date(inc.criadoEm).toLocaleDateString('pt-PT')}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-600">{tipoLabel(inc.tipo)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge value={inc.prioridade} options={PRIORIDADES} />
                  </td>
                  <td className="px-4 py-4">
                    <Badge value={inc.estado} options={ESTADOS} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-600">{inc.criadoPor?.nome ?? '—'}</span>
                  </td>
                  {eTI && (
                    <td className="px-4 py-4">
                      <select
                        value={inc.estado}
                        onChange={e => atualizarEstado(inc.id, e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar incidente */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '500px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Novo Incidente TI</h2>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título</label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Resumo do problema"
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva o problema com detalhe..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flex gap-3" style={{ marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                >
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Prioridade</label>
                <select
                  value={prioridade}
                  onChange={e => setPrioridade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                >
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {erro && <p className="text-red-600 text-sm" style={{ marginBottom: '12px' }}>{erro}</p>}

            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}
              >
                Cancelar
              </button>
              <button
                onClick={criarIncidente}
                disabled={salvando || !titulo.trim() || !descricao.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}
              >
                {salvando ? 'A criar...' : 'Criar Incidente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
