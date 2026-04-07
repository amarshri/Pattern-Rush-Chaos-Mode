export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const range = (count: number) => Array.from({ length: count }, (_, i) => i);

export const shuffle = <T,>(items: T[], rng: () => number) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const pick = <T,>(items: T[], rng: () => number) =>
  items[Math.floor(rng() * items.length)];

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const formatMs = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
