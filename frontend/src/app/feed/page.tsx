"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Situation } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { SituationCard } from "@/components/SituationCard";

export default function FeedPage() {
  const router = useRouter();
  const [situations, setSituations] = useState<Situation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFeed()
      .then(setSituations)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Couldn't load your feed. Try refreshing.");
      });
  }, [router]);

  return (
    <main className="min-h-screen">
      <AppHeader />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl text-paper mb-1">Your feed</h1>
        <p className="text-paper/60 text-sm mb-8">
          Situations like the ones you&apos;ve shared, and anything you&apos;re following.
        </p>

        {error && <p className="text-amber text-sm">{error}</p>}

        {situations === null && !error && (
          <p className="text-slate text-sm font-mono uppercase tracking-wider">Loading…</p>
        )}

        {situations !== null && situations.length === 0 && (
          <div className="bg-inkmuted border border-white/5 rounded-lg p-8 text-center">
            <p className="text-paper/70 mb-4">
              Nothing here yet. Share what you&apos;re going through to find others on
              the same path.
            </p>
            <a href="/situations/new" className="text-amber hover:underline text-sm">
              Share your situation
            </a>
          </div>
        )}

        <div className="space-y-4">
          {situations?.map((s) => (
            <SituationCard
              key={s.id}
              situation={s}
              onClick={() => router.push(`/situations/${s.id}`)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
