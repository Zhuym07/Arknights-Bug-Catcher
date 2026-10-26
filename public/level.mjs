export const WIDTH = 960;
export const HEIGHT = 600;
export const ROUND_SECONDS = 25;
// From the game video: upper pair, lower-left, lower-right; blue at centre.
export const spawns = [[0, 0], [8, 0], [0, 4], [8, 3]];
export const destination = [4, 2];
export const gateDeadzone = 30;
export const obstacles = [[1, 1], [1, 2], [1, 3], [4, 0], [5, 0], [6, 0], [5, 2], [3, 4], [4, 4], [5, 4], [6, 4]];
const blocked = new Set(obstacles.map(String));
export const isWalkable = ([c, r]) => c >= 0 && c < 9 && r >= 0 && r < 5 && !blocked.has(String([c, r]));
export function project([c, r]) {
  return { x: 480 + (c - 4) * (82 + r * 4), y: 244 + r * 65 };
}
export function findPath(start, goal, random = Math.random) {
  // Random edge costs select different valid corridors, without crossing blocks.
  const open = [start], cost = new Map([[String(start), 0]]), parent = new Map();
  const weights = new Map();
  while (open.length) {
    open.sort((a, b) => cost.get(String(a)) - cost.get(String(b)));
    const current = open.shift(), key = String(current);
    if (key === String(goal)) {
      const path = [goal];
      while (String(path[0]) !== String(start)) path.unshift(parent.get(String(path[0])));
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [current[0] + dc, current[1] + dr], nextKey = String(next);
      if (!isWalkable(next)) continue;
      if (!weights.has(nextKey)) weights.set(nextKey, 1 + random() * 2.5);
      const nextCost = cost.get(key) + weights.get(nextKey);
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      cost.set(nextKey, nextCost); parent.set(nextKey, current);
      if (!open.some(cell => String(cell) === nextKey)) open.push(next);
    }
  }
  throw new Error(`No route from ${start} to ${goal}`);
}
