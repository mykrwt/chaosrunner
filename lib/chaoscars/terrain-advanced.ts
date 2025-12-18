import type { Vec3 } from "./vec3";
import { v3Normalize } from "./vec3";

export type BiomeConfig = {
  frequency: number;
  amplitude: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
  warpStrength: number;
};

export type ErosionConfig = {
  iterations: number;
  strength: number;
  depositionRate: number;
  evaporationRate: number;
  minSlope: number;
  maxSlope: number;
};

export class AdvancedTerrainGenerator {
  private seed: number;
  private permutation: Uint8Array;
  private gradients: Float32Array;

  constructor(seed: number) {
    this.seed = seed;
    this.permutation = new Uint8Array(512);
    this.gradients = new Float32Array(512 * 2);
    this.initializePermutation();
    this.initializeGradients();
  }

  private initializePermutation(): void {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    let s = this.seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i % 256];
    }
  }

  private initializeGradients(): void {
    let s = this.seed;
    for (let i = 0; i < 256; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const angle = (s / 0x7fffffff) * Math.PI * 2;
      this.gradients[i * 2] = Math.cos(angle);
      this.gradients[i * 2 + 1] = Math.sin(angle);
    }
    for (let i = 256; i < 512; i++) {
      this.gradients[i * 2] = this.gradients[(i - 256) * 2];
      this.gradients[i * 2 + 1] = this.gradients[(i - 256) * 2 + 1];
    }
  }

  public generateBiome(x: number, z: number, config: BiomeConfig): number {
    let value = 0;
    let amplitude = config.amplitude;
    let frequency = config.frequency;
    let maxValue = 0;

    for (let octave = 0; octave < config.octaves; octave++) {
      const sampleX = x * frequency;
      const sampleZ = z * frequency;

      let noiseValue = this.improvedPerlin(sampleX, sampleZ);

      if (config.warpStrength > 0) {
        const warpX = this.improvedPerlin(sampleX + 100, sampleZ) * config.warpStrength;
        const warpZ = this.improvedPerlin(sampleX, sampleZ + 100) * config.warpStrength;
        noiseValue = this.improvedPerlin(sampleX + warpX, sampleZ + warpZ);
      }

      value += noiseValue * amplitude;
      maxValue += amplitude;

      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    return value / maxValue;
  }

  private improvedPerlin(x: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(z);

    const a = this.permutation[X] + Z;
    const b = this.permutation[X + 1] + Z;

    const aa = this.permutation[a];
    const ab = this.permutation[a + 1];
    const ba = this.permutation[b];
    const bb = this.permutation[b + 1];

    const g1x = this.gradients[aa * 2];
    const g1z = this.gradients[aa * 2 + 1];
    const g2x = this.gradients[ba * 2];
    const g2z = this.gradients[ba * 2 + 1];
    const g3x = this.gradients[ab * 2];
    const g3z = this.gradients[ab * 2 + 1];
    const g4x = this.gradients[bb * 2];
    const g4z = this.gradients[bb * 2 + 1];

    const d1 = g1x * x + g1z * z;
    const d2 = g2x * (x - 1) + g2z * z;
    const d3 = g3x * x + g3z * (z - 1);
    const d4 = g4x * (x - 1) + g4z * (z - 1);

    const x1 = this.lerp(d1, d2, u);
    const x2 = this.lerp(d3, d4, u);

    return this.lerp(x1, x2, v);
  }

  public generateRidgedMultifractal(x: number, z: number, config: BiomeConfig): number {
    let value = 0;
    let amplitude = config.amplitude;
    let frequency = config.frequency;
    let weight = 1.0;

    for (let octave = 0; octave < config.octaves; octave++) {
      let signal = this.improvedPerlin(x * frequency, z * frequency);
      signal = Math.abs(signal);
      signal = 1.0 - signal;
      signal *= signal;
      signal *= weight;

      weight = signal * 2.0;
      weight = Math.max(0, Math.min(1, weight));

      value += signal * amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    return value;
  }

  public generateVoronoiNoise(x: number, z: number, scale: number, jitter: number): number {
    const cellX = Math.floor(x * scale);
    const cellZ = Math.floor(z * scale);

    let minDist = Infinity;

    for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const neighborX = cellX + offsetX;
        const neighborZ = cellZ + offsetZ;

        const hash = this.hash2D(neighborX, neighborZ);
        const pointX = neighborX + (((hash & 0xff) / 255) - 0.5) * jitter;
        const pointZ = neighborZ + (((hash >> 8) & 0xff) / 255 - 0.5) * jitter;

        const dx = x * scale - pointX;
        const dz = z * scale - pointZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        minDist = Math.min(minDist, dist);
      }
    }

    return minDist;
  }

  public generateTerraces(height: number, terraceCount: number, sharpness: number): number {
    const terraceHeight = 1.0 / terraceCount;
    const t = height / terraceHeight;
    const terraceIndex = Math.floor(t);
    const terraceRemainder = t - terraceIndex;

    const smoothed = Math.pow(terraceRemainder, sharpness);
    return (terraceIndex + smoothed) * terraceHeight;
  }

  private hash2D(x: number, y: number): number {
    const h = (x * 374761393 + y * 668265263) ^ (this.seed * 1103515245);
    return ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
}

