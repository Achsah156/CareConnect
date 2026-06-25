import Link from "next/link";
import { PathLine } from "@/components/PathLine";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 md:px-12 py-6">
        <span className="font-display italic text-lg text-paper">PathParallel</span>
        <div className="flex gap-6 font-mono text-xs uppercase tracking-wider text-slate">
          <Link href="/login" className="hover:text-paper transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-paper transition-colors">
            Sign up
          </Link>
        </div>
      </nav>

      <section className="flex-1 flex items-center px-6 md:px-12">
        <div className="max-w-2xl mx-auto w-full py-16">
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-6">
            for whatever stage you&apos;re at
          </p>
          <h1 className="font-display text-4xl md:text-6xl leading-[1.05] text-paper mb-8">
            Someone has already
            <br />
            <span className="italic text-amber">walked this exact stretch.</span>
          </h1>
          <p className="text-lg text-paper/70 leading-relaxed mb-12 max-w-lg">
            Not advice from strangers. Not a search engine. PathParallel finds people
            at your exact stage of your exact situation — and shows you what happened
            to the ones who made it through.
          </p>

          <div className="bg-inkmuted border border-white/5 rounded-xl p-6 mb-12">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate mb-4">
              someone navigating a job search, right now
            </p>
            <PathLine
              selfStage="in_it"
              points={[
                { id: "a", stage: "just_started" },
                { id: "b", stage: "resolved", hasOutcome: true, label: "Resolved — got an offer" },
              ]}
            />
          </div>

          <Link
            href="/signup"
            className="inline-block bg-amber text-ink font-medium px-6 py-3 rounded-lg hover:bg-amber/90 transition-colors"
          >
            Find your path
          </Link>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-6 font-mono text-[10px] uppercase tracking-wider text-slate/60">
        PathParallel does not provide medical, legal, or financial advice.
      </footer>
    </main>
  );
}
