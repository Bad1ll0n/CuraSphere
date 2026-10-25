import { GUARDS_METADATA } from '@nestjs/common/constants';
import { QuiosqueController } from './quiosque.controller';
import { QuiosqueGuard } from '../common/quiosque.guard';

/**
 * S-05: `GET /doentes/quiosque-dados` validava o token de quiosque por conta própria — sem
 * o tecto de 30 dias nem a revogação que o `QuiosqueGuard` aplica às restantes rotas.
 */
describe('QuiosqueController (doentes)', () => {
  const guardas = (metodo: keyof QuiosqueController) =>
    (Reflect.getMetadata(GUARDS_METADATA, QuiosqueController.prototype[metodo]) ?? []) as unknown[];

  it('os dados de corredor passam pelo QuiosqueGuard', () => {
    expect(guardas('dadosQuiosque')).toContain(QuiosqueGuard);
  });

  it('nenhuma rota deste controlador fica sem guard', () => {
    const metodos = Object.getOwnPropertyNames(QuiosqueController.prototype).filter(
      (m) => m !== 'constructor',
    ) as (keyof QuiosqueController)[];

    expect(metodos.filter((m) => guardas(m).length === 0)).toEqual([]);
  });

  it('usa o serviço do token validado, não o que o pedido declara', async () => {
    const doentes = { dadosQuiosque: jest.fn().mockResolvedValue({}) };
    const controller = new QuiosqueController(doentes as any);

    await controller.dadosQuiosque({ quiosque: { servicoId: 'internamento' } });

    expect(doentes.dadosQuiosque).toHaveBeenCalledWith('internamento');
  });
});
