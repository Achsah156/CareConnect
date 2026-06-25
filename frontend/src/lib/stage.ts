import type { Stage } from "./api";

export const STAGE_ORDER: Stage[] = ["just_started", "in_it", "turning_point", "resolved"];

export const STAGE_LABEL: Record<Stage, string> = {
  just_started: "Just started",
  in_it: "In it",
  turning_point: "Turning point",
  resolved: "Resolved",
};

export const STAGE_POSITION: Record<Stage, number> = {
  just_started: 0,
  in_it: 1 / 3,
  turning_point: 2 / 3,
  resolved: 1,
};

export function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}
