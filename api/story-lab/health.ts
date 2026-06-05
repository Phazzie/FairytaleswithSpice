// Created: 2025-10-29 08:27 UTC

import type { ApiResponse } from '../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';

type HealthPayload = { status: 'ok'; time: string };

export default function handler(_req: any, res: any) {
  const cors = applyCorsPolicy(_req, res, {
    methods: ['GET', 'OPTIONS']
  });
  if (cors.handled) {
    return;
  }

  const payload: ApiResponse<HealthPayload> = {
    success: true,
    data: { status: 'ok', time: new Date().toISOString() }
  };
  res.status(200).json(payload);
}
