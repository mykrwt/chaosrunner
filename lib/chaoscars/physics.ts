import type { CarInput, CarState, MatchRuntime, PlayerId } from "./types";
import type { Track } from "./track";
import { v3, v3Copy, v3Dot, v3Len, v3Sub } from "./vec3";
import { VehiclePhysics, createDefaultVehicleConfig } from "./vehicle";
import type { VehicleState } from "./vehicle";

const GRAVITY = 28;
const RIDE_HEIGHT = 1.25;
const CAR_RADIUS = 2.1;

const vehicleInstances = new Map<string, VehiclePhysics>();

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
    pitch: 0,
    roll: 0,
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
  state.pitch = 0;
  state.roll = 0;
  state.grounded = true;
  
  const vehicleKey = `vehicle_${state.p.x}_${state.p.y}_${state.p.z}`;
  if (vehicleInstances.has(vehicleKey)) {
    vehicleInstances.delete(vehicleKey);
  }
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

    stepCarAdvanced({ now, dt, track, car, input, playerId: id });

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

function getVehicleInstance(playerId: string, car: CarState): VehiclePhysics {
  const key = `vehicle_${playerId}`;
  
  if (!vehicleInstances.has(key)) {
    const config = createDefaultVehicleConfig();
    const vehicle = new VehiclePhysics(config, v3Copy(car.p), car.yaw);
    vehicleInstances.set(key, vehicle);
    return vehicle;
  }
  
  return vehicleInstances.get(key)!;
}

export function stepCarAdvanced(params: { 
  now: number; 
  dt: number; 
  track: Track; 
  car: CarState; 
  input: CarInput;
  playerId: string;
}): void {
  const { now, dt, track, car, input, playerId } = params;

  const useAdvancedPhysics = false;
  
  if (useAdvancedPhysics) {
    const vehicle = getVehicleInstance(playerId, car);
    
    const throttle = Math.max(0, input.throttle);
    const brake = Math.max(0, -input.throttle);
    const steer = clamp(input.steer, -1, 1);
    const handbrake = input.handbrake ? 1 : 0;
    
    vehicle.setInputs(throttle, brake, steer, handbrake);
    
    const terrainHeightFn = (x: number, z: number) => track.getSurfaceInfo(x, z).height;
    vehicle.step(dt, terrainHeightFn);
    
    const vState = vehicle.getState();
    
    car.p = v3Copy(vState.position);
    car.v = v3Copy(vState.velocity);
    car.yaw = vehicle.getYaw();
    car.pitch = vehicle.getPitch();
    car.roll = vehicle.getRoll();
    car.grounded = vState.wheels.some(w => w.groundContact);
    
    const forward = vehicle.getForwardVector();
    car.yawVel = vState.angularVelocity.y;
    
  } else {
    stepCarArcade({ now, dt, track, car, input });
  }
  
  car.boostCd = Math.max(0, car.boostCd - dt);

  if (input.boost && car.boostCd <= 0) {
    const forward = { x: Math.cos(car.yaw), y: 0, z: Math.sin(car.yaw) };
    car.v.x += forward.x * 32;
    car.v.z += forward.z * 32;
    car.v.y += 7;
    car.boostCd = 3.8;
  }

  for (const pad of track.boostPads) {
    const dx = pad.p.x - car.p.x;
    const dz = pad.p.z - car.p.z;
    if (dx * dx + dz * dz <= pad.radius * pad.radius && car.grounded) {
      const forward = { x: Math.cos(car.yaw), y: 0, z: Math.sin(car.yaw) };
      car.v.x += forward.x * pad.impulse;
      car.v.z += forward.z * pad.impulse;
      car.v.y += pad.lift;
      car.lastHitAt = now;
    }
  }
}

