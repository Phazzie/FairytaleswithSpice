import { buildContinuationResponse, buildGenesisResponse } from '../api/_lib/story-lab/mockData';
import type { StoryGenerationSeam } from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const blueprint: StoryGenerationSeam['input'] = {
  creature: 'vampire',
  themes: [
    {
      id: 'forbidden-love',
      label: 'Forbidden Love',
      description: 'A romance that risks court punishment.'
    }
  ],
  logline: 'Velvet envoys bargain with a dangerous mortal scholar.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 900,
  chapterBatchSize: 2
};

const genesis = buildGenesisResponse(blueprint);
assert(genesis.success, 'genesis response should succeed');
assert(genesis.data, 'genesis should include data');
assert(genesis.data.stateDelta, 'genesis should include a state delta');
assert(genesis.data.persistence?.mode === 'transient_memory', 'genesis should record transient persistence');
assert(genesis.data.state.characters.length >= 3, 'genesis should apply introduced character deltas');
assert(genesis.data.state.beats.length === 2, 'genesis should create one beat per generated chapter');
assert(genesis.data.stateDelta.addedChapterNumbers.join(',') === '1,2', 'genesis delta should list added chapters');
assert(genesis.data.batch.chapters.some(chapter => chapter.delta.introducedCharacters.length), 'chapter deltas should introduce characters');
assert(genesis.data.state.threads.every(thread => thread.lifetime === 'series'), 'genesis story threads should default to series lifetime');
assert(genesis.data.state.artifacts.some(artifact => artifact.name === 'Crimson Signet Ring' && artifact.lifetime === 'series'), 'base story artifacts should default to series lifetime');
assert(genesis.data.state.artifacts.some(artifact => artifact.name === 'Broken Oath Scroll' && artifact.lifetime === 'chapter'), 'chapter-foreshadowed artifacts should carry chapter lifetime');

const continuation = buildContinuationResponse({
  storyId: genesis.data.summary.storyId,
  chapterBatchSize: 2,
  storyState: genesis.data.state,
  previouslyGeneratedChapters: genesis.data.batch.chapters,
  continuationBrief: 'Force the oath scroll into the open.',
  existingSummary: genesis.data.summary
});

assert(continuation.success, 'continuation response should succeed');
assert(continuation.data, 'continuation should include data');
assert(continuation.data.state.revision === genesis.data.state.revision + 1, 'continuation should advance the state revision');
assert(continuation.data.stateDelta?.fromRevision === genesis.data.state.revision, 'continuation delta should remember the prior revision');
assert(continuation.data.stateDelta?.addedChapterNumbers.join(',') === '3,4', 'continuation delta should list appended chapters');
assert(continuation.data.appendedChapterNumbers.join(',') === '3,4', 'continuation should list appended chapter numbers');
assert(continuation.data.persistence?.persistedRevision === continuation.data.state.revision, 'continuation persistence should track the new revision');
assert(continuation.data.state.beats.length === 4, 'continuation should preserve old beats and add new beats');

const fallbackContinuation = buildContinuationResponse({
  storyId: genesis.data.summary.storyId,
  chapterBatchSize: 1,
  storyState: continuation.data.state,
  previouslyGeneratedChapters: [],
  continuationBrief: 'Use the transient snapshot to keep chapter order.',
  existingSummary: continuation.data.summary
});

assert(fallbackContinuation.success, 'fallback continuation response should succeed');
assert(fallbackContinuation.data, 'fallback continuation should include data');
assert(fallbackContinuation.data.appendedChapterNumbers.join(',') === '5', 'fallback should continue after transiently stored chapters');

console.log('Story-lab state delta tests passed');
