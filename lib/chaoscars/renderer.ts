import * as THREE from "three";
import type { CarState, MatchRuntime, PlayerId, PlayerInfo } from "./types";
import type { Track } from "./track";
import { estimateSpeed } from "./physics";

export type RenderFrameState = {
  now: number;
  dt: number;
  track: Track;
  checkpointCount: number;
  cars: Record<PlayerId, CarState>;
  players: Record<PlayerId, PlayerInfo>;
  localId: PlayerId;
  match: MatchRuntime;
};

export class ChaosCarsRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private road: THREE.Mesh;
  private checkpointMeshes: THREE.Mesh[] = [];
  private boostMeshes: THREE.Mesh[] = [];

  private carGroups = new Map<PlayerId, THREE.Group>();
  private cameraPos = new THREE.Vector3();
  private cameraLook = new THREE.Vector3();

  private lastSize = { w: 0, h: 0 };

  constructor(params: { canvas: HTMLCanvasElement; track: Track }) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: params.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0xbfe9ff, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe9ff, 180, 520);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
    this.cameraPos.set(0, 8, 16);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x4b5c72, 1.15);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(60, 120, 20);
    this.scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900, 60, 60),
      new THREE.MeshLambertMaterial({ color: 0x7ddc71 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    this.scene.add(ground);

    this.road = createRoadMesh(params.track);
    this.scene.add(this.road);

    this.createCheckpoints(params.track);
    this.createBoostPads(params.track);

    this.resize();
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (w === this.lastSize.w && h === this.lastSize.h) return;

    this.lastSize = { w, h };
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(frame: RenderFrameState): void {
    this.resize();

    const local = frame.cars[frame.localId];
    if (local) {
      const speed = estimateSpeed(local);
      this.camera.fov = 60 + Math.min(20, speed * 0.55);
      this.camera.updateProjectionMatrix();

      const forward = new THREE.Vector3(Math.cos(local.yaw), 0, Math.sin(local.yaw));
      const targetPos = new THREE.Vector3(local.p.x, local.p.y, local.p.z);

      const desired = targetPos
        .clone()
        .addScaledVector(forward, -14)
        .add(new THREE.Vector3(0, 7.5, 0));

      const shake = Math.max(0, 1 - (frame.now - local.lastHitAt) / 180);
      if (shake > 0) {
        desired.x += (Math.random() - 0.5) * 0.9 * shake;
        desired.y += (Math.random() - 0.5) * 0.6 * shake;
        desired.z += (Math.random() - 0.5) * 0.9 * shake;
      }

      this.cameraPos.lerp(desired, 1 - Math.exp(-6.5 * frame.dt));
      this.cameraLook.lerp(targetPos, 1 - Math.exp(-9 * frame.dt));

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraLook);
    }

    this.syncCars(frame);
    this.syncCheckpointVisuals(frame);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.scene.clear();
  }

  private syncCars(frame: RenderFrameState): void {
    for (const [id, group] of this.carGroups.entries()) {
      if (!frame.cars[id]) {
        group.removeFromParent();
        this.carGroups.delete(id);
      }
    }

    for (const id of Object.keys(frame.cars)) {
      const state = frame.cars[id];
      const info = frame.players[id];
      if (!info) continue;

      let group = this.carGroups.get(id);
      if (!group) {
        group = createCarGroup(info.color);
        this.carGroups.set(id, group);
        this.scene.add(group);
      }

      group.position.set(state.p.x, state.p.y, state.p.z);
      group.rotation.y = state.yaw;
      group.visible = state.alive;
      if (state.finished) {
        group.scale.setScalar(0.97);
      } else {
        group.scale.setScalar(1);
      }
    }
  }

  private createCheckpoints(track: Track): void {
    const geo = new THREE.TorusGeometry(6.5, 0.35, 8, 14);

    for (const cp of track.checkpoints) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cp.p.x, cp.p.y + 3.5, cp.p.z);
      this.scene.add(ring);
      this.checkpointMeshes.push(ring);
    }
  }

  private createBoostPads(track: Track): void {
    const geo = new THREE.CylinderGeometry(6.5, 6.5, 0.25, 14);
    for (const pad of track.boostPads) {
      const mat = new THREE.MeshLambertMaterial({ color: 0x4affff, emissive: 0x1d5cff, emissiveIntensity: 0.25 });
      const disk = new THREE.Mesh(geo, mat);
      disk.position.set(pad.p.x, pad.p.y + 0.05, pad.p.z);
      this.scene.add(disk);
      this.boostMeshes.push(disk);
    }
  }

  private syncCheckpointVisuals(frame: RenderFrameState): void {
    const mode = frame.match.settings?.mode;
    const cps = this.checkpointMeshes;

    for (let i = 0; i < cps.length; i++) {
      const mesh = cps[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;

      if (i >= frame.checkpointCount) {
        mat.opacity = 0.08;
        mat.color.setHex(0xffd84a);
        mesh.scale.setScalar(0.75);
        continue;
      }

      let highlight = false;
      if (mode === "checkpointChaos") {
        highlight = i === frame.match.chaosTargetCp;
      } else if (mode === "race") {
        const car = frame.cars[frame.localId];
        if (car) highlight = i === (car.lastCp + 1) % frame.checkpointCount;
      }

      mat.opacity = highlight ? 1 : 0.28;
      mat.color.setHex(highlight ? 0xff4aff : 0xffd84a);
      mesh.scale.setScalar(highlight ? 1.2 : 0.95);
    }
  }
}

function createRoadMesh(track: Track): THREE.Mesh {
  const samples = track.samples;
  const w = track.roadWidth * 0.5;

  const vertCount = samples.length * 2;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const lx = s.p.x + s.left.x * w;
    const lz = s.p.z + s.left.z * w;
    const rx = s.p.x - s.left.x * w;
    const rz = s.p.z - s.left.z * w;

    const y = s.p.y + 0.05;

    positions.set([lx, y, lz, rx, y, rz], i * 2 * 3);
    normals.set([0, 1, 0, 0, 1, 0], i * 2 * 3);
  }

  const indices: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const i0 = i * 2;
    const i1 = ((i + 1) % samples.length) * 2;

    indices.push(i0, i0 + 1, i1);
    indices.push(i1, i0 + 1, i1 + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshLambertMaterial({ color: 0x2f2f3c });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;

  return mesh;
}

function createCarGroup(color: string): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 2.2), bodyMat);
  body.position.y = 0.9;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.6), bodyMat);
  roof.position.set(0, 1.55, -0.05);
  group.add(roof);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 0.55), accentMat);
  bumper.position.set(0, 0.6, 1.25);
  group.add(bumper);

  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.42, 10);
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelOffsets = [
    [-1.35, 0.45, 0.95],
    [1.35, 0.45, 0.95],
    [-1.35, 0.45, -0.95],
    [1.35, 0.45, -0.95],
  ] as const;

  for (const [x, y, z] of wheelOffsets) {
    const w = new THREE.Mesh(wheelGeo, accentMat);
    w.position.set(x, y, z);
    group.add(w);
  }

  return group;
}
