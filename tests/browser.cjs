const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const http = require('node:http');
(async()=>{
  mkdirSync('art/qa',{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.join(process.cwd(),'public',pathname==='/'?'index.html':pathname);
    const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
    try{res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(readFileSync(file));}
    catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseURL=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.clock.install({time:new Date('2026-10-26T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  await page.goto(baseURL);
  await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>document.querySelector('#offline-status').textContent==='离线可用');
  await page.screenshot({path:'art/qa/start-desktop.png'});
  await page.locator('#start-button').click();
  await page.clock.runFor(3100);
  assert.equal(await page.locator('#countdown').isVisible(),false);
  const bounds=await page.locator('#game').boundingBox();
  const desktopScale=Math.min(bounds.width/960,bounds.height/600), desktopOffsetX=(bounds.width-960*desktopScale)/2, desktopOffsetY=(bounds.height-600*desktopScale)/2;
  for(const [x,y] of [[152,244],[808,244],[88,504],[856,439]]){
    await page.mouse.click(bounds.x+desktopOffsetX+x*desktopScale,bounds.y+desktopOffsetY+(y-9)*desktopScale);
  }
  for(let y=24;y<600;y+=36) for(let x=24;x<960;x+=36) await page.mouse.click(bounds.x+desktopOffsetX+x*desktopScale,bounds.y+desktopOffsetY+y*desktopScale);
  assert.ok(Number(await page.locator('#score').textContent())>=1,'a visible bug can be tapped');
  await page.clock.runFor(9000);
  await page.screenshot({path:'art/qa/playing-desktop.png'});
  await page.locator('#pause-button').click();
  const time=await page.locator('#time').textContent();
  await page.clock.fastForward(5000);
  assert.equal(await page.locator('#time').textContent(),time);
  await page.locator('#start-button').click();
  await page.clock.fastForward(26000);
  assert.equal(await page.locator('#screen-title').textContent(),'行动结束');
  assert.ok(Number(await page.locator('#leaks').textContent())>0);
  assert.equal(await page.locator('#result-score').textContent(),await page.locator('#score').textContent());
  assert.ok(await page.locator('#result-score').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=140,'large desktop result score');
  assert.equal(await page.locator('.game-frame.is-result .hud>div:not(.timer)').evaluateAll(items=>items.filter(item=>item.getClientRects().length).length),0,'result card avoids duplicate score and leak counts');
  await page.screenshot({path:'art/qa/result-desktop.png'});
  await page.locator('#start-button').click();
  assert.equal(await page.locator('#score').textContent(),'00');
  assert.equal(await page.locator('#leaks').textContent(),'00');
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
  assert.equal(await page.locator('#screen-title').textContent(),'源石防线');
  await page.locator('#start-button').click();await page.clock.runFor(5000);
  await page.screenshot({path:'art/qa/offline-desktop.png'});
  console.log('PASS desktop: start, countdown, tap, pause, leak, result, restart, offline reload/play');
  await context.close();
  for(const viewport of [{width:1920,height:1080},{width:390,height:844},{width:844,height:390}]){
    const mobile=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<1000});
    const tab=await mobile.newPage();
    await tab.clock.install({time:new Date('2026-10-26T00:00:00Z')});
    await tab.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
    await tab.goto(baseURL);
    await tab.waitForFunction(()=>!document.querySelector('#start-button').disabled);
    const overflow=await tab.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);
    assert.equal(overflow,false,`viewport fits ${viewport.width}x${viewport.height}`);
    const readyContent=await tab.locator('.screen-content').boundingBox(),readyStage=await tab.locator('.game-stage').boundingBox();
    assert.ok(readyContent.y>=readyStage.y && readyContent.y+readyContent.height<=readyStage.y+readyStage.height+1,'visible start screen fits inside the scene');
    await tab.screenshot({path:`art/qa/start-${viewport.width}x${viewport.height}.png`});
    await tab.locator('#start-button').tap();await tab.clock.runFor(3100);
    const hud=await tab.locator('.hud').boundingBox(),tools=await tab.locator('.tools').boundingBox();
    assert.ok(hud.x+hud.width<=tools.x || hud.y>=tools.y+tools.height,`HUD and controls do not overlap ${viewport.width}x${viewport.height}`);
    const stage=await tab.locator('.game-stage').boundingBox();
    assert.ok(hud.y+hud.height<=stage.y && tools.y+tools.height<=stage.y,'controls stay outside the map');
    const content=await tab.locator('.screen-content').boundingBox();
    assert.ok(content.y>=stage.y && content.y+content.height<=stage.y+stage.height+1,'start screen fits inside the scene');
    const box=await tab.locator('#game').boundingBox();
    const scale=Math.min(box.width/960,box.height/600), offsetX=(box.width-960*scale)/2, offsetY=(box.height-600*scale)/2;
    // Distinct simultaneous touch pointers, just as a shared activity-day screen.
    const client=await mobile.newCDPSession(tab);
    const touchPoints=[[152,244],[808,244],[88,504],[856,439]].map(([x,y],id)=>({x:box.x+offsetX+x*scale,y:box.y+offsetY+(y-9)*scale,id,radiusX:5,radiusY:5}));
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const sweep=[]; for(let y=24;y<600;y+=36) for(let x=24;x<960;x+=36) sweep.push({x:box.x+offsetX+x*scale,y:box.y+offsetY+y*scale});
    for(let i=0;i<sweep.length;i+=4){
      const points=sweep.slice(i,i+4).map((point,id)=>({...point,id,radiusX:5,radiusY:5}));
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    assert.ok(Number(await tab.locator('#score').textContent())>=1,'multitouch dispatch hits visible bug');
    await tab.clock.runFor(7000);await tab.screenshot({path:`art/qa/playing-${viewport.width}x${viewport.height}.png`});
    // Sliding on the scene or the surrounding page must not move a fixed kiosk.
    for(const [x,y] of [[box.x+box.width/2,box.y+box.height/2],[viewport.width/2,10]]){
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
      for(let step=1;step<=5;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+step*4,y:y+step*12,id:0}]});
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await tab.mouse.wheel(100,500);
    await tab.locator('#game').click({position:{x:10,y:10}});
    await tab.keyboard.press('PageDown');
    await tab.keyboard.press('ArrowDown');
    await tab.evaluate(()=>scrollTo(100,500));
    await tab.clock.runFor(100);
    const scroll=await tab.evaluate(()=>({x:scrollX,y:scrollY,left:visualViewport.offsetLeft,top:visualViewport.offsetTop}));
    assert.deepEqual(scroll,{x:0,y:0,left:0,top:0},'wheel, keys and touch drags do not scroll');
    assert.deepEqual(await tab.locator('#game').boundingBox(),box,'the playfield stays fixed after gestures');
    await tab.clock.runFor(26000);
    assert.equal(await tab.locator('#screen-title').textContent(),'行动结束');
    const result=await tab.locator('.screen-content').boundingBox();
    assert.ok(result.y>=stage.y && result.y+result.height<=stage.y+stage.height+1,`result panel fits ${viewport.width}x${viewport.height}`);
    assert.equal(await tab.locator('#result-score').textContent(),await tab.locator('#score').textContent());
    assert.ok(await tab.locator('#result-score').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=64,'readable mobile result score');
    assert.equal(await tab.locator('.game-frame.is-result .hud>div:not(.timer)').evaluateAll(items=>items.filter(item=>item.getClientRects().length).length),0,'mobile result has no duplicate counters');
    await tab.screenshot({path:`art/qa/result-${viewport.width}x${viewport.height}.png`});
    console.log(`PASS ${viewport.width}x${viewport.height}: fit, multitouch, scroll lock, large result`);await mobile.close();
  }
  assert.deepEqual(errors,[]);await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1);});