export class HydraulicErosionSimulator {
  private heightMap: Float32Array;
  private width: number;
  private height: number;

  constructor(heightMap: Float32Array, width: number, height: number) {
    this.heightMap = new Float32Array(heightMap);
    this.width = width;
    this.height = height;
  }

  public erode(config: ErosionConfig): Float32Array {
    const result = new Float32Array(this.heightMap);

    for (let iter = 0; iter < config.iterations; iter++) {
      const x = Math.floor(Math.random() * this.width);
      const z = Math.floor(Math.random() * this.height);

      this.simulateDroplet(result, x, z, config);
    }

    return result;
  }

  private simulateDroplet(
    heightMap: Float32Array,
    startX: number,
    startZ: number,
    config: ErosionConfig
  ): void {
    let x = startX;
    let z = startZ;
    let velX = 0;
    let velZ = 0;
    let water = 1.0;
    let sediment = 0;
    let speed = 0;

    const maxSteps = 50;

    for (let step = 0; step < maxSteps; step++) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);

      if (ix < 0 || ix >= this.width - 1 || iz < 0 || iz >= this.height - 1) {
        break;
      }

      const fx = x - ix;
      const fz = z - iz;

      const h00 = heightMap[iz * this.width + ix];
      const h10 = heightMap[iz * this.width + (ix + 1)];
      const h01 = heightMap[(iz + 1) * this.width + ix];
      const h11 = heightMap[(iz + 1) * this.width + (ix + 1)];

      const currentHeight = this.bilinearInterpolate(h00, h10, h01, h11, fx, fz);

      const gradX = (h10 - h00) * (1 - fz) + (h11 - h01) * fz;
      const gradZ = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;

      velX = velX * 0.9 - gradX;
      velZ = velZ * 0.9 - gradZ;

      const velLen = Math.sqrt(velX * velX + velZ * velZ);
      if (velLen !== 0) {
        velX /= velLen;
        velZ /= velLen;
      }

      x += velX;
      z += velZ;

      if (x < 0 || x >= this.width - 1 || z < 0 || z >= this.height - 1) {
        break;
      }

      const newIX = Math.floor(x);
      const newIZ = Math.floor(z);
      const newFX = x - newIX;
      const newFZ = z - newIZ;

      const nh00 = heightMap[newIZ * this.width + newIX];
      const nh10 = heightMap[newIZ * this.width + (newIX + 1)];
      const nh01 = heightMap[(newIZ + 1) * this.width + newIX];
      const nh11 = heightMap[(newIZ + 1) * this.width + (newIX + 1)];

      const newHeight = this.bilinearInterpolate(nh00, nh10, nh01, nh11, newFX, newFZ);

      const deltaHeight = newHeight - currentHeight;

      const capacity = Math.max(-deltaHeight, config.minSlope) * speed * water;

      if (sediment > capacity || deltaHeight > 0) {
        const deposit = (deltaHeight > 0) 
          ? Math.min(deltaHeight, sediment) 
          : (sediment - capacity) * config.depositionRate;

        sediment -= deposit;

        this.depositSediment(heightMap, newIX, newIZ, newFX, newFZ, deposit);
      } else {
        const erosion = Math.min((capacity - sediment) * config.strength, -deltaHeight);
        this.erodeTerrain(heightMap, newIX, newIZ, newFX, newFZ, erosion);
        sediment += erosion;
      }

      speed = Math.sqrt(speed * speed + deltaHeight * 9.8);
      water *= (1 - config.evaporationRate);

