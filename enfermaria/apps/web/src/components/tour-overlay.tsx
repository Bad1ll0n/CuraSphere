'use client';
import { useState } from 'react';

interface Passo {
  titulo: string;
  descricao: string;
  emoji: string;
}

const PASSOS_MEDICO: Passo[] = [
  { emoji: '👋', titulo: 'Bem-vindo ao CuraSphere', descricao: 'A plataforma clínica integrada do seu hospital. Pode navegar pelo menu lateral para aceder a todos os módulos.' },
  { emoji: '📊', titulo: 'Dashboard em Tempo Real', descricao: 'O dashboard mostra KPIs do turno, NEWS2 por grau de urgência e alertas activos. Actualiza automaticamente.' },
  { emoji: '🔴', titulo: 'Vista de Risco do Turno', descricao: 'Na lista de doentes, use o tab "⚠ Vista de Risco" para ver todos os doentes ordenados por score de deterioração calculado automaticamente.' },
  { emoji: '🧠', titulo: 'Apoio à Decisão Clínica (IA)', descricao: 'Na ficha do doente, o painel "Análise IA" sugere padrões e investigações com base nos dados clínicos. Apenas para apoio — nunca substitui o julgamento médico.' },
  { emoji: '✅', titulo: 'Pronto!', descricao: 'Pode repetir este tour a qualquer momento nas Definições do perfil. Bom turno!' },
];

const PASSOS_ENFERMEIRO: Passo[] = [
  { emoji: '👋', titulo: 'Bem-vindo ao CuraSphere', descricao: 'A plataforma clínica integrada do seu hospital. Use o menu lateral para aceder a todos os módulos disponíveis para o seu perfil.' },
  { emoji: '💊', titulo: 'Timeline de Medicação', descricao: 'Em Turno → Timeline Medicação vê todas as medicações do turno por hora, com alertas de atraso. Clique num bloco para marcar como administrada.' },
  { emoji: '📋', titulo: 'Passagem de Turno', descricao: 'Em Turno → Passagem de Turno pode gerar automaticamente o relatório do turno por serviço, ordenado por criticidade clínica.' },
  { emoji: '⚠', titulo: 'Sinalizar Doente', descricao: 'Na ficha do doente, use o botão "Sinalizar" para alertar a equipa sobre preocupações clínicas — mesmo sem valores alterados. A intuição clínica importa.' },
  { emoji: '✅', titulo: 'Pronto!', descricao: 'Pode repetir este tour a qualquer momento nas Definições do perfil. Bom turno!' },
];

const PASSOS_DEFAULT: Passo[] = [
  { emoji: '👋', titulo: 'Bem-vindo ao CuraSphere', descricao: 'A plataforma hospitalar integrada. Use o menu lateral para navegar.' },
  { emoji: '🏥', titulo: 'Dashboard', descricao: 'O dashboard mostra o estado geral do hospital em tempo real com KPIs actualizados.' },
  { emoji: '✅', titulo: 'Pronto!', descricao: 'Pode repetir este tour nas Definições do perfil. Bem-vindo!' },
];

function getPasosos(role: string): Passo[] {
  if (role === 'medico') return PASSOS_MEDICO;
  if (['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(role)) return PASSOS_ENFERMEIRO;
  return PASSOS_DEFAULT;
}

interface Props {
  role: string;
  onConcluir: () => void;
}

export function TourOverlay({ role, onConcluir }: Props) {
  const passos = getPasosos(role);
  const [step, setStep] = useState(0);
  const passo = passos[step];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl" style={{ maxWidth: '440px', width: '90%', padding: '36px 32px' }}>
        {/* Progress dots */}
        <div className="flex items-center gap-1.5" style={{ marginBottom: '28px' }}>
          {passos.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-blue-600 w-6' : i < step ? 'bg-blue-300 w-3' : 'bg-slate-200 w-3'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <div className="text-5xl" style={{ marginBottom: '16px' }}>{passo.emoji}</div>
          <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '10px' }}>{passo.titulo}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{passo.descricao}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={onConcluir}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            style={{ marginRight: 'auto' }}>
            Saltar tour
          </button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              style={{ padding: '10px 20px' }}>
              Anterior
            </button>
          )}
          {step < passos.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 24px' }}>
              Próximo
            </button>
          ) : (
            <button onClick={onConcluir}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 24px' }}>
              Começar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
