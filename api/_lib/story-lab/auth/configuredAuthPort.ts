// Created: 2026-06-08 07:25 EDT

import type { AuthPort } from './authPort';
import { createDenyByDefaultAuthPort } from './authPort';

export interface ConfiguredAuthPortOptions {
  provider?: AuthPort | null;
}

export function createConfiguredAuthPort(options: ConfiguredAuthPortOptions = {}): AuthPort {
  if (!options.provider) {
    return createDenyByDefaultAuthPort();
  }

  return {
    getCurrentUser(req) {
      return options.provider!.getCurrentUser(req);
    },
    requireUser(req) {
      return options.provider!.requireUser(req);
    }
  };
}

export const configuredAuthPort = createConfiguredAuthPort();
