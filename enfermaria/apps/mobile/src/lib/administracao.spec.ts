import { CINCO_CERTOS, corpoAdministracao, todosConfirmados } from './administracao';

describe('administração à cabeceira (PROD-16)', () => {
  const agora = new Date('2026-11-18T03:10:00Z');

  it('a hora do ato é a da confirmação, não a do envio da fila', () => {
    const corpo = corpoAdministracao('d1', { atestado: true }, agora);
    expect(corpo).toEqual({ doenteId: 'd1', ocorridoEm: '2026-11-18T03:10:00.000Z', atestadoPeloEnfermeiro: true });
  });

  it('com etiqueta lida, envia a etiqueta (e a justificação, se houver) — não uma atestação', () => {
    expect(corpoAdministracao('d1', { qrPayload: 'abc.sig' }, agora)).toEqual({ doenteId: 'd1', ocorridoEm: agora.toISOString(), qrPayload: 'abc.sig' });
    expect(corpoAdministracao('d1', { qrPayload: 'abc.sig', observacoes: 'dose ajustada' }, agora).observacoes).toBe('dose ajustada');
  });

  it('só se administra com os cinco certos confirmados', () => {
    expect(CINCO_CERTOS).toHaveLength(5);
    expect(todosConfirmados({ doente: true, medicamento: true, dose: true, via: true })).toBe(false);
    expect(todosConfirmados({ doente: true, medicamento: true, dose: true, via: true, hora: true })).toBe(true);
  });
});
