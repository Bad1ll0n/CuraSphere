import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { AllExceptionsFilter } from './exception.filter';

function host() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const h = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/v1/medicacao/x/administrar' }) }),
  } as unknown as ArgumentsHost;
  return { h, res };
}

describe('AllExceptionsFilter', () => {
  const filtro = new AllExceptionsFilter();

  it('QA-09: conflito de serialização esgotado (P2034) → 409, não 500', () => {
    const { h, res } = host();
    filtro.catch(new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: 'x' }), h);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).toMatchObject({ statusCode: 409, errorCode: 'REGISTO_CONCORRENTE' });
  });

  it('QA-09: o 40001 cru do Postgres também é 409', () => {
    const { h, res } = host();
    filtro.catch(Object.assign(new Error('could not serialize access due to concurrent update'), { code: '40001' }), h);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('outros erros mantêm o seu código', () => {
    const { h, res } = host();
    filtro.catch(new BadRequestException('dose inválida'), h);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
