// Created: 2026-06-07 07:05 EDT

import { withUnhandledRouteFailureLogging } from '../_lib/http/withUnhandledRouteFailureLogging';
import { handleStoryLabJobsRoute } from '../_lib/story-lab/jobs/jobRouteHandlers';

export default withUnhandledRouteFailureLogging(handleStoryLabJobsRoute);
