"use client";

import { STAGE_LABEL, STAGE_POSITION } from "@/lib/stage";
import type { Stage } from "@/lib/api";

interface PathPoint {
  id: string;
  stage: Stage;
  hasOutcome?: boolean;
  label?: string;
}

interface PathLineProps {
  /** The viewer's own current position on the path. */
  selfStage: Stage;
  /** Other situations to plot relative to self. */
  points?: PathPoint[];
  onPointClick?: (id: string) => void;
}

/**
 * The literal embodiment of PathParallel's whole idea: a horizontal trail
 * with the viewer's position marked, and matched stories plotted ahead
 * or behind them on the same line. A resolved story glows gently — it's
 * the porch light showing where the path leads.
 */
export function PathLine({ selfStage, points = [], onPointClick }: PathLineProps) {
  const selfPos = STAGE_POSITION[selfStage];

  return (
    <div className="w-full">
      <div className="relative h-16">
        {/* the trail itself */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate/30" />

        {/* stage tick marks */}
        {(Object.keys(STAGE_POSITION) as Stage[]).map((stage) => (
          <div
            key={stage}
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${STAGE_POSITION[stage] * 100}%` }}
          >
            <div className="w-px h-3 bg-slate/40 -translate-y-5" />
          </div>
        ))}

        {/* matched points */}
        {points.map((point) => {
          const pos = STAGE_POSITION[point.stage];
          return (
            <button
              key={point.id}
              onClick={() => onPointClick?.(point.id)}
              title={point.label || STAGE_LABEL[point.stage]}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${pos * 100}%` }}
            >
              <span
                className={`block w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125 ${
                  point.hasOutcome
                    ? "bg-amber animate-pulseglow shadow-[0_0_8px_rgba(199,107,60,0.6)]"
                    : "bg-slate/60"
                }`}
              />
            </button>
          );
        })}

        {/* self marker, drawn last so it's always on top */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${selfPos * 100}%` }}
        >
          <span className="block w-3.5 h-3.5 rounded-full bg-paper ring-2 ring-ink" />
          <span className="absolute top-5 text-[10px] font-mono uppercase tracking-wider text-paper whitespace-nowrap">
            you
          </span>
        </div>
      </div>

      <div className="flex justify-between mt-1 font-mono text-[10px] uppercase tracking-wider text-slate">
        {(Object.keys(STAGE_POSITION) as Stage[]).map((stage) => (
          <span key={stage}>{STAGE_LABEL[stage]}</span>
        ))}
      </div>
    </div>
  );
}
