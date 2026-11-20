import { erroDeConfiguracao } from './esquema-config';
import { carregarSegredosDeFicheiro } from '../../carregar-segredos';

const HEX = (c: string) => c.repeat(64);
const base = {
  DATABASE_URL: 'postgresql://x', JWT_SECRET: 'j'.repeat(40), ENCRYPTION_KEY: HEX('a'),
};
const producao = {
  ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://h.pt', JWT_PRIVATE_KEY: 'pem', JWT_PUBLIC_KEY: 'pem',
  AUDIT_SIGNING_KEY: 'b'.repeat(40), MEDICACAO_QR_SECRET: 'c'.repeat(40),
};

describe('configuração (ARQ-20)', () => {
  it('desenvolvimento: só o essencial', () => {
    expect(erroDeConfiguracao(base)).toBeNull();
  });

  it('ENCRYPTION_KEY tem de ter exatamente 64 hex (128 desligava a cifragem em silêncio)', () => {
    expect(erroDeConfiguracao({ ...base, ENCRYPTION_KEY: HEX('a') + HEX('b') })).toMatch(/ENCRYPTION_KEY/);
    expect(erroDeConfiguracao({ ...base, ENCRYPTION_KEY: 'z'.repeat(64) })).toMatch(/ENCRYPTION_KEY/);
  });

  it('produção: completa passa; sem auditoria, sem segredo de QR ou sem chaves ES256, não arranca', () => {
    expect(erroDeConfiguracao(producao)).toBeNull();
    for (const falta of ['AUDIT_SIGNING_KEY', 'MEDICACAO_QR_SECRET', 'JWT_PRIVATE_KEY', 'ALLOWED_ORIGINS']) {
      const { [falta]: _, ...resto } = producao as Record<string, string>;
      expect([falta, erroDeConfiguracao(resto)]).toEqual([falta, expect.stringContaining(falta)]);
    }
  });

  it('produção: recusa valores de exemplo e segredos repetidos', () => {
    expect(erroDeConfiguracao({ ...producao, MEDICACAO_QR_SECRET: 'ALTERAR_SECRET_MINIMO_32_CHARS_AQUI_XX' })).toMatch(/valor de exemplo/);
    expect(erroDeConfiguracao({ ...producao, AUDIT_SIGNING_KEY: producao.JWT_SECRET })).toMatch(/igual a JWT_SECRET/);
  });

  it('opcionais vazios (o compose passa "") são aceites; curtos em produção não', () => {
    expect(erroDeConfiguracao({ ...producao, QUIOSQUE_SECRET: '', METRICS_TOKEN: '', HL7_API_TOKEN: '', ENCRYPTION_KEYS_ANTERIORES: '' })).toBeNull();
    expect(erroDeConfiguracao({ ...producao, QUIOSQUE_SECRET: 'curto' })).toMatch(/QUIOSQUE_SECRET/);
    expect(erroDeConfiguracao({ ...base, HL7_API_TOKEN: 'curto' })).toBeNull();
  });

  it('chaves anteriores: lista de 64 hex separadas por vírgulas', () => {
    expect(erroDeConfiguracao({ ...base, ENCRYPTION_KEYS_ANTERIORES: `${HEX('b')},${HEX('c')}` })).toBeNull();
    expect(erroDeConfiguracao({ ...base, ENCRYPTION_KEYS_ANTERIORES: 'abc' })).toMatch(/ENCRYPTION_KEYS_ANTERIORES/);
  });
});

describe('segredos por ficheiro (OPS-20)', () => {
  it('<NOME>_FILE lê o valor do ficheiro (sem a quebra de linha final)', () => {
    const env: NodeJS.ProcessEnv = { ENCRYPTION_KEY_FILE: '/run/secrets/k', OUTRA_FILE: '/x' };
    expect(carregarSegredosDeFicheiro(env, () => 'segredo\r\n')).toEqual(['ENCRYPTION_KEY']);
    expect(env['ENCRYPTION_KEY']).toBe('segredo');
    expect(env).not.toHaveProperty('OUTRA'); // só os segredos conhecidos
  });

  it('os dois definidos, ou ficheiro ilegível → erro', () => {
    expect(() => carregarSegredosDeFicheiro({ JWT_SECRET: 'x', JWT_SECRET_FILE: '/f' }, () => 'y')).toThrow(/ambos definidos/);
    expect(() => carregarSegredosDeFicheiro({ JWT_SECRET_FILE: '/f' }, () => { throw new Error('ENOENT'); })).toThrow(/não foi possível ler JWT_SECRET_FILE/);
  });
});
