// Created: 2026-06-08 08:28 EDT

import { withUnhandledRouteFailureLogging } from '../_lib/http/withUnhandledRouteFailureLogging';
import { handleStoryLabAccountRoute } from '../_lib/story-lab/account/accountRouteHandlers';

export default withUnhandledRouteFailureLogging(handleStoryLabAccountRoute);
