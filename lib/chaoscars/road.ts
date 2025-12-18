import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Cross, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from "./vec3";
import type { TerrainSystem } from "./terrain";

export type RoadSplinePoint = {
  position: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
  curvature: number;
  s: number;
};

export type RoadSegment = {
  center: Vec3;
  left: Vec3;
  right: Vec3;
  tangent: Vec3;
  normal: Vec3;
  width: number;
  s: number;
};

export type RoadConfig = {
  baseRadius: number;
  radiusVariation: number;
  heightVariation: number;
  width: number;
  segmentCount: number;
  smoothness: number;
  bankingFactor: number;
  elevationBlend: number;
};

export class RoadSystem {
  private config: RoadConfig;
  private terrain: TerrainSystem | null;
  private splinePoints: RoadSplinePoint[];
  private segments: RoadSegment[];
  private totalLength: number;

  constructor(config: RoadConfig, terrain: TerrainSystem | null = null) {
    this.config = config;
    this.terrain = terrain;
    this.splinePoints = [];
    this.segments = [];
    this.totalLength = 0;
    this.generateRoadPath();
    this.computeSegments();
  }

  public getSegments(): RoadSegment[] {
    return this.segments;
  }

  public getSplinePoints(): RoadSplinePoint[] {
    return this.splinePoints;
  }

  public getTotalLength(): number {
    return this.totalLength;
  }

  public getNearestSegment(x: number, z: number): { segment: RoadSegment; distance: number; index: number } {
    let minDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = seg.center.x - x;
      const dz = seg.center.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }

