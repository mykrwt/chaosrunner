import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Cross, v3Dot, v3Len, v3LenSq, v3Normalize, v3Scale, v3Sub } from "./vec3";

export type AABB = {
  min: Vec3;
  max: Vec3;
};

export type Sphere = {
  center: Vec3;
  radius: number;
};

export type Capsule = {
  start: Vec3;
  end: Vec3;
  radius: number;
};

export type Ray = {
  origin: Vec3;
  direction: Vec3;
};

export type Plane = {
  normal: Vec3;
  distance: number;
};

export type CollisionResult = {
  collided: boolean;
  penetration: number;
  normal: Vec3;
  contactPoint: Vec3;
};

export function sphereVsSphere(a: Sphere, b: Sphere): CollisionResult {
  const diff = v3Sub(b.center, a.center);
  const distSq = v3LenSq(diff);
  const radiusSum = a.radius + b.radius;
  const radiusSumSq = radiusSum * radiusSum;

  if (distSq >= radiusSumSq) {
    return {
      collided: false,
      penetration: 0,
      normal: v3(0, 1, 0),
      contactPoint: a.center,
    };
  }

  const dist = Math.sqrt(distSq);
  const normal = dist > 0.0001 ? v3Scale(diff, 1 / dist) : v3(0, 1, 0);
  const penetration = radiusSum - dist;
  const contactPoint = v3Add(a.center, v3Scale(normal, a.radius - penetration * 0.5));

  return {
    collided: true,
    penetration,
    normal,
    contactPoint,
  };
}

export function aabbVsAABB(a: AABB, b: AABB): boolean {
  if (a.max.x < b.min.x || a.min.x > b.max.x) return false;
  if (a.max.y < b.min.y || a.min.y > b.max.y) return false;
  if (a.max.z < b.min.z || a.min.z > b.max.z) return false;
  return true;
}

export function sphereVsAABB(sphere: Sphere, aabb: AABB): CollisionResult {
  const closest = v3(
    Math.max(aabb.min.x, Math.min(sphere.center.x, aabb.max.x)),
    Math.max(aabb.min.y, Math.min(sphere.center.y, aabb.max.y)),
    Math.max(aabb.min.z, Math.min(sphere.center.z, aabb.max.z))
  );

  const diff = v3Sub(closest, sphere.center);
  const distSq = v3LenSq(diff);
  const radiusSq = sphere.radius * sphere.radius;

  if (distSq >= radiusSq) {
    return {
      collided: false,
      penetration: 0,
      normal: v3(0, 1, 0),
      contactPoint: sphere.center,
    };
  }

  const dist = Math.sqrt(distSq);
  const normal = dist > 0.0001 ? v3Scale(diff, -1 / dist) : v3(0, 1, 0);
  const penetration = sphere.radius - dist;

  return {
    collided: true,
    penetration,
    normal,
    contactPoint: closest,
  };
}

export function rayVsSphere(ray: Ray, sphere: Sphere): { hit: boolean; distance: number; point: Vec3 } {
  const oc = v3Sub(ray.origin, sphere.center);
  const a = v3Dot(ray.direction, ray.direction);
  const b = 2 * v3Dot(oc, ray.direction);
  const c = v3Dot(oc, oc) - sphere.radius * sphere.radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return { hit: false, distance: Infinity, point: ray.origin };
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  const t = t1 >= 0 ? t1 : t2;

  if (t < 0) {
    return { hit: false, distance: Infinity, point: ray.origin };
  }

  const point = v3Add(ray.origin, v3Scale(ray.direction, t));

  return { hit: true, distance: t, point };
}

export function rayVsPlane(ray: Ray, plane: Plane): { hit: boolean; distance: number; point: Vec3 } {
  const denom = v3Dot(plane.normal, ray.direction);

  if (Math.abs(denom) < 0.0001) {
    return { hit: false, distance: Infinity, point: ray.origin };
  }

  const t = -(v3Dot(plane.normal, ray.origin) + plane.distance) / denom;

  if (t < 0) {
    return { hit: false, distance: Infinity, point: ray.origin };
  }

  const point = v3Add(ray.origin, v3Scale(ray.direction, t));

  return { hit: true, distance: t, point };
}

export function rayVsAABB(ray: Ray, aabb: AABB): { hit: boolean; distance: number; point: Vec3 } {
  const invDir = v3(
    1 / ray.direction.x,
    1 / ray.direction.y,
    1 / ray.direction.z
  );

  const t1 = (aabb.min.x - ray.origin.x) * invDir.x;
  const t2 = (aabb.max.x - ray.origin.x) * invDir.x;
  const t3 = (aabb.min.y - ray.origin.y) * invDir.y;
  const t4 = (aabb.max.y - ray.origin.y) * invDir.y;
  const t5 = (aabb.min.z - ray.origin.z) * invDir.z;
  const t6 = (aabb.max.z - ray.origin.z) * invDir.z;

  const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
  const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

  if (tmax < 0 || tmin > tmax) {
    return { hit: false, distance: Infinity, point: ray.origin };
  }

  const t = tmin >= 0 ? tmin : tmax;
  const point = v3Add(ray.origin, v3Scale(ray.direction, t));

  return { hit: true, distance: t, point };
}