export function stepCarArcade(params: { now: number; dt: number; track: Track; car: CarState; input: CarInput }): void {
  const { now, dt, track, car, input } = params;

  const surface = track.getSurfaceInfo(car.p.x, car.p.z);

  const forward = { x: Math.cos(car.yaw), y: 0, z: Math.sin(car.yaw) };
  const right = { x: -forward.z, y: 0, z: forward.x };

  let vF = v3Dot(car.v, forward);
  let vR = v3Dot(car.v, right);

  const onRoadGrip = surface.onRoad ? 1.2 : 0.65;
  const handbrakeGrip = input.handbrake ? 0.2 : 1;

  const speedMultiplier = 1.4;
  const accel = (car.grounded ? 72 : 32) * speedMultiplier;
  const brake = (car.grounded ? 85 : 28) * speedMultiplier;

  const throttle = clamp(input.throttle, -1, 1);
  if (throttle >= 0) vF += throttle * accel * dt;
  else vF += throttle * brake * dt;

  const grip = (car.grounded ? 13 : 3.2) * onRoadGrip * handbrakeGrip;
  vR *= expDamp(grip, dt);

  const drag = car.grounded ? 0.65 : 0.25;
  vF *= expDamp(drag, dt);

  const speed = Math.abs(vF);
  const steerPower = (car.grounded ? 3.5 : 1.5) * clamp(0.65 + speed * 0.028, 0.65, 3.0);
  car.yawVel += clamp(input.steer, -1, 1) * steerPower * dt;
  car.yawVel *= expDamp(8.5, dt);
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
  const spring = yErr * 95 - car.v.y * 12;
  car.v.y += spring * dt;

  if (car.p.y <= targetY) {
    car.p.y = targetY;
    if (car.v.y < -12) car.v.y *= -0.28;
    else car.v.y = 0;
    car.grounded = true;
  } else {
    car.grounded = false;
  }

  const sampleDist = 2.5;
  const frontX = car.p.x + forward.x * sampleDist;
  const frontZ = car.p.z + forward.z * sampleDist;
  const backX = car.p.x - forward.x * sampleDist;
  const backZ = car.p.z - forward.z * sampleDist;
  const leftX = car.p.x + right.x * sampleDist;
  const leftZ = car.p.z + right.z * sampleDist;
  const rightX = car.p.x - right.x * sampleDist;
  const rightZ = car.p.z - right.z * sampleDist;

  const frontH = track.getSurfaceInfo(frontX, frontZ).height;
  const backH = track.getSurfaceInfo(backX, backZ).height;
  const leftH = track.getSurfaceInfo(leftX, leftZ).height;
  const rightH = track.getSurfaceInfo(rightX, rightZ).height;

  const targetPitch = Math.atan2(frontH - backH, sampleDist * 2);
  const targetRoll = Math.atan2(rightH - leftH, sampleDist * 2);

  const pitchSpeed = car.grounded ? 9.0 : 4.0;
  const rollSpeed = car.grounded ? 8.5 : 3.5;

  car.pitch += (targetPitch - car.pitch) * pitchSpeed * dt;
  car.roll += (targetRoll - car.roll) * rollSpeed * dt;
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

        const push = (minDist - dist) * 0.55;
        a.p.x -= n.x * push;
        a.p.z -= n.z * push;
        b.p.x += n.x * push;
        b.p.z += n.z * push;

        const relV = v3Sub(b.v, a.v);
        const relAlong = v3Dot(relV, n);
        const impulse = clamp(-relAlong * 1.5 + 8, 0, 28);

        a.v.x -= n.x * impulse;
        a.v.z -= n.z * impulse;
        b.v.x += n.x * impulse;
        b.v.z += n.z * impulse;

        a.v.y += 4.0;
        b.v.y += 4.0;

        a.lastHitAt = params.now;
        b.lastHitAt = params.now;
      }
    }
  }
}

export function estimateSpeed(car: CarState): number {
  return Math.sqrt(car.v.x * car.v.x + car.v.z * car.v.z);
}
