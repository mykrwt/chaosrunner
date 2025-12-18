# Chaos Cars (P2P)

A lightweight, arcade-style multiplayer 3D car game that runs entirely in the browser.

- **No backend server, no database, no accounts**
- **Multiplayer via WebRTC P2P** (using [Trystero](https://github.com/dmotz/trystero) with torrent signaling relays)
- **3D rendering with Three.js**
- **Host-authoritative simulation** (inputs → host, snapshots → everyone)

## How to play

### Create a room
1. Open the app.
2. Enter your name.
3. Click **Create room**.
4. Share the **room code** (e.g. `A2K9QX`) or **Copy link**.

### Join a room
1. Open the app.
2. Enter your name.
3. Paste the room code and click **Join**.

You can also open a shared link like:

```
https://your-host.example/?room=A2K9QX
```

### Controls
- **Keyboard**: `W/S` throttle, `A/D` steer, `Space` drift/handbrake, `Shift` boost, `R` respawn
- **Gamepad**: `RT/LT` throttle, left stick steer, `B` drift, `A` boost, `Y` respawn

## Networking architecture (no backend)

All peers join the same WebRTC room.

- A single peer is elected as **host** (room creator, with deterministic host migration if the host disconnects).
- All players send their **inputs** to the host over WebRTC data channels.
- The host simulates physics and broadcasts periodic **snapshots** (car transforms + match state).
- Clients do lightweight local prediction and smoothly blend toward snapshots.

This model keeps gameplay stable and prevents conflicting simulations without requiring any backend.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Static deployment

This project is configured for static export:

```bash
npm run build
```

The static site will be generated into `out/`. Host that folder on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.).

## Notes / limitations

- WebRTC connectivity depends on NAT/firewall rules. Some networks may block P2P.
- The torrent strategy uses public relays for matchmaking/signaling only; gameplay traffic is peer-to-peer.
