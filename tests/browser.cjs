// QA only: npm install --no-save playwright, or use an environment with Playwright installed.
const {chromium,expect}=require('playwright/test');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.TEST_URL||'http://127.0.0.1:4173';await page.goto(url);
 const blocks=page.locator('#blocks article');assert.equal(await blocks.count(),3);
 await blocks.nth(0).locator('textarea').fill('彼女は微笑んだ。');await blocks.nth(1).locator('textarea').fill('「今日は楽しかったね」');
 assert.equal(await page.locator('#source').inputValue(),'*彼女は微笑んだ。*\n\n「今日は楽しかったね」');
 await blocks.nth(0).getByRole('button',{name:'行動描写を複製',exact:true}).click();assert.equal(await blocks.count(),4);
 await blocks.nth(0).getByRole('button',{name:'行動描写を下へ移動',exact:true}).click();assert.equal(await blocks.nth(1).locator('[data-action=down]').evaluate(el=>el===document.activeElement),true);
 await blocks.nth(1).locator('[data-action=up]').click();await blocks.nth(0).locator('[data-action=down]').click();await blocks.nth(1).locator('[data-action=delete]').click();assert.equal(await blocks.count(),3);
 await page.getByRole('button',{name:'キャラクター紹介文',exact:true}).click();await blocks.nth(0).locator('textarea').fill('夕凪');
 await page.getByRole('button',{name:'チャット作成',exact:true}).click();assert.equal(await blocks.nth(1).locator('textarea').inputValue(),'「今日は楽しかったね」');
 await page.reload();assert.equal(await blocks.nth(1).locator('textarea').inputValue(),'「今日は楽しかったね」');
 await page.locator('#toggleAdd').click();await page.getByRole('button',{name:'自由入力ブロックを追加',exact:true}).click();
 const payload='<img src=x onerror="window.xss=1"><script>window.xss=2</script>\n\n# **見出し**\n\n- リスト\n\n> 引用\n\n~~削除~~';await blocks.last().locator('textarea').fill(payload);
 assert.equal(await page.locator('#preview img,#preview script').count(),0);assert.equal(await page.evaluate(()=>window.xss),undefined);assert.equal(await page.locator('#preview h1 strong').textContent(),'見出し');assert.equal(await page.locator('#preview li').textContent(),'リスト');assert.equal(await page.locator('#preview blockquote').textContent(),'引用');
 await page.locator('#applyTemplate').click();await page.getByRole('button',{name:'キャンセル',exact:true}).click();assert.equal(await blocks.count(),4);
 await page.locator('#applyTemplate').click();await page.getByRole('button',{name:'末尾に追加',exact:true}).click();assert.equal(await blocks.count(),7);
 await page.locator('#applyTemplate').click();await page.getByRole('button',{name:'置き換える',exact:true}).click();assert.equal(await blocks.count(),3);
 await blocks.first().locator('textarea').fill('保存する文章');
 await page.locator('.settings').evaluate(el=>el.open=true);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const exportPath=path.join('/tmp','zeta-test-export.json');await download.saveAs(exportPath);
 await page.locator('#importFile').setInputFiles(exportPath);await page.getByRole('button',{name:'上書きする',exact:true}).click();assert.equal(await blocks.first().locator('textarea').inputValue(),'保存する文章');
 await page.locator('#importFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.locator('#status')).toContainText('JSONの構文');
 await page.locator('#importFile').setInputFiles({name:'evil.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,mode:'chat',options:{escape:true},chat:[{type:'script',text:'evil',settings:{}}],profile:[]}))});await expect(page.locator('#status')).toContainText('形式が不正');
 // Clipboard success, legacy fallback, and manual copy branches use controlled browser API stubs.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));await page.locator('#copy').click();assert.equal(await page.evaluate(()=>window.copied),'*保存する文章*');assert.equal(await page.locator('#status').textContent(),'コピーしました');
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});document.execCommand=()=>true;});await page.locator('#copy').click();assert.equal(await page.locator('#status').textContent(),'コピーしました');
 await page.evaluate(()=>document.execCommand=()=>false);await page.locator('#copy').click();assert.match(await page.locator('#status').textContent(),/Ctrl\/Cmd/);assert.equal(await page.locator('#source').evaluate(el=>el.selectionEnd-el.selectionStart===el.value.length),true);
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow '+width);}
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:'/tmp/zeta-mobile.png',fullPage:true});await page.setViewportSize({width:1280,height:900});await page.locator('#previewTab').click();await page.screenshot({path:'/tmp/zeta-desktop.png',fullPage:true});
 await page.locator('#reset').click();await page.getByRole('button',{name:'キャンセル',exact:true}).click();assert.equal(await blocks.first().locator('textarea').inputValue(),'保存する文章');
 await page.locator('#reset').click();await page.getByRole('button',{name:'初期化する',exact:true}).click();assert.equal(await blocks.first().locator('textarea').inputValue(),'');
 await page.evaluate(()=>localStorage.setItem('zeta-markdown-studio','broken'));await page.reload();assert.match(await page.locator('#saveStatus').textContent(),/保存を停止/);assert.equal(await page.evaluate(()=>localStorage.getItem('zeta-markdown-studio')),'broken');
 await page.locator('.settings').evaluate(el=>el.open=true);await page.locator('#reset').click();await page.getByRole('button',{name:'初期化する',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zeta-markdown-studio')).version),1);
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};});await blocks.first().locator('textarea').fill('容量超過');assert.match(await page.locator('#saveStatus').textContent(),/保存できません/);
 assert.deepEqual(errors,[]);console.log('PASS: editor, modes, persistence, templates, import/export, XSS, copy branches, responsive widths, reset, corrupted storage, quota errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
