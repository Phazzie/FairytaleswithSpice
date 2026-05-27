#!/usr/bin/env tsx

import { CliffhangerService } from '../api/_lib/services/cliffhangerService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new CliffhangerService();

const danger = service.analyze(`
<p>[Narrator]: The corridor went silent.</p>
<p>[Narrator]: Footsteps stopped outside the door, and her blood froze.</p>
`);

assert(danger.cliffhangerDetected, 'danger cliffhanger should be detected');
assert(danger.cliffhangerType === 'danger', 'danger pattern should classify as danger');
assert(danger.cliffhangerStrength > 0, 'danger cliffhanger should have strength');
assert(danger.suggestedContinuations.length > 0, 'danger cliffhanger should include suggestions');

const repeated = service.analyze('A secret waited behind the locked mirror?', ['mystery']);

assert(repeated.cliffhangerDetected, 'question ending should be a cliffhanger');
assert(repeated.cliffhangerType === 'mystery', 'secret/question should classify as mystery');
assert(repeated.varietyScore === 3, 'repeated cliffhanger type should reduce variety score');

console.log('Cliffhanger service tests passed');
