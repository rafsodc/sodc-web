import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeStartupSamples } from '../../../scripts/performance/startup-statistics.mjs';

const sample = (variant, pair, durationMs, options = {}) => ({ variant, pair, profile: 'slow', journey: 'public',
  status: 'passed', steps: [{ name: 'first-sign-in', durationMs }], ...options });
const summarize = samples => summarizeStartupSamples(samples, ['slow'], ['public']);

test('joins pair IDs despite alternating insertion order', () => {
  const [result] = summarize([sample('baseline', 1, 100), sample('candidate', 1, 110),
    sample('candidate', 2, 220), sample('baseline', 2, 200), sample('baseline', 3, 300), sample('candidate', 3, 330)]);
  assert.deepEqual(result.pairedPairIds, [1, 2, 3]);
  assert.deepEqual(result.pairedDifferencesMs, [10, 20, 30]);
  assert.equal(result.pairedDifferenceMedianMs, 20);
});

test('keep-going failures on opposite sides cannot pair unrelated runs', () => {
  const [result] = summarize([sample('baseline', 1, 100), sample('candidate', 1, 0, { status: 'failed' }),
    sample('candidate', 2, 220), sample('baseline', 2, 200), sample('baseline', 3, 0, { status: 'failed' }), sample('candidate', 3, 330)]);
  assert.deepEqual(result.pairedPairIds, [2]);
  assert.deepEqual(result.pairedDifferencesMs, [20]);
  assert.equal(result.pairedDifferenceMedianMs, 20);
  assert.deepEqual(result.unmatchedPairs, { baseline: [1], candidate: [3] });
  assert.equal(result.baselineSamples, 2);
  assert.equal(result.candidateSamples, 2);
});

test('reports null paired median when no successful pair remains', () => {
  const [result] = summarize([sample('baseline', 1, 100), sample('candidate', 2, 200)]);
  assert.equal(result.pairedDifferenceMedianMs, null);
  assert.equal(result.pairedSamples, 0);
  assert.deepEqual(result.pairedDifferencesMs, []);
});

test('all-failed and unrelated cohorts do not produce timing rows', () => {
  assert.deepEqual(summarize([sample('baseline', 1, 100, { status: 'failed' }),
    sample('candidate', 1, 110, { journey: 'guest' })]), []);
});

test('rejects duplicate pair IDs and invalid successful durations', () => {
  assert.throws(() => summarize([sample('baseline', 1, 1), sample('baseline', 1, 2)]), /duplicate-measurement-pair/);
  assert.throws(() => summarize([sample('baseline', 1, NaN)]), /invalid-passed-measurement-step/);
});
