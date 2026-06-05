import {
  createDenyByDefaultAuthPort,
  isAuthError
} from '../api/_lib/story-lab/auth/authPort';
import {
  authorizeProjectAccess,
  isProjectAuthorizationError
} from '../api/_lib/story-lab/auth/authorizeProjectAccess';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const auth = createDenyByDefaultAuthPort();

  const apiKeyOnlyRequest = {
    headers: {
      authorization: 'Bearer xai-not-a-user-token',
      'x-api-key': 'api-key-is-not-account-auth'
    }
  };

  const currentUser = await auth.getCurrentUser(apiKeyOnlyRequest);
  assert(currentUser === null, 'API keys and bearer provider keys must not create account users');

  try {
    await auth.requireUser(apiKeyOnlyRequest);
    throw new Error('requireUser should deny when no account auth provider is configured');
  } catch (error) {
    assert(isAuthError(error), 'requireUser denial should use AuthError');
    assert(error.code === 'UNAUTHORIZED', 'requireUser denial should be unauthorized');
  }

  const ownerDecision = authorizeProjectAccess(
    { userId: 'user-owner', email: 'owner@example.com' },
    { projectId: 'project-1', ownerUserId: 'user-owner' }
  );
  assert(ownerDecision.authorized === true, 'matching project owner should be authorized');

  try {
    authorizeProjectAccess(
      { userId: 'user-other', email: 'other@example.com' },
      { projectId: 'project-1', ownerUserId: 'user-owner' }
    );
    throw new Error('authorizeProjectAccess should deny non-owners');
  } catch (error) {
    assert(isProjectAuthorizationError(error), 'owner denial should use ProjectAuthorizationError');
    assert(error.code === 'FORBIDDEN', 'owner denial should be forbidden');
    assert(!error.message.includes('project-1'), 'owner denial should not leak project ids in user-facing messages');
  }

  console.log('Story Lab auth and authorization tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
