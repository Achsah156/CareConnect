"use client";

import { STAGE_LABEL } from "@/lib/stage";
import type { Situation, MatchedSituation } from "@/lib/api";

interface SituationCardProps {
  situation: Situation | MatchedSituation;
  onClick?: () => void;
}

function isMatched(s: Situation | MatchedSituation): s is MatchedSituation {
  return "match_score" in s;
}

export function SituationCard({ situation, onClick }: SituationCardProps) {
  const hasOutcome = Boolean(situation.outcome_text);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-inkmuted border border-white/5 rounded-lg p-5 transition-colors hover:border-amber/30 animate-fadeup"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
          {situation.situation_type.replace(/_/g, " ")}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
            hasOutcome ? "bg-amber/15 text-amber" : "bg-white/5 text-slate"
          }`}
        >
          {STAGE_LABEL[situation.stage]}
        </span>
      </div>

      <p className="font-display text-paper text-base leading-snug mb-3">
        {situation.body_text}
      </p>

      {hasOutcome && (
        <div className="border-l-2 border-amber/40 pl-3 mt-3">
          <p className="text-sm text-paper/80 leading-relaxed">{situation.outcome_text}</p>
        </div>
      )}

      {isMatched(situation) && (
        <div className="mt-4 pt-3 border-t border-white/5 flex gap-4 font-mono text-[10px] uppercase tracking-wider text-slate">
          <span>match {Math.round(situation.match_score * 100)}%</span>
        </div>
      )}
    </button>
  );
}
