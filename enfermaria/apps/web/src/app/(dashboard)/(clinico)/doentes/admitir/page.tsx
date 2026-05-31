'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Cama } from '@org/shared';

export default function AdmitirDoentesPagina() {
  const router = useRouter();
  const [camas, setCamas] = useState<Cama[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    nome: '',
    dataNascimento: '',
    diagnosticoPrincipal: '',
    camaId: '',
    dataAltaPrevista: '',
    nif: '',
    numeroSNS: '',
    morada: '',
    codigoPostal: '',
    localidade: '',
    telefone: '',
  });

  useEffect(() => {
    api.get('/camas').then((r) => setCamas(r.data.filter((c: Cama) => c.estado === 'livre' || c.estado === 'reservada')));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        dataNascimento: new Date(form.dataNascimento),
        diagnosticoPrincipal: form.diagnosticoPrincipal,
        camaId: form.camaId,
        dataAltaPrevista: form.dataAltaPrevista ? new Date(form.dataAltaPrevista) : undefined,
      };
      if (form.nif)         payload.nif = form.nif;
      if (form.numeroSNS)   payload.numeroSNS = form.numeroSNS;
      if (form.morada)      payload.morada = form.morada;
      if (form.codigoPostal) payload.codigoPostal = form.codigoPostal;
      if (form.localidade)  payload.localidade = form.localidade;
      if (form.telefone)    payload.telefone = form.telefone;
      await api.post('/doentes/admitir', payload);
      router.push('/doentes');
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao admitir doente');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all";

  return (
    <div style={{ padding: '40px 48px', maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link
          href="/doentes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          style={{ marginBottom: '16px', display: 'inline-flex' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar a Doentes
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Admissão de Doente</h1>
        <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Preencha os dados para internar um novo doente</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Secção — Dados pessoais */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px 32px', marginBottom: '20px' }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: '24px' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Dados Pessoais</h2>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nome completo</label>
              <input
                required
                value={form.nome}
                onChange={set('nome')}
                placeholder="Nome do doente"
                className={inputClass}
                style={{ padding: '11px 16px' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Data de Nascimento</label>
              <input
                type="date"
                required
                value={form.dataNascimento}
                onChange={set('dataNascimento')}
                className={inputClass}
                style={{ padding: '11px 16px' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Número de Processo</label>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 flex items-center gap-2" style={{ padding: '11px 16px' }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerado automaticamente
              </div>
            </div>
          </div>
        </div>

        {/* Secção — Clínico */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px 32px', marginBottom: '20px' }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: '24px' }}>
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Informação Clínica</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Diagnóstico Principal</label>
            <textarea
              required
              value={form.diagnosticoPrincipal}
              onChange={set('diagnosticoPrincipal')}
              rows={3}
              placeholder="Descreva o diagnóstico principal do doente..."
              className={`${inputClass} resize-none`}
              style={{ padding: '11px 16px' }}
            />
          </div>
        </div>

        {/* Secção — Dados Administrativos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px 32px', marginBottom: '20px' }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: '24px' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Dados Administrativos</h2>
              <p className="text-xs text-slate-400" style={{ marginTop: '1px' }}>Opcional — pode ser preenchido depois em "Dados Administrativos" na ficha do doente</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>NIF <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.nif} onChange={set('nif')} placeholder="123456789"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Número SNS <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.numeroSNS} onChange={set('numeroSNS')} placeholder="123456789"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Telefone <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.telefone} onChange={set('telefone')} placeholder="912 345 678"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Localidade <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.localidade} onChange={set('localidade')} placeholder="Lisboa"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Morada <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.morada} onChange={set('morada')} placeholder="Rua Exemplo, n.º 1"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Código Postal <span className="font-normal text-slate-300 normal-case tracking-normal">(opcional)</span></label>
              <input value={form.codigoPostal} onChange={set('codigoPostal')} placeholder="1000-001"
                className={inputClass} style={{ padding: '11px 16px' }} />
            </div>
          </div>
        </div>

        {/* Secção — Internamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px 32px', marginBottom: '28px' }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: '24px' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Internamento</h2>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>
                Cama
                {camas.length > 0 && (
                  <span style={{ marginLeft: '12px', fontSize: '12px' }} className="font-medium text-teal-600 bg-teal-50 badge-pad py-0.5 rounded-full normal-case tracking-normal">
                    {camas.length} disponíveis
                  </span>
                )}
              </label>
              <select
                required
                value={form.camaId}
                onChange={set('camaId')}
                className={inputClass}
                style={{ padding: '11px 16px' }}
              >
                <option value="">Selecionar cama...</option>
                {camas.map((c) => (
                  <option key={c.id} value={c.id}>
                    Quarto {c.quarto} · Cama {c.numero}{c.estado === 'reservada' ? ' (reservada)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Alta Prevista <span className="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></label>
              <input
                type="date"
                value={form.dataAltaPrevista}
                onChange={set('dataAltaPrevista')}
                className={inputClass}
                style={{ padding: '11px 16px' }}
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-3" style={{ padding: '14px 18px', marginBottom: '20px' }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {erro}
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href="/doentes"
            className="flex-1 flex items-center justify-center border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            style={{ padding: '13px' }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
            style={{ padding: '13px' }}
          >
            {loading ? 'A admitir...' : 'Admitir Doente'}
          </button>
        </div>
      </form>
    </div>
  );
}
