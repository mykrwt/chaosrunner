"use client";

import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChaosCarsGame, { type NetworkBridge } from "./ChaosCarsGame";
import { P2PRoomClient } from "@/lib/chaoscars/p2p";
import type { HostClaim, MatchSettings, PlayerId, PlayerInfo, StartMatchMsg } from "@/lib/chaoscars/types";
import { hashStringToSeed, mulberry32, randomCarColor } from "@/lib/chaoscars/random";

const makeRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const APP_ID = "chaos-cars-p2p";

type Screen = "menu" | "lobby" | "game";

export default function ChaosCarsApp() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [name, setName] = useState<string>(() => {
    if (typeof window === "undefined") return "Driver";
    return window.localStorage.getItem("chaoscars:name") ?? "Driver";
  });

  const [roomInput, setRoomInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get("room");
    return fromLink ? fromLink.trim().toUpperCase() : "";
  });

  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<PlayerId, PlayerInfo>>({});
  const [host, setHost] = useState<HostClaim>({ term: 0, hostId: "" });
  const [peerCount, setPeerCount] = useState(1);

  const [startMsg, setStartMsg] = useState<StartMatchMsg | null>(null);

  const [client, setClient] = useState<P2PRoomClient | null>(null);
  const clientRef = useRef<P2PRoomClient | null>(null);

  const networkBridgeRef = useRef<NetworkBridge>({});
  const setNetworkHandlers = useCallback((handlers: NetworkBridge | null) => {
    networkBridgeRef.current = handlers ?? {};
  }, []);

  const isHost = Boolean(host.hostId && client?.selfId === host.hostId);



  useEffect(() => {
    window.localStorage.setItem("chaoscars:name", name);
  }, [name]);

  const shareLink = useMemo(() => {
    if (!roomId) return "";
    if (typeof window === "undefined") return "";

    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    url.hash = "";
    return url.toString();
  }, [roomId]);

  const connect = (id: string, asHostFlag: boolean) => {
    if (clientRef.current) void clientRef.current.leave();

    const rng = mulberry32(hashStringToSeed(`${name}|${Date.now()}`));
    const color = randomCarColor(rng);

    const client = new P2PRoomClient({
      roomId: id,
      appId: APP_ID,
      self: { name, color },
      asHost: asHostFlag,
      callbacks: {
        onPlayersChanged: setPlayers,
        onHostChanged: setHost,
        onPeerCountChanged: setPeerCount,
        onStartMatch: (msg) => {
          setStartMsg(msg);
          setScreen("game");
        },
        onSnapshot: (snap, peerId) => networkBridgeRef.current.onSnapshot?.(snap, peerId),
        onInput: (input, peerId) => networkBridgeRef.current.onInput?.(input, peerId),
      },
    });

    clientRef.current = client;
    setClient(client);
    setRoomId(id);
    setPlayers(client.getPlayers());
    setHost(client.getHost());
    setPeerCount(1);
    setStartMsg(null);
    setScreen("lobby");
  };

  const disconnect = async () => {
    const roomClient = clientRef.current;
    clientRef.current = null;
    setClient(null);

    if (roomClient) await roomClient.leave();

    setRoomId(null);
    setPlayers({});
    setHost({ term: 0, hostId: "" });
    setPeerCount(1);
    setStartMsg(null);
    setScreen("menu");
  };

  const createRoom = () => {
    const id = makeRoomId();
    connect(id, true);
  };

  const joinRoom = () => {
    const id = roomInput.trim().toUpperCase();
    if (!id) return;
    connect(id, false);
  };

  const startMatch = (settings: MatchSettings) => {
    const roomClient = clientRef.current;
    if (!roomClient || !roomClient.isHost()) return;

    const seed = `${roomClient.roomId}-${Date.now().toString(36)}`;
    const startAt = Date.now() + 900;

    const msg: StartMatchMsg = { settings, seed, startAt };
    setStartMsg(msg);
    void roomClient.startMatch(msg);
    setScreen("game");
  };

  if (screen === "game" && client && startMsg) {
    return (
      <ChaosCarsGame
        client={client}
        players={players}
        hostId={host.hostId}
        start={startMsg}
        setNetworkHandlers={setNetworkHandlers}
        onExit={() => setScreen("lobby")}
        onRematch={(settings) => startMatch(settings)}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight">Chaos Cars</h1>
          <p className="max-w-2xl text-sm text-zinc-300">
            Multiplayer 3D arcade racing game. Race friends through hilly tracks, hit boost pads, and battle for first place.
          </p>
        </header>

        <div className="rounded-xl bg-zinc-800/90 p-5 shadow-sm ring-1 ring-zinc-700/50 backdrop-blur">
          <label className="mb-2 block text-sm font-semibold">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 focus:border-fuchsia-500"
            maxLength={18}
          />
        </div>

        {screen === "menu" ? (
          <div className="grid gap-4 rounded-xl bg-zinc-800/90 p-5 shadow-sm ring-1 ring-zinc-700/50 backdrop-blur">
            <div className="flex flex-col gap-2">
              <button
                className="rounded-lg bg-fuchsia-600 px-4 py-3 font-semibold text-white hover:bg-fuchsia-500"
                onClick={createRoom}
              >
                Create room
              </button>

              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-semibold">Join with room code</label>
                <div className="flex gap-2">
                  <input
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm uppercase text-zinc-100 outline-none focus:border-fuchsia-500"
                    placeholder="ABC123"
                  />
                  <button
                    className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600"
                    onClick={joinRoom}
                  >
                    Join
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-400">
                Tip: if you’re on a strict network, P2P may be blocked. Try another connection or a different browser.
              </div>
            </div>
          </div>
        ) : null}

        {screen === "lobby" ? (
          <Lobby
            roomId={roomId ?? ""}
            shareLink={shareLink}
            players={players}
            hostId={host.hostId}
            peerCount={peerCount}
            isHost={Boolean(isHost)}
            onStart={startMatch}
            onLeave={disconnect}
          />
        ) : null}

        <div className="text-xs text-zinc-500">
          Built for static hosting. Multiplayer is P2P WebRTC using Trystero’s torrent signaling relays (no custom
          backend).
        </div>
      </div>
    </div>
  );
}

