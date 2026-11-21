import { Registry } from 'prom-client';
import { contadorFalhas, registarFalha, falhaTratada } from './falhas';

describe('falhas tratadas (ARQ-07)', () => {
  const registo = new Registry();
  registo.registerMetric(contadorFalhas);
  const valor = async (contexto: string, gravidade: string) =>
    (await contadorFalhas.get()).values.find((v) => v.labels.contexto === contexto && v.labels.gravidade === gravidade)?.value ?? 0;

  it('registarFalha devolve null (para o .catch) e conta por contexto e gravidade', async () => {
    const r = await Promise.reject(new Error('boom')).catch(registarFalha('teste:alerta', 'erro'));
    expect(r).toBeNull();
    expect(await valor('teste:alerta', 'erro')).toBe(1);
  });

  it('falhaTratada conta como aviso por omissão', async () => {
    falhaTratada('teste:aviso', new Error('x'));
    falhaTratada('teste:aviso', 'texto');
    expect(await valor('teste:aviso', 'aviso')).toBe(2);
    expect(await registo.metrics()).toContain('curasphere_falhas_tratadas_total{contexto="teste:aviso",gravidade="aviso"} 2');
  });
});
