import type { Bin, PickTask } from "./types";

/**
 * Serpentine pick order: zone order, then aisle ascending, then rack ascending
 * on odd aisles / descending on even aisles (the walker snakes through), then
 * shelf, then bin. Not a TSP solver - it removes back-tracking in a rack layout.
 */
export function assignPickSeq(bins: Bin[], zoneOrder: string[]): void {
  const zoneRank = (z: string) => {
    const i = zoneOrder.indexOf(z);
    return i === -1 ? zoneOrder.length : i;
  };
  const sorted = [...bins].sort((a, b) => {
    if (zoneRank(a.zone) !== zoneRank(b.zone)) return zoneRank(a.zone) - zoneRank(b.zone);
    if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
    const aa = Number(a.aisle);
    const ab = Number(b.aisle);
    if (aa !== ab) return aa - ab;
    const ra = Number(a.rack);
    const rb = Number(b.rack);
    if (ra !== rb) return aa % 2 === 1 ? ra - rb : rb - ra;
    if (a.shelf !== b.shelf) return a.shelf.localeCompare(b.shelf);
    return a.bin.localeCompare(b.bin);
  });
  sorted.forEach((b, i) => {
    b.pickSeq = i + 1;
  });
}

/** Sort pick tasks by the pick sequence of their bin (stable). */
export function sortTasksByRoute(tasks: PickTask[], seqOf: (binId: string) => number): PickTask[] {
  return [...tasks].sort((a, b) => seqOf(a.binId) - seqOf(b.binId));
}

/** Total walking "distance" proxy: sum of pickSeq jumps along a route. */
export function routeDistance(seqs: number[]): number {
  let d = 0;
  for (let i = 1; i < seqs.length; i++) d += Math.abs(seqs[i] - seqs[i - 1]);
  return d;
}
