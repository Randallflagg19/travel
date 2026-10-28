const fs=require('node:fs');
const {chromium,expect}=require('../../../frontend/node_modules/@playwright/test');
const pixel="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23315755'/%3E%3C/svg%3E";
const base={user_id:'admin',media_type:'PHOTO',media_url:pixel,cloudinary_public_id:null,folder:null,text:null,layout:'STANDARD',media_width:1200,media_height:800,country:'Indonesia',city:'Bali',lat:null,lng:null,pinned_at:null,created_at:'2026-09-15T12:00:00.000Z',like_count:3,comment_count:2,liked_by_me:true};
const report=[];
async function setup(browser,behavior){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('travel_access_token','mock-local-audit'));
 page.on('dialog',d=>d.dismiss());let held=null;const patchLog=[];
 const posts=[{...base,id:'a',title:'A'},{...base,id:'b',title:'B'}];
 await page.route('**/api-proxy/**',async route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname;
  if(p.endsWith('/auth/me'))return route.fulfill({json:{user:{id:'admin',username:'tapir',name:'Tapir',role:'SUPERADMIN',email:null}}});
  if(p.endsWith('/authors'))return route.fulfill({json:{items:[{id:'admin',username:'tapir',name:'Tapir'},{id:'friend',username:'friend',name:'Друг'}]}});
  if(p.endsWith('/places'))return route.fulfill({json:{countries:[{country:'Indonesia',count:2,stats:{posts:2,photos:2,videos:0,stories:0},cities:[{city:'Bali',count:2,stats:{posts:2,photos:2,videos:0,stories:0}}]}]}});
  if(p.endsWith('/posts'))return route.fulfill({json:{items:u.searchParams.get('authorId')==='friend'?[]:posts,nextCursor:null,hasMore:false}});
  if(request.method()==='PATCH'){
   const id=p.split('/').pop(),data=request.postDataJSON();patchLog.push({id,data});
   if(behavior==='rollback'&&id==='a'){held=route;return;}
   const post=posts.find(p=>p.id===id);Object.assign(post,data);
   return route.fulfill({json:{post:{...post,like_count:0,comment_count:0,liked_by_me:undefined}}});
  }
  return route.fulfill({status:404,json:{message:'No fixture'}});
 });
 return {context,page,posts,patchLog,failHeld:()=>held.fulfill({status:500,json:{message:'Controlled audit failure'}})};
}
const card=(p,title)=>p.getByRole('heading',{name:title,exact:true}).locator('xpath=ancestor::div[@data-slot="card"]');
(async()=>{const browser=await chromium.launch({headless:true});try{
 {const {page,context}=await setup(browser,'metadata');await page.goto('http://127.0.0.1:3000/?all=true');await expect(card(page,'A')).toBeVisible();
  const before={liked:await card(page,'A').getByRole('button',{name:'Снять лайк',exact:true}).count(),likeText:await card(page,'A').getByRole('button',{name:'Снять лайк',exact:true}).innerText()};
  await card(page,'A').getByRole('button',{name:'Действия с постом'}).click();await page.getByRole('button',{name:'Редактировать',exact:true}).click();await page.getByRole('textbox',{name:'Название',exact:true}).fill('A edited');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(card(page,'A edited').getByRole('button',{name:'Лайкнуть',exact:true})).toBeVisible();
  report.push({case:'metadata overwrites reactions',before,after:{liked:await card(page,'A edited').getByRole('button',{name:'Снять лайк',exact:true}).count(),likeText:await card(page,'A edited').getByRole('button',{name:'Лайкнуть',exact:true}).innerText()}});await context.close();}
 {const x=await setup(browser,'rollback'),p=x.page;await p.goto('http://127.0.0.1:3000/?all=true');await expect(card(p,'B')).toBeVisible();
  const width=()=>card(p,'B').evaluate(e=>e.getBoundingClientRect().width);const before=await width();
  await card(p,'A').getByRole('button',{name:'Действия с постом'}).click();await p.getByRole('button',{name:'Сделать крупным',exact:true}).click();
  await card(p,'B').getByRole('button',{name:'Действия с постом'}).click();await p.getByRole('button',{name:'Сделать крупным',exact:true}).click();await p.waitForTimeout(200);const afterSuccess=await width();
  await x.failHeld();await p.waitForTimeout(200);report.push({case:'rollback A erases successful B',before,afterSuccess,afterRollback:await width(),backendB:x.posts[1].layout,patchLog:x.patchLog});await x.context.close();}
 {const {page:p,context}=await setup(browser,'modal');await p.goto('http://127.0.0.1:3000/?author=friend&all=true');await p.getByRole('navigation',{name:'Авторы'}).getByRole('button',{name:'Tapir',exact:true}).click();await card(p,'A').getByRole('img',{name:'A',exact:true}).click();await expect(p.getByRole('dialog',{name:'Просмотр медиа'})).toBeVisible();const opened=await p.evaluate(()=>({bodyPosition:document.body.style.position,focusInsideDialog:!!document.activeElement?.closest('[role=dialog]')}));await p.goBack();await p.waitForTimeout(400);report.push({case:'back to another author while photo is open',opened,afterBack:await p.evaluate(()=>({url:location.href,dialogs:document.querySelectorAll('[role=dialog]').length,bodyPosition:document.body.style.position}))});await context.close();}
 {const {page:p,context}=await setup(browser,'country');await p.goto('http://127.0.0.1:3000/?author=admin&country=Indonesia');await p.getByRole('button',{name:/Indonesia/}).waitFor();await p.waitForTimeout(300);report.push({case:'direct country URL with one city',cards:await p.locator('[data-slot=card]').count(),url:p.url()});await context.close();}
}finally{await browser.close();fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'travel-behavior-recheck.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
