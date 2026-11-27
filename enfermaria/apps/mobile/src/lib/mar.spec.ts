import { administradaHoje } from './mar';

const registo = (administradoEm: string, naoAdministrada = false) => ({
  id: administradoEm, administradoEm, administradoPor: { nome: 'Enf.' }, observacoes: null,
  verificacao5Certas: false, naoAdministrada, motivoNaoAdmin: naoAdministrada ? 'recusou' : null,
});

describe('MAR móvel — administrada hoje (ARQ-12)', () => {
  const agora = new Date('2026-11-16T15:00:00');
  it('um registo de hoje conta; um de ontem não', () => {
    expect(administradaHoje({ registos: [registo('2026-11-16T09:00:00')] }, agora)).toBe(true);
    expect(administradaHoje({ registos: [registo('2026-11-15T21:00:00')] }, agora)).toBe(false);
  });
  it('uma não-administração de hoje não conta como administrada', () => {
    expect(administradaHoje({ registos: [registo('2026-11-16T09:00:00', true)] }, agora)).toBe(false);
  });
  it('sem registos, está por administrar', () => {
    expect(administradaHoje({ registos: [] }, agora)).toBe(false);
  });
});
