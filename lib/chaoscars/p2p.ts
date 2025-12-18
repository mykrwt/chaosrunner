import { joinRoom, selfId } from "trystero/torrent";
import type { Room } from "trystero";
import type {
  CarInput,
  HostClaim,
  PlayerId,
  PlayerInfo,
  Snapshot,
  StartMatchMsg,
} from "./types";

export type P2PRoomCallbacks = {
  onPlayersChanged?: (players: Record<PlayerId, PlayerInfo>) => void;
  onHostChanged?: (host: HostClaim) => void;
  onStartMatch?: (msg: StartMatchMsg, peerId: PlayerId) => void;
  onSnapshot?: (snapshot: Snapshot, peerId: PlayerId) => void;
  onInput?: (input: CarInput, peerId: PlayerId) => void;
  onPeerCountChanged?: (count: number) => void;
};

export type CreateP2PRoomParams = {
  roomId: string;
  appId: string;
  self: Omit<PlayerInfo, "id">;
  asHost: boolean;
  callbacks?: P2PRoomCallbacks;
};

export class P2PRoomClient {
  readonly roomId: string;
  readonly appId: string;

  readonly selfId: PlayerId;
  readonly room: Room;

  private peers = new Set<PlayerId>();
  private players: Record<PlayerId, PlayerInfo>;

  private host: HostClaim;
  private callbacks: P2PRoomCallbacks;

  private sendPlayerInfo: (data: PlayerInfo, targetPeers?: string | string[] | null) => Promise<void[]>;
  private sendHostClaim: (data: HostClaim, targetPeers?: string | string[] | null) => Promise<void[]>;
  private sendStartMatch: (data: StartMatchMsg, targetPeers?: string | string[] | null) => Promise<void[]>;
  private sendSnapshot: (data: Snapshot, targetPeers?: string | string[] | null) => Promise<void[]>;
  private sendInput: (data: CarInput, targetPeers?: string | string[] | null) => Promise<void[]>;

  private hostTimeout: number | null = null;

  constructor(params: CreateP2PRoomParams) {
    this.roomId = params.roomId;
    this.appId = params.appId;
    this.selfId = selfId;
    this.callbacks = params.callbacks ?? {};

    this.players = {
      [this.selfId]: { id: this.selfId, ...params.self },
    };

    this.host = { term: 0, hostId: "" };

    this.room = joinRoom(
      {
        appId: params.appId,
        rtcConfig: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
      },
      params.roomId
    );

    const [sendPlayerInfo, onPlayerInfo] = this.room.makeAction<PlayerInfo>("player-info");
    const [sendHostClaim, onHostClaim] = this.room.makeAction<HostClaim>("host");
    const [sendStartMatch, onStartMatch] = this.room.makeAction<StartMatchMsg>("start");
    const [sendSnapshot, onSnapshot] = this.room.makeAction<Snapshot>("snap");
    const [sendInput, onInput] = this.room.makeAction<CarInput>("input");

    this.sendPlayerInfo = sendPlayerInfo;
    this.sendHostClaim = sendHostClaim;
    this.sendStartMatch = sendStartMatch;
    this.sendSnapshot = sendSnapshot;
    this.sendInput = sendInput;

    onPlayerInfo((info, peerId) => {
      this.players[peerId] = { ...info, id: peerId };
      this.emitPlayers();
    });

    onHostClaim((claim) => {
      this.acceptHostClaim(claim);
    });

    onStartMatch((msg, peerId) => {
      this.callbacks.onStartMatch?.(msg, peerId);
    });

    onSnapshot((snap, peerId) => {
      this.callbacks.onSnapshot?.(snap, peerId);
    });

    onInput((input, peerId) => {
      this.callbacks.onInput?.(input, peerId);
    });

    this.room.onPeerJoin((peerId) => {
      this.peers.add(peerId);
      this.callbacks.onPeerCountChanged?.(this.peers.size + 1);

      void this.sendPlayerInfo(this.players[this.selfId], peerId);

      // If we're the current host, let late joiners know immediately.
      if (this.host.hostId === this.selfId) void this.sendHostClaim(this.host, peerId);

      this.maybeElectHost();
    });

    this.room.onPeerLeave((peerId) => {
      this.peers.delete(peerId);
      delete this.players[peerId];
      this.emitPlayers();
      this.callbacks.onPeerCountChanged?.(this.peers.size + 1);

      if (this.host.hostId === peerId) {
        // Host migration: use deterministic leader election so all peers converge.
        this.host = { term: this.host.term + 1, hostId: "" };
        this.emitHost();
        this.maybeElectHost();
      }
    });

    this.emitPlayers();

    if (params.asHost) {
      this.host = { term: 1, hostId: this.selfId };
      this.emitHost();
      void this.sendHostClaim(this.host);
    } else {
      this.hostTimeout = window.setTimeout(() => {
        this.hostTimeout = null;
        this.maybeElectHost();
      }, 2200);
    }
  }

  setCallbacks(callbacks: P2PRoomCallbacks): void {
    this.callbacks = callbacks;
    this.emitPlayers();
    this.emitHost();
  }

  getPlayers(): Record<PlayerId, PlayerInfo> {
    return this.players;
  }

  getHost(): HostClaim {
    return this.host;
  }

  isHost(): boolean {
    return this.host.hostId === this.selfId;
  }

  async broadcastSnapshot(snapshot: Snapshot): Promise<void> {
    if (!this.isHost()) return;
    await this.sendSnapshot(snapshot);
  }

  async sendInputToHost(input: CarInput): Promise<void> {
    const hostId = this.host.hostId;
    if (!hostId) {
      await this.sendInput(input);
      return;
    }

    if (hostId === this.selfId) return;
    await this.sendInput(input, hostId);
  }

  async startMatch(msg: StartMatchMsg): Promise<void> {
    if (!this.isHost()) return;
    await this.sendStartMatch(msg);
  }

  async leave(): Promise<void> {
    if (this.hostTimeout) window.clearTimeout(this.hostTimeout);
    await this.room.leave();
  }

  private emitPlayers(): void {
    this.callbacks.onPlayersChanged?.({ ...this.players });
  }

  private emitHost(): void {
    this.callbacks.onHostChanged?.({ ...this.host });
  }

  private acceptHostClaim(claim: HostClaim): void {
    if (!claim.hostId) return;

    const shouldAccept =
      claim.term > this.host.term ||
      (claim.term === this.host.term &&
        (!this.host.hostId || claim.hostId.localeCompare(this.host.hostId) < 0));

    if (!shouldAccept) return;

    if (this.hostTimeout) {
      window.clearTimeout(this.hostTimeout);
      this.hostTimeout = null;
    }

    this.host = claim;
    this.emitHost();
  }

  private maybeElectHost(): void {
    if (this.host.hostId) return;

    const candidates = [this.selfId, ...Array.from(this.peers.values())].sort();
    const elected = candidates[0] ?? this.selfId;

    if (elected === this.selfId) {
      const claim: HostClaim = { term: Math.max(1, this.host.term), hostId: this.selfId };
      this.host = claim;
      this.emitHost();
      void this.sendHostClaim(claim);
    } else {
      this.host = { term: Math.max(1, this.host.term), hostId: elected };
      this.emitHost();
    }
  }
}
