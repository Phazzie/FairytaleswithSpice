import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { PROVING_GROUNDS_DEV_MODE_CHECK, provingGroundsDevOnlyGuard } from './proving-grounds-access.guard';

describe('provingGroundsDevOnlyGuard', () => {
  it('defaults to redirecting home when nothing provides the dev-mode check', () => {
    TestBed.configureTestingModule({});
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      provingGroundsDevOnlyGuard({} as any, {} as any)
    ) as UrlTree;

    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('redirects home when the dev-mode check reports false', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PROVING_GROUNDS_DEV_MODE_CHECK, useValue: () => false }]
    });
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      provingGroundsDevOnlyGuard({} as any, {} as any)
    ) as UrlTree;

    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('allows activation when the dev-mode check reports true', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PROVING_GROUNDS_DEV_MODE_CHECK, useValue: () => true }]
    });

    const result = TestBed.runInInjectionContext(() =>
      provingGroundsDevOnlyGuard({} as any, {} as any)
    );

    expect(result).toBeTrue();
  });
});
