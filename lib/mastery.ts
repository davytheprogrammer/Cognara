import type { Difficulty } from '@/lib/types';

export type NextAction =
  | { kind: 'reteach'; label: 'Re-teach simply'; reason: string }
  | { kind: 'practice'; label: 'Guided practice'; reason: string }
  | { kind: 'apply'; label: 'Apply the idea'; reason: string }
  | { kind: 'advance'; label: 'Advance / challenge'; reason: string };

export function clampMastery(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Deterministic mastery update. Never classifies a learner globally — per concept only. */
export function recordAttempt(mastery: number, correct: boolean, difficulty: Difficulty): number {
  const base = Number.isFinite(mastery) ? clampMastery(mastery) : 50;
  if (correct) {
    const gain = difficulty === 'foundations' ? 10 : difficulty === 'guided' ? 8 : 6;
    // Diminishing returns near the top so challenge material still matters.
    const scaled = base >= 85 ? gain * 0.5 : gain;
    return clampMastery(base + scaled);
  }
  const loss = difficulty === 'foundations' ? 4 : difficulty === 'guided' ? 6 : 5;
  return clampMastery(base - loss);
}

export function nextAction(mastery: number, streakWrong: number): NextAction {
  if (mastery < 40 || streakWrong >= 2) {
    return {
      kind: 'reteach',
      label: 'Re-teach simply',
      reason: 'Recent attempts show the core idea is not landing — smaller steps and a concrete analogy first.',
    };
  }
  if (mastery < 70) {
    return {
      kind: 'practice',
      label: 'Guided practice',
      reason: 'Partial understanding — scaffolded exercises with hints will close the gap.',
    };
  }
  if (mastery < 85) {
    return {
      kind: 'apply',
      label: 'Apply the idea',
      reason: 'Solid footing — time to apply the idea to fresh problems.',
    };
  }
  return {
    kind: 'advance',
    label: 'Advance / challenge',
    reason: 'Strong mastery — push toward harder material and independent problem-solving.',
  };
}

export function difficultyFor(mastery: number, action: NextAction['kind']): Difficulty {
  if (action === 'reteach') return 'foundations';
  if (action === 'practice') return 'guided';
  if (action === 'apply') return 'guided';
  return 'challenge';
}
