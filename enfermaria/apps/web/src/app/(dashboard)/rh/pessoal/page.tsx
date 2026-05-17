'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useToast } from '../../../../components/toast';

interface Pessoal {
  id: string;
  nome: string;
  role: string;
  subRole?: string;
  servico?: string;
  dadosContratuais?: {
    tipoVinculo: string;
    dataInicio: string;
    dataFimPrevista?: string;
    diasFeriasAnuais: number;
  };
  chefe?: { id: string; nome: string };
  saldoFerias: { direitoAnual: number; diasUsados: number };
}

const VINCULO_COR: Record<string, string> = {
  permanente:          'bg-green-50 text-green-700 border-green-200',
  termo_certo:         'bg-amber-50 text-amber-700 border-amber-200',
  prestacao_servicos:  'bg-blue-50 text-blue-700 border-blue-200',
  estagio:             'bg-purple-50 text-purple-700 border-purple-200',
};

const VINCULO_LABEL: Record<string, string> = {
  permanente: 'Permanente', termo_certo: 'Termo Certo',
  prestacao_servicos: 'Prestação de Serviços', estagio: 'Estágio',
};

const ROLE_LABEL: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

export default function PessoalPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filtroRole, setFiltroRole] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [filtroServico, setFiltroServico] = useState('');
  const [modalPessoa, setModalPessoa] = useState<Pessoal | null>(null);
  const [contrato, setContrato] = useState({
    tipoVinculo: 'permanente', dataInicio: '', dataFimPrevista: '', diasFeriasAnuais: 22,
  });

  const { data: pessoal = [], isLoading } = useQuery<Pessoal[]>({
    queryKey: ['rh-pessoal'],
    queryFn: () => api.get('/rh/pessoal').then(r => r.data),
    staleTime: 60_000,
  });

  const mutContrato = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: typeof contrato }) =>
      api.post(`/rh/pessoal/${id}/contrato`, dto),
    onSuccess: () => { toast.success('Dados contratuais guardados'); qc.invalidateQueries({ queryKey: ['rh-pessoal'] }); setModalPessoa(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao guardar contrato'),
  });

  const roles = [...new Set(pessoal.map(p => p.role))];
  const servicos = [...new Set(pessoal.map(p => p.servico).filter(Boolean) as string[])].sort();
  const filtrado = pessoal.filter(p => {
    if (filtroRole && p.role !== filtroRole) return false;
    if (filtroServico && p.servico !== filtroServico) return false;
    if (pesquisa && !p.nome.toLowerCase().includes(pesquisa.toLowerCase())) return false;
    return true;
  });

  const abrirModal = (p: Pessoal) => {
    setModalPessoa(p);
    setContrato({
      tipoVinculo: p.dadosContratuais?.tipoVinculo ?? 'permanente',
      dataInicio: p.dadosContratuais?.dataInicio ? new Date(p.dadosContratuais.dataInicio).toISOString().split('T')[0] : '',
      dataFimPrevista: p.dadosContratuais?.dataFimPrevista ? new Date(p.dadosContratuais.dataFimPrevista).toISOString().split('T')[0] : '',
      diasFeriasAnuais: p.dadosContratuais?.diasFeriasAnuais ?? 22,
    });
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Pessoal</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Dados contratuais, vínculos e saldo de férias</p>
        </div>
        <div className="flex items-center gap-3">
          <input value={pesquisa} onChange={e => setPesquisa(e.target.value)}
            placeholder="Pesquisar por nome..."
            className="border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '9px 14px', width: '200px' }} />
          <select value={filtroRole} onChange={e => setFiltroRole(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '9px 14px' }}>
            <option value="">Todas as roles</option>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
          </select>
          <select value={filtroServico} onChange={e => setFiltroServico(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '9px 14px' }}>
            <option value="">Todos os serviços</option>
            {servicos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px 12px 32px' }}>Colaborador</th>
                <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Role</th>
                <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Vínculo</th>
                <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Fim Contrato</th>
                <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 16px' }}>Férias</th>
                <th style={{ padding: '12px 16px' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrado.map(p => {
                const saldo = p.saldoFerias;
                const pct = Math.min(100, (saldo.diasUsados / saldo.direitoAnual) * 100);
                const aExpirar = p.dadosContratuais?.dataFimPrevista && new Date(p.dadosContratuais.dataFimPrevista) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td style={{ padding: '14px 20px 14px 32px' }}>
                      <p className="font-medium text-slate-800">{p.nome}</p>
                      {p.chefe && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Chefe: {p.chefe.nome}</p>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <p className="text-slate-700">{ROLE_LABEL[p.role] ?? p.role}</p>
                      {p.subRole && <p className="text-xs text-slate-400">{p.subRole}</p>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {p.dadosContratuais ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${VINCULO_COR[p.dadosContratuais.tipoVinculo] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {VINCULO_LABEL[p.dadosContratuais.tipoVinculo] ?? p.dadosContratuais.tipoVinculo}
                        </span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {p.dadosContratuais?.dataFimPrevista ? (
                        <span className={`text-xs font-medium ${aExpirar ? 'text-red-600' : 'text-slate-600'}`}>
                          {new Date(p.dadosContratuais.dataFimPrevista).toLocaleDateString('pt-PT')}
                          {aExpirar && ' ⚠'}
                        </span>
                      ) : <span className="text-xs text-slate-400">Indefinido</span>}
                    </td>
                    <td style={{ padding: '14px 16px', minWidth: '120px' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full" style={{ height: '6px' }}>
                          <div className="bg-blue-500 rounded-full" style={{ width: `${pct}%`, height: '6px' }} />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{saldo.diasUsados}/{saldo.direitoAnual}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button onClick={() => abrirModal(p)}
                        className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}>
                        Editar Contrato
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrado.length === 0 && (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>Sem colaboradores</p>
          )}
        </div>
      )}

      {modalPessoa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full" style={{ maxWidth: '460px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '6px' }}>Dados Contratuais</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{modalPessoa.nome}</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tipo de Vínculo</label>
                <select value={contrato.tipoVinculo} onChange={e => setContrato(c => ({ ...c, tipoVinculo: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 12px' }}>
                  <option value="permanente">Permanente</option>
                  <option value="termo_certo">Termo Certo</option>
                  <option value="prestacao_servicos">Prestação de Serviços</option>
                  <option value="estagio">Estágio</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Início</label>
                  <input type="date" value={contrato.dataInicio} onChange={e => setContrato(c => ({ ...c, dataInicio: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Fim (opcional)</label>
                  <input type="date" value={contrato.dataFimPrevista} onChange={e => setContrato(c => ({ ...c, dataFimPrevista: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dias de Férias Anuais</label>
                <input type="number" value={contrato.diasFeriasAnuais} min={22} max={30}
                  onChange={e => setContrato(c => ({ ...c, diasFeriasAnuais: +e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalPessoa(null)}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button
                onClick={() => mutContrato.mutate({ id: modalPessoa.id, dto: contrato })}
                disabled={!contrato.dataInicio || mutContrato.isPending}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutContrato.isPending ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
