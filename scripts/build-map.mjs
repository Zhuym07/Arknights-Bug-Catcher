import { readFileSync, writeFileSync } from 'node:fs';
import { project, obstacles, spawns, destination } from '../public/level.mjs';

const polygon = (points, attributes) => `<polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" ${attributes}/>`;
function tile(cell, raised = false) {
  const [c, r] = cell;
  const corners = [[c - .48, r - .47], [c + .48, r - .47], [c + .48, r + .47], [c - .48, r + .47]].map(project);
  const top = corners.map(p => ({ x: p.x, y: p.y - (raised ? 30 : 0) }));
  const face = raised
    ? polygon([top[3], top[2], { ...corners[2], y: corners[2].y + 8 }, { ...corners[3], y: corners[3].y + 8 }], 'fill="#444b5e" stroke="#252e40" stroke-width="1.5"')
    : '';
  return face + polygon(top, `fill="url(#${raised ? 'raised' : 'tile'})" stroke="${raised ? '#8792a4' : '#4c586d'}" stroke-width="${raised ? 1.5 : 1}"`);
}
function gate(cell, blue = false) {
  const [c,r] = cell, color = blue ? '#6cddff' : '#ff5961', height = 43 + r * 2;
  const base = [[c-.37,r-.37],[c+.37,r-.37],[c+.37,r+.37],[c-.37,r+.37]].map(project);
  const top = base.map(p => ({x:p.x,y:p.y-height}));
  const edge = (a,b) => `M${a.x},${a.y}L${b.x},${b.y}`;
  const topEdges = top.map((p,i) => edge(p,top[(i+1)%4])).join('');
  const frontEdges = edge(base[3],base[2])+edge(top[3],base[3])+edge(top[2],base[2]);
  const outline = topEdges + frontEdges + edge(base[0],base[3])+edge(base[1],base[2]);
  const front = [top[3],top[2],base[2],base[3]];
  const portal = { x: front.reduce((sum,p)=>sum+p.x,0)/front.length, y: front.reduce((sum,p)=>sum+p.y,0)/front.length };
  return `<g stroke="${color}" stroke-linejoin="miter" fill="none">
    ${polygon(base,`fill="${color}" fill-opacity=".09" stroke-opacity=".5" stroke-width="1.5"`)}
    ${polygon([top[3],top[2],base[2],base[3]],`fill="${color}" fill-opacity=".035" stroke="none"`)}
    <path d="${outline}" stroke-width="2.2"/>
    ${blue ? `<ellipse cx="${portal.x}" cy="${portal.y}" rx="18" ry="15" stroke-width="2.2" opacity=".9"/>` : ''}
  </g>`;
}
// Inline the bitmap: external images inside an SVG do not render when loaded by Canvas.
const chamber = readFileSync(new URL('../art/chamber-background.webp', import.meta.url)).toString('base64');
const floorCells = [];
for (let r=0;r<5;r++) for(let c=0;c<9;c++) floorCells.push([c,r]);
const defs = `<defs>
 <image id="chamber" href="data:image/webp;base64,${chamber}" width="960" height="600"/>
 <clipPath id="floorSurface">${floorCells.map(cell => {
   const [c,r] = cell;
   return polygon([[c-.48,r-.47],[c+.48,r-.47],[c+.48,r+.47],[c-.48,r+.47]].map(project), '');
 }).join('')}</clipPath>
 <linearGradient id="tile" x2=".1" y2="1"><stop stop-color="#788297"/><stop offset="1" stop-color="#626e83"/></linearGradient>
 <linearGradient id="raised" x2=".1" y2="1"><stop stop-color="#aab4c3"/><stop offset="1" stop-color="#8995a9"/></linearGradient>
 </defs>`;
const machinery = '<use href="#chamber"/>';
const floor = floorCells.map(cell => tile(cell)).join('')
  + '<use href="#chamber" clip-path="url(#floorSurface)" opacity=".3"/>';
const fixtures = obstacles.map(c => tile(c,true)).join('') + spawns.map(c => gate(c)).join('') + gate(destination,true);
const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">${defs}${content}</svg>`;
writeFileSync(new URL('../public/assets/map-layout.svg',import.meta.url),svg(machinery+floor+fixtures));
console.log('Map generated with embedded Image2 scenery and exact level.mjs geometry.');
