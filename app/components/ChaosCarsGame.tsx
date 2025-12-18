"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioManager } from "@/lib/chaoscars/audio";
import { createInputSource } from "@/lib/chaoscars/input";
import {
  computeRaceProgress,
  createCarState,
  estimateSpeed,
  respawnCar,
  stepCarArcade,
  stepWorld,
} from "@/lib/chaoscars/physics";
import { ChaosCarsRenderer } from "@/lib/chaoscars/renderer";
import { mulberry32, hashStringToSeed } from "@/lib/chaoscars/random";
import { createTrack } from "@/lib/chaoscars/track";
import type { P2PRoomClient } from "@/lib/chaoscars/p2p";
import type {
  CarInput,
  CarState,
  MatchRuntime,
  MatchSettings,
  PlayerId,
  PlayerInfo,
  Snapshot,
  StartMatchMsg,
} from "@/lib/chaoscars/types";

export type NetworkBridge = {
  onSnapshot?: (snapshot: Snapshot, peerId: PlayerId) => void;
  onInput?: (input: CarInput, peerId: PlayerId) => void;
};

export default function ChaosCarsGame(props: {
  client: P2PRoomClient;
  players: Record<PlayerId, PlayerInfo>;
  hostId: PlayerId;
  start: StartMatchMsg;
  setNetworkHandlers: (handlers: NetworkBridge | null) => void;
  onExit: () => void;
  onRematch: (settings: MatchSettings) => void;
}) {
  const { client, players, hostId, start, setNetworkHandlers } = props;

  const localId = client.selfId;
  const isHost = hostId === localId;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioInitArmedRef = useRef(false);

  const track = useMemo(() => createTrack(start.seed), [start.seed]);

  const checkpointCount = useMemo(
    () => Math.max(4, Math.min(track.checkpoints.length, start.settings.checkpointCount)),
    [track.checkpoints.length, start.settings.checkpointCount]
  );

  const carsRef = useRef<Record<PlayerId, CarState>>({});
  const matchRef = useRef<MatchRuntime>(createInitialMatch(start));
  const inputsRef = useRef<Record<PlayerId, CarInput | undefined>>({});

  const lastSnapshotRef = useRef<Snapshot | null>(null);
  const lastSnapshotSentAtRef = useRef(0);
  const lastInputSentAtRef = useRef(0);

  const [hud, setHud] = useState(() => ({
    speed: 0,
    position: 1,
    total: 1,
    timeLeft: 0,
    mode: start.settings.mode,
    running: true,
    countdown: 0,
    scores: {} as Record<PlayerId, number>,
    finishedOrder: [] as PlayerId[],
    eliminated: [] as PlayerId[],
  }));

  useEffect(() => {
    matchRef.current = createInitialMatch(start);

    const ids = Object.keys(players).sort();
    const offsets = spawnOffsets(ids.length);
    const cars: Record<PlayerId, CarState> = {};

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const spawn = track.getCheckpointSpawn(0);
      const o = offsets[i];

      const s = createCarState({
        p: { x: spawn.p.x + o.x, y: spawn.p.y, z: spawn.p.z + o.z },
        yaw: spawn.yaw,
      });

      cars[id] = s;
      matchRef.current.scores[id] = 0;
    }

    carsRef.current = cars;
    inputsRef.current = {};

    lastSnapshotRef.current = null;
    lastSnapshotSentAtRef.current = 0;

    if (!isHost) {
      lastInputSentAtRef.current = 0;
    }
  }, [start, track, players, isHost]);

  useEffect(() => {
    setNetworkHandlers({
      onSnapshot: (snapshot) => {
        lastSnapshotRef.current = snapshot;

        // If we're a client, treat the incoming snapshot as the authoritative state and
        // smoothly blend toward it. If we become host later, we'll promote this state.
        if (!isHost) {
          matchRef.current = snapshot.match;
          for (const id of Object.keys(snapshot.cars)) {
            const src = snapshot.cars[id];
            if (!carsRef.current[id]) carsRef.current[id] = structuredClone(src);
          }

          for (const id of Object.keys(carsRef.current)) {
            if (!snapshot.cars[id]) delete carsRef.current[id];
          }
        }
      },
      onInput: (input, peerId) => {
        if (!isHost) return;
        inputsRef.current[peerId] = input;
      },
    });

    return () => {
      setNetworkHandlers(null);
    };
  }, [setNetworkHandlers, isHost]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new ChaosCarsRenderer({ canvas, track });
    const input = createInputSource();
    const audio = new AudioManager();

    let raf = 0;
    let lastPerf = performance.now();

    const chaosRng = mulberry32(hashStringToSeed(`${start.seed}|${start.startAt}`));

    const step = () => {
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - lastPerf) / 1000);
      lastPerf = nowPerf;

      const now = Date.now();
      const localInput = input.getInput(now);

      // Lazy audio init: must be called from a user gesture. We allow any key press / click to start it.
      if (!audioInitArmedRef.current) {
        audioInitArmedRef.current = true;
        const arm = async () => {
          await audio.init();
        };
        window.addEventListener("pointerdown", arm, { once: true });
        window.addEventListener("keydown", arm, { once: true });
      }

      ensureCarsForPlayers({ track, players, cars: carsRef.current, match: matchRef.current });

      // Networking model (host-authoritative, P2P-friendly):
      // - All peers join the same WebRTC mesh room.
      // - A single peer is elected as host.
      // - Everyone sends *inputs* to the host.
      // - The host simulates physics and periodically broadcasts *snapshots*.
      // - Clients do lightweight local prediction and blend toward snapshots.
      // - If the host disconnects, peers deterministically elect a new host.
      if (isHost) {
        inputsRef.current[localId] = localInput;

        if (now >= matchRef.current.startTime && matchRef.current.running) {
          stepWorld({
            now,
            dt,
            track,
            checkpointCount,
            cars: carsRef.current,
            inputs: inputsRef.current,
            match: matchRef.current,
            chaosRng,
          });

          const shouldSend = now - lastSnapshotSentAtRef.current > 50;
          if (shouldSend) {
            lastSnapshotSentAtRef.current = now;
            void client.broadcastSnapshot(makeSnapshot(now, carsRef.current, matchRef.current));
          }
        }
      } else {
        const localCar = carsRef.current[localId];
        if (localCar && now >= matchRef.current.startTime && matchRef.current.running) {
          stepCarArcade({ now, dt, track, car: localCar, input: localInput });
          updateClientProgress(localCar, track);

          if (localInput.respawn) respawnCar(localCar, track, localCar.lastCp);
        }

        const shouldSend = now - lastInputSentAtRef.current > 33;
        if (shouldSend) {
          lastInputSentAtRef.current = now;
          void client.sendInputToHost(localInput);
        }

        const snap = lastSnapshotRef.current;
        if (snap) {
          // Blend toward authoritative snapshot.
          for (const id of Object.keys(snap.cars)) {
            const target = snap.cars[id];
            const car = carsRef.current[id];
            if (!car) continue;

            const lerp = id === localId ? 0.16 : 0.22;
            car.p.x += (target.p.x - car.p.x) * lerp;
            car.p.y += (target.p.y - car.p.y) * lerp;
            car.p.z += (target.p.z - car.p.z) * lerp;
            car.v.x += (target.v.x - car.v.x) * lerp;
            car.v.y += (target.v.y - car.v.y) * lerp;
            car.v.z += (target.v.z - car.v.z) * lerp;
            car.yaw += angleDelta(car.yaw, target.yaw) * lerp;

            car.grounded = target.grounded;
            car.boostCd = target.boostCd;
            car.lap = target.lap;
            car.s = target.s;
            car.lastCp = target.lastCp;
            car.finished = target.finished;
            car.alive = target.alive;
            car.lastHitAt = target.lastHitAt;
          }
        }
      }

      const localCar = carsRef.current[localId];
      audio.update(localCar);

      renderer.update({
        now,
        dt,
        track,
        checkpointCount,
        cars: carsRef.current,
        players,
        localId,
        match: matchRef.current,
      });

      const h = computeHud({ now, match: matchRef.current, cars: carsRef.current, localId, checkpointCount });
      setHud(h);

      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(raf);
      renderer.dispose();
      input.dispose();
      audio.dispose();
    };
  }, [client, checkpointCount, isHost, localId, players, start.seed, start.startAt, start.settings.mode, track]);

  useEffect(() => {
    if (!isHost) return;

    // If we just became host (host migration), promote the last snapshot.
    const snap = lastSnapshotRef.current;
    if (!snap) return;

    carsRef.current = structuredClone(snap.cars);
    matchRef.current = structuredClone(snap.match);

    if (!matchRef.current.scores) matchRef.current.scores = {};
    if (matchRef.current.chaosTargetCp == null) matchRef.current.chaosTargetCp = 1;
  }, [isHost]);

  const speedEffect = Math.min(1, hud.speed / 45);

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hud.running ? speedEffect * 0.35 : 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.0) 70%)",
        }}
      />

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2 rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold">{hud.mode}</div>
          <div className="text-white/80">Room: {client.roomId}</div>
        </div>
        <div className="flex gap-4">
          <div>Speed: {hud.speed.toFixed(0)}</div>
          <div>
            Pos: {hud.position}/{hud.total}
          </div>
        </div>
        <div className="text-white/80">
          {hud.countdown > 0 ? (
            <span>Starting in {hud.countdown.toFixed(1)}…</span>
          ) : (
            <span>Time left: {Math.max(0, hud.timeLeft / 1000).toFixed(0)}s</span>
          )}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur">
        <div className="font-semibold">Controls</div>
        <div className="text-white/80">W/S or RT/LT: throttle</div>
        <div className="text-white/80">A/D or stick: steer</div>
        <div className="text-white/80">Space / B: drift</div>
        <div className="text-white/80">Shift / A: boost</div>
        <div className="text-white/80">R / Y: respawn</div>
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex gap-2">
        <button
          className="rounded-md bg-white/90 px-3 py-2 text-sm font-semibold text-black hover:bg-white"
          onClick={props.onExit}
        >
          Back to lobby
        </button>

        {isHost && !hud.running && hud.countdown === 0 ? (
          <button
            className="rounded-md bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400"
            onClick={() => props.onRematch(start.settings)}
          >
            Play again
          </button>
        ) : null}
      </div>

      {!hud.running && hud.countdown === 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 mx-auto mb-4 w-[min(560px,90vw)] rounded-xl bg-black/60 p-4 text-white backdrop-blur">
          <div className="mb-2 text-lg font-semibold">Match over</div>
          <Scoreboard hud={hud} players={players} />
          <div className="mt-3 text-xs text-white/70">
            Host-authoritative simulation over P2P WebRTC (via Trystero torrent relays). Inputs are sent to the host;
            the host simulates physics and broadcasts snapshots.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createInitialMatch(start: StartMatchMsg): MatchRuntime {
  return {
    running: true,
    settings: start.settings,
    seed: start.seed,
    startTime: start.startAt,
    endTime: start.startAt + start.settings.durationMs,
    finishedOrder: [],
    eliminated: [],
    chaosTargetCp: 1,
    scores: {},
  };
}

function ensureCarsForPlayers(params: {
  track: ReturnType<typeof createTrack>;
  players: Record<PlayerId, PlayerInfo>;
  cars: Record<PlayerId, CarState>;
  match: MatchRuntime;
}): void {
  const ids = Object.keys(params.players).sort();
  const offsets = spawnOffsets(ids.length);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (params.cars[id]) continue;

    const spawn = params.track.getCheckpointSpawn(0);
    const o = offsets[i];

    params.cars[id] = createCarState({
      p: { x: spawn.p.x + o.x, y: spawn.p.y, z: spawn.p.z + o.z },
      yaw: spawn.yaw,
    });

    params.match.scores[id] = params.match.scores[id] ?? 0;
  }

  for (const id of Object.keys(params.cars)) {
    if (!params.players[id]) delete params.cars[id];
  }
}

