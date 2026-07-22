import { TriagemPortalService } from './triagem-portal.service';

describe('TriagemPortalService', () => {
  const svc = new TriagemPortalService();

  it('sem IA disponível degrada em segurança (fallback conservador + disclaimer + sinais de alarme)', async () => {
    // Força o caminho de fallback ao fazer a chamada ao modelo falhar.
    (svc as any).client = { messages: { create: jest.fn().mockRejectedValue(new Error('sem key')) } };

    const r: any = await svc.orientar({ sintomas: 'dor de cabeça há 2 dias' } as any);

    expect(r.nivelUrgencia).toBe('marcar_consulta'); // nunca 'auto_cuidado' no fallback
    expect(r.indisponivel).toBe(true);
    expect(r.disclaimer).toMatch(/não substitui/i);
    expect(r.sinaisAlarme.length).toBeGreaterThan(0);
  });

  it('quando a IA responde, mapeia o JSON e mantém o disclaimer', async () => {
    (svc as any).client = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"nivelUrgencia":"urgencia","titulo":"T","recomendacao":"R","sinaisAlarme":["dor no peito"]}' }],
        }),
      },
    };

    const r: any = await svc.orientar({ sintomas: 'dor no peito', idade: 60, duracaoDias: 1 } as any);
    expect(r.nivelUrgencia).toBe('urgencia');
    expect(r.titulo).toBe('T');
    expect(r.disclaimer).toMatch(/não substitui/i);
  });
});
