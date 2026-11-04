export type Difficulty = 'foundations' | 'guided' | 'challenge';

export interface Concept {
  id: string;
  courseId: string;
  title: string;
  summary: string; // verified course material (quoted as verified)
  analogy: string; // generated-style scaffold explanation
  commonMistake: string;
}

export interface Course {
  id: string;
  title: string;
  teacher: string;
  chapter: string;
  totalChapters: number;
  chapterIndex: number;
}

export interface Attempt {
  id: string;
  conceptId: string;
  exerciseId: string;
  answer: string;
  correct: boolean;
  feedback: string;
  at: string;
}

export interface Student {
  id: string;
  name: string;
  role: 'student' | 'educator';
  tagline: string;
  initials: string;
  mastery: Record<string, number>; // conceptId -> 0..100
  attempts: Attempt[];
  streakDays: number;
  minutesThisMonth: number;
}

export interface Exercise {
  id: string;
  conceptId: string;
  difficulty: Difficulty;
  prompt: string;
  expected: string; // canonical answer for grading
  hint: string;
  solution: string;
}

export interface Intervention {
  id: string;
  conceptId: string;
  title: string;
  detail: string;
  affectedStudents: string[];
  status: 'proposed' | 'published';
  createdAt: string;
}

export interface TraceStep {
  tool: string;
  input: string;
  result: string;
  at: string;
}

export interface ChatMessage {
  id: string;
  from: 'cognara' | 'student';
  text: string;
  at: string;
}

export interface Db {
  students: Student[];
  courses: Course[];
  concepts: Concept[];
  exercises: Exercise[];
  interventions: Intervention[];
  chats: Record<string, ChatMessage[]>; // studentId -> messages
}