function spawnOffsets(count: number): { x: number; z: number }[] {
  const offsets: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    offsets.push({ x: (col - 1.5) * 2.8, z: row * -3.4 });
  }
  return offsets;
}

function updateClientProgress(car: CarState, track: ReturnType<typeof createTrack>): void {
  const surface = track.getSurfaceInfo(car.p.x, car.p.z);
  const prevS = car.s;
  car.s = surface.s;
  if (car.s < 0.2 && prevS > 0.8) car.lap++;
}

function computeHud(params: {
  now: number;
  match: MatchRuntime;
  cars: Record<PlayerId, CarState>;
  localId: PlayerId;
  checkpointCount: number;
}): {
  speed: number;
  position: number;
  total: number;
  timeLeft: number;
  mode: MatchSettings["mode"];
  running: boolean;
  countdown: number;
  scores: Record<PlayerId, number>;
  finishedOrder: PlayerId[];
  eliminated: PlayerId[];
} {
  const { now, match, cars, localId } = params;

  const car = cars[localId];
  const speed = car ? estimateSpeed(car) : 0;

  const total = Object.keys(cars).filter((id) => cars[id].alive).length;

  const countdown = Math.max(0, (match.startTime - now) / 1000);
  const timeLeft = Math.max(0, match.endTime - now);

  const mode: MatchSettings["mode"] = match.settings?.mode ?? "race";

  let rank: PlayerId[] = [];
  if (mode === "checkpointChaos") {
    rank = Object.keys(cars).sort((a, b) => (match.scores[b] ?? 0) - (match.scores[a] ?? 0));
  } else {
    const finished = match.finishedOrder;
    const unfinished = Object.keys(cars)
      .filter((id) => !finished.includes(id))
      .sort((a, b) => computeRaceProgress(cars[b]) - computeRaceProgress(cars[a]));

    rank = [...finished, ...unfinished];
  }

  const position = Math.max(1, rank.indexOf(localId) + 1);

  return {
    speed,
    position,
    total,
    timeLeft,
    mode,
    running: match.running,
    countdown,
    scores: match.scores,
    finishedOrder: match.finishedOrder,
    eliminated: match.eliminated,
  };
}