    return {
      segment: this.segments[bestIndex],
      distance: minDist,
      index: bestIndex,
    };
  }

  public getHeightAtPosition(x: number, z: number): number {
    const nearest = this.getNearestSegment(x, z);
    
    if (nearest.distance > this.config.width * 0.5) {
      return this.terrain ? this.terrain.getHeight(x, z) : 0;
    }

    const seg = nearest.segment;
    const nextIndex = (nearest.index + 1) % this.segments.length;
    const prevIndex = (nearest.index - 1 + this.segments.length) % this.segments.length;
    
    const prev = this.segments[prevIndex];
    const next = this.segments[nextIndex];

    const toPoint = { x: x - seg.center.x, y: 0, z: z - seg.center.z };
    const distAlong = v3Dot(toPoint, seg.tangent);
    
    let blendedHeight = seg.center.y;
    
    if (distAlong < 0) {
      const t = Math.max(0, 1 + distAlong / 5);
      blendedHeight = this.lerp(prev.center.y, seg.center.y, t);
    } else if (distAlong > 0) {
      const t = Math.min(1, distAlong / 5);
      blendedHeight = this.lerp(seg.center.y, next.center.y, t);
    }

    const offsetFromCenter = nearest.distance;
    const bankingAngle = seg.normal.x * this.config.bankingFactor;
    const bankingOffset = Math.sin(bankingAngle) * offsetFromCenter * 0.1;

    return blendedHeight + bankingOffset;
  }

  public isOnRoad(x: number, z: number): boolean {
    const nearest = this.getNearestSegment(x, z);
    return nearest.distance <= this.config.width * 0.5;
  }

  private generateRoadPath(): void {
    const pointCount = this.config.segmentCount;
    const controlPoints: Vec3[] = [];

    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      
      const radiusNoise = 
        Math.sin(angle * 3.0 + 1.234) * 0.4 +
        Math.sin(angle * 7.0 + 2.345) * 0.2 +
        Math.cos(angle * 5.0 + 3.456) * 0.25;
      
      const radius = this.config.baseRadius + radiusNoise * this.config.radiusVariation;

      const heightNoise =
        Math.sin(angle * 2.0 + 4.567) * 0.5 +
        Math.sin(angle * 5.0 + 5.678) * 0.3 +
        Math.cos(angle * 3.5 + 6.789) * 0.2;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = heightNoise * this.config.heightVariation;

      controlPoints.push({ x, y, z });
    }

    const interpolatedPoints = this.interpolateSpline(controlPoints, this.config.smoothness);
    this.splinePoints = this.computeSplineData(interpolatedPoints);
  }

  private interpolateSpline(controlPoints: Vec3[], subdivisions: number): Vec3[] {
    const result: Vec3[] = [];

    for (let i = 0; i < controlPoints.length; i++) {
      const p0 = controlPoints[(i - 1 + controlPoints.length) % controlPoints.length];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % controlPoints.length];
      const p3 = controlPoints[(i + 2) % controlPoints.length];

      for (let j = 0; j < subdivisions; j++) {
        const t = j / subdivisions;
        const point = this.catmullRomSpline(p0, p1, p2, p3, t);
        result.push(point);
      }
    }

    return result;
  }

  private catmullRomSpline(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0 = -0.5 * t3 + 1.0 * t2 - 0.5 * t;
    const v1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const v2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const v3 = 0.5 * t3 - 0.5 * t2;

    return {
      x: p0.x * v0 + p1.x * v1 + p2.x * v2 + p3.x * v3,
      y: p0.y * v0 + p1.y * v1 + p2.y * v2 + p3.y * v3,
      z: p0.z * v0 + p1.z * v1 + p2.z * v2 + p3.z * v3,
    };
  }

  private computeSplineData(points: Vec3[]): RoadSplinePoint[] {
    const result: RoadSplinePoint[] = [];
    let lengthAcc = 0;
    const segmentLengths: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % points.length];
      const len = v3Len(v3Sub(p1, p0));
      segmentLengths.push(len);
      lengthAcc += len;
    }

    this.totalLength = lengthAcc;
    let sAcc = 0;

    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];

      const tangent = v3Normalize(v3Sub(next, prev));
      
      const toNext = v3Sub(next, curr);
      const toPrev = v3Sub(prev, curr);
      const curvatureVec = v3Add(v3Normalize(toNext), v3Normalize(toPrev));
      const curvature = v3Len(curvatureVec);

      const upHint = { x: 0, y: 1, z: 0 };
      const binormal = v3Normalize(v3Cross(tangent, upHint));
      const normal = v3Normalize(v3Cross(binormal, tangent));

      const s = sAcc / lengthAcc;
      sAcc += segmentLengths[i];

      result.push({
        position: curr,
        tangent,
        normal,
        binormal,
        curvature,
        s,
      });
    }

    return result;
  }

  private computeSegments(): void {
    this.segments = [];

    for (const spline of this.splinePoints) {
      let centerY = spline.position.y;

      if (this.terrain) {
        const terrainHeight = this.terrain.getHeight(spline.position.x, spline.position.z);
        centerY = this.lerp(spline.position.y, terrainHeight, this.config.elevationBlend) + 0.25;
      }

      const center = {
        x: spline.position.x,
        y: centerY,
        z: spline.position.z,
      };

      const halfWidth = this.config.width * 0.5;
      const left = v3Add(center, v3Scale(spline.binormal, halfWidth));
      const right = v3Add(center, v3Scale(spline.binormal, -halfWidth));

      this.segments.push({
        center,
        left,
        right,
        tangent: spline.tangent,
        normal: spline.normal,
        width: this.config.width,
        s: spline.s,
      });
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

export function createDefaultRoadConfig(seed: number): RoadConfig {
  const seedHash = Math.abs(Math.floor(seed * 9999999)) % 9999999;
  const rng = () => {
    const x = Math.sin(seedHash * 9999.123) * 10000;
    return x - Math.floor(x);
  };

  return {
    baseRadius: 140 + rng() * 30,
    radiusVariation: 20 + rng() * 10,
    heightVariation: 15 + rng() * 8,
    width: 16 + rng() * 3,
    segmentCount: 800,
    smoothness: 4,
    bankingFactor: 0.15,
    elevationBlend: 0.65,
  };
}

export type RoadMeshData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

export function generateRoadMesh(road: RoadSystem): RoadMeshData {
  const segments = road.getSegments();
  const vertCount = segments.length * 2;
  
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextIdx = (i + 1) % segments.length;
    const next = segments[nextIdx];

    const dx = next.center.x - seg.center.x;
    const dy = next.center.y - seg.center.y;
    const dz = next.center.z - seg.center.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    const slopeX = -dy * seg.tangent.z / len;
    const slopeY = Math.sqrt(dx * dx + dz * dz) / len;
    const slopeZ = dy * seg.tangent.x / len;
    const slopeLen = Math.sqrt(slopeX * slopeX + slopeY * slopeY + slopeZ * slopeZ) || 1;

    const nx = slopeX / slopeLen;
    const ny = slopeY / slopeLen;
    const nz = slopeZ / slopeLen;

    const leftIdx = i * 2;
    const rightIdx = i * 2 + 1;

    positions[leftIdx * 3 + 0] = seg.left.x;
    positions[leftIdx * 3 + 1] = seg.left.y;
    positions[leftIdx * 3 + 2] = seg.left.z;

    positions[rightIdx * 3 + 0] = seg.right.x;
    positions[rightIdx * 3 + 1] = seg.right.y;
    positions[rightIdx * 3 + 2] = seg.right.z;

    normals[leftIdx * 3 + 0] = nx;
    normals[leftIdx * 3 + 1] = ny;
    normals[leftIdx * 3 + 2] = nz;

    normals[rightIdx * 3 + 0] = nx;
    normals[rightIdx * 3 + 1] = ny;
    normals[rightIdx * 3 + 2] = nz;

    uvs[leftIdx * 2 + 0] = 0;
    uvs[leftIdx * 2 + 1] = seg.s * 10;

    uvs[rightIdx * 2 + 0] = 1;
    uvs[rightIdx * 2 + 1] = seg.s * 10;
  }

  const faceCount = segments.length * 2;
  const indices = new Uint32Array(faceCount * 3);

  for (let i = 0; i < segments.length; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const nextBase = ((i + 1) % segments.length) * 2;
    const i2 = nextBase;
    const i3 = nextBase + 1;

    indices[i * 6 + 0] = i0;
    indices[i * 6 + 1] = i2;
    indices[i * 6 + 2] = i1;

    indices[i * 6 + 3] = i1;
    indices[i * 6 + 4] = i2;
    indices[i * 6 + 5] = i3;
  }

  return { positions, normals, uvs, indices };
}
