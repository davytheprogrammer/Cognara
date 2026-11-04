import type { Concept, Course, Db, Exercise } from '@/lib/types';

export function seedDb(): Db {
  const courses: Course[] = [
    { id: 'calc1', title: 'Calculus I', teacher: 'Dr. Alan Reyes', chapter: 'Chapter 3 · Derivatives', totalChapters: 8, chapterIndex: 3 },
    { id: 'psych1', title: 'Introduction to Psychology', teacher: 'Dr. Nina Shah', chapter: 'Chapter 5 · Memory', totalChapters: 10, chapterIndex: 5 },
    { id: 'phys1', title: 'Physics: Motion & Energy', teacher: 'Prof. James Okafor', chapter: 'Chapter 2 · Kinematics', totalChapters: 9, chapterIndex: 2 },
  ];

  const concepts: Concept[] = [
    {
      id: 'rate-of-change',
      courseId: 'calc1',
      title: 'Rate of change',
      summary: 'Verified course material (Ch.3): the derivative of f at a point is the instantaneous rate of change — the slope of the tangent line, defined as the limit of average rates as the interval shrinks to zero.',
      analogy: 'Think of a cyclist: average speed over the whole trip hides the hills and sprints. The derivative is the speedometer reading at one exact instant.',
      commonMistake: 'Confusing average rate (over an interval) with instantaneous rate (at a point).',
    },
    {
      id: 'derivative-rules',
      courseId: 'calc1',
      title: 'Derivative rules',
      summary: 'Verified course material (Ch.3): power rule d/dx[x^n] = n·x^(n−1); constant multiples and sums differentiate term by term.',
      analogy: 'Rules are shortcuts for the limit definition — same answer, less algebra, once the idea clicks.',
      commonMistake: 'Applying the power rule to the exponent instead of multiplying by it (e.g. x³ → x² is missing the 3).',
    },
    {
      id: 'chain-rule',
      courseId: 'calc1',
      title: 'Chain rule',
      summary: 'Verified course material (Ch.3): d/dx[f(g(x))] = f′(g(x))·g′(x) — differentiate outside, then inside, and multiply.',
      analogy: 'Gears inside gears: the outer gear speed times the inner gear speed.',
      commonMistake: 'Forgetting to multiply by the derivative of the inner function.',
    },
    {
      id: 'memory-encoding',
      courseId: 'psych1',
      title: 'Memory encoding',
      summary: 'Verified course material (Ch.5): elaborative encoding — connecting new material to existing knowledge — produces far stronger recall than maintenance rehearsal.',
      analogy: 'Memory is a filing system: elaboration adds cross-references so you can find the file later.',
      commonMistake: 'Rereading notes and mistaking fluency for durable learning.',
    },
    {
      id: 'retrieval-practice',
      courseId: 'psych1',
      title: 'Retrieval practice',
      summary: 'Verified course material (Ch.5): actively recalling information (testing effect) strengthens long-term retention more than restudying.',
      analogy: 'Each recall is a rep at the gym for that memory trace.',
      commonMistake: 'Waiting until you "feel ready" before self-testing.',
    },
    {
      id: 'kinematics-graphs',
      courseId: 'phys1',
      title: 'Motion graphs',
      summary: 'Verified course material (Ch.2): on a position–time graph, slope is velocity; on a velocity–time graph, slope is acceleration and area is displacement.',
      analogy: 'Graphs are stories: steepness tells you how fast the story is changing.',
      commonMistake: 'Reading a position–time graph as if it were a velocity–time graph.',
    },
  ];

  const exercises: Exercise[] = [
    {
      id: 'roc-1', conceptId: 'rate-of-change', difficulty: 'foundations',
      prompt: 'A cyclist travels 5 km in 15 minutes, then the next 5 km in 25 minutes. What was the average speed over the full 10 km, in km/h? (Answer with just the number.)',
      expected: '15', hint: 'Total distance ÷ total time. Convert minutes to hours first.', solution: '10 km ÷ (40/60 h) = 15 km/h.',
    },
    {
      id: 'roc-2', conceptId: 'rate-of-change', difficulty: 'guided',
      prompt: 'At the exact moment the cyclist passes the 5 km mark, the speedometer reads 24 km/h. Is 24 km/h an average rate or an instantaneous rate? (Answer: average / instantaneous)',
      expected: 'instantaneous', hint: 'Ask: over what interval was it measured? A single instant means…', solution: 'Instantaneous — it describes one moment, so it is the derivative at that point.',
    },
    {
      id: 'roc-3', conceptId: 'rate-of-change', difficulty: 'challenge',
      prompt: 'Position s(t) = 2t² + 3t (metres, seconds). Find the instantaneous velocity at t = 4 s. (Answer with just the number.)',
      expected: '19', hint: 's′(t) = 4t + 3, then evaluate.', solution: 's′(t) = 4t + 3 → s′(4) = 19 m/s.',
    },
    {
      id: 'dr-1', conceptId: 'derivative-rules', difficulty: 'guided',
      prompt: 'Find d/dx [x³]. (Answer in the form 3x^2.)',
      expected: '3x^2', hint: 'Power rule: bring the exponent down front, subtract one.', solution: 'd/dx[x³] = 3x².',
    },
    {
      id: 'dr-2', conceptId: 'derivative-rules', difficulty: 'challenge',
      prompt: 'Find d/dx [4x³ − 2x + 7]. (Answer in the form 12x^2-2.)',
      expected: '12x^2-2', hint: 'Differentiate term by term; the constant vanishes.', solution: '12x² − 2.',
    },
    {
      id: 'cr-1', conceptId: 'chain-rule', difficulty: 'guided',
      prompt: 'If y = (3x + 1)², what is dy/dx? (Answer in the form 6(3x+1) or 18x+6.)',
      expected: '18x+6', hint: 'Outside 2(3x+1), times inside derivative 3.', solution: 'dy/dx = 2(3x+1)·3 = 18x + 6.',
    },
    {
      id: 'mem-1', conceptId: 'memory-encoding', difficulty: 'guided',
      prompt: 'Name one study technique that counts as elaborative encoding (e.g. self-explanation, interleaving, concept mapping).',
      expected: 'self-explanation', hint: 'Anything that connects new ideas to what you already know.', solution: 'Self-explanation, concept mapping, or interleaved examples all qualify.',
    },
    {
      id: 'ret-1', conceptId: 'retrieval-practice', difficulty: 'guided',
      prompt: 'True or false: self-testing beats rereading for long-term retention.',
      expected: 'true', hint: 'Think: testing effect.', solution: 'True — the testing effect is one of the most replicated findings in the field.',
    },
  ];

  return {
    courses,
    concepts,
    exercises,
    interventions: [],
    chats: {},
    students: [
      {
        id: 'maya', name: 'Maya Thompson', role: 'student', tagline: 'Student workspace',
        initials: 'MT', mastery: { 'rate-of-change': 38, 'derivative-rules': 55, 'chain-rule': 30, 'memory-encoding': 72, 'retrieval-practice': 64, 'kinematics-graphs': 45 },
        attempts: [], streakDays: 4, minutesThisMonth: 564,
      },
      {
        id: 'jonas', name: 'Jonas Park', role: 'student', tagline: 'Student workspace',
        initials: 'JP', mastery: { 'rate-of-change': 88, 'derivative-rules': 91, 'chain-rule': 78, 'memory-encoding': 70, 'retrieval-practice': 82, 'kinematics-graphs': 76 },
        attempts: [], streakDays: 9, minutesThisMonth: 812,
      },
    ],
  };
}