function angleDelta(a: number, b: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makeSnapshot(now: number, cars: Record<PlayerId, CarState>, match: MatchRuntime): Snapshot {
  const carsCopy: Record<PlayerId, CarState> = {};
  for (const id of Object.keys(cars)) carsCopy[id] = structuredClone(cars[id]);

  return {
    t: now,
    cars: carsCopy,
    match: structuredClone(match),
  };
}

function Scoreboard(props: {
  hud: ReturnType<typeof computeHud>;
  players: Record<PlayerId, PlayerInfo>;
}) {
  const { hud, players } = props;

  const ids = Object.keys(players);
  const rows = ids
    .map((id) => ({
      id,
      name: players[id].name,
      score: hud.scores[id] ?? 0,
      finishedPos: hud.finishedOrder.includes(id) ? hud.finishedOrder.indexOf(id) + 1 : null,
      eliminated: hud.eliminated.includes(id),
    }))
    .sort((a, b) => {
      if (a.finishedPos && b.finishedPos) return a.finishedPos - b.finishedPos;
      if (a.finishedPos) return -1;
      if (b.finishedPos) return 1;
      return b.score - a.score;
    });

  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ background: players[r.id]?.color ?? "white" }}
            />
            <div className="font-medium">
              {r.name}
              {r.eliminated ? <span className="ml-2 text-xs text-white/70">(out)</span> : null}
            </div>
          </div>
          <div className="text-sm text-white/80">
            {hud.mode === "checkpointChaos" ? `Score ${r.score}` : r.finishedPos ? `Finish #${r.finishedPos}` : "Racing"}
          </div>
        </div>
      ))}
    </div>
  );
}
