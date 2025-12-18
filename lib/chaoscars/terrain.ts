import type { Vec3 } from "./vec3";

export type TerrainConfig = {
  seed: number;
  size: number;
  resolution: number;
  baseHeight: number;
  hillAmplitude: number;
  detailScale: number;
  ridgeSharpness: number;
  valleyDepth: number;
};

export type TerrainSample = {
  height: number;
  normal: Vec3;
  slope: number;
  gradient: Vec3;
};

export class TerrainSystem {
  private config: TerrainConfig;
  private noiseSeeds: number[];
  private heightCache: Map<string, number>;
  private normalCache: Map<string, Vec3>;
  private biomeOffsets: { x: number; z: number }[];

  constructor(config: TerrainConfig) {
    this.config = config;
    this.heightCache = new Map();
    this.normalCache = new Map();
    
    const seedHash = Math.abs(Math.floor(config.seed * 9999999)) % 9999999;
    this.noiseSeeds = [
      seedHash,
      (seedHash * 1.7321 + 1000) % 9999999,
      (seedHash * 2.4142 + 2000) % 9999999,
      (seedHash * 3.1416 + 3000) % 9999999,
      (seedHash * 4.6692 + 4000) % 9999999,
      (seedHash * 5.8284 + 5000) % 9999999,
    ];

    this.biomeOffsets = [
      { x: seedHash * 0.123, z: seedHash * 0.456 },
      { x: seedHash * 0.789, z: seedHash * 0.234 },
      { x: seedHash * 0.567, z: seedHash * 0.891 },
    ];
  }

  public getHeight(x: number, z: number): number {
    const key = `${Math.floor(x * 100)}:${Math.floor(z * 100)}`;
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;

    const height = this.computeHeight(x, z);
    this.heightCache.set(key, height);
    return height;
  }

  public getNormal(x: number, z: number): Vec3 {
    const key = `${Math.floor(x * 100)}:${Math.floor(z * 100)}`;
    const cached = this.normalCache.get(key);
    if (cached !== undefined) return cached;

    const normal = this.computeNormal(x, z);
    this.normalCache.set(key, normal);
    return normal;
  }

  public getSample(x: number, z: number): TerrainSample {
    const height = this.getHeight(x, z);
    const normal = this.getNormal(x, z);
    
    const eps = 0.5;
    const hx1 = this.getHeight(x + eps, z);
    const hx0 = this.getHeight(x - eps, z);
    const hz1 = this.getHeight(x, z + eps);
    const hz0 = this.getHeight(x, z - eps);
    
    const gradient = {
      x: (hx1 - hx0) / (2 * eps),
      y: 0,
      z: (hz1 - hz0) / (2 * eps),
    };
    
    const slope = Math.sqrt(gradient.x * gradient.x + gradient.z * gradient.z);
    
    return { height, normal, slope, gradient };
  }

  public clearCache(): void {
    this.heightCache.clear();
    this.normalCache.clear();
  }

  private computeHeight(x: number, z: number): number {
    const baseNoise = this.multiOctaveNoise(x, z, 0.008, 6);
    const baseHeight = this.config.baseHeight + baseNoise * this.config.hillAmplitude;

    const ridgeNoise = this.ridgeNoise(x, z, 0.015, 4);
    const ridgeHeight = ridgeNoise * this.config.hillAmplitude * 0.6;

    const valleyNoise = this.valleyNoise(x, z, 0.012, 3);
    const valleyHeight = valleyNoise * this.config.valleyDepth;

    const detailNoise = this.multiOctaveNoise(x, z, 0.05, 3);
    const detailHeight = detailNoise * this.config.detailScale;

    const microDetail = this.perlinNoise(x * 0.2, z * 0.2, this.noiseSeeds[5]);
    const microHeight = microDetail * 0.3;

    return baseHeight + ridgeHeight + valleyHeight + detailHeight + microHeight;
  }

  private computeNormal(x: number, z: number): Vec3 {
    const eps = 0.25;
    const h0 = this.getHeight(x, z);
    const hx = this.getHeight(x + eps, z);
    const hz = this.getHeight(x, z + eps);

    const dx = { x: eps, y: hx - h0, z: 0 };
    const dz = { x: 0, y: hz - h0, z: eps };

    const nx = dx.y * dz.z - dx.z * dz.y;
    const ny = dx.z * dz.x - dx.x * dz.z;
    const nz = dx.x * dz.y - dx.y * dz.x;

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-6) return { x: 0, y: 1, z: 0 };

