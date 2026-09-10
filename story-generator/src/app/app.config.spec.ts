import { InjectionToken, isDevMode } from '@angular/core';
import { appConfig } from './app.config';
import { PROVING_GROUNDS_DEV_MODE_CHECK } from './proving-grounds/proving-grounds-access.guard';

describe('appConfig', () => {
  // `PROVING_GROUNDS_DEV_MODE_CHECK` defaults to a hardcoded `false` (fail
  // closed) everywhere it isn't explicitly provided — this is the one place
  // that must wire in the real `isDevMode` check, or Proving Grounds and the
  // debug panel become unreachable in every environment, dev included.
  it('wires the real isDevMode check into PROVING_GROUNDS_DEV_MODE_CHECK', () => {
    const entry = appConfig.providers.find((provider): provider is { provide: InjectionToken<unknown>; useValue: unknown } =>
      typeof provider === 'object' && provider !== null && 'provide' in provider &&
      provider.provide === PROVING_GROUNDS_DEV_MODE_CHECK
    );

    expect(entry).withContext('PROVING_GROUNDS_DEV_MODE_CHECK must be provided in appConfig').toBeTruthy();
    expect(entry?.useValue).toBe(isDevMode);
  });
});
