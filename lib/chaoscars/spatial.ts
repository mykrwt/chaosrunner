import type { Vec3 } from "./vec3";

export type SpatialCell = {
  x: number;
  z: number;
  items: number[];
};

export class SpatialGrid<T> {
  private cellSize: number;
  private grid: Map<string, T[]>;
  private items: Map<number, { item: T; cells: string[] }>;
  private nextId: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.items = new Map();
    this.nextId = 0;
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx}:${cz}`;
  }

  private getCellsForBounds(minX: number, minZ: number, maxX: number, maxZ: number): string[] {
    const cells: string[] = [];
    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellZ = Math.floor(minZ / this.cellSize);
    const maxCellZ = Math.floor(maxZ / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        cells.push(`${cx}:${cz}`);
      }
    }

    return cells;
  }

  public insert(item: T, x: number, z: number, radius: number = 0): number {
    const id = this.nextId++;
    const cells = this.getCellsForBounds(x - radius, z - radius, x + radius, z + radius);

    for (const cellKey of cells) {
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      this.grid.get(cellKey)!.push(item);
    }

    this.items.set(id, { item, cells });
    return id;
  }

  public remove(id: number): boolean {
    const entry = this.items.get(id);
    if (!entry) return false;

    for (const cellKey of entry.cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        const index = cell.indexOf(entry.item);
        if (index !== -1) {
          cell.splice(index, 1);
        }
        if (cell.length === 0) {
          this.grid.delete(cellKey);
        }
      }
    }

    this.items.delete(id);
    return true;
  }

  public update(id: number, x: number, z: number, radius: number = 0): boolean {
    const entry = this.items.get(id);
    if (!entry) return false;

    const newCells = this.getCellsForBounds(x - radius, z - radius, x + radius, z + radius);
    const oldCells = new Set(entry.cells);
    const newCellSet = new Set(newCells);

    for (const cellKey of oldCells) {
      if (!newCellSet.has(cellKey)) {
        const cell = this.grid.get(cellKey);
        if (cell) {
          const index = cell.indexOf(entry.item);
          if (index !== -1) {
            cell.splice(index, 1);
          }
          if (cell.length === 0) {
            this.grid.delete(cellKey);
          }
        }
      }
    }

    for (const cellKey of newCells) {
      if (!oldCells.has(cellKey)) {
        if (!this.grid.has(cellKey)) {
          this.grid.set(cellKey, []);
        }
        this.grid.get(cellKey)!.push(entry.item);
      }
    }

    entry.cells = newCells;
    return true;
  }

  public query(x: number, z: number, radius: number): T[] {
    const cells = this.getCellsForBounds(x - radius, z - radius, x + radius, z + radius);
    const results = new Set<T>();

    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const item of cell) {
          results.add(item);
        }
      }
    }

    return Array.from(results);
  }

  public queryRect(minX: number, minZ: number, maxX: number, maxZ: number): T[] {
    const cells = this.getCellsForBounds(minX, minZ, maxX, maxZ);
    const results = new Set<T>();

    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const item of cell) {
          results.add(item);
        }
      }
    }

    return Array.from(results);
  }

  public clear(): void {
    this.grid.clear();
    this.items.clear();
    this.nextId = 0;
  }

  public size(): number {
    return this.items.size;
  }
}

export class QuadTree<T> {
  private boundary: { x: number; z: number; halfSize: number };
  private capacity: number;
  private items: Array<{ item: T; x: number; z: number }>;
  private divided: boolean;
  private northwest: QuadTree<T> | null;
  private northeast: QuadTree<T> | null;
  private southwest: QuadTree<T> | null;
  private southeast: QuadTree<T> | null;

  constructor(x: number, z: number, halfSize: number, capacity: number = 4) {
    this.boundary = { x, z, halfSize };
    this.capacity = capacity;
    this.items = [];
    this.divided = false;
    this.northwest = null;
    this.northeast = null;
    this.southwest = null;
    this.southeast = null;
  }

  private subdivide(): void {
    const x = this.boundary.x;
    const z = this.boundary.z;
    const h = this.boundary.halfSize / 2;

    this.northwest = new QuadTree(x - h, z - h, h, this.capacity);
    this.northeast = new QuadTree(x + h, z - h, h, this.capacity);
    this.southwest = new QuadTree(x - h, z + h, h, this.capacity);
    this.southeast = new QuadTree(x + h, z + h, h, this.capacity);

    this.divided = true;
  }

  public insert(item: T, x: number, z: number): boolean {
    if (!this.contains(x, z)) {
      return false;
    }

    if (this.items.length < this.capacity) {
      this.items.push({ item, x, z });
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    if (this.northwest!.insert(item, x, z)) return true;
    if (this.northeast!.insert(item, x, z)) return true;
    if (this.southwest!.insert(item, x, z)) return true;
    if (this.southeast!.insert(item, x, z)) return true;

    return false;
  }

  private contains(x: number, z: number): boolean {
    const dx = Math.abs(x - this.boundary.x);
    const dz = Math.abs(z - this.boundary.z);
    return dx <= this.boundary.halfSize && dz <= this.boundary.halfSize;
  }

  public query(x: number, z: number, radius: number): T[] {
    const results: T[] = [];

    if (!this.intersects(x, z, radius)) {
      return results;
    }

    for (const entry of this.items) {
      const dx = entry.x - x;
      const dz = entry.z - z;
      if (dx * dx + dz * dz <= radius * radius) {
        results.push(entry.item);
      }
    }

    if (this.divided) {
      results.push(...this.northwest!.query(x, z, radius));
      results.push(...this.northeast!.query(x, z, radius));
      results.push(...this.southwest!.query(x, z, radius));
      results.push(...this.southeast!.query(x, z, radius));
    }

    return results;
  }

  private intersects(x: number, z: number, radius: number): boolean {
    const dx = Math.abs(x - this.boundary.x);
    const dz = Math.abs(z - this.boundary.z);

    if (dx > this.boundary.halfSize + radius) return false;
    if (dz > this.boundary.halfSize + radius) return false;

    if (dx <= this.boundary.halfSize) return true;
    if (dz <= this.boundary.halfSize) return true;

    const cornerDistSq = 
      (dx - this.boundary.halfSize) * (dx - this.boundary.halfSize) +
      (dz - this.boundary.halfSize) * (dz - this.boundary.halfSize);

    return cornerDistSq <= radius * radius;
  }

  public clear(): void {
    this.items = [];
    this.divided = false;
    this.northwest = null;
    this.northeast = null;
    this.southwest = null;
    this.southeast = null;
  }

  public size(): number {
    let count = this.items.length;
    if (this.divided) {
      count += this.northwest!.size();
      count += this.northeast!.size();
      count += this.southwest!.size();
      count += this.southeast!.size();
    }
    return count;
  }
}

export function optimizePathSmoothing(points: Vec3[], iterations: number, strength: number): Vec3[] {
  if (points.length < 3) return points;

  let smoothed = points.map(p => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    const next: Vec3[] = [];

    for (let i = 0; i < smoothed.length; i++) {
      const prev = smoothed[(i - 1 + smoothed.length) % smoothed.length];
      const curr = smoothed[i];
      const nextP = smoothed[(i + 1) % smoothed.length];

      const avgX = (prev.x + curr.x * 2 + nextP.x) * 0.25;
      const avgY = (prev.y + curr.y * 2 + nextP.y) * 0.25;
      const avgZ = (prev.z + curr.z * 2 + nextP.z) * 0.25;

      next.push({
        x: curr.x * (1 - strength) + avgX * strength,
        y: curr.y * (1 - strength) + avgY * strength,
        z: curr.z * (1 - strength) + avgZ * strength,
      });
    }

    smoothed = next;
  }

  return smoothed;
}

export function subdivideSegments(points: Vec3[], subdivisionsPerSegment: number): Vec3[] {
  if (points.length < 2) return points;

  const result: Vec3[] = [];

  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];

    for (let j = 0; j < subdivisionsPerSegment; j++) {
      const t = j / subdivisionsPerSegment;
      result.push({
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        z: p0.z + (p1.z - p0.z) * t,
      });
    }
  }

  return result;
}
