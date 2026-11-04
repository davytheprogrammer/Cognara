import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BookOpen, FlaskConical } from 'lucide-react'

export default function Landing() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between">
          <p className="font-display text-2xl tracking-tight">cognara</p>
          <p className="hidden text-sm text-ink-faint sm:block">An educator that adapts to how you learn</p>
        </header>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display max-w-xl text-5xl leading-[1.04] tracking-tight sm:text-6xl">
              Teaching that bends toward the student.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-ink-soft">
              Cognara notices what you understand, finds the exact idea in your way,
              and teaches it differently until it clicks. Then it proves it worked.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/learn" className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-pine-deep">
                Begin a session <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/teach" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-ink-soft ring-1 ring-ink/15 transition-colors hover:text-ink hover:ring-ink/30">
                Educator console <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-ink/10 pt-6">
              {[['Adapts', 'pace, depth & difficulty per concept'], ['Acts', 'writes exercises, marks, intervenes'], ['Proves', 'mastery moves are shown, not claimed']].map(([t, d]) => (
                <div key={t}>
                  <dt className="font-display text-xl">{t}</dt>
                  <dd className="mt-1 text-xs leading-5 text-ink-faint">{d}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-4">
            <Link href="/learn" className="group rounded-3xl bg-white p-8 shadow-[0_24px_60px_-30px_rgba(28,33,30,0.35)] ring-1 ring-ink/10 transition-shadow hover:shadow-[0_24px_60px_-24px_rgba(12,107,74,0.4)]">
              <BookOpen className="size-6 text-pine" />
              <p className="font-display mt-5 text-3xl tracking-tight">I&apos;m here to learn</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">A personal session with Maya&apos;s calculus class. Diagnosis, practice, feedback — one continuous thread.</p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pine">Enter as a student <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></p>
            </Link>
            <Link href="/teach" className="group rounded-3xl bg-console p-8 text-console-ink shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
              <FlaskConical className="size-6 text-gilt" />
              <p className="font-display mt-5 text-3xl tracking-tight">I run the classroom</p>
              <p className="mt-2 text-sm leading-6 text-console-dim">Class-wide signals, struggling concepts surfaced, interventions you approve before anything goes out.</p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gilt">Enter the console <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></p>
            </Link>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-ink/10 py-5 text-xs text-ink-faint">
          <p>Cognara · adaptive teaching demo</p>
          <p>Explanations are grounded in your course material</p>
        </footer>
      </div>
    </main>
  )
}
