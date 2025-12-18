import type { CarInput, CarState, MatchRuntime, PlayerId } from "./types";
import type { Track } from "./track";
import { v3, v3Copy, v3Dot, v3Len, v3Sub } from "./vec3";

const GRAVITY = 28;
const RIDE_HEIGHT = 1.25;
const CAR_RADIUS = 2.1;

function expDamp(k: number, dt: number): number {
  return Math.exp(-k * dt * 60) ** (1 / 60);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createCarState(spawn: { p: { x: number; y: number; z: number }; yaw: number }): CarState {
  return {
    p: v3Copy(spawn.p),
    v: v3(0, 0, 0),
    yaw: spawn.yaw,
    yawVel: 0,
    grounded: true,
    boostCd: 0,
    lap: 0,
    s: 0,
    lastCp: 0,
    finished: false,
    alive: true,
    lastHitAt: 0,
  };
}

export function respawnCar(state: CarState, track: Track, cpIndex: number): void {
  const spawn = track.getCheckpointSpawn(cpIndex);
  state.p = v3Copy(spawn.p);
  state.v = v3(0, 0, 0);
  state.yaw = spawn.yaw;
  state.yawVel = 0;
  state.grounded = true;
}

export function stepWorld(params: {
  now: number;
  dt: number;
  track: Track;
  checkpointCount: number;
  cars: Record<PlayerId, CarState>;
  inputs: Record<PlayerId, CarInput | undefined>;
  match: MatchRuntime;
  chaosRng?: () => number;
}): void {
  const { now, dt, track, cars, inputs, checkpointCount, match } = params;
  const settings = match.settings;
  if (!settings || !match.running) return;

  for (const id of Object.keys(cars)) {
    const car = cars[id];
    if (!car.alive || car.finished) continue;

    const input =
      inputs[id] ??
      ({ t: now, throttle: 0, steer: 0, handbrake: false, boost: false, respawn: false } satisfies CarInput);

    stepCarArcade({ now, dt, track, car, input });

    if (input.respawn || car.p.y < -30 || v3Len(car.p) > 700) {
      respawnCar(car, track, car.lastCp);
    }

    const surface = track.getSurfaceInfo(car.p.x, car.p.z);

    const prevS = car.s;
    car.s = surface.s;

    if (car.s < 0.2 && prevS > 0.8) {
      car.lap++;
    }

    if (settings.mode === "race") {
      const nextCp = (car.lastCp + 1) % checkpointCount;
      const target = track.checkpoints[nextCp];
      const dx = target.p.x - car.p.x;
      const dz = target.p.z - car.p.z;

      if (dx * dx + dz * dz <= target.radius * target.radius) {
        car.lastCp = nextCp;
        if (nextCp === 0 && car.lap >= settings.laps) {
          car.finished = true;
          if (!match.finishedOrder.includes(id)) match.finishedOrder.push(id);
        }
      }
    }

    if (settings.mode === "checkpointChaos") {
      const targetCp = match.chaosTargetCp % checkpointCount;
      const target = track.checkpoints[targetCp];
      const dx = target.p.x - car.p.x;
      const dz = target.p.z - car.p.z;

      if (dx * dx + dz * dz <= target.radius * target.radius) {
        match.scores[id] = (match.scores[id] ?? 0) + 1;
        car.lastCp = targetCp;

        const rng = params.chaosRng;
        if (rng) {
          let next = Math.floor(rng() * checkpointCount);
          if (checkpointCount > 1) {
            let guard = 0;
            while (next === targetCp && guard++ < 10) next = Math.floor(rng() * checkpointCount);
          }
          match.chaosTargetCp = next;
        } else {
          match.chaosTargetCp = (targetCp + 1) % checkpointCount;
        }
      }
    }
  }

  if (settings.mode === "elimination") {
    applyElimination({ now, cars, match });
  }

  resolveCarCollisions({ now, cars });

  if (now >= match.endTime) {
    match.running = false;
  }

  if (settings.mode === "race") {
    const aliveIds = Object.keys(cars).filter((id) => cars[id].alive);
    if (match.finishedOrder.length >= aliveIds.length) match.running = false;
  }

  if (settings.mode === "checkpointChaos") {
    const best = Math.max(0, ...Object.values(match.scores));
    if (best >= 10) match.running = false;
  }
}

function applyElimination(params: { now: number; cars: Record<PlayerId, CarState>; match: MatchRuntime }): void {
  const { now, cars, match } = params;
  const settings = match.settings;
  if (!settings) return;

  const roundMs = 20_000;
  const nextRoundAt = match.startTime + (match.eliminated.length + 1) * roundMs;
  if (now < nextRoundAt) return;

  const aliveIds = Object.keys(cars).filter((id) => cars[id].alive);
  if (aliveIds.length <= 1) {
    match.running = false;
    return;
  }

  let worstId = aliveIds[0];
  let worstScore = Infinity;

  for (const id of aliveIds) {
    const car = cars[id];
    const score = car.lap + car.s;
    if (score < worstScore) {
      worstScore = score;
      worstId = id;
    }
  }

  cars[worstId].alive = false;
  match.eliminated.push(worstId);
}

export function stepCarArcade(params: { now: number; dt: number; track: Track; car: CarState; input: CarInput }): void {
  const { now, dt, track, car, input } = params;

  car.boostCd = Math.max(0, car.boostCd - dt);

  const surface = track.getSurfaceInfo(car.p.x, car.p.z);

  const forward = { x: Math.cos(car.yaw), y: 0, z: Math.sin(car.yaw) };
  const right = { x: -forward.z, y: 0, z: forward.x };

  let vF = v3Dot(car.v, forward);
  let vR = v3Dot(car.v, right);

  const onRoadGrip = surface.onRoad ? 1 : 0.7;
  const handbrakeGrip = input.handbrake ? 0.25 : 1;

  const accel = car.grounded ? 64 : 30;
  const brake = car.grounded ? 72 : 26;

  const throttle = clamp(input.throttle, -1, 1);
  if (throttle >= 0) vF += throttle * accel * dt;
  else vF += throttle * brake * dt;

  if (input.boost && car.boostCd <= 0) {
    vF += 32;
    car.v.y += 7;
    car.boostCd = 3.8;
  }

  const grip = (car.grounded ? 11 : 2.8) * onRoadGrip * handbrakeGrip;
  vR *= expDamp(grip, dt);

  const drag = car.grounded ? 0.8 : 0.3;
  vF *= expDamp(drag, dt);

  const speed = Math.abs(vF);
  const steerPower = (car.grounded ? 3.0 : 1.3) * clamp(0.6 + speed * 0.025, 0.6, 2.5);
  car.yawVel += clamp(input.steer, -1, 1) * steerPower * dt;
  car.yawVel *= expDamp(7.5, dt);
  car.yaw += car.yawVel * dt;

  car.v.x = forward.x * vF + right.x * vR;
  car.v.z = forward.z * vF + right.z * vR;

  car.v.y -= GRAVITY * dt;

  car.p.x += car.v.x * dt;
  car.p.y += car.v.y * dt;
  car.p.z += car.v.z * dt;

  const surf2 = track.getSurfaceInfo(car.p.x, car.p.z);
  const targetY = surf2.height + RIDE_HEIGHT;

  const yErr = targetY - car.p.y;
  const spring = yErr * 85 - car.v.y * 11;
  car.v.y += spring * dt;

  if (car.p.y <= targetY) {
    car.p.y = targetY;
    if (car.v.y < -12) car.v.y *= -0.3;
    else car.v.y = 0;
    car.grounded = true;
  } else {
    car.grounded = false;
  }

  for (const pad of track.boostPads) {
    const dx = pad.p.x - car.p.x;
    const dz = pad.p.z - car.p.z;
    if (dx * dx + dz * dz <= pad.radius * pad.radius && car.grounded) {
      car.v.x += forward.x * pad.impulse;
      car.v.z += forward.z * pad.impulse;
      car.v.y += pad.lift;
      car.lastHitAt = now;
    }
  }
}

export function computeRaceProgress(car: CarState): number {
  return car.lap + car.s;
}

export function resolveCarCollisions(params: { now: number; cars: Record<PlayerId, CarState> }): void {
  const ids = Object.keys(params.cars);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = params.cars[ids[i]];
      const b = params.cars[ids[j]];

      if (!a.alive || !b.alive) continue;

      const dx = b.p.x - a.p.x;
      const dz = b.p.z - a.p.z;
      const distSq = dx * dx + dz * dz;
      const minDist = CAR_RADIUS * 2;

      if (distSq > 0 && distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const n = { x: dx / dist, y: 0, z: dz / dist };

        const push = (minDist - dist) * 0.52;
        a.p.x -= n.x * push;
        a.p.z -= n.z * push;
        b.p.x += n.x * push;
        b.p.z += n.z * push;

        const relV = v3Sub(b.v, a.v);
        const relAlong = v3Dot(relV, n);
        const impulse = clamp(-relAlong * 1.4 + 7, 0, 26);

        a.v.x -= n.x * impulse;
        a.v.z -= n.z * impulse;
        b.v.x += n.x * impulse;
        b.v.z += n.z * impulse;

        a.v.y += 3.6;
        b.v.y += 3.6;

        a.lastHitAt = params.now;
        b.lastHitAt = params.now;
      }
    }
  }
}

export function estimateSpeed(car: CarState): number {
  return Math.sqrt(car.v.x * car.v.x + car.v.z * car.v.z);
}
