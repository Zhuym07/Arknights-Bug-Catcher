import { ROUND_SECONDS, spawns, destination, project, gateDeadzone, findPath } from './level.mjs';
const protectedZones = [...spawns, destination].map(project);

export class Round {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.state = 'ready'; this.time = ROUND_SECONDS; this.countdown = 3;
    this.score = 0; this.leaks = 0; this.bugs = []; this.effects = [];
    this.spawnClock = 0; this.spawnNumber = 0;
    this.gateOrder = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.gateOrder[i], this.gateOrder[j]] = [this.gateOrder[j], this.gateOrder[i]];
    }
  }
  start() { this.reset(); this.state = 'countdown'; }
  spawn() {
    const gate = this.gateOrder[this.spawnNumber++ % 4];
    const path = findPath(spawns[gate], destination, this.random).map(project);
    this.bugs.push({ ...path[0], gate, path, next: 1, speed: 190 + this.random() * 35 + (ROUND_SECONDS - this.time) * 4.5,
      phase: this.random() * 6.28, facing: gate % 2 ? -1 : 1, sprite: Math.floor(this.random() * 2) });
  }
  tick(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown > 0) return;
      dt = -this.countdown; this.state = 'playing';
    }
    if (this.state !== 'playing') return;
    // Small simulation steps preserve spawns, routes and a real 25-second duration at low frame rates.
    let remaining = Math.min(dt, this.time);
    while (remaining > .000001) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step; this.time = Math.max(0, this.time - step);
      this.spawnClock -= step;
      if (this.spawnClock <= 0) {
        const elapsed = ROUND_SECONDS - this.time;
        this.spawn();
        // The last wave periodically opens two different gates at once.
        if (elapsed >= 17 && this.spawnNumber % 5 === 4) this.spawn();
        this.spawnClock += this.spawnNumber < 4 ? .22 : elapsed < 8 ? .42 : elapsed < 17 ? .32 : .24;
      }
      for (const bug of this.bugs) {
        bug.phase += step * bug.speed * .09;
        let distanceLeft = bug.speed * step;
        while (distanceLeft > 0 && bug.next < bug.path.length) {
          const target = bug.path[bug.next], dx = target.x - bug.x, dy = target.y - bug.y;
          const distance = Math.hypot(dx, dy), amount = Math.min(distance, distanceLeft);
          if (Math.abs(dx) > 1) bug.facing = dx > 0 ? 1 : -1;
          if (distance) { bug.x += dx / distance * amount; bug.y += dy / distance * amount; }
          distanceLeft -= amount;
          if (amount >= distance) bug.next++; else break;
        }
        if (bug.next === bug.path.length) {
          this.leaks++; this.effects.push({x:bug.x,y:bug.y,age:0,hit:false});
        }
      }
      this.bugs = this.bugs.filter(bug => bug.next < bug.path.length);
      this.effects.forEach(effect => effect.age += step);
      this.effects = this.effects.filter(effect => effect.age < .45);
    }
    if (this.time < .00001) {
      this.time = 0; this.state = 'finished';
      this.bugs = []; this.effects = [];
    }
  }
  hit(x, y, radius = 33) {
    if (this.state !== 'playing') return false;
    if (protectedZones.some(zone => Math.hypot(x - zone.x, y - zone.y) < gateDeadzone)) return false;
    let closest = null, best = radius;
    for (const bug of this.bugs) {
      const distance = Math.hypot(x - bug.x, y - (bug.y - 9));
      if (distance <= best) { best = distance; closest = bug; }
    }
    if (!closest) return false;
    this.bugs.splice(this.bugs.indexOf(closest), 1); this.score++;
    this.effects.push({x:closest.x,y:closest.y,age:0,hit:true});
    return true;
  }
}
