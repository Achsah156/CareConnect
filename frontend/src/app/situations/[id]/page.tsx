"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, Situation, MatchedSituation } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { SituationCard } from "@/components/SituationCard";
import { PathLine } from "@/components/PathLine";
import { STAGE_LABEL } from "@/lib/stage";

export default function SituationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [situation, setSituation] = useState<Situation | null>(null);
  const [matches, setMatches] = useState<MatchedSituation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [reacted, setReacted] = useState(false);

  useEffect(() => {
    if (!params.id) return;

    api
      .getSituation(params.id)
      .then(setSituation)
      .catch(() => setError("Couldn't find that situation."));

    api
      .getMatches(params.id)
      .then(setMatches)
      .catch(() => setMatches([]));
  }, [params.id]);

  async function handleFollow() {
    if (!situation) return;
    try {
      if (following) {
        await api.unfollow(situation.id);
        setFollowing(false);
      } else {
        await api.follow(situation.id);
        setFollowing(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      }
    }
  }

  async function handleReact() {
    if (!situation || reacted) return;
    try {
      await api.react(situation.id, "rooting_for_you");
      setReacted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      }
    }
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <p className="text-amber">{error}</p>
        </div>
      </main>
    );
  }

  if (!situation) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <div className="max-w-2xl mx-auto px-6 py-10">
          <p className="text-slate text-sm font-mono uppercase tracking-wider">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader />

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* the situation itself */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
              {situation.situation_type.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber bg-amber/10 px-2 py-0.5 rounded-full">
              {STAGE_LABEL[situation.stage]}
            </span>
          </div>
          <p className="font-display text-xl text-paper leading-snug mb-4">
            {situation.body_text}
          </p>
          {situation.outcome_text && (
            <div className="border-l-2 border-amber/40 pl-4">
              <p className="text-paper/80 leading-relaxed">{situation.outcome_text}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleReact}
              disabled={reacted}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-white/10 text-paper/70 hover:border-amber/40 hover:text-amber transition-colors disabled:opacity-50"
            >
              {reacted ? "Rooting for you ✓" : "Root for them"}
            </button>
            <button
              onClick={handleFollow}
              className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                following
                  ? "border-amber/40 text-amber"
                  : "border-white/10 text-paper/70 hover:border-amber/40 hover:text-amber"
              }`}
            >
              {following ? "Following ✓" : "Follow this story"}
            </button>
          </div>
        </div>

        {/* the path visual - where this situation sits relative to its matches */}
        {matches && matches.length > 0 && (
          <div className="bg-inkmuted border border-white/5 rounded-xl p-6 mb-10">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate mb-4">
              where this sits among similar stories
            </p>
            <PathLine
              selfStage={situation.stage}
              points={matches.map((m) => ({
                id: m.id,
                stage: m.stage,
                hasOutcome: Boolean(m.outcome_text),
              }))}
              onPointClick={(id) => router.push(`/situations/${id}`)}
            />
          </div>
        )}

        {/* matches */}
        <h2 className="font-display text-lg text-paper mb-4">
          {matches === null
            ? "Finding similar stories…"
            : matches.length > 0
            ? "People at a similar stage"
            : "No similar stories yet"}
        </h2>

        {matches !== null && matches.length === 0 && (
          <p className="text-paper/60 text-sm">
            You might be among the first to share this kind of situation. Check back soon.
          </p>
        )}

        <div className="space-y-4">
          {matches?.map((m) => (
            <SituationCard key={m.id} situation={m} onClick={() => router.push(`/situations/${m.id}`)} />
          ))}
        </div>
      </div>
    </main>
  );
}
