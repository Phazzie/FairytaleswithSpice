import type { ApiResponse } from './_lib/types/contracts';
import { applyCorsPolicy } from './_lib/http/corsPolicy';
import { sendMethodNotAllowed } from './_lib/http/methodNotAllowed';
import { createRateLimitStoreConfig } from './_lib/middleware/rateLimitStoreConfig';
import { createStoryLabJobStoreConfig } from './_lib/story-lab/jobs/storyLabJobStoreConfig';
import { createCriticalAlertSinkConfig } from './_lib/utils/criticalAlertSink';
import { withUnhandledRouteFailureLogging } from './_lib/http/withUnhandledRouteFailureLogging';
import { logError } from './_lib/utils/logger';

/** What this route serves, for CORS and for `Allow` alike. */
const HEALTH_ROUTE_METHODS = ['GET', 'OPTIONS'];

/** Reported for a durable-store dependency without making a live network call. */
type DurableStoreHealth = {
  mode: string;
  configured: boolean;
};

type HealthPayload = {
  status: 'healthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    grok: 'configured' | 'mock';
    rateLimitStore: DurableStoreHealth;
    storyLabJobStore: DurableStoreHealth;
    criticalAlerting: DurableStoreHealth;
  };
  cors: {
    allowedOrigin: string | null;
  };
};

/**
 * A dependency is degraded only for a genuine misconfiguration: an unsupported
 * mode value (a typo'd env var), a `postgres` mode this deployment can't
 * actually reach, or a `webhook` critical-alert destination that isn't a
 * usable URL. Falling back to an in-memory/non-durable/console-only default is
 * this app's intentional behavior, not a failure — mirrors `grok: 'mock'`
 * already being a non-error state below.
 */
function isServiceDependencyDegraded(service: DurableStoreHealth): boolean {
  return (
    service.mode === 'unsupported'
    || (service.mode === 'postgres' && !service.configured)
    || (service.mode === 'webhook' && !service.configured)
  );
}

async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: HEALTH_ROUTE_METHODS
  });
  if (cors.handled) {
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, HEALTH_ROUTE_METHODS, 'Method not allowed');
  }

  try {
    const rateLimitStoreConfig = createRateLimitStoreConfig();
    const storyLabJobStoreConfig = createStoryLabJobStoreConfig();
    const rateLimitStore: DurableStoreHealth = {
      mode: rateLimitStoreConfig.mode,
      configured: rateLimitStoreConfig.isConfigured()
    };
    const storyLabJobStore: DurableStoreHealth = {
      mode: storyLabJobStoreConfig.mode,
      configured: storyLabJobStoreConfig.isConfigured()
    };
    const criticalAlertSinkConfig = createCriticalAlertSinkConfig();
    const criticalAlerting: DurableStoreHealth = {
      mode: criticalAlertSinkConfig.mode,
      configured: criticalAlertSinkConfig.configured
    };
    const degraded =
      isServiceDependencyDegraded(rateLimitStore)
      || isServiceDependencyDegraded(storyLabJobStore)
      || isServiceDependencyDegraded(criticalAlerting);

    const health: HealthPayload = {
      status: degraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock',
        rateLimitStore,
        storyLabJobStore,
        criticalAlerting
      },
      cors: {
        // Report what the CORS policy actually resolved for this request rather
        // than re-deriving it from FRONTEND_URL alone: the policy also reads
        // STORY_LAB_ALLOWED_ORIGINS and ALLOWED_ORIGINS, so a deployment
        // configured through either of those was told the wrong origin here.
        allowedOrigin: cors.allowedOrigin
      }
    };

    // Degraded still answers on the body, but a plain status-code uptime
    // monitor only ever sees 2xx from this route unless the code itself
    // differs — 503 is what actually gets a real misconfiguration paged.
    res.status(degraded ? 503 : 200).json({
      success: true,
      data: health
    } satisfies ApiResponse<HealthPayload>);
  } catch (error) {
    logError('Health check failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: { timestamp: new Date().toISOString() }
      }
    } satisfies ApiResponse<HealthPayload>);
  }
}

export default withUnhandledRouteFailureLogging(handler);
