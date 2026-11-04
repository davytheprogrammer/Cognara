import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampMastery, difficultyFor, nextAction, recordAttempt } from '@/lib/mastery';

describe('mastery rules (offline)', () => {
  it('clamps to 0..100', () => {
    assert.equal(clampMastery(-5), 0);
    assert.equal(clampMastery(105), 100);
    assert.equal(clampMastery(38.4), 38);
  });

  it('never escapes bounds on attempts', () => {
    assert.equal(recordAttempt(99, true, 'foundations'), 100);
    assert.equal(recordAttempt(1, false, 'guided'), 0);
  });

  it('handles non-finite input without NaN', () => {
    assert.ok(Number.isFinite(recordAttempt(NaN, true, 'guided')));
    assert.ok(Number.isFinite(recordAttempt(Infinity, false, 'foundations')));
  });

  it('reteaches on low mastery or a wrong streak', () => {
    assert.equal(nextAction(38, 0).kind, 'reteach');
    assert.equal(nextAction(60, 2).kind, 'reteach');
    assert.equal(nextAction(60, 0).kind, 'practice');
    assert.equal(nextAction(80, 0).kind, 'apply');
    assert.equal(nextAction(90, 0).kind, 'advance');
  });

  it('maps reteach->foundations and apply->guided', () => {
    assert.equal(difficultyFor(20, 'reteach'), 'foundations');
    assert.equal(difficultyFor(60, 'practice'), 'guided');
    assert.equal(difficultyFor(80, 'apply'), 'guided');
    assert.equal(difficultyFor(95, 'advance'), 'challenge');
  });
});