function Lobby(props: {
  roomId: string;
  shareLink: string;
  players: Record<PlayerId, PlayerInfo>;
  hostId: PlayerId;
  peerCount: number;
  isHost: boolean;
  onStart: (settings: MatchSettings) => void;
  onLeave: () => void;
}) {
  const [mode, setMode] = useState<MatchSettings["mode"]>("race");
  const [laps, setLaps] = useState(2);
  const [duration, setDuration] = useState(90);

  const settings: MatchSettings = {
    mode,
    laps,
    checkpointCount: 12,
    durationMs: duration * 1000,
  };

  const ids = Object.keys(props.players).sort();

  return (
    <div className="grid gap-4 rounded-xl bg-zinc-800/90 p-5 shadow-sm ring-1 ring-zinc-700/50 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-400">Room code</div>
          <div className="text-2xl font-black tracking-widest">{props.roomId}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600"
            onClick={() => void navigator.clipboard.writeText(props.roomId)}
          >
            Copy code
          </button>
          <button
            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600"
            onClick={() => void navigator.clipboard.writeText(props.shareLink)}
          >
            Copy link
          </button>
          <button
            className="rounded-lg bg-zinc-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-zinc-500 hover:bg-zinc-500"
            onClick={props.onLeave}
          >
            Leave
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold text-zinc-300">Players ({props.peerCount}/8)</div>
        <div className="grid gap-2">
          {ids.map((id) => (
            <div key={id} className="flex items-center justify-between rounded-lg bg-zinc-700/60 px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ background: props.players[id].color }} />
                <div className="font-semibold">{props.players[id].name}</div>
              </div>
              <div className="text-xs text-zinc-400">{props.hostId === id ? "Host" : ""}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 rounded-lg bg-zinc-700/60 p-3">
        <div className="text-sm font-semibold">Match settings</div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            value={mode}
            onChange={(e) => setMode(e.target.value as MatchSettings["mode"])}
          >
            <option value="race">Race (laps)</option>
            <option value="checkpointChaos">Checkpoint chaos</option>
            <option value="elimination">Elimination</option>
          </select>

          <label className="flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
            <span className="text-zinc-400">Laps</span>
            <input
              type="number"
              className="w-16 bg-transparent text-right text-zinc-100 outline-none"
              value={laps}
              onChange={(e) => setLaps(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
              disabled={mode !== "race"}
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
            <span className="text-zinc-400">Seconds</span>
            <input
              type="number"
              className="w-16 bg-transparent text-right text-zinc-100 outline-none"
              value={duration}
              onChange={(e) => setDuration(Math.max(20, Math.min(300, Number(e.target.value) || 60)))}
            />
          </label>
        </div>

        {props.isHost ? (
          <button
            className="mt-2 rounded-lg bg-fuchsia-600 px-4 py-3 font-semibold text-white hover:bg-fuchsia-500"
            onClick={() => props.onStart(settings)}
            disabled={ids.length < 1}
          >
            Start match
          </button>
        ) : (
          <div className="mt-2 text-sm text-zinc-300">Waiting for host to start…</div>
        )}
      </div>

      <div className="text-xs text-zinc-400">
        Host migration: if the host disconnects, the remaining peers deterministically elect a new host and keep going.
      </div>
    </div>
  );
}
