import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY, SUB_ROLES_KEY } from './roles.decorator';

// QA-21 — o guard que decide quem chega a cada rota não tinha um único teste.
describe('RolesGuard', () => {
  const contexto = (user: unknown, roles?: string[], subRoles?: string[]) => {
    const handler = () => undefined;
    const reflector = new Reflector();
    if (roles) Reflect.defineMetadata(ROLES_KEY, roles, handler);
    if (subRoles) Reflect.defineMetadata(SUB_ROLES_KEY, subRoles, handler);
    const ctx: any = {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };
    return new RolesGuard(reflector).canActivate(ctx);
  };
  const enf = { role: 'enfermeiro', subRole: null, tipoToken: 'pessoal' };

  it('rota sem @Roles nem @SubRoles: passa', () => {
    expect(contexto(enf)).toBe(true);
  });

  it('papel base listado: passa; não listado: recusa', () => {
    expect(contexto(enf, ['medico', 'enfermeiro'])).toBe(true);
    expect(contexto(enf, ['medico'])).toBe(false);
  });

  it('o sub-papel de liderança conta como papel (chefe_enfermeiros)', () => {
    const chefe = { role: 'enfermeiro', subRole: 'chefe_enfermeiros', tipoToken: 'pessoal' };
    expect(contexto(chefe, ['chefe_enfermeiros'])).toBe(true);
    expect(contexto(enf, ['chefe_enfermeiros'])).toBe(false);
  });

  it('@SubRoles é um filtro adicional estrito (AND)', () => {
    const cardio = { role: 'medico', subRole: 'cardiologista', tipoToken: 'pessoal' };
    expect(contexto(cardio, ['medico'], ['cardiologista'])).toBe(true);
    expect(contexto(cardio, ['medico'], ['neurologista'])).toBe(false);
    expect(contexto({ role: 'medico', subRole: null, tipoToken: 'pessoal' }, ['medico'], ['cardiologista'])).toBe(false);
  });

  it('SEC-01/03: tokens intermédios ou de outro domínio nunca passam numa rota com papel', () => {
    expect(contexto(undefined, ['enfermeiro'])).toBe(false);
    expect(contexto({ role: undefined, tipoToken: 'pessoal' }, ['enfermeiro'])).toBe(false);
    expect(contexto({ ...enf, tipoToken: 'mfa_desafio' }, ['enfermeiro'])).toBe(false);
    expect(contexto({ ...enf, tipoToken: 'portal' }, ['enfermeiro'])).toBe(false);
    // `includes(undefined)` não pode abrir a porta a um token sem papel.
    expect(contexto({ tipoToken: 'pessoal' }, ['enfermeiro', undefined as unknown as string])).toBe(false);
  });

  it('as definições da rota sobrepõem-se às da classe', () => {
    const handler = () => undefined;
    class Ctrl {}
    Reflect.defineMetadata(ROLES_KEY, ['direcao'], Ctrl);
    Reflect.defineMetadata(ROLES_KEY, ['enfermeiro'], handler);
    const ctx: any = { getHandler: () => handler, getClass: () => Ctrl, switchToHttp: () => ({ getRequest: () => ({ user: enf }) }) };
    expect(new RolesGuard(new Reflector()).canActivate(ctx)).toBe(true);
  });
});
