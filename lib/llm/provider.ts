import type { Difficulty } from '@/lib/types';

/** Clean integration boundary for a Meta AI model (e.g. Llama).
 *  LocalHeuristicProvider works offline with zero credentials.
 *  MetaLlamaProvider activates when LLAMA_API_URL + LLAMA_API_KEY are set.
 *  Nothing in the agent imports fetch directly — everything goes through here. */

export interface TeachInput {
  conceptTitle: string;
  verifiedSummary: string;
  analogy: string;
  mastery: number;
  studentName: string;
  lastWrong?: boolean;
}

export interface LlmProvider {
  name: string;
  teach(input: TeachInput): Promise<string>;
  grade(prompt: string, expected: string, answer: string): Promise<{ correct: boolean; feedback: string }>;
}

export class LocalHeuristicProvider implements LlmProvider {
  name = 'local-heuristic (offline, no credentials)';

  async teach(input: TeachInput): Promise<string> {
    const { conceptTitle, verifiedSummary, analogy, mastery, studentName, lastWrong } = input;
    const first = studentName.split(' ')[0] ?? studentName;
    if (mastery < 40 || lastWrong) {
      return (
        `${first}, let's slow this down — no new formulas yet.\n\n${verifiedSummary}\n\n` +
        `Here's the picture to hold onto: ${analogy}\n\n` +
        `Tell me in your own words: what is ${conceptTitle} actually measuring? ` +
        `There is no wrong answer here — I will build from whatever you say.`
      );
    }
    if (mastery < 70) {
      return (
        `Nice — you're close on ${conceptTitle}, ${first}.\n\n${verifiedSummary}\n\n` +
          `Quick check to lock it in: ${analogy} ` +
          `Now, what would change in that picture if things sped up twice as fast?`
      );
    }
    if (mastery < 85) {
      return (
        `${first}, you've got the core of ${conceptTitle}. Time to stretch it.\n\n${verifiedSummary}\n\n` +
          `Challenge: where would this idea break down, or where does it not apply? ` +
          `Explaining the edge cases is what turns good into mastery.`
      );
    }
    return (
      `${first}, strong work on ${conceptTitle} — let's go deeper.\n\n${verifiedSummary}\n\n` +
        `Independent challenge: derive or justify the result from first principles, ` +
        `then teach it back to me as if I am seeing it for the first time.`
    );
  }

  async grade(prompt: string, expected: string, answer: string) {
    void prompt;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .slice(0, 2000)
        .replace(/[\s_^*()]+/g, '')
        .replace(/[−–—]/g, '-');
    const a = norm(answer);
    const e = norm(expected);
    if (!a) return { correct: false, feedback: 'No answer given — take a guess and I will work from there.' };
    const stripped = (s: string) => s.replace(/[^a-z0-9.+-]/g, '');
    const sa = stripped(a);
    const se = stripped(e);
    if (!sa) return { correct: false, feedback: 'No answer given — take a guess and I will work from there.' };
    // Accept common alternates for known items; keys are already normalized.
    const alternates: Record<string, string[]> = {
      instantaneous: ['instantaneousrate', 'instantaneous'],
      '18x+6': ['18x+6', '6(3x+1)'],
      '3x^2': ['3x^2', '3x2'],
      '12x^2-2': ['12x^2-2', '12x2-2'],
      true: ['true', 't', 'yes'],
      false: ['false', 'f', 'no'],
    };
    const accepted = (alternates[se] ?? [se]).map(stripped);
    // Numeric answers with units ("15 km/h" for expected "15") are correct.
    const numericSe = se.match(/^-?\d+(\.\d+)?$/);
    const numericSa = sa.match(/^-?\d+(\.\d+)?/);
    const numericMatch = Boolean(
      numericSe && numericSa && Number(numericSa[0]) === Number(numericSe[0]),
    );
    const correct =
      accepted.some((alt) => sa === alt) ||
      numericMatch ||
      (se.length > 3 && sa.includes(se));
    // Concept answers (e.g. elaborative encoding synonyms)
    const conceptHits = ['self-explanation', 'selfexplanation', 'conceptmapping', 'interleaving', 'elaboration'];
    if (!correct && e.includes('self') && conceptHits.some((h) => stripped(a).includes(h.replace(/-/g, '')))) {
      return { correct: true, feedback: 'Exactly — that is a valid form of elaborative encoding. Good connection.' };
    }
    if (correct) {
      return { correct: true, feedback: 'Correct. Your reasoning is lining up with the underlying idea, not just the steps.' };
    }
    return {
      correct: false,
      feedback: `Not quite — the expected answer is "${expected}". The key trap here is covered in your course material; re-read the hint and try a sibling problem. Your progress is saved, not lost.`,
    };
  }
}

export class MetaLlamaProvider implements LlmProvider {
  name = 'meta-llama (live)';
  private url: string;
  private key: string;
  private model: string;

  constructor() {
    this.url = process.env.LLAMA_API_URL ?? '';
    this.key = process.env.LLAMA_API_KEY ?? '';
    this.model = process.env.LLAMA_MODEL ?? 'Llama-4-Maverick-17B-128E-Instruct';
  }

  get configured() {
    return Boolean(this.url && this.key);
  }

  private async chat(system: string, user: string): Promise<string> {
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 10_000);
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 10_000;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.4, max_tokens: 500 }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() ?? '';
    } finally {
      clearTimeout(t);
    }
  }

  async teach(input: TeachInput): Promise<string> {
    const local = new LocalHeuristicProvider();
    if (!this.configured) return local.teach(input);
    try {
      const out = await this.chat(
        'You are Cognara, an adaptive teacher. Adapt difficulty to the stated mastery (0-100). Ground claims in the verified summary; label the rest as your explanation.',
        `Teach ${input.conceptTitle} to ${input.studentName} (mastery ${input.mastery}). Verified: ${input.verifiedSummary} Analogy you may use: ${input.analogy}. Last attempt wrong: ${input.lastWrong}. Reply in ≤150 words, end with one question.`,
      );
      return out || local.teach(input);
    } catch {
      return local.teach(input);
    }
  }

  async grade(prompt: string, expected: string, answer: string) {
    const local = new LocalHeuristicProvider();
    if (!this.configured) return local.grade(prompt, expected, answer);
    try {
      const out = await this.chat(
        'You grade student answers leniently but honestly. Reply with exactly: CORRECT: <feedback> or INCORRECT: <feedback>.',
        `Question: ${prompt}\nExpected: ${expected}\nStudent: ${answer}`,
      );
      if (/^correct/i.test(out)) return { correct: true, feedback: out.replace(/^correct:?\s*/i, '') };
      if (/^incorrect/i.test(out)) return { correct: false, feedback: out.replace(/^incorrect:?\s*/i, '') };
      return local.grade(prompt, expected, answer);
    } catch {
      return local.grade(prompt, expected, answer);
    }
  }
}

export function activeProvider(): LlmProvider {
  const p = new MetaLlamaProvider();
  if (p.configured) return p;
  return new LocalHeuristicProvider();
}

export function llmStatus(): { provider: string; live: boolean; needs: string[] } {
  const needs: string[] = [];
  if (!process.env.LLAMA_API_URL) needs.push('LLAMA_API_URL');
  if (!process.env.LLAMA_API_KEY) needs.push('LLAMA_API_KEY');
  const live = needs.length === 0;
  return { provider: live ? 'meta-llama (live)' : 'local-heuristic (offline, no credentials)', live, needs };
}
