'use client'

export interface TraceStep { tool: string; input: string; result: string; at: string }
export interface Action { kind: string; label: string; reason: string }
export interface Exercise { id: string; conceptId: string; difficulty: string; prompt: string; hint: string; solution: string; expected?: string }
export interface Attempt { id: string; conceptId: string; answer: string; correct: boolean; feedback: string; at: string }
export interface ChatMessage { id: string; from: 'cognara' | 'student'; text: string; at: string }
export interface Concept { id: string; courseId: string; title: string; summary: string; analogy: string; commonMistake: string }
export interface StateData {
  student: { id: string; name: string; initials: string; tagline: string; mastery: Record<string, number>; attempts: Attempt[]; streakDays: number; minutesThisMonth: number }
  courses: { id: string; title: string; teacher: string; chapter: string }[]
  concepts: Concept[]
  focus: { concept: Concept; mastery: number; action: Action }
  chats: ChatMessage[]
  attempts: Attempt[]
  interventions: { id: string; conceptId: string; title: string; detail: string; affectedStudents: string[]; status: string }[]
  recommendations: { conceptId: string; title: string; avgMastery: number; affected: string[]; proposal: string }[]
  llm: { provider: string; live: boolean; needs: string[] }
  peers: { id: string; name: string; initials: string; mastery: Record<string, number> }[]
}

export async function apiState(userId: string): Promise<StateData> {
  const r = await fetch(`/api/state?userId=${userId}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('Could not reach your workspace. Check your connection and try again.')
  return r.json()
}

export function adminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const t = window.sessionStorage.getItem('cognara-admin-token')?.trim()
  return t ? { 'x-admin-token': t } : {}
}

export async function apiAgent(body: object) {
  const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminHeaders() }, body: JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? 'Cognara hit a snag. Try again.')
  return j
}

export function courseMastery(courseId: string, concepts: Concept[], mastery: Record<string, number>): number {
  const ids = concepts.filter((c) => c.courseId === courseId).map((c) => c.id)
  if (!ids.length) return 0
  return Math.round(ids.reduce((a, id) => a + (mastery[id] ?? 50), 0) / ids.length)
}

/** Quiet, human-readable rendering of the agent's work for "Why this?" disclosures. */
export function traceSentence(t: TraceStep): string {
  if (t.tool === 'diagnoseGap') return t.result
  if (t.tool === 'generateExercise') return `Prepared one exercise at your level. ${t.result}`
  if (t.tool === 'gradeAttempt') return `Marked your answer. ${t.result}`
  if (t.tool === 'updateMastery') return `Updated your standing. ${t.result}`
  if (t.tool === 'recommendIntervention') return t.result
  if (t.tool === 'publishIntervention') return t.result
  return t.result
}
