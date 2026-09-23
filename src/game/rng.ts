/** RNG determinístico e persistível: semente + cursor ficam no estado. */

export function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Retorna o n-ésimo valor da sequência. Puro: mesma semente/cursor = mesmo valor. */
export function valueAt(seed: number, cursor: number): number {
  const rand = mulberry32(seed);
  let v = 0;
  for (let i = 0; i <= cursor; i++) v = rand();
  return v;
}

export function intAt(seed: number, cursor: number, min: number, max: number): number {
  return min + Math.floor(valueAt(seed, cursor) * (max - min + 1));
}

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Embaralhamento determinístico (usado no sorteio de ordem). */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
