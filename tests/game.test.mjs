import test from 'node:test';
import assert from 'node:assert/strict';
import { spawns, destination, isWalkable, findPath } from '../public/level.mjs';
import { Round } from '../public/game-core.mjs';

test('all four video gates connect to centre through walkable adjacent cells', () => {
  for (const start of spawns) for (let attempt=0;attempt<100;attempt++) {
    const path=findPath(start,destination);
    assert.deepEqual(path[0],start);assert.deepEqual(path.at(-1),destination);
    path.forEach((cell,i)=>{
      assert.ok(isWalkable(cell));
      if(i)assert.equal(Math.abs(cell[0]-path[i-1][0])+Math.abs(cell[1]-path[i-1][1]),1);
    });
  }
});
test('routes have real variety around the fixed obstacles',()=>{
  const routes=new Set(Array.from({length:100},()=>JSON.stringify(findPath(spawns[1],destination))));
  assert.ok(routes.size>2);
});
test('countdown, all four spawns, hit, miss and no double scoring',()=>{
  const round=new Round();round.start();round.tick(2.9);assert.equal(round.state,'countdown');
  round.tick(1.2);assert.equal(round.state,'playing');
  assert.equal(new Set(round.bugs.map(bug=>bug.gate)).size,4);
  const bug=round.bugs[0];assert.ok(round.hit(bug.x,bug.y-9));assert.equal(round.score,1);
  assert.equal(round.hit(bug.x,bug.y-9),false);assert.equal(round.score,1);
  assert.equal(round.hit(-100,-100),false);
});
test('hidden gate deadzones prevent spawn and destination camping',()=>{
  const round=new Round();round.start();round.tick(3.2);
  const bug=round.bugs[0];
  assert.equal(round.hit(0,0),false);
  assert.equal(round.hit(480,244),false);
  assert.ok(round.hit(bug.x,bug.y-9));
});
test('untouched round leaks, finishes after 25 seconds and resets cleanly',()=>{
  const round=new Round();round.start();round.tick(3);round.tick(24.5);
  assert.equal(round.state,'playing');assert.ok(round.leaks>0);
  round.tick(.5);assert.equal(round.state,'finished');assert.equal(round.time,0);
  assert.deepEqual(round.bugs,[]);assert.deepEqual(round.effects,[]);
  const leaks=round.leaks;round.tick(10);assert.equal(round.leaks,leaks);
  round.start();assert.equal(round.time,25);assert.equal(round.score,0);assert.equal(round.leaks,0);assert.equal(round.bugs.length,0);
});
test('pause freezes enemies and timer; slow frames keep real duration',()=>{
  const round=new Round();round.start();round.tick(4);round.state='paused';
  const snapshot=JSON.stringify(round);round.tick(20);assert.equal(JSON.stringify(round),snapshot);
  round.state='playing';round.tick(24);assert.equal(round.state,'finished');
});

test('waves accelerate, increase pressure and launch distinct simultaneous gates',()=>{
  const round=new Round(()=>.5);round.start();round.tick(3);
  const events=[],spawn=round.spawn.bind(round);
  round.spawn=()=>{
    spawn();const bug=round.bugs.at(-1);
    events.push({time:25-round.time,speed:bug.speed,gate:bug.gate});
  };
  round.tick(25);
  const opening=events.filter(e=>e.time<8),middle=events.filter(e=>e.time>=8&&e.time<17),final=events.filter(e=>e.time>=17);
  assert.ok(opening[0].speed>=190);
  assert.ok(final[0].speed>opening.at(-1).speed);
  assert.ok(middle.length/9>opening.length/8);
  assert.ok(final.length/8>middle.length/9);
  assert.ok(events.length>=80 && events.length<=100,'25 seconds has sustained but bounded pressure');
  assert.ok(final.some((e,i)=>i>0 && e.time===final[i-1].time && e.gate!==final[i-1].gate),'final burst uses two different gates');
  console.log(`Pressure: ${opening.length}/${middle.length}/${final.length} enemies across three waves; ${events.length} total`);
});
