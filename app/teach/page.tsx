'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { apiAgent, apiState, type StateData } from '@/lib/client'

export default function Teach() {
  const [data, setData] = useState<StateData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [adminToken, setAdminToken] = useState('')

  const refresh = useCallback(async () => {
    try { setData(await apiState('maya')); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
  }, [])
  useEffect(() => {
    setAdminToken(window.sessionStorage.getItem('cognara-admin-token') ?? '')
    refresh()
  }, [refresh])

  const publish = async (conceptId: string, title: string) => {
    setBusy(conceptId); setNote('')
    try {
      await apiAgent({ op: 'publish', conceptId, approved: true, userId: 'maya' })
      setNote(`“${title}” is now with the affected students.`)
      await refresh()
    } catch (e) { setNote(e instanceof Error ? e.message : 'Publish failed.') }
    finally { setBusy('') }
  }

  if (error) return <main className="flex min-h-screen items-center justify-center bg-console p-6 text-console-ink"><div className="max-w-sm text-center"><p className="font-display text-3xl">Console unreachable.</p><p className="mt-3 text-sm text-console-dim">{error}</p><button onClick={refresh} className="mt-6 rounded-full bg-console-ink px-6 py-3 text-sm font-semibold text-console">Retry</button></div></main>
  if (!data) return <main className="flex min-h-screen items-center justify-center bg-console text-console-ink"><p className="text-sm text-console-dim">Reading the classroom…</p></main>

  const flagged = data.recommendations
  const totalBelow = data.peers.filter((p) => Object.values(p.mastery).some((m) => m < 50)).length

  return (
    <main className="min-h-screen bg-console text-console-ink">
      <header className="border-b border-console-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm text-console-dim hover:text-console-ink"><ArrowLeft className="size-4" /><span className="font-display text-lg text-console-ink">cognara studio</span></Link>
          <p className="text-sm text-console-dim">Teaching console · {data.courses.length} courses · {data.peers.length} students</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <p className="text-sm font-medium text-gilt">{flagged.length === 0 ? 'All quiet' : `${flagged.length} concept${flagged.length > 1 ? 's need' : ' needs'} you`}</p>
        <h1 className="font-display mt-2 max-w-2xl text-5xl tracking-tight sm:text-6xl">
          {flagged.length === 0 ? 'The class is holding steady.' : 'Here is where the class is stuck.'}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-console-dim">
          Cognara watches every marked answer and drafts the response. Nothing reaches a student
          without your approval — the console is oversight, not autopilot.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-console-dim">Needs a decision</h2>
            <div className="mt-4 space-y-4">
              {flagged.length === 0 && (
                <div className="rounded-3xl bg-console-raise p-8 ring-1 ring-console-line">
                  <p className="font-display text-2xl">Nothing to approve.</p>
                  <p className="mt-2 text-sm leading-6 text-console-dim">No concept currently has a student below the bar. New struggles will appear here with a drafted session attached.</p>
                </div>
              )}
              {flagged.map((r) => {
                const sent = data.interventions.some((i) => i.conceptId === r.conceptId)
                return (
                <article key={r.conceptId} className="rounded-3xl bg-console-raise p-7 ring-1 ring-console-line sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-display text-3xl">{r.title}</h3>
                    <p className="text-sm text-console-dim">class average <span className="font-semibold text-gilt">{r.avgMastery}%</span></p>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-console-dim">{r.proposal}</p>
                  <p className="mt-3 text-xs text-console-dim">Affects {r.affected.join(' · ')}</p>
                  {sent ? (
                    <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-mint"><CheckCircle2 className="size-4" /> Sent — live with students</p>
                  ) : (
                  <button onClick={() => publish(r.conceptId, r.title)} disabled={busy === r.conceptId}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-gilt px-5 py-2.5 text-sm font-semibold text-console transition-opacity hover:opacity-90 disabled:opacity-50">
                    {busy === r.conceptId ? 'Sending…' : 'Approve & send to students'} <ArrowRight className="size-4" />
                  </button>
                  )}
                </article>
                )
              })}
            </div>
            {note && <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm text-mint"><CheckCircle2 className="size-4" />{note}</p>}

            <h2 className="mt-12 text-xs font-semibold uppercase tracking-widest text-console-dim">Sent sessions</h2>
            <div className="mt-4 space-y-3">
              {data.interventions.length === 0 && <p className="rounded-3xl border border-dashed border-console-line p-6 text-sm text-console-dim">Approved sessions land here, visible to the students they target.</p>}
              {data.interventions.map((i) => (
                <div key={i.id} className="rounded-3xl bg-console-raise p-6 ring-1 ring-console-line">
                  <p className="font-medium">{i.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-console-dim">{i.detail}</p>
                  <p className="mt-2 text-xs text-console-dim">To {i.affectedStudents.join(' · ')}</p>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <div className="rounded-3xl bg-console-raise p-5 ring-1 ring-console-line">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-console-dim">Educator key</h2>
              <p className="mt-2 text-xs leading-5 text-console-dim">Required in production to approve sessions. Stored only in this tab.</p>
              <input
                value={adminToken}
                onChange={(e) => {
                  setAdminToken(e.target.value)
                  window.sessionStorage.setItem('cognara-admin-token', e.target.value)
                }}
                type="password"
                autoComplete="off"
                placeholder="ADMIN_TOKEN"
                aria-label="Educator admin token"
                className="mt-3 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm text-console-ink outline-none ring-1 ring-white/10 placeholder:text-console-dim/60 focus:ring-gilt/60"
              />
            </div>
            <h2 className="mt-6 text-xs font-semibold uppercase tracking-widest text-console-dim">The room</h2>
            <p className="mt-2 text-sm text-console-dim">{totalBelow} of {data.peers.length} students have at least one concept below the bar.</p>
            <div className="mt-4 space-y-3">
              {data.peers.map((p) => {
                const weak = data.concepts.filter((c) => (p.mastery[c.id] ?? 50) < 50)
                const avg = Math.round(Object.values(p.mastery).reduce((a, m) => a + m, 0) / Math.max(1, Object.values(p.mastery).length))
                return (
                  <div key={p.id} className="rounded-3xl bg-console-raise p-5 ring-1 ring-console-line">
                    <div className="flex items-baseline justify-between">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-console-dim">{avg}%</p>
                    </div>
                    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${avg < 50 ? 'bg-gilt' : 'bg-mint'}`} style={{ width: `${avg}%` }} /></div>
                    <p className="mt-2.5 text-xs leading-5 text-console-dim">{weak.length === 0 ? 'No flags — on track everywhere.' : `Needs support: ${weak.map((c) => c.title.toLowerCase()).join(', ')}`}</p>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t border-console-line py-6 text-xs text-console-dim">
          <p>Recommendations are computed from marked work, never from vibes.</p>
          <Link href="/learn" className="hover:text-console-ink">See the student side</Link>
        </footer>
      </div>
    </main>
  )
}