    return { x: nx / len, y: ny / len, z: nz / len };
  }

  private multiOctaveNoise(x: number, z: number, scale: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const sx = x * scale * frequency;
      const sz = z * scale * frequency;
      const sample = this.perlinNoise(sx, sz, this.noiseSeeds[i % this.noiseSeeds.length]);
      value += sample * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value / maxValue;
  }

  private ridgeNoise(x: number, z: number, scale: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const sx = x * scale * frequency;
      const sz = z * scale * frequency;
      let sample = Math.abs(this.perlinNoise(sx, sz, this.noiseSeeds[(i + 2) % this.noiseSeeds.length]));
      sample = 1.0 - sample;
      sample = Math.pow(sample, this.config.ridgeSharpness);
      value += sample * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value / maxValue;
  }

  private valleyNoise(x: number, z: number, scale: number, octaves: number): number {
    const offset = this.biomeOffsets[0];
    const n1 = this.multiOctaveNoise(x + offset.x, z + offset.z, scale, octaves);
    const offset2 = this.biomeOffsets[1];
    const n2 = this.multiOctaveNoise(x + offset2.x, z + offset2.z, scale * 1.3, octaves);
    
    const valley = n1 * n2;
    return valley * valley * Math.sign(valley);
  }

  private perlinNoise(x: number, z: number, seed: number): number {
    const X = Math.floor(x) & 255;
    const Z = Math.floor(z) & 255;
    
    x -= Math.floor(x);
    z -= Math.floor(z);
    
    const u = this.fade(x);
    const v = this.fade(z);
    
    const p = this.generatePermutation(seed);
    
    const a = p[X] + Z;
    const b = p[X + 1] + Z;
    
    const aa = p[a % 256];
    const ab = p[(a + 1) % 256];
    const ba = p[b % 256];
    const bb = p[(b + 1) % 256];
    
    const g1 = this.grad2(p[aa % 256], x, z);
    const g2 = this.grad2(p[ba % 256], x - 1, z);
    const g3 = this.grad2(p[ab % 256], x, z - 1);
    const g4 = this.grad2(p[bb % 256], x - 1, z - 1);
    
    const x1 = this.lerp(g1, g2, u);
    const x2 = this.lerp(g3, g4, u);
    
    return this.lerp(x1, x2, v);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad2(hash: number, x: number, z: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : z;
    const v = h < 2 ? z : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private generatePermutation(seed: number): number[] {
    const p = new Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    return [...p, ...p];
  }
}

export function createDefaultTerrainConfig(seed: number): TerrainConfig {
  return {
    seed,
    size: 1200,
    resolution: 150,
    baseHeight: 0,
    hillAmplitude: 8.5,
    detailScale: 2.0,
    ridgeSharpness: 2.2,
    valleyDepth: 6.5,
  };
}

export type TerrainMeshData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

export function generateTerrainMesh(terrain: TerrainSystem, config: TerrainConfig): TerrainMeshData {
  const size = config.size;
  const resolution = config.resolution;
  const halfSize = size / 2;
  
  const vertCount = (resolution + 1) * (resolution + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  let vertIndex = 0;
  for (let iz = 0; iz <= resolution; iz++) {
    for (let ix = 0; ix <= resolution; ix++) {
      const x = (ix / resolution) * size - halfSize;
      const z = (iz / resolution) * size - halfSize;

      const sample = terrain.getSample(x, z);

      positions[vertIndex * 3 + 0] = x;
      positions[vertIndex * 3 + 1] = sample.height;
      positions[vertIndex * 3 + 2] = z;

      normals[vertIndex * 3 + 0] = sample.normal.x;
      normals[vertIndex * 3 + 1] = sample.normal.y;
      normals[vertIndex * 3 + 2] = sample.normal.z;

      uvs[vertIndex * 2 + 0] = ix / resolution;
      uvs[vertIndex * 2 + 1] = iz / resolution;

      vertIndex++;
    }
  }

  const faceCount = resolution * resolution * 2;
  const indices = new Uint32Array(faceCount * 3);
  
  let faceIndex = 0;
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const i0 = iz * (resolution + 1) + ix;
      const i1 = i0 + 1;
      const i2 = i0 + (resolution + 1);
      const i3 = i2 + 1;

      indices[faceIndex * 3 + 0] = i0;
      indices[faceIndex * 3 + 1] = i2;
      indices[faceIndex * 3 + 2] = i1;
      faceIndex++;

      indices[faceIndex * 3 + 0] = i1;
      indices[faceIndex * 3 + 1] = i2;
      indices[faceIndex * 3 + 2] = i3;
      faceIndex++;
    }
  }

  return { positions, normals, uvs, indices };
}