export function pointVsAABB(point: Vec3, aabb: AABB): boolean {
  if (point.x < aabb.min.x || point.x > aabb.max.x) return false;
  if (point.y < aabb.min.y || point.y > aabb.max.y) return false;
  if (point.z < aabb.min.z || point.z > aabb.max.z) return false;
  return true;
}

export function pointVsSphere(point: Vec3, sphere: Sphere): boolean {
  const distSq = v3LenSq(v3Sub(point, sphere.center));
  return distSq <= sphere.radius * sphere.radius;
}

export function closestPointOnSegment(point: Vec3, segmentStart: Vec3, segmentEnd: Vec3): Vec3 {
  const segment = v3Sub(segmentEnd, segmentStart);
  const toPoint = v3Sub(point, segmentStart);
  const segmentLenSq = v3LenSq(segment);

  if (segmentLenSq < 0.0001) {
    return segmentStart;
  }

  const t = Math.max(0, Math.min(1, v3Dot(toPoint, segment) / segmentLenSq));
  return v3Add(segmentStart, v3Scale(segment, t));
}

export function distancePointToSegment(point: Vec3, segmentStart: Vec3, segmentEnd: Vec3): number {
  const closest = closestPointOnSegment(point, segmentStart, segmentEnd);
  return v3Len(v3Sub(point, closest));
}

export function capsuleVsCapsule(a: Capsule, b: Capsule): CollisionResult {
  const closestA = closestPointOnSegment(b.start, a.start, a.end);
  const closestB = closestPointOnSegment(closestA, b.start, b.end);
  const finalClosestA = closestPointOnSegment(closestB, a.start, a.end);

  const diff = v3Sub(closestB, finalClosestA);
  const distSq = v3LenSq(diff);
  const radiusSum = a.radius + b.radius;
  const radiusSumSq = radiusSum * radiusSum;

  if (distSq >= radiusSumSq) {
    return {
      collided: false,
      penetration: 0,
      normal: v3(0, 1, 0),
      contactPoint: finalClosestA,
    };
  }

  const dist = Math.sqrt(distSq);
  const normal = dist > 0.0001 ? v3Scale(diff, 1 / dist) : v3(0, 1, 0);
  const penetration = radiusSum - dist;
  const contactPoint = v3Add(finalClosestA, v3Scale(normal, a.radius - penetration * 0.5));

  return {
    collided: true,
    penetration,
    normal,
    contactPoint,
  };
}

export function createAABBFromPoints(points: Vec3[]): AABB {
  if (points.length === 0) {
    return { min: v3(0, 0, 0), max: v3(0, 0, 0) };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let minZ = points[0].z;
  let maxX = points[0].x;
  let maxY = points[0].y;
  let maxZ = points[0].z;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }

  return { min: v3(minX, minY, minZ), max: v3(maxX, maxY, maxZ) };
}

export function expandAABB(aabb: AABB, amount: number): AABB {
  return {
    min: v3(aabb.min.x - amount, aabb.min.y - amount, aabb.min.z - amount),
    max: v3(aabb.max.x + amount, aabb.max.y + amount, aabb.max.z + amount),
  };
}

export function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    min: v3(
      Math.min(a.min.x, b.min.x),
      Math.min(a.min.y, b.min.y),
      Math.min(a.min.z, b.min.z)
    ),
    max: v3(
      Math.max(a.max.x, b.max.x),
      Math.max(a.max.y, b.max.y),
      Math.max(a.max.z, b.max.z)
    ),
  };
}

export function getAABBCenter(aabb: AABB): Vec3 {
  return v3(
    (aabb.min.x + aabb.max.x) * 0.5,
    (aabb.min.y + aabb.max.y) * 0.5,
    (aabb.min.z + aabb.max.z) * 0.5
  );
}

export function getAABBExtents(aabb: AABB): Vec3 {
  return v3(
    (aabb.max.x - aabb.min.x) * 0.5,
    (aabb.max.y - aabb.min.y) * 0.5,
    (aabb.max.z - aabb.min.z) * 0.5
  );
}

export function sweepSphereVsSphere(
  a: Sphere,
  aVelocity: Vec3,
  b: Sphere,
  bVelocity: Vec3,
  dt: number
): { hit: boolean; time: number; normal: Vec3 } {
  const relVel = v3Sub(aVelocity, bVelocity);
  const relPos = v3Sub(a.center, b.center);
  const radiusSum = a.radius + b.radius;

  const a_coeff = v3Dot(relVel, relVel);
  const b_coeff = 2 * v3Dot(relVel, relPos);
  const c_coeff = v3Dot(relPos, relPos) - radiusSum * radiusSum;

  const discriminant = b_coeff * b_coeff - 4 * a_coeff * c_coeff;

  if (discriminant < 0 || Math.abs(a_coeff) < 0.0001) {
    return { hit: false, time: Infinity, normal: v3(0, 1, 0) };
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b_coeff - sqrtD) / (2 * a_coeff);
  const t2 = (-b_coeff + sqrtD) / (2 * a_coeff);

  const t = t1 >= 0 ? t1 : t2;

  if (t < 0 || t > dt) {
    return { hit: false, time: Infinity, normal: v3(0, 1, 0) };
  }

  const aPos = v3Add(a.center, v3Scale(aVelocity, t));
  const bPos = v3Add(b.center, v3Scale(bVelocity, t));
  const normal = v3Normalize(v3Sub(aPos, bPos));

  return { hit: true, time: t, normal };
}
