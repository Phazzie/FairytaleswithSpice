import { routes } from './app.routes';
import { provingGroundsDevOnlyGuard } from './proving-grounds-access.guard';

describe('routes', () => {
  it('gates the proving-grounds route behind provingGroundsDevOnlyGuard', () => {
    const provingGroundsRoute = routes.find(route => route.path === 'proving-grounds');

    expect(provingGroundsRoute).withContext('proving-grounds route must exist').toBeTruthy();
    expect(provingGroundsRoute?.canActivate).toEqual([provingGroundsDevOnlyGuard]);
  });
});
