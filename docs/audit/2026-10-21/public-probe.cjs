const fs = require('node:fs');
const {chromium} = require('../../../frontend/node_modules/playwright');
const out = require('node:path').join(require('node:os').tmpdir(),'travel-audit-recheck');
fs.mkdirSync(out,{recursive:true});
async function sample(page, name, url, reload=false) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const requests = new Map();
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId,{url:e.request.url,method:e.request.method,start:e.timestamp,type:e.type}));
  cdp.on('Network.responseReceived', e => { const r=requests.get(e.requestId); if(r) Object.assign(r,{status:e.response.status,cache:e.response.fromDiskCache,mime:e.response.mimeType,headers:Object.fromEntries(Object.entries(e.response.headers).filter(([k])=>/^(cache-control|content-encoding|content-length|vary)$/i.test(k)))}); });
  cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r)Object.assign(r,{ms:Math.round((e.timestamp-r.start)*1000),bytes:e.encodedDataLength});});
  cdp.on('Network.loadingFailed',e=>{const r=requests.get(e.requestId);if(r)r.error=e.errorText;});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const start=Date.now();
  const response=reload?await page.reload({waitUntil:'domcontentloaded',timeout:45000}):await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  let cardsMs=null;
  try{await page.locator('[data-slot="card"] img').first().waitFor({timeout:25000}); cardsMs=Date.now()-start;}catch{}
  await page.waitForTimeout(5000);
  const dom = await page.evaluate(()=>({
    url:location.href, nav:performance.getEntriesByType('navigation')[0]?.toJSON(),
    paint:performance.getEntriesByType('paint').map(p=>p.toJSON()),
    observed:window.__auditMetrics,
    images:Array.from(document.images).map(i=>({src:i.currentSrc,width:i.width,naturalWidth:i.naturalWidth,top:Math.round(i.getBoundingClientRect().top),height:i.height,complete:i.complete,visible:!!i.getClientRects().length,loading:i.loading,priority:i.fetchPriority})),
    preloads:Array.from(document.querySelectorAll('link[rel="preload"]')).map(e=>({as:e.as,href:e.href,srcset:e.imageSrcset,media:e.media})),
    cards:document.querySelectorAll('[data-slot="card"]').length,
    mainCount:document.querySelectorAll('main').length,h1Count:document.querySelectorAll('h1').length,
  }));
  await page.screenshot({path:`${out}/${name}.png`,fullPage:false});
  const rows=[...requests.values()];
  const result={name,status:response?.status(),cardsMs,errors,dom,requests:rows};
  fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(result,null,2));
  const group={};for(const r of rows){const key=r.type;group[key]??={count:0,bytes:0};group[key].count++;group[key].bytes+=r.bytes||0;}
  console.log(JSON.stringify({name,status:result.status,cardsMs,ttfb:Math.round(dom.nav?.responseStart||0),paint:dom.paint,observed:dom.observed,groups:group,errors,failed:rows.filter(r=>r.error||r.status>=400),api:rows.filter(r=>r.url.includes('api.tapir.su')).map(r=>({url:r.url,ms:r.ms,method:r.method,status:r.status})),images:dom.images.map(i=>({...i,src:i.src.includes('cloudinary')?i.src.split('/upload/')[1]?.split('/').slice(0,2).join('/'):i.src})),preloads:dom.preloads}));
  await cdp.detach();
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const mode of ['desktop','mobile']){
  const context=await browser.newContext(mode==='mobile'?{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000},deviceScaleFactor:2});
  await context.addInitScript(()=>{window.__auditMetrics={lcp:[],cls:0};new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__auditMetrics.lcp.push({time:e.startTime,size:e.size,url:e.url,tag:e.element?.tagName}))).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__auditMetrics.cls+=e.value;})).observe({type:'layout-shift',buffered:true});});
  const page=await context.newPage();
  await sample(page,`${mode}-cold`,'https://www.tapir.su/');
  if(mode==='mobile')await sample(page,'mobile-warm','',true);
  await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
