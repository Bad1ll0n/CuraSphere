import { SetMetadata } from '@nestjs/common';
import type { TipoToken } from './token-audiences';

export const TIPOS_TOKEN_KEY = 'tiposToken';

/**
 * Declara que tipos de token um endpoint aceita (ver `token-audiences.ts`).
 *
 * Por omissão — sem este decorator — o `JwtAuthGuard` só aceita 'pessoal', ou seja,
 * uma sessão de funcionário completa. Os tokens intermédios ('mfa_setup',
 * 'password_expirada') têm de ser explicitamente permitidos endpoint a endpoint,
 * o que impede que um token emitido a meio do fluxo de login sirva como sessão.
 *
 * Exemplo: `@TiposToken('pessoal', 'password_expirada')` em `PATCH /auth/alterar-password`
 * — o utilizador com password expirada pode trocá-la, mas não pode fazer mais nada.
 */
export const TiposToken = (...tipos: TipoToken[]) => SetMetadata(TIPOS_TOKEN_KEY, tipos);
