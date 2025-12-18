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
      alpha: false,
      stencil: false,
      depth: true,
    });
    this.renderer.setClearColor(0xbfe9ff, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe9ff, 220, 600);

    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 2000);
    this.cameraPos.set(0, 8, 16);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x4b5c72, 1.4);
    hemi.position.set(0, 100, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(100, 180, 40);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -200;
    dir.shadow.camera.right = 200;
    dir.shadow.camera.top = 200;
    dir.shadow.camera.bottom = -200;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 500;
    dir.shadow.bias = -0.0001;
    this.scene.add(dir);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200, 120, 120),
      new THREE.MeshStandardMaterial({ 
        color: 0x7ddc71, 
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
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
      this.camera.fov = 62 + Math.min(25, speed * 0.65);
      this.camera.updateProjectionMatrix();

      const forward = new THREE.Vector3(Math.cos(local.yaw), 0, Math.sin(local.yaw));
      const targetPos = new THREE.Vector3(local.p.x, local.p.y, local.p.z);

      const speedOffset = Math.min(3, speed * 0.08);
      const desired = targetPos
        .clone()
        .addScaledVector(forward, -13 - speedOffset)
        .add(new THREE.Vector3(0, 7 + speedOffset * 0.3, 0));

      const shake = Math.max(0, 1 - (frame.now - local.lastHitAt) / 180);
      if (shake > 0) {
        desired.x += (Math.random() - 0.5) * 1.2 * shake;
        desired.y += (Math.random() - 0.5) * 0.8 * shake;
        desired.z += (Math.random() - 0.5) * 1.2 * shake;
      }

      const smoothing = Math.max(0.85, 0.98 - speed * 0.003);
      this.cameraPos.lerp(desired, 1 - Math.pow(smoothing, frame.dt * 60));
      this.cameraLook.lerp(targetPos, 1 - Math.pow(0.88, frame.dt * 60));

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

      const lerpFactor = id === frame.localId ? 0.5 : 0.35;
      const currentPos = group.position;
      currentPos.x += (state.p.x - currentPos.x) * lerpFactor;
      currentPos.y += (state.p.y - currentPos.y) * lerpFactor;
      currentPos.z += (state.p.z - currentPos.z) * lerpFactor;
      
      let yawDiff = state.yaw - group.rotation.y;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      group.rotation.y += yawDiff * lerpFactor;
      
      group.visible = state.alive;
      if (state.finished) {
        group.scale.setScalar(0.97);
      } else {
        group.scale.setScalar(1);
      }
    }
  }

  private createCheckpoints(track: Track): void {
    const geo = new THREE.TorusGeometry(6.8, 0.42, 12, 20);

    for (const cp of track.checkpoints) {
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0xffd84a, 
        transparent: true, 
        opacity: 0.8,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.6
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cp.p.x, cp.p.y + 3.8, cp.p.z);
      ring.castShadow = true;
      this.scene.add(ring);
      this.checkpointMeshes.push(ring);
    }
  }

  private createBoostPads(track: Track): void {
    const geo = new THREE.CylinderGeometry(6.8, 6.8, 0.3, 20);
    for (const pad of track.boostPads) {
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0x4affff, 
        emissive: 0x1d5cff, 
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
      });
      const disk = new THREE.Mesh(geo, mat);
      disk.position.set(pad.p.x, pad.p.y + 0.08, pad.p.z);
      disk.castShadow = true;
      disk.receiveShadow = true;
      this.scene.add(disk);
      this.boostMeshes.push(disk);
    }
  }

  private syncCheckpointVisuals(frame: RenderFrameState): void {
    const mode = frame.match.settings?.mode;
    const cps = this.checkpointMeshes;

    for (let i = 0; i < cps.length; i++) {
      const mesh = cps[i];
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (i >= frame.checkpointCount) {
        mat.opacity = 0.1;
        mat.color.setHex(0xffd84a);
        mat.emissiveIntensity = 0.1;
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

      mat.opacity = highlight ? 0.95 : 0.35;
      mat.color.setHex(highlight ? 0xff4aff : 0xffd84a);
      mat.emissive.setHex(highlight ? 0xff00ff : 0xffaa00);
      mat.emissiveIntensity = highlight ? 0.8 : 0.3;
      const targetScale = highlight ? 1.25 : 0.95;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      mesh.rotation.z += frame.dt * (highlight ? 1.5 : 0.5);
    }
  }
}

function createRoadMesh(track: Track): THREE.Mesh {
  const samples = track.samples;
  const w = track.roadWidth * 0.5;

  const vertCount = samples.length * 2;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const lx = s.p.x + s.left.x * w;
    const lz = s.p.z + s.left.z * w;
    const rx = s.p.x - s.left.x * w;
    const rz = s.p.z - s.left.z * w;

    const y = s.p.y + 0.08;

    positions.set([lx, y, lz, rx, y, rz], i * 2 * 3);
    normals.set([0, 1, 0, 0, 1, 0], i * 2 * 3);
    uvs.set([0, s.s * 10, 1, s.s * 10], i * 2 * 2);
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
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x2f2f3c,
    roughness: 0.65,
    metalness: 0.15
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return mesh;
}

function createCarGroup(color: string): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(color),
    roughness: 0.4,
    metalness: 0.7,
    envMapIntensity: 1.2
  });
  const accentMat = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.9
  });
  const glassMat = new THREE.MeshStandardMaterial({ 
    color: 0x222244,
    roughness: 0.1,
    metalness: 0.95,
    transparent: true,
    opacity: 0.7
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.2, 2.3), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 1.65), glassMat);
  roof.position.set(0, 1.6, -0.05);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.55, 0.6), accentMat);
  bumperFront.position.set(0, 0.62, 1.3);
  bumperFront.castShadow = true;
  bumperFront.receiveShadow = true;
  group.add(bumperFront);

  const bumperBack = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.55, 0.5), accentMat);
  bumperBack.position.set(0, 0.62, -1.15);
  bumperBack.castShadow = true;
  bumperBack.receiveShadow = true;
  group.add(bumperBack);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.6), bodyMat);
  spoiler.position.set(0, 1.45, -1.35);
  spoiler.castShadow = true;
  group.add(spoiler);

  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 16);
  wheelGeo.rotateZ(Math.PI / 2);

  const wheelOffsets = [
    [-1.4, 0.48, 1.0],
    [1.4, 0.48, 1.0],
    [-1.4, 0.48, -1.0],
    [1.4, 0.48, -1.0],
  ] as const;

  for (const [x, y, z] of wheelOffsets) {
    const w = new THREE.Mesh(wheelGeo, accentMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
  }

  return group;
}