      if (water < 0.01) {
        break;
      }
    }
  }

  private bilinearInterpolate(
    v00: number,
    v10: number,
    v01: number,
    v11: number,
    fx: number,
    fz: number
  ): number {
    const v0 = v00 * (1 - fx) + v10 * fx;
    const v1 = v01 * (1 - fx) + v11 * fx;
    return v0 * (1 - fz) + v1 * fz;
  }

  private depositSediment(
    heightMap: Float32Array,
    ix: number,
    iz: number,
    fx: number,
    fz: number,
    amount: number
  ): void {
    heightMap[iz * this.width + ix] += amount * (1 - fx) * (1 - fz);
    heightMap[iz * this.width + (ix + 1)] += amount * fx * (1 - fz);
    heightMap[(iz + 1) * this.width + ix] += amount * (1 - fx) * fz;
    heightMap[(iz + 1) * this.width + (ix + 1)] += amount * fx * fz;
  }

  private erodeTerrain(
    heightMap: Float32Array,
    ix: number,
    iz: number,
    fx: number,
    fz: number,
    amount: number
  ): void {
    heightMap[iz * this.width + ix] -= amount * (1 - fx) * (1 - fz);
    heightMap[iz * this.width + (ix + 1)] -= amount * fx * (1 - fz);
    heightMap[(iz + 1) * this.width + ix] -= amount * (1 - fx) * fz;
    heightMap[(iz + 1) * this.width + (ix + 1)] -= amount * fx * fz;
  }

  public getHeightMap(): Float32Array {
    return new Float32Array(this.heightMap);
  }
}

export class TerrainFeatureGenerator {
  private generator: AdvancedTerrainGenerator;

  constructor(seed: number) {
    this.generator = new AdvancedTerrainGenerator(seed);
  }

  public generateMountainRanges(
    x: number,
    z: number,
    scale: number,
    height: number,
    rangeCount: number
  ): number {
    let value = 0;

    for (let i = 0; i < rangeCount; i++) {
      const config: BiomeConfig = {
        frequency: scale * (1 + i * 0.5),
        amplitude: height / (i + 1),
        octaves: 6,
        lacunarity: 2.2,
        persistence: 0.5,
        warpStrength: 0.3,
      };

      const range = this.generator.generateRidgedMultifractal(
        x + i * 100,
        z + i * 100,
        config
      );

      value += range;
    }

    return value / rangeCount;
  }

  public generateRollingHills(x: number, z: number, scale: number, height: number): number {
    const config: BiomeConfig = {
      frequency: scale,
      amplitude: height,
      octaves: 4,
      lacunarity: 2.0,
      persistence: 0.6,
      warpStrength: 0.2,
    };

    return this.generator.generateBiome(x, z, config);
  }

  public generateCanyons(x: number, z: number, scale: number, depth: number): number {
    const voronoi = this.generator.generateVoronoiNoise(x, z, scale, 0.8);
    const canyonMask = Math.max(0, 1 - voronoi * 2);
    return -canyonMask * depth;
  }

  public generatePlateaus(
    x: number,
    z: number,
    scale: number,
    height: number,
    terraceCount: number
  ): number {
    const config: BiomeConfig = {
      frequency: scale,
      amplitude: 1.0,
      octaves: 3,
      lacunarity: 2.0,
      persistence: 0.5,
      warpStrength: 0,
    };

    const baseHeight = this.generator.generateBiome(x, z, config);
    const normalized = (baseHeight + 1) * 0.5;
    const terraced = this.generator.generateTerraces(normalized, terraceCount, 2.5);

    return terraced * height;
  }

  public blendFeatures(features: number[], weights: number[]): number {
    let totalWeight = 0;
    let value = 0;

    for (let i = 0; i < features.length; i++) {
      value += features[i] * weights[i];
      totalWeight += weights[i];
    }

    return totalWeight > 0 ? value / totalWeight : 0;
  }
}

export function smoothHeightMap(
  heightMap: Float32Array,
  width: number,
  height: number,
  kernelSize: number
): Float32Array {
  const result = new Float32Array(heightMap.length);
  const halfKernel = Math.floor(kernelSize / 2);

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let kz = -halfKernel; kz <= halfKernel; kz++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + kx));
          const sampleZ = Math.max(0, Math.min(height - 1, z + kz));

          sum += heightMap[sampleZ * width + sampleX];
          count++;
        }
      }

      result[z * width + x] = sum / count;
    }
  }

  return result;
}

export function computeTerrainNormals(
  heightMap: Float32Array,
  width: number,
  height: number,
  scale: number
): Float32Array {
  const normals = new Float32Array(width * height * 3);

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x;

      const hL = heightMap[z * width + Math.max(0, x - 1)];
      const hR = heightMap[z * width + Math.min(width - 1, x + 1)];
      const hD = heightMap[Math.max(0, z - 1) * width + x];
      const hU = heightMap[Math.min(height - 1, z + 1) * width + x];

      const normal = v3Normalize({
        x: (hL - hR) / (2 * scale),
        y: 2.0,
        z: (hD - hU) / (2 * scale),
      });

      normals[idx * 3] = normal.x;
      normals[idx * 3 + 1] = normal.y;
      normals[idx * 3 + 2] = normal.z;
    }
  }

  return normals;
}
