import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Cross, v3Dot, v3Normalize, v3Scale, v3Sub } from "./vec3";

export type TerrainConfig = {
  seed: number;
  size: number;
  resolution: number;
  maxHeight: number;
  minHeight: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  ridgeStrength: number;
  valleyStrength: number;
};

export type TerrainSample = {
  height: number;
  normal: Vec3;
  gradient: Vec3;
  slope: number;
};

export class TerrainSystem {
  private config: TerrainConfig;
  private heightCache: Map<string, number>;
  private normalCache: Map<string, Vec3>;
  private noiseSeeds: Float64Array;
  private ridgeSeeds: Float64Array;
  private valleySeeds: Float64Array;

  constructor(config: TerrainConfig) {
    this.config = config;
    this.heightCache = new Map();
    this.normalCache = new Map();
    this.noiseSeeds = new Float64Array(config.octaves * 3);
    this.ridgeSeeds = new Float64Array(6);
    this.valleySeeds = new Float64Array(6);

    this.initializeSeeds();
  }

  private initializeSeeds(): void {
    const seed = this.config.seed;
    
    for (let i = 0; i < this.noiseSeeds.length; i++) {
      this.noiseSeeds[i] = this.seededRandom(seed + i * 1000);
    }
    
    for (let i = 0; i < this.ridgeSeeds.length; i++) {
      this.ridgeSeeds[i] = this.seededRandom(seed + 5000 + i * 500);
    }
    
    for (let i = 0; i < this.valleySeeds.length; i++) {
      this.valleySeeds[i] = this.seededRandom(seed + 8000 + i * 500);
    }
  }

  private seededRandom(s: number): number {
    const x = Math.sin(s * 12.9898 + s * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * Math.PI * 2;
  }

  public getHeight(x: number, z: number): number {
    const key = `${Math.floor(x * 100)}:${Math.floor(z * 100)}`;
    
    if (this.heightCache.has(key)) {
      return this.heightCache.get(key)!;
    }

    const height = this.calculateHeight(x, z);
    
    if (this.heightCache.size < 50000) {
      this.heightCache.set(key, height);
    }

    return height;
  }

  private calculateHeight(x: number, z: number): number {
    let height = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    const baseScale = 0.008;

    for (let octave = 0; octave < this.config.octaves; octave++) {
      const seedIndex = octave * 3;
      const sx = x * baseScale * frequency;
      const sz = z * baseScale * frequency;

      const n1 = Math.sin(sx + this.noiseSeeds[seedIndex]) * Math.cos(sz + this.noiseSeeds[seedIndex + 1]);
      const n2 = Math.cos(sx * 1.3 + sz * 0.7 + this.noiseSeeds[seedIndex + 2]);
      const n3 = Math.sin(sx * 0.7 - sz * 1.3 + this.noiseSeeds[seedIndex]);
      
      const noiseValue = (n1 + n2 * 0.5 + n3 * 0.3) / 1.8;
      
      height += noiseValue * amplitude;
      maxValue += amplitude;

      amplitude *= this.config.persistence;
      frequency *= this.config.lacunarity;
    }

    height = (height / maxValue) * this.config.maxHeight;

    const ridgeComponent = this.calculateRidges(x, z);
    const valleyComponent = this.calculateValleys(x, z);

    height += ridgeComponent * this.config.ridgeStrength;
    height -= valleyComponent * this.config.valleyStrength;

    return Math.max(this.config.minHeight, Math.min(this.config.maxHeight, height));
  }

  private calculateRidges(x: number, z: number): number {
    const scale = 0.006;
    const sx = x * scale;
    const sz = z * scale;

    const r1 = Math.abs(Math.sin(sx + this.ridgeSeeds[0]) * Math.cos(sz + this.ridgeSeeds[1]));
    const r2 = Math.abs(Math.sin(sx * 1.5 + this.ridgeSeeds[2]) + Math.cos(sz * 1.5 + this.ridgeSeeds[3])) * 0.5;
    const r3 = Math.abs(Math.cos(sx * 0.8 - sz * 0.8 + this.ridgeSeeds[4])) * 0.3;

    const ridge = 1.0 - (r1 + r2 + r3) / 1.8;
    return Math.pow(ridge, 2.5) * 8.0;
  }

  private calculateValleys(x: number, z: number): number {
    const scale = 0.005;
    const sx = x * scale;
    const sz = z * scale;

    const v1 = Math.sin(sx + this.valleySeeds[0]) * Math.cos(sz + this.valleySeeds[1]);
    const v2 = Math.sin((sx + sz) * 1.2 + this.valleySeeds[2]) * 0.6;
    const v3 = Math.cos((sx - sz) * 0.9 + this.valleySeeds[3]) * 0.4;

    const valley = (v1 + v2 + v3) / 2.0;
    return Math.max(0, valley) * 5.0;
  }

  public getNormal(x: number, z: number): Vec3 {
    const key = `${Math.floor(x * 50)}:${Math.floor(z * 50)}`;
    
    if (this.normalCache.has(key)) {
      return this.normalCache.get(key)!;
    }

    const normal = this.calculateNormal(x, z);
    
    if (this.normalCache.size < 30000) {
      this.normalCache.set(key, normal);
    }

    return normal;
  }

  private calculateNormal(x: number, z: number): Vec3 {
    const epsilon = 0.5;
    
    const h = this.getHeight(x, z);
    const hx = this.getHeight(x + epsilon, z);
    const hz = this.getHeight(x, z + epsilon);

    const dx = v3(epsilon, hx - h, 0);
    const dz = v3(0, hz - h, epsilon);

    const normal = v3Cross(dz, dx);
    return v3Normalize(normal);
  }

  public getGradient(x: number, z: number): Vec3 {
    const epsilon = 0.5;
    
    const h = this.getHeight(x, z);
    const hx = this.getHeight(x + epsilon, z);
    const hz = this.getHeight(x, z + epsilon);

    const dx = (hx - h) / epsilon;
    const dz = (hz - h) / epsilon;

    return v3(dx, 0, dz);
  }

  public getSlope(x: number, z: number): number {
    const gradient = this.getGradient(x, z);
    return Math.sqrt(gradient.x * gradient.x + gradient.z * gradient.z);
  }

  public getSample(x: number, z: number): TerrainSample {
    return {
      height: this.getHeight(x, z),
      normal: this.getNormal(x, z),
      gradient: this.getGradient(x, z),
      slope: this.getSlope(x, z),
    };
  }

  public clearCache(): void {
    this.heightCache.clear();
    this.normalCache.clear();
  }

  public getCacheSize(): number {
    return this.heightCache.size + this.normalCache.size;
  }
}

export function createDefaultTerrainConfig(seed: number): TerrainConfig {
  return {
    seed,
    size: 1200,
    resolution: 150,
    maxHeight: 25,
    minHeight: -2,
    octaves: 6,
    persistence: 0.52,
    lacunarity: 2.15,
    ridgeStrength: 1.2,
    valleyStrength: 0.8,
  };
}
