import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Copy, v3Dot, v3Len, v3LenSq, v3Lerp, v3Normalize, v3Scale, v3Sub } from "./vec3";
import type { TerrainSystem } from "./terrain";

export type RoadPoint = {
  position: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
  curvature: number;
  torsion: number;
  s: number;
};

export type RoadSegment = {
  start: RoadPoint;
  end: RoadPoint;
  length: number;
  leftEdge: Vec3[];
  rightEdge: Vec3[];
  centerline: Vec3[];
};

export type RoadConfig = {
  width: number;
  segments: number;
  smoothingIterations: number;
  elevationSmoothness: number;
  curvatureSmoothness: number;
  bankingFactor: number;
  heightOffset: number;
};

export class RoadSystem {
  private config: RoadConfig;
  private terrain: TerrainSystem;
  private spline: Vec3[];
  private roadPoints: RoadPoint[];
  private segments: RoadSegment[];
  private totalLength: number;

  constructor(config: RoadConfig, terrain: TerrainSystem, controlPoints: Vec3[]) {
    this.config = config;
    this.terrain = terrain;
    this.spline = [];
    this.roadPoints = [];
    this.segments = [];
    this.totalLength = 0;

    this.buildSpline(controlPoints);
    this.smoothSpline();
    this.alignToTerrain();
    this.calculateRoadGeometry();
    this.buildSegments();
  }

  private buildSpline(controlPoints: Vec3[]): void {
    if (controlPoints.length < 3) {
      throw new Error("Road requires at least 3 control points");
    }

    this.spline = [];
    const pointsPerSegment = Math.floor(this.config.segments / controlPoints.length);

    for (let i = 0; i < controlPoints.length; i++) {
      const p0 = controlPoints[(i - 1 + controlPoints.length) % controlPoints.length];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % controlPoints.length];
      const p3 = controlPoints[(i + 2) % controlPoints.length];

      for (let j = 0; j < pointsPerSegment; j++) {
        const t = j / pointsPerSegment;
        const point = this.catmullRomSpline(p0, p1, p2, p3, t);
        this.spline.push(point);
      }
    }

