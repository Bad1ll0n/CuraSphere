'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';

/**
 * UX-21 — posto de trabalho partilhado.
 *
 * Antes: aos 15 min sem atividade a sessão terminava em silêncio (perdia-se a nota a meio) e não
 * havia forma rápida de sair do posto sem terminar a sessão — o que, com MFA à entrada, levava a
 * deixar sessões abertas. Agora:
 *  - aos 13 min aparece um aviso com contagem decrescente e "Continuar";
 *  - "Bloquear" (botão ou Ctrl+Shift+L) tapa o ecrã e desmonta o conteúdo clínico; desbloqueia
 *    com a password (a sessão é a mesma: não volta a pedir MFA) ou "Trocar de utilizador";
 *  - os rascunhos de notas ficam na memória do separador, por utilizador (lib/rascunhos.ts).
 * O bloqueio é um ecrã de privacidade, não uma fronteira de segurança: a sessão continua no
 * servidor e expira pela mesma regra de inatividade.
 */
export const INATIVIDADE_MS = 15 * 60 * 1000;
export const AVISO_ANTES_MS = 2 * 60 * 1000;
const EVENTOS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
const chaveBloqueio = (id: string) => `curasphere_bloqueado_${id}`;

export function useSessaoPosto(utilizadorId: string | null, onExpirar: () => void) {
  const [avisoSegundos, setAvisoSegundos] = useState<number | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const fimRef = useRef(Date.now() + INATIVIDADE_MS);
  const expirarRef = useRef(onExpirar);
  expirarRef.current = onExpirar;

  // Um reload com o ecrã bloqueado continua bloqueado (sessionStorage: só este separador).
  useEffect(() => {
    if (!utilizadorId) return;
    try { setBloqueado(sessionStorage.getItem(chaveBloqueio(utilizadorId)) === '1'); } catch { /* sem storage */ }
  }, [utilizadorId]);

  const continuar = useCallback(() => {
    fimRef.current = Date.now() + INATIVIDADE_MS;
    setAvisoSegundos(null);
  }, []);

  useEffect(() => {
    if (!utilizadorId) return;
    // Atividade só adia o fim enquanto não há aviso: com o aviso aberto é preciso escolher.
    const atividade = () => { if (fimRef.current - Date.now() > AVISO_ANTES_MS) fimRef.current = Date.now() + INATIVIDADE_MS; };
    EVENTOS.forEach((e) => window.addEventListener(e, atividade, { passive: true }));
    const relogio = setInterval(() => {
      const falta = fimRef.current - Date.now();
      if (falta <= 0) { clearInterval(relogio); setAvisoSegundos(null); expirarRef.current(); return; }
      setAvisoSegundos(falta <= AVISO_ANTES_MS ? Math.ceil(falta / 1000) : null);
    }, 1000);
    return () => { clearInterval(relogio); EVENTOS.forEach((e) => window.removeEventListener(e, atividade)); };
  }, [utilizadorId]);

  const bloquear = useCallback(() => {
    if (!utilizadorId) return;
    try { sessionStorage.setItem(chaveBloqueio(utilizadorId), '1'); } catch { /* sem storage */ }
    setBloqueado(true);
  }, [utilizadorId]);

  const desbloqueado = useCallback(() => {
    if (utilizadorId) { try { sessionStorage.removeItem(chaveBloqueio(utilizadorId)); } catch { /* sem storage */ } }
    setBloqueado(false);
    continuar();
  }, [utilizadorId, continuar]);

  // Ctrl+Shift+L bloqueia.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); bloquear(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [bloquear]);

  return { avisoSegundos, continuar, bloqueado, bloquear, desbloqueado };
}

export function AvisoInatividade({ segundos, onContinuar, onSair }: { segundos: number; onContinuar: () => void; onSair: () => void }) {
  const t = useTranslations('session');
  const mm = Math.floor(segundos / 60);
  const ss = String(segundos % 60).padStart(2, '0');
  return (
    <div role="presentation" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40">
      <div role="alertdialog" aria-modal="true" aria-labelledby="aviso-inatividade-titulo" aria-describedby="aviso-inatividade-texto"
        className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', margin: '0 16px', padding: '24px' }}>
        <h2 id="aviso-inatividade-titulo" className="text-lg font-bold text-slate-900">{t('idleTitle')}</h2>
        <p id="aviso-inatividade-texto" className="text-sm text-slate-600" style={{ marginTop: '8px' }} aria-live="polite">
          {t('idleBody', { tempo: `${mm}:${ss}` })}
        </p>
        <div className="flex justify-end gap-2" style={{ marginTop: '20px' }}>
          <button type="button" onClick={onSair} className="rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50" style={{ padding: '8px 16px' }}>
            {t('logoutNow')}
          </button>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a ação principal do aviso */}
          <button type="button" autoFocus onClick={onContinuar} className="rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700" style={{ padding: '8px 16px' }}>
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EcraBloqueado({ nome, alertasCriticos, onDesbloqueado, onTrocarUtilizador }: {
  nome: string; alertasCriticos: number; onDesbloqueado: () => void; onTrocarUtilizador: () => void;
}) {
  const t = useTranslations('session');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  const desbloquear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || aEnviar) return;
    setAEnviar(true); setErro('');
    try {
      await api.post('/auth/desbloquear', { password });
      setPassword('');
      onDesbloqueado();
    } catch (err: any) {
      const estado = err?.response?.status;
      const mensagem = String(err?.response?.data?.message ?? '');
      setPassword('');
      // 401 "Credenciais inválidas" = password errada. Outro 401 (conta bloqueada por falhas, ou a
      // sessão já expirou no servidor): só resta entrar de novo.
      if (estado === 401 && !/credenciais inv/i.test(mensagem)) { onTrocarUtilizador(); return; }
      setErro(estado === 429 ? t('tooMany') : t('wrongPassword'));
    } finally { setAEnviar(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ecra-bloqueado-titulo"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900" style={{ padding: '16px' }}>
      <form onSubmit={desbloquear} className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '28px' }}>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('lockedLabel')}</p>
        <h2 id="ecra-bloqueado-titulo" className="text-xl font-bold text-slate-900" style={{ marginTop: '4px' }}>{nome}</h2>
        {alertasCriticos > 0 && (
          <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl" style={{ marginTop: '14px', padding: '8px 12px' }}>
            {t('criticalAlerts', { n: alertasCriticos })}
          </p>
        )}
        <label className="block" style={{ marginTop: '18px' }}>
          <span className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>{t('password')}</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- o único campo do ecrã */}
          <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 12px' }} />
        </label>
        {erro && <p role="alert" className="text-sm text-red-600" style={{ marginTop: '8px' }}>{erro}</p>}
        <button type="submit" disabled={aEnviar || !password}
          className="w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" style={{ padding: '10px', marginTop: '16px' }}>
          {t('unlock')}
        </button>
        <button type="button" onClick={onTrocarUtilizador}
          className="w-full rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50" style={{ padding: '10px', marginTop: '8px' }}>
          {t('switchUser')}
        </button>
      </form>
    </div>
  );
}
