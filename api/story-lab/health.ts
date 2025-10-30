// Created: 2025-10-29 08:27 UTC

import type { NextApiRequest, NextApiResponse } from 'next';

import type { ApiEnvelope } from './contracts';

type HealthPayload = { status: 'ok'; time: string };

export default function handler(_req: NextApiRequest, res: NextApiResponse<ApiEnvelope<HealthPayload>>) {
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');

  res.status(200).json({
    success: true,
    data: { status: 'ok', time: new Date().toISOString() }
  });
}
