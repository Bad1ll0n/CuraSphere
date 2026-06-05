const CONSENT_KEY = 'curasphere:ai_consent_v1';

export function hasAiConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'granted';
}

export function giveAiConsent(): void {
  localStorage.setItem(CONSENT_KEY, 'granted');
}

export function revokeAiConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
}
