import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value ?? 'pt';
  // UX-26: espanhol e ucraniano só existem no quiosque (turistas e migrantes). Os ficheiros
  // es/uk têm o namespace do quiosque; o resto cai para o inglês.
  const validLocales = ['pt', 'en', 'es', 'uk'];
  const resolvedLocale = validLocales.includes(locale) ? locale : 'pt';
  const proprias = (await import(`../messages/${resolvedLocale}.json`)).default;
  const messages = resolvedLocale === 'es' || resolvedLocale === 'uk'
    ? juntar((await import('../messages/en.json')).default, proprias)
    : proprias;

  return { locale: resolvedLocale, messages };
});

/** Junta as mensagens de base com as do idioma (as do idioma ganham), por namespace. */
function juntar(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const b = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object'
      ? juntar(b as Record<string, unknown>, v as Record<string, unknown>)
      : v;
  }
  return out;
}
