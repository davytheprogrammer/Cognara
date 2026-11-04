'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Lightbulb, Send } from 'lucide-react'
import { apiAgent, apiState, courseMastery, traceSentence, type Exercise, type StateData, type TraceStep } from '@/lib/client'

function useWorkspace() {
  const [data, setData] = useState<StateData | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setData(await apiState('maya')); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return { data, error, refresh }
}

export default function Learn() {
  const { data, error, refresh } = useWorkspace()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [answer, setAnswer] = useState('')
  const [grade, setGrade] = useState<{ correct: boolean; feedback: string; before: number; after: number; followUp: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const [extraChat, setExtraChat] = useState<{ from: 'cognara' | 'student'; text: string; id: string }[]>([])
  const [showHint, setShowHint] = useState(false)
  const [why, setWhy] = useState<TraceStep[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setExercise(null); setGrade(null); setExtraChat([]); setWhy([]) }, [])

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setFormError('')
    try { await fn(); await refresh() } catch (e) { setFormError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }, [refresh])

  if (error) return <main className="flex min-h-screen items-center justify-center bg-paper p-6 text-ink"><div className="max-w-sm text-center"><p className="font-display text-3xl">The classroom door is stuck.</p><p className="mt-3 text-sm text-ink-soft">{error}</p><button onClick={refresh} className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper">Try again</button></div></main>
  if (!data) return <main className="flex min-h-screen items-center justify-center bg-paper text-ink"><p className="text-sm text-ink-soft">Preparing your session…</p></main>

  const c = data.focus.concept
  const first = data.student.name.split(' ')[0]
  const course = data.courses.find((k) => k.id === c.courseId)

  const startExercise = () => run(async () => {
    const j = await apiAgent({ op: 'exercise', userId: 'maya', conceptId: c.id })
    setExercise(j.exercise); setGrade(null); setAnswer(''); setShowHint(false)
    setWhy(j.trace)
  })

  const submit = () => run(async () => {
    if (!exercise) return
    if (!answer.trim()) { setFormError('Write something first — even a guess. Cognara builds from it.'); return }
    const j = await apiAgent({ op: 'grade', userId: 'maya', exerciseId: exercise.id, answer })
    setGrade(j); setWhy(j.trace)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })

  const send = () => run(async () => {
    if (!message.trim()) return
    const text = message.trim(); setMessage('')
    const j = await apiAgent({ op: 'chat', userId: 'maya', conceptId: c.id, text })
    setExtraChat((prev) => [...prev, { from: 'student', text, id: `s-${Date.now()}` }, { from: 'cognara', text: j.reply, id: `c-${Date.now()}` }])
    setWhy(j.trace)
  })

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /><span className="font-display text-lg text-ink">cognara</span></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
            <a href="#session" className="hover:text-ink">Session</a>
            <a href="#courses" className="hover:text-ink">Courses</a>
            <a href="#progress" className="hover:text-ink">Progress</a>
          </nav>
          <p className="text-sm"><span className="font-semibold">{first}</span> <span className="text-ink-faint">· {data.student.streakDays}-day streak</span></p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <section className="border-b border-ink/10 py-14">
          <p className="text-sm font-medium text-pine">{course ? `${course.title} · ${course.chapter}` : 'Your focus today'}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display max-w-xl text-5xl tracking-tight sm:text-6xl">{c.title}</h1>
            <div className="text-right">
              <p className="font-display text-5xl">{data.focus.mastery}<span className="text-2xl text-ink-faint">%</span></p>
              <p className="mt-1 text-xs text-ink-faint">understanding · live</p>
            </div>
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-pine transition-all duration-700" style={{ width: `${data.focus.mastery}%` }} /></div>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">{data.focus.action.reason}</p>
        </section>

        <section id="session" className="grid gap-10 py-14 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="font-display text-3xl tracking-tight">The session</h2>
            <div className="mt-6 space-y-8">
              <div className="rounded-3xl bg-white p-7 ring-1 ring-ink/10 sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Where you stand</p>
                <p className="mt-3 text-lg leading-8">
                  You can handle procedure, {first.toLowerCase()} — but the <em className="font-display">{c.title.toLowerCase()}</em> idea underneath isn&apos;t settled yet.
                </p>
                <div className="mt-5 rounded-2xl bg-paper p-5 text-[15px] leading-7 text-ink-soft">
                  <p className="text-xs font-semibold text-pine">From your course material</p>
                  <p className="mt-1">{c.summary}</p>
                </div>
                <p className="mt-4 text-sm text-ink-faint">Worth remembering: {c.commonMistake}</p>
              </div>

              <div className="rounded-3xl bg-ink p-7 text-paper sm:p-9">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-paper/50">Practice, set at your level</p>
                  {exercise && <p className="text-xs text-paper/50">{exercise.difficulty}</p>}
                </div>
                {!exercise ? (
                  <div>
                    <p className="font-display mt-3 text-3xl tracking-tight">Ready when you are.</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-paper/60">One question, chosen for exactly where you are. Wrong answers teach us more than right ones.</p>
                    <button onClick={startExercise} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
                      {busy ? 'Preparing…' : 'Give me my question'} <ArrowRight className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="mt-3 text-lg leading-8">{exercise.prompt}</p>
                    <div className="mt-5 flex gap-2">
                      <input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                        placeholder="Your answer…" aria-label="Your answer"
                        className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-paper outline-none placeholder:text-paper/40 focus:border-paper/50" />
                      <button onClick={submit} disabled={busy} className="shrink-0 rounded-full bg-paper px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50">{busy ? 'Marking…' : 'Submit'}</button>
                    </div>
                    <button onClick={() => setShowHint((s) => !s)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-paper/60 hover:text-paper"><Lightbulb className="size-3.5" />{showHint ? exercise.hint : 'Stuck? Reveal a hint'}</button>
                    {grade && (
                      <div ref={bottomRef} className="mt-5 rounded-2xl bg-white/10 p-5">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {grade.correct ? <><Check className="size-4 text-mint" /> Correct — {grade.before}% to {grade.after}%</> : <>Not quite — {grade.before}% to {grade.after}%. Nothing lost.</>}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-paper/70">{grade.feedback}</p>
                        <p className="mt-3 whitespace-pre-line border-t border-white/10 pt-3 text-sm leading-6 text-paper/80">{grade.followUp}</p>
                        <button onClick={startExercise} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-xs font-semibold text-ink disabled:opacity-50">Next question <ArrowRight className="size-3.5" /></button>
                      </div>
                    )}
                  </div>
                )}
                {formError && <p role="alert" className="mt-4 text-sm text-gilt">{formError}</p>}
              </div>

              <div>
                <p className="text-sm font-medium text-ink-soft">Talk it through — {first.toLowerCase()}, what&apos;s actually confusing?</p>
                <div className="mt-3 space-y-3">
                  {[...data.chats.slice(-6).map((m) => ({ from: m.from, text: m.text, id: m.id })), ...extraChat.filter((m) => !data.chats.some((c) => c.id === m.id))].map((m) => (
                    <div key={m.id} className={m.from === 'student' ? 'flex justify-end' : ''}>
                      <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-5 py-3.5 text-[15px] leading-7 ${m.from === 'student' ? 'rounded-br-md bg-ink text-paper' : 'bg-white ring-1 ring-ink/10'}`}>{m.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                    placeholder="Ask about anything in this topic…" aria-label="Ask Cognara"
                    className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-sm outline-none ring-1 ring-ink/15 placeholder:text-ink-faint focus:ring-2 focus:ring-pine" />
                  <button onClick={send} disabled={busy || !message.trim()} aria-label="Send message" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pine text-white disabled:opacity-40"><Send className="size-4" /></button>
                </div>
                {why.length > 0 && (
                  <details className="mt-4 text-xs text-ink-faint">
                    <summary className="cursor-pointer font-medium hover:text-ink-soft">Why this? How Cognara decided</summary>
                    <ul className="mt-2 space-y-1.5 leading-5">{why.map((t, i) => <li key={`${t.at}-${i}`}>· {traceSentence(t)}</li>)}</ul>
                  </details>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-6 lg:pt-14">
            <div className="rounded-3xl bg-moss p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-pine">Next best step</p>
              <p className="font-display mt-2 text-2xl">{data.focus.action.label}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{data.focus.action.reason}</p>
            </div>
            <div className="rounded-3xl bg-white p-6 ring-1 ring-ink/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Analogy to hold onto</p>
              <p className="mt-2 text-sm italic leading-6 text-ink-soft">{c.analogy}</p>
            </div>
          </aside>
        </section>

        <section id="courses" className="border-t border-ink/10 py-14">
          <h2 className="font-display text-3xl tracking-tight">Your courses</h2>
          <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {data.courses.map((course) => {
              const p = courseMastery(course.id, data.concepts, data.student.mastery)
              return (
                <div key={course.id} className="flex items-center gap-5 py-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl">{course.title}</p>
                    <p className="mt-0.5 text-sm text-ink-faint">{course.teacher} · {course.chapter}</p>
                  </div>
                  <div className="hidden w-48 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className={`h-full rounded-full transition-all ${p < 50 ? 'bg-ember' : 'bg-pine'}`} style={{ width: `${p}%` }} /></div>
                  </div>
                  <p className="w-12 text-right text-sm font-semibold">{p}%</p>
                </div>
              )
            })}
          </div>
        </section>

        <section id="progress" className="border-t border-ink/10 py-14">
          <h2 className="font-display text-3xl tracking-tight">How understanding is moving</h2>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              {data.concepts.map((concept) => {
                const m = data.student.mastery[concept.id] ?? 50
                return (
                  <div key={concept.id} className="mb-4">
                    <div className="flex items-baseline justify-between text-sm"><p className="font-medium">{concept.title}</p><p className={m < 50 ? 'font-semibold text-ember' : 'text-ink-faint'}>{m}%</p></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className={`h-full rounded-full transition-all ${m < 50 ? 'bg-ember' : 'bg-pine'}`} style={{ width: `${m}%` }} /></div>
                  </div>
                )
              })}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Latest marked work</p>
              <div className="mt-3 space-y-2.5">
                {data.attempts.length === 0 && <p className="text-sm text-ink-faint">Nothing marked yet — your first question is waiting above.</p>}
                {data.attempts.slice(0, 5).map((a) => (
                  <div key={a.id} className="rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/10">
                    <p className={`text-xs font-semibold ${a.correct ? 'text-pine' : 'text-ember'}`}>{a.correct ? 'Understood' : 'Still forming'}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{a.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 py-6 text-xs text-ink-faint">
          <p>Explanations marked “from your course material” are verified quotes. The rest is Cognara teaching.</p>
          <Link href="/teach" className="hover:text-ink">Educators enter here</Link>
        </footer>
      </div>
    </main>
  )
}
