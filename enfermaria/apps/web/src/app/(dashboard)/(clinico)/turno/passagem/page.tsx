'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Breadcrumb } from '@/components/breadcrumb';

type Turno = 'manha' | 'tarde' | 'noite';

interface AiSumario {
  narrativa: string;
  destaques: string[];
  disclaimer: string;
}

const SERVICOS = ['Cardiologia', 'Ortopedia', 'Medicina Interna', 'Cirurgia', 'Neurologia', 'UCI'];

export default function PassagemTurnoPage() {
  const toast = useToast();
  const [turno, setTurno] = useState<Turno>('manha');
  const [servico, setServico] = useState(SERVICOS[0]);
  const [relatorio, setRelatorio] = useState<{ id: string; rascunho: string; conteudo: string } | null>(null);
  const [conteudoEditado, setConteudoEditado] = useState('');
  const [gerando, setGerando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aiSumario, setAiSumario] = useState<AiSumario | null>(null);
  const [gerandoAI, setGerandoAI] = useState(false);

  const gerar = async () => {
    setGerando(true);
    setAiSumario(null);
    try {
      const r = await api.post('/relatorio-passagem-turno/gerar', { turno, servico });
      setRelatorio(r.data);
      setConteudoEditado(r.data.rascunho);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao gerar');
    } finally { setGerando(false); }
  };

  const gerarSumarioAI = async () => {
    setGerandoAI(true);
    try {
      const servicoMap: Record<string, string> = {
        'Cardiologia': 'internamento', 'Medicina Interna': 'internamento',
        'Cirurgia': 'internamento', 'UCI': 'internamento',
        'Ortopedia': 'internamento', 'Neurologia': 'internamento',
      };
      const r = await api.post('/ai-clinico/sumarizar-turno-servico', {
        servico: servicoMap[servico] ?? 'internamento',
      });
      setAiSumario(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao gerar sumário IA');
    } finally { setGerandoAI(false); }
  };

  const confirmar = async () => {
    if (!relatorio) return;
    setConfirmando(true);
    try {
      await api.post(`/relatorio-passagem-turno/${relatorio.id}/confirmar`, { conteudo: conteudoEditado });
      toast.success('Passagem de turno confirmada e registada');
      setRelatorio(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally { setConfirmando(false); }
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Breadcrumb items={[{ label: 'Turno' }, { label: 'Passagem de Turno' }]} />
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Passagem de Turno</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Geração automática do relatório por serviço e turno</p>
        </div>
      </div>

      {!relatorio ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '32px' }}>
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço</label>
              <select value={servico} onChange={e => setServico(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '10px 12px' }}>
                {SERVICOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Turno a Sair</label>
              <select value={turno} onChange={e => setTurno(e.target.value as Turno)}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '10px 12px' }}>
                <option value="manha">Manhã (08h–16h)</option>
                <option value="tarde">Tarde (16h–00h)</option>
                <option value="noite">Noite (00h–08h)</option>
              </select>
            </div>
          </div>

          <button onClick={gerar} disabled={gerando}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            style={{ padding: '13px' }}>
            {gerando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                A gerar rascunho...
              </span>
            ) : 'Gerar Rascunho de Passagem'}
          </button>
        </div>
      ) : (
        <div>
          {/* Painel AI Sumário */}
          {aiSumario ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl" style={{ padding: '24px', marginBottom: '16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-sm font-bold text-indigo-800">Narrativa IA — Passagem de Turno</span>
                </div>
                <button onClick={() => setAiSumario(null)} className="text-indigo-400 hover:text-indigo-600 text-lg font-bold">✕</button>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed" style={{ marginBottom: '16px' }}>{aiSumario.narrativa}</p>
              {aiSumario.destaques.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Destaques para o turno seguinte</p>
                  <ul className="flex flex-col gap-1.5">
                    {aiSumario.destaques.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                        <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-indigo-400 italic" style={{ marginTop: '12px' }}>{aiSumario.disclaimer}</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl flex items-center justify-between" style={{ padding: '16px 20px', marginBottom: '16px' }}>
              <div>
                <p className="text-sm font-semibold text-slate-700">Enriquecer com Inteligência Artificial</p>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Gera uma narrativa de turno e destaca os doentes mais críticos para a equipa seguinte.</p>
              </div>
              <button
                onClick={gerarSumarioAI}
                disabled={gerandoAI}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shrink-0"
                style={{ padding: '10px 18px' }}>
                {gerandoAI ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A gerar...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Narrativa IA
                  </>
                )}
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px', marginBottom: '16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 className="text-base font-bold text-slate-900">Rascunho gerado — reveja e edite antes de confirmar</h2>
              <button onClick={() => { setRelatorio(null); setAiSumario(null); }}
                className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg"
                style={{ padding: '5px 10px' }}>
                Recomeçar
              </button>
            </div>
            <textarea
              value={conteudoEditado}
              onChange={e => setConteudoEditado(e.target.value)}
              rows={30}
              className="w-full border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              style={{ padding: '12px 14px' }}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setRelatorio(null); setAiSumario(null); }}
              className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              style={{ padding: '12px' }}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={confirmando || !conteudoEditado.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ padding: '12px' }}>
              {confirmando ? 'A confirmar...' : 'Confirmar Passagem de Turno'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
