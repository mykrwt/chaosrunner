import type { Vec3 } from "./vec3";

export type PlayerId = string;

export type PlayerInfo = {
  id: PlayerId;
  name: string;
  color: string;
};

export type CarInput = {
  t: number;
  throttle: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
  respawn: boolean;
};

export type CarState = {
  p: Vec3;
  v: Vec3;
  yaw: number;
  yawVel: number;
  grounded: boolean;
  boostCd: number;
  lap: number;
  s: number;
  lastCp: number;
  finished: boolean;
  alive: boolean;
  lastHitAt: number;
};

export type MatchMode = "race" | "checkpointChaos" | "elimination";

export type MatchSettings = {
  mode: MatchMode;
  laps: number;
  checkpointCount: number;
  durationMs: number;
};

export type MatchRuntime = {
  running: boolean;
  settings: MatchSettings | null;
  seed: string;
  startTime: number;
  endTime: number;
  finishedOrder: PlayerId[];
  eliminated: PlayerId[];
  chaosTargetCp: number;
  scores: Record<PlayerId, number>;
};

export type Snapshot = {
  t: number;
  cars: Record<PlayerId, CarState>;
  match: MatchRuntime;
};

export type HostClaim = {
  term: number;
  hostId: PlayerId;
};

export type StartMatchMsg = {
  settings: MatchSettings;
  seed: string;
  startAt: number;
};

export type EndMatchMsg = {
  finishedOrder: PlayerId[];
  eliminated: PlayerId[];
};
