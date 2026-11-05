// Simulated PDA beeper. AudioContext is created lazily on a user gesture
// (browser autoplay policy) - never at module scope.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function audioReady(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Call from a click/keypress handler so the context may start. */
export function unlockAudio(): void {
  getCtx();
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(c.destination);
  const t = c.currentTime + startOffset;
  osc.start(t);
  g.gain.setValueAtTime(gain, t + duration - 0.02);
  g.gain.linearRampToValueAtTime(0, t + duration);
  osc.stop(t + duration);
}

export function beepOk(): void {
  tone(880, 0, 0.12, "sine");
}

export function buzzError(): void {
  tone(180, 0, 0.18, "sawtooth", 0.2);
  tone(180, 0.22, 0.18, "sawtooth", 0.2);
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
