"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Stage } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stage";

const SITUATION_TYPE_OPTIONS = [
  { value: "job_search", label: "Job search" },
  { value: "career_pivot", label: "Career pivot" },
  { value: "relocation", label: "Relocation" },
  { value: "grief", label: "Grief & loss" },
  { value: "burnout", label: "Burnout" },
  { value: "other", label: "Something else" },
];

export default function NewSituationPage() {
  const router = useRouter();
  const [situationType, setSituationType] = useState(SITUATION_TYPE_OPTIONS[0].value);
  const [stage, setStage] = useState<Stage>("in_it");
  const [bodyText, setBodyText] = useState("");
  const [outcomeText, setOutcomeText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const situation = await api.createSituation({
        situation_type: situationType,
        stage,
        body_text: bodyText,
        is_anonymous: isAnonymous,
        outcome_text: stage === "resolved" && outcomeText ? outcomeText : undefined,
      });
      router.push(`/situations/${situation.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("Couldn't post that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <AppHeader />

      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl text-paper mb-2">Share what&apos;s going on</h1>
        <p className="text-paper/60 text-sm mb-8">
          Be as specific as you&apos;re comfortable with. This is what helps someone else
          recognize their own situation in yours.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              What kind of situation is this?
            </label>
            <select
              value={situationType}
              onChange={(e) => setSituationType(e.target.value)}
              className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper outline-none focus:border-amber/50"
            >
              {SITUATION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              Where are you right now?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STAGE_ORDER.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStage(s)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors ${
                    stage === s
                      ? "border-amber bg-amber/10 text-amber"
                      : "border-white/10 text-paper/70 hover:border-white/20"
                  }`}
                >
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
              Tell your situation
            </label>
            <textarea
              required
              minLength={1}
              maxLength={5000}
              rows={5}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper placeholder:text-slate/50 outline-none focus:border-amber/50 resize-none"
              placeholder="What's happening, in your own words…"
            />
          </div>

          {stage === "resolved" && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate mb-2">
                What happened? (this is the part others need most)
              </label>
              <textarea
                rows={4}
                maxLength={5000}
                value={outcomeText}
                onChange={(e) => setOutcomeText(e.target.value)}
                className="w-full bg-inkmuted border border-white/10 rounded-lg px-4 py-3 text-paper placeholder:text-slate/50 outline-none focus:border-amber/50 resize-none"
                placeholder="What got you through, or what changed…"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-paper/70">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded border-white/20 bg-inkmuted"
            />
            Post anonymously
          </label>

          {error && <p className="text-sm text-amber">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber text-ink font-medium px-6 py-3 rounded-lg hover:bg-amber/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post situation"}
          </button>
        </form>
      </div>
    </main>
  );
}
