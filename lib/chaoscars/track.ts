import { hashStringToSeed, mulberry32, randRange } from "./random";
import type { Vec3 } from "./vec3";
import { v3, v3LenSq, v3Normalize, v3Sub } from "./vec3";
import { TerrainSystem, createDefaultTerrainConfig } from "./terrain";
import { RoadSystem, createDefaultRoadConfig } from "./road";
import type { RoadPoint } from "./road";

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
  terrain: TerrainSystem;
  road: RoadSystem;
  getSurfaceInfo: (x: number, z: number) => SurfaceInfo;
  getCheckpointSpawn: (cpIndex: number) => { p: Vec3; yaw: number };
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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

function roadPointToTrackSample(rp: RoadPoint): TrackSample {
  return {
    p: rp.position,
    t: rp.tangent,
    left: rp.binormal,
    s: rp.s,
  };
}

export function createTrack(seed: string): Track {
  const seedNum = hashStringToSeed(seed);
  const rng = mulberry32(seedNum);

  const terrainConfig = createDefaultTerrainConfig(seedNum);
  const terrain = new TerrainSystem(terrainConfig);

  const baseR = randRange(rng, 135, 165);
  const wobbleR = randRange(rng, 18, 28);
  const wobbleH = randRange(rng, 12, 22);

  const seedA = randRange(rng, 0, Math.PI * 2);
  const seedB = randRange(rng, 0, Math.PI * 2);
  const seedC = randRange(rng, 0, Math.PI * 2);

  const controlPointCount = 16;
  const controlPoints: Vec3[] = [];

  for (let i = 0; i < controlPointCount; i++) {
    const a = (i / controlPointCount) * Math.PI * 2;
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

    controlPoints.push(v3(x, y, z));
  }

  const roadConfig = createDefaultRoadConfig();
  roadConfig.width = randRange(rng, 15, 19);
  
  const road = new RoadSystem(roadConfig, terrain, controlPoints);

  const roadPoints = road.getRoadPoints();
  const samples: TrackSample[] = roadPoints.map(roadPointToTrackSample);

  const roadWidth = roadConfig.width;

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
    const onRoad = road.isOnRoad(x, z);
    const nearest = road.getNearestPoint(x, z);
    
    let height: number;
    if (onRoad) {
      height = nearest.point.position.y;
    } else {
      height = terrain.getHeight(x, z);
    }

    return {
      height,
      onRoad,
      s: nearest.point.s,
      t: nearest.point.tangent,
      distToCenter: nearest.distance,
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
    terrain,
    road,
    getSurfaceInfo,
    getCheckpointSpawn,
  };
}
