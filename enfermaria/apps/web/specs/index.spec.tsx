import RootPage from '../src/app/page';

// A raiz não renderiza nada: encaminha para o dashboard. O teste anterior (scaffold) tentava
// renderizá-la e falhava sempre com NEXT_REDIRECT — testava o oposto do comportamento real.
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
import { redirect } from 'next/navigation';

describe('RootPage', () => {
  it('encaminha a raiz para /dashboard', () => {
    RootPage();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
