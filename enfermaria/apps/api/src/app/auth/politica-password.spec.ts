import { BadRequestException } from '@nestjs/common';
import { exigirPasswordForte, motivoPasswordFraca } from './politica-password';

describe('SEC-25 — política de passwords', () => {
  it('aceita frases-passe sem regras de composição', () => {
    expect(motivoPasswordFraca('cavalo bateria agrafo')).toBeNull();
    expect(motivoPasswordFraca('nuvem-violeta-quarta')).toBeNull();
  });

  it('comprimento: 12 a 64 caracteres e no máximo 72 bytes (o bcrypt ignora o resto)', () => {
    expect(motivoPasswordFraca('Abc123!xyz')).toMatch(/pelo menos 12/);
    expect(motivoPasswordFraca('a'.repeat(5) + 'b'.repeat(60))).toMatch(/no máximo/);
    expect(motivoPasswordFraca('ção'.repeat(19))).toMatch(/no máximo/); // 57 caracteres, 95 bytes
  });

  it('recusa as comuns e as variantes óbvias', () => {
    for (const p of ['Hospital2026!', 'enfermeiro123', 'Password1234', 'qwertyuiop12', '!!Benfica1904']) {
      expect(motivoPasswordFraca(p)).toMatch(/comum ou previsível/);
    }
  });

  it('recusa repetições e sequências', () => {
    expect(motivoPasswordFraca('aaaaaaaaaaaa')).toMatch(/previsível/);
    expect(motivoPasswordFraca('123456789012')).not.toBeNull();
    expect(motivoPasswordFraca('abcdefghijkl')).toMatch(/previsível/);
  });

  it('recusa dados pessoais (número, nome sem acentos, email)', () => {
    expect(motivoPasswordFraca('xx00042 verde azul', { numeroFuncionario: '00042' })).toMatch(/nome, email ou número/);
    expect(motivoPasswordFraca('joaosilva primavera', { nome: 'João Silva' })).toMatch(/nome, email ou número/);
    expect(motivoPasswordFraca('maria.lopes viagem 9', { email: 'maria.lopes@exemplo.pt' })).toMatch(/nome, email ou número/);
  });

  it('a nova tem de ser diferente da atual', () => {
    expect(motivoPasswordFraca('cavalo bateria agrafo', { atual: 'cavalo bateria agrafo' })).toMatch(/diferente/);
  });

  it('exigirPasswordForte lança 400', () => {
    expect(() => exigirPasswordForte('curto')).toThrow(BadRequestException);
    expect(() => exigirPasswordForte('cavalo bateria agrafo')).not.toThrow();
  });
});