    if (this.spline.length === 0) {
      this.spline = controlPoints.slice();
    }
  }

  private catmullRomSpline(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0 = v3Scale(v3Sub(p2, p0), 0.5);
    const v1 = v3Scale(v3Sub(p3, p1), 0.5);

    const a = v3Scale(p1, 2);
    const b = v0;
    const c = v3Add(v3Add(v3Scale(p1, -5), v3Scale(p2, 4)), v3Add(v3Scale(v0, -3), v3Scale(v1, -1)));
    const d = v3Add(v3Add(v3Scale(p1, 3), v3Scale(p2, -3)), v3Add(v3Scale(v0, 2), v1));

    return v3Scale(
      v3Add(
        v3Add(a, v3Scale(b, t)),
        v3Add(v3Scale(c, t2), v3Scale(d, t3))
      ),
      0.5
    );
  }

  private smoothSpline(): void {
    for (let iteration = 0; iteration < this.config.smoothingIterations; iteration++) {
      const smoothed: Vec3[] = [];

      for (let i = 0; i < this.spline.length; i++) {
        const prev = this.spline[(i - 1 + this.spline.length) % this.spline.length];
        const curr = this.spline[i];
        const next = this.spline[(i + 1) % this.spline.length];

        const avgX = (prev.x + curr.x * 2 + next.x) * 0.25;
        const avgY = (prev.y + curr.y * 2 + next.y) * 0.25;
        const avgZ = (prev.z + curr.z * 2 + next.z) * 0.25;

        smoothed.push(v3(avgX, avgY, avgZ));
      }

      this.spline = smoothed;
    }
  }

  private alignToTerrain(): void {
    const aligned: Vec3[] = [];

    for (let i = 0; i < this.spline.length; i++) {
      const point = this.spline[i];
      const terrainHeight = this.terrain.getHeight(point.x, point.z);
      
      let targetHeight = terrainHeight + this.config.heightOffset;

      if (i > 0 && i < this.spline.length - 1) {
        const prevHeight = this.terrain.getHeight(this.spline[i - 1].x, this.spline[i - 1].z);
        const nextHeight = this.terrain.getHeight(this.spline[i + 1].x, this.spline[i + 1].z);
        targetHeight = (prevHeight + terrainHeight * 2 + nextHeight) * 0.25 + this.config.heightOffset;
      }

      const smoothedHeight = point.y * (1 - this.config.elevationSmoothness) + 
                             targetHeight * this.config.elevationSmoothness;

      aligned.push(v3(point.x, smoothedHeight, point.z));
    }

    this.spline = aligned;

    for (let smoothPass = 0; smoothPass < 3; smoothPass++) {
      const heightSmoothed: Vec3[] = [];

      for (let i = 0; i < this.spline.length; i++) {
        const prev = this.spline[(i - 1 + this.spline.length) % this.spline.length];
        const curr = this.spline[i];
        const next = this.spline[(i + 1) % this.spline.length];

        const smoothY = (prev.y + curr.y * 4 + next.y) / 6;

        heightSmoothed.push(v3(curr.x, smoothY, curr.z));
      }

      this.spline = heightSmoothed;
    }
  }

  private calculateRoadGeometry(): void {
    this.roadPoints = [];
    this.totalLength = 0;

    for (let i = 0; i < this.spline.length; i++) {
      const curr = this.spline[i];
      const prev = this.spline[(i - 1 + this.spline.length) % this.spline.length];
      const next = this.spline[(i + 1) % this.spline.length];
      const next2 = this.spline[(i + 2) % this.spline.length];

      const tangent = v3Normalize(v3Sub(next, prev));

      const terrainNormal = this.terrain.getNormal(curr.x, curr.z);
      
      let upVector = v3Copy(terrainNormal);
      
      const curvature = this.calculateCurvature(prev, curr, next);
      const bankAngle = curvature * this.config.bankingFactor;
      
      if (Math.abs(bankAngle) > 0.01) {
        const bankAxis = v3Copy(tangent);
        upVector = this.rotateVectorAroundAxis(upVector, bankAxis, bankAngle);
      }

      const binormal = v3Normalize(this.crossProduct(tangent, upVector));
      const normal = v3Normalize(this.crossProduct(binormal, tangent));

      const torsion = this.calculateTorsion(prev, curr, next, next2);

      const s = this.totalLength / Math.max(1, this.spline.length * 10);

      this.roadPoints.push({
        position: v3Copy(curr),
        tangent,
        normal,
        binormal,
        curvature,
        torsion,
        s,
      });

      if (i > 0) {
        this.totalLength += v3Len(v3Sub(curr, prev));
      }
    }

    let accumulatedLength = 0;
    for (let i = 0; i < this.roadPoints.length; i++) {
      if (i > 0) {
        accumulatedLength += v3Len(
          v3Sub(this.roadPoints[i].position, this.roadPoints[i - 1].position)
        );
      }
      this.roadPoints[i].s = this.totalLength > 0 ? accumulatedLength / this.totalLength : 0;
    }
  }

  private calculateCurvature(p0: Vec3, p1: Vec3, p2: Vec3): number {
    const v1 = v3Sub(p1, p0);
    const v2 = v3Sub(p2, p1);
    
    const len1 = v3Len(v1);
    const len2 = v3Len(v2);
    
    if (len1 < 0.001 || len2 < 0.001) return 0;

    const cross = this.crossProduct(v1, v2);
    const crossLen = v3Len(cross);
    
    const dot = v3Dot(v1, v2);
    const angle = Math.atan2(crossLen, dot);
    
    return angle / ((len1 + len2) * 0.5);
  }

  private calculateTorsion(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): number {
    const v1 = v3Sub(p1, p0);
    const v2 = v3Sub(p2, p1);
    const v3 = v3Sub(p3, p2);

    const b1 = this.crossProduct(v1, v2);
    const b2 = this.crossProduct(v2, v3);

    const len1 = v3Len(b1);
    const len2 = v3Len(b2);

    if (len1 < 0.001 || len2 < 0.001) return 0;

    const dot = v3Dot(b1, b2) / (len1 * len2);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    
    return Math.asin(Math.sqrt(Math.max(0, 1 - clampedDot * clampedDot)));
  }

  private crossProduct(a: Vec3, b: Vec3): Vec3 {
    return v3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  private rotateVectorAroundAxis(vector: Vec3, axis: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = v3Dot(axis, vector);

    const term1 = v3Scale(vector, cos);
    const term2 = v3Scale(this.crossProduct(axis, vector), sin);
    const term3 = v3Scale(axis, dot * (1 - cos));

    return v3Add(v3Add(term1, term2), term3);
  }

  private buildSegments(): void {
    this.segments = [];
    const halfWidth = this.config.width * 0.5;

    for (let i = 0; i < this.roadPoints.length; i++) {
      const start = this.roadPoints[i];
      const end = this.roadPoints[(i + 1) % this.roadPoints.length];

      const leftEdge: Vec3[] = [];
      const rightEdge: Vec3[] = [];
      const centerline: Vec3[] = [];

      const subsegments = 4;
      for (let j = 0; j <= subsegments; j++) {
        const t = j / subsegments;
        const interpPoint = v3Lerp(start.position, end.position, t);
        const interpBinormal = v3Normalize(v3Lerp(start.binormal, end.binormal, t));

        centerline.push(v3Copy(interpPoint));
        leftEdge.push(v3Add(interpPoint, v3Scale(interpBinormal, halfWidth)));
        rightEdge.push(v3Sub(interpPoint, v3Scale(interpBinormal, halfWidth)));
      }

      const segmentLength = v3Len(v3Sub(end.position, start.position));

      this.segments.push({
        start,
        end,
        length: segmentLength,
        leftEdge,
        rightEdge,
        centerline,
      });
    }
  }

  public getRoadPoints(): RoadPoint[] {
    return this.roadPoints;
  }

  public getSegments(): RoadSegment[] {
    return this.segments;
  }

  public getTotalLength(): number {
    return this.totalLength;
  }

  public getNearestPoint(x: number, z: number): { point: RoadPoint; distance: number; index: number } {
    let nearestIndex = 0;
    let nearestDistSq = Infinity;

    for (let i = 0; i < this.roadPoints.length; i++) {
      const p = this.roadPoints[i].position;
      const dx = p.x - x;
      const dz = p.z - z;
      const distSq = dx * dx + dz * dz;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestIndex = i;
      }
    }

    return {
      point: this.roadPoints[nearestIndex],
      distance: Math.sqrt(nearestDistSq),
      index: nearestIndex,
    };
  }

  public getPointAtDistance(distance: number): RoadPoint | null {
    if (this.roadPoints.length === 0) return null;

    const wrappedDist = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
    let accumulated = 0;

    for (let i = 0; i < this.roadPoints.length; i++) {
      const curr = this.roadPoints[i];
      const next = this.roadPoints[(i + 1) % this.roadPoints.length];
      const segLen = v3Len(v3Sub(next.position, curr.position));

      if (accumulated + segLen >= wrappedDist) {
        const t = (wrappedDist - accumulated) / segLen;
        
        return {
          position: v3Lerp(curr.position, next.position, t),
          tangent: v3Normalize(v3Lerp(curr.tangent, next.tangent, t)),
          normal: v3Normalize(v3Lerp(curr.normal, next.normal, t)),
          binormal: v3Normalize(v3Lerp(curr.binormal, next.binormal, t)),
          curvature: curr.curvature * (1 - t) + next.curvature * t,
          torsion: curr.torsion * (1 - t) + next.torsion * t,
          s: curr.s * (1 - t) + next.s * t,
        };
      }

      accumulated += segLen;
    }

    return this.roadPoints[0];
  }

  public isOnRoad(x: number, z: number): boolean {
    const nearest = this.getNearestPoint(x, z);
    return nearest.distance <= this.config.width * 0.5;
  }

  public getDistanceToRoad(x: number, z: number): number {
    const nearest = this.getNearestPoint(x, z);
    return Math.max(0, nearest.distance - this.config.width * 0.5);
  }
}

export function createDefaultRoadConfig(): RoadConfig {
  return {
    width: 16,
    segments: 800,
    smoothingIterations: 3,
    elevationSmoothness: 0.85,
    curvatureSmoothness: 0.75,
    bankingFactor: 0.15,
    heightOffset: 0.35,
  };
}
