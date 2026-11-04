import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalHeuristicProvider } from '@/lib/llm/provider';

describe('local grade heuristics (offline)', () => {
  it('grades exact and equivalent math forms', async () => {
    const p = new LocalHeuristicProvider();
    assert.equal((await p.grade('q', '15', '15')).correct, true);
    assert.equal((await p.grade('q', '15', ' 15 km/h ')).correct, true);
    assert.equal((await p.grade('q', '3x^2', '3x²'.replace('²', '^2'))).correct, true);
    assert.equal((await p.grade('q', 'instantaneous', 'Instantaneous rate')).correct, true);
  });

  it('accepts factored chain-rule form and rejects the old wrong alternate', async () => {
    const p = new LocalHeuristicProvider();
    assert.equal((await p.grade('q', '18x+6', '6(3x+1)')).correct, true);
    assert.equal((await p.grade('q', '18x+6', '6x+2')).correct, false);
  });

  it('handles true/false leniently but rejects empty', async () => {
    const p = new LocalHeuristicProvider();
    assert.equal((await p.grade('q', 'true', 'True')).correct, true);
    assert.equal((await p.grade('q', 'true', 'yes')).correct, true);
    assert.equal((await p.grade('q', '15', '   ')).correct, false);
    assert.equal((await p.grade('q', '15', '___')).correct, false);
  });

  it('does not crash on 2000+ char input', async () => {
    const p = new LocalHeuristicProvider();
    const r = await p.grade('q', '15', 'x'.repeat(5000));
    assert.equal(typeof r.feedback, 'string');
  });
});
