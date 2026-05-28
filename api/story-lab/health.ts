// Created: 2025-10-29 08:27 UTC

import type { ApiResponse } from '../_lib/story-lab/contracts';

type HealthPayload = { status: 'ok'; time: string };

export default function handler(_req: any, res: any) {
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');

  const payload: ApiResponse<HealthPayload> = {
    success: true,
    data: { status: 'ok', time: new Date().toISOString() }
  };
  res.status(200).json(payload);
}
