import { hashStringToSeed, mulberry32, randRange } from "./random";
import type { Vec3 } from "./vec3";
import { v3, v3LenSq, v3Normalize, v3Sub } from "./vec3";

export type TrackSample = {
  p: Vec3;
  t: Vec3;
  left: Vec3;
  s: number;
};

export type Checkpoint = {
  index: number;
  s: number;
  p: Vec3;
  radius: number;
};

export type BoostPad = {
  p: Vec3;
  radius: number;
  impulse: number;
  lift: number;
};

export type SurfaceInfo = {
  height: number;
  onRoad: boolean;
  s: number;
  t: Vec3;
  distToCenter: number;
};

export type Track = {
  seed: string;
  samples: TrackSample[];
  checkpoints: Checkpoint[];
  boostPads: BoostPad[];
  roadWidth: number;
  start: TrackSample;
  getSurfaceInfo: (x: number, z: number) => SurfaceInfo;
  getCheckpointSpawn: (cpIndex: number) => { p: Vec3; yaw: number };
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function terrainHeight(seedA: number, seedB: number, x: number, z: number): number {
  const sx = x * 0.012;
  const sz = z * 0.012;
  
  const h1 = Math.sin(sx + seedA) * 8.5 + Math.cos(sz + seedB) * 8.5;
  const h2 = Math.sin((sx + sz) * 2.1 + seedA * 0.7) * 5.2;
  const h3 = Math.cos((sx * 1.8 - sz * 1.9) + seedB * 0.8) * 3.8;
  const h4 = Math.sin((sx * 3.2 + sz * 2.8) + seedA * 1.3) * 2.1;
  const h5 = Math.cos((sx * 5.5 - sz * 4.8) + seedB * 1.7) * 1.2;
  
  const hills = h1 + h2 + h3 + h4 + h5;
  
  const valleyFactor = Math.sin(sx * 0.8) * Math.cos(sz * 0.8);
  const valleys = valleyFactor * 6.5;
  
  return hills + valleys;
}

function computeNearestSample(samples: TrackSample[], x: number, z: number): { i: number; d: number } {
  let bestI = 0;
  let bestD = Infinity;

  for (let i = 0; i < samples.length; i++) {
    const p = samples[i].p;
    const dx = p.x - x;
    const dz = p.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }

  return { i: bestI, d: Math.sqrt(bestD) };
}

export function createTrack(seed: string): Track {
  const seedNum = hashStringToSeed(seed);
  const rng = mulberry32(seedNum);

  const baseR = randRange(rng, 135, 165);
  const wobbleR = randRange(rng, 18, 28);
  const wobbleH = randRange(rng, 12, 22);

  const seedA = randRange(rng, 0, Math.PI * 2);
  const seedB = randRange(rng, 0, Math.PI * 2);
  const seedC = randRange(rng, 0, Math.PI * 2);

  const pointCount = 800;
  const points: Vec3[] = [];

  for (let i = 0; i < pointCount; i++) {
    const a = (i / pointCount) * Math.PI * 2;
    const r =
      baseR +
      Math.sin(a * 3 + seedA) * wobbleR +
      Math.sin(a * 7 + seedB) * wobbleR * 0.5;

    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = Math.sin(a * 2 + seedC) * wobbleH + 
              Math.sin(a * 5 + seedA) * wobbleH * 0.5 +
              Math.cos(a * 3.5 + seedB) * wobbleH * 0.35 +
              Math.sin(a * 8 + seedC * 0.7) * wobbleH * 0.2;

    points.push({ x, y, z });
  }

  const samples: TrackSample[] = [];
  let lengthAcc = 0;
  const segLengths: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const d = Math.sqrt(v3LenSq(v3Sub(p1, p0)));
    segLengths.push(d);
    lengthAcc += d;
  }

  let sAcc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    const prev = points[(i - 1 + points.length) % points.length];

    const t = v3Normalize(v3Sub(next, prev));
    const left = v3Normalize({ x: -t.z, y: 0, z: t.x });

    const s = sAcc / lengthAcc;
    sAcc += segLengths[i];

    samples.push({ p, t, left, s });
  }

  const roadWidth = randRange(rng, 15, 19);

  const checkpointCount = 28;
  const checkpoints: Checkpoint[] = [];
  for (let i = 0; i < checkpointCount; i++) {
    const t = i / checkpointCount;
    const idx = Math.floor(t * samples.length) % samples.length;
    const s = samples[idx].s;
    checkpoints.push({ index: i, s, p: samples[idx].p, radius: 9.5 });
  }

  const boostPads: BoostPad[] = [];
  const boostCount = 12;
  for (let i = 0; i < boostCount; i++) {
    const t = (i + 0.5) / boostCount;
    const idx = Math.floor(t * samples.length) % samples.length;
    const p = samples[idx].p;
    boostPads.push({ p: v3(p.x, p.y + 0.18, p.z), radius: 7.2, impulse: 20, lift: 6.5 });
  }

  const getSurfaceInfo = (x: number, z: number): SurfaceInfo => {
    const { i, d } = computeNearestSample(samples, x, z);
    const center = samples[i];
    const distToCenter = d;
    const onRoad = distToCenter <= roadWidth * 0.5;

    const offH = terrainHeight(seedA, seedB, x, z);
    const roadH = center.p.y + lerp(-0.4, 0.4, Math.sin(center.s * Math.PI * 2) * 0.5 + 0.5);

    return {
      height: onRoad ? roadH : offH,
      onRoad,
      s: center.s,
      t: center.t,
      distToCenter,
    };
  };

  const start = samples[0];

  const getCheckpointSpawn = (cpIndex: number): { p: Vec3; yaw: number } => {
    const cp = checkpoints[cpIndex % checkpoints.length];
    const { i } = computeNearestSample(samples, cp.p.x, cp.p.z);
    const smp = samples[i];
    const yaw = Math.atan2(smp.t.z, smp.t.x);
    const offset = smp.left;
    const side = ((cpIndex % 4) - 1.5) * 2.4;
    return {
      p: v3(smp.p.x + offset.x * side, smp.p.y + 1.2, smp.p.z + offset.z * side),
      yaw,
    };
  };

  return {
    seed,
    samples,
    checkpoints,
    boostPads,
    roadWidth,
    start,
    getSurfaceInfo,
    getCheckpointSpawn,
  };
}
