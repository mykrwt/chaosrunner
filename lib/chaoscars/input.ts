import type { CarInput } from "./types";

export type InputSource = {
  getInput: (now: number) => CarInput;
  dispose: () => void;
};

export function createInputSource(): InputSource {
  const keysDown = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    keysDown.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keysDown.delete(e.code);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const isDown = (code: string) => keysDown.has(code);

  const getInput = (now: number): CarInput => {
    let throttle = 0;
    if (isDown("KeyW") || isDown("ArrowUp")) throttle += 1;
    if (isDown("KeyS") || isDown("ArrowDown")) throttle -= 1;

    let steer = 0;
    if (isDown("KeyA") || isDown("ArrowLeft")) steer -= 1;
    if (isDown("KeyD") || isDown("ArrowRight")) steer += 1;

    let handbrake = isDown("Space");
    let boost = isDown("ShiftLeft") || isDown("ShiftRight");
    let respawn = isDown("KeyR");

    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected) ?? null;

    if (gp) {
      const accel = gp.buttons[7]?.value ?? 0;
      const brake = gp.buttons[6]?.value ?? 0;
      const stickX = gp.axes[0] ?? 0;

      throttle = clamp(accel - brake + throttle, -1, 1);
      steer = clamp(stickX + steer, -1, 1);

      boost = boost || Boolean(gp.buttons[0]?.pressed);
      handbrake = handbrake || Boolean(gp.buttons[1]?.pressed) || Boolean(gp.buttons[4]?.pressed);
      respawn = respawn || Boolean(gp.buttons[3]?.pressed);
    }

    return { t: now, throttle, steer, handbrake, boost, respawn };
  };

  const dispose = () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };

  return { getInput, dispose };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
