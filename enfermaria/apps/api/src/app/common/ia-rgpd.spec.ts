import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { exigirIaPermitida, FUNCOES_IA, iaPermitida } from './funcoes-ia';
import { conteudoPush } from '../notificacoes/notificacoes.service';
import { escaparHtml } from './escapar-html';
import { TriagemPortalService } from '../triagem-portal/triagem-portal.service';

const semComentarios = (f: string) =>
  readFileSync(join(__dirname, '..', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ARQ-05: o nome do doente nunca é interpolado num texto que segue para um LLM externo.
describe('ARQ-05 — prompts sem identificação do doente', () => {
  it.each([
    'ai-clinico/ai-clinico.service.ts', 'triagem-portal/triagem-portal.service.ts',
    'stewardship/stewardship.service.ts', 'feridas/feridas.service.ts', 'guidelines/guidelines.service.ts',
  ])('%s não interpola nome, NIF nem n.º SNS em template strings', (f) => {
    const codigo = semComentarios(f);
    expect(codigo).not.toMatch(/\$\{\s*(doente|d|paciente)\??\.(nome|nif|numeroSNS)\s*\}/);
    expect(codigo).not.toMatch(/nomePaciente:\s*doente\.nome/);
  });
});

// PROD-19: decisão clínica por LLM desligada por omissão.
describe('PROD-19 — registo de funções de IA', () => {
  const antes = process.env['IA_DECISAO_CLINICA'];
  afterEach(() => { process.env['IA_DECISAO_CLINICA'] = antes; });

  it('produtividade ligada, decisão clínica desligada por omissão', () => {
    delete process.env['IA_DECISAO_CLINICA'];
    expect(iaPermitida('carta_alta')).toBe(true);
    expect(iaPermitida('turno')).toBe(true);
    for (const [nome, f] of Object.entries(FUNCOES_IA)) {
      if (f.tipo === 'decisao_clinica') expect(iaPermitida(nome)).toBe(false);
    }
    expect(() => exigirIaPermitida('triagem_portal')).toThrow(ForbiddenException);
  });

  it('função desconhecida fecha (tratada como decisão clínica)', () => {
    delete process.env['IA_DECISAO_CLINICA'];
    expect(iaPermitida('nova_funcao_sem_registo')).toBe(false);
  });

  it('activação explícita, uma a uma ou todas', () => {
    process.env['IA_DECISAO_CLINICA'] = 'diagnostico_diferencial';
    expect(iaPermitida('diagnostico_diferencial')).toBe(true);
    expect(iaPermitida('triagem_portal')).toBe(false);
    process.env['IA_DECISAO_CLINICA'] = 'todas';
    expect(iaPermitida('triagem_portal')).toBe(true);
  });

  it('triagem do portal desligada: orientação conservadora, sem chamar o LLM', async () => {
    delete process.env['IA_DECISAO_CLINICA'];
    const svc = new TriagemPortalService();
    const create = jest.fn();
    (svc as any).client = { messages: { create } };
    const r = await svc.orientar({ sintomas: 'Dor de cabeça há dois dias' });
    expect(create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ indisponivel: true, nivelUrgencia: 'marcar_consulta' });
  });

  it('todas as chamadas callAI do serviço clínico usam funções registadas', () => {
    const usadas = [...semComentarios('ai-clinico/ai-clinico.service.ts').matchAll(/callAI\('([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(usadas.length).toBeGreaterThan(5);
    expect(usadas.filter((f) => !FUNCOES_IA[f])).toEqual([]);
  });
});

// SEC-18: o push não leva dados pessoais por omissão; o HTML dos emails é escapado.
describe('SEC-18 — subcontratantes', () => {
  const antes = process.env['PUSH_CONTEUDO_COMPLETO'];
  afterEach(() => { process.env['PUSH_CONTEUDO_COMPLETO'] = antes; });

  it('push genérico por omissão', () => {
    delete process.env['PUSH_CONTEUDO_COMPLETO'];
    const p = conteudoPush('Break-glass', 'Dr. X acedeu em emergência ao doente Maria Silva');
    expect(JSON.stringify(p)).not.toMatch(/Maria Silva/);
  });

  it('conteúdo completo só por opção explícita', () => {
    process.env['PUSH_CONTEUDO_COMPLETO'] = 'true';
    expect(conteudoPush('T', 'C')).toEqual({ title: 'T', body: 'C' });
  });

  it('escaparHtml', () => {
    expect(escaparHtml('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
  });
});
