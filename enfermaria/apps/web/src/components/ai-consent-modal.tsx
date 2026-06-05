'use client';
import { giveAiConsent } from '@/lib/ai-consent';

interface Props {
  onAceitar: () => void;
  onRecusar: () => void;
}

export function AiConsentModal({ onAceitar, onRecusar }: Props) {
  const aceitar = () => {
    giveAiConsent();
    onAceitar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4" style={{ padding: '32px' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Utilização de Inteligência Artificial</h2>
            <p className="text-xs text-slate-500">Consentimento informado — RGPD Art. 22</p>
          </div>
        </div>

        <div className="text-sm text-slate-700 space-y-3" style={{ marginBottom: '24px' }}>
          <p>
            O CuraSphere utiliza um sistema de <strong>apoio à decisão clínica baseado em IA</strong> (modelo de linguagem de grande escala). Antes de activar esta funcionalidade, é necessário o seu consentimento explícito nos termos do <strong>Regulamento (UE) 2016/679 (RGPD), Art. 22</strong>.
          </p>
          <div className="bg-slate-50 rounded-xl" style={{ padding: '14px' }}>
            <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ marginBottom: '8px' }}>O que é processado</p>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>• Dados clínicos do doente (diagnósticos, sinais vitais, medicação, notas)</li>
              <li>• Identificadores anonimizados — nenhum nome é enviado ao modelo de IA</li>
              <li>• As interações são registadas para fins de auditoria interna</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl" style={{ padding: '14px' }}>
            <p className="font-semibold text-amber-800 text-xs uppercase tracking-wide" style={{ marginBottom: '6px' }}>Aviso importante</p>
            <p className="text-xs text-amber-700">
              As sugestões da IA são <strong>exclusivamente de apoio</strong> e não substituem o julgamento clínico, diagnóstico ou prescrição médica. A responsabilidade clínica mantém-se integralmente nos profissionais de saúde.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Pode revogar o consentimento a qualquer momento em <strong>Definições → Privacidade</strong>. A recusa não afecta o acesso às restantes funcionalidades da plataforma.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRecusar}
            className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            style={{ padding: '10px' }}>
            Recusar
          </button>
          <button
            onClick={aceitar}
            className="flex-1 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
            style={{ padding: '10px' }}>
            Aceitar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
