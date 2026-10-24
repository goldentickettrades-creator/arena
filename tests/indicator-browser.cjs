const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { install, open, profile } = require('./returning-account.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}) });
  try {
    for (const [width, height, dpr] of [[390,844,3], [1440,1000,1], [844,390,2], [320,640,2]]) {
      const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor: dpr, isMobile: width < 600, hasTouch: width < 900 });
      await install(context);
      const s = await open(context, false);
      await profile(s.frame, 'Chart QA');
      await s.frame.evaluate(() => { chart.ind.rsi=true; enterMarket('SPY'); setChain(false); render(); });
      await s.page.waitForTimeout(1500);
      const before = await s.frame.evaluate(() => {
        render(); const R=rectFor(); return {R, tf: chart.tf, mode: chart.priceMode, dpr: DPR, width: canvas.width, warmMath: rsiArr([1,2,1,2],2)[3]};
      });
      assert.equal(before.warmMath, 75);
      assert.equal(before.width, Math.round(width*dpr));
      const R=before.R;
      assert.ok(R.h>=110);
      assert.ok(R.y+R.h+R.timeH+R.rsiH<=height, 'pane within viewport');
      const x=R.x+R.w*.4, y=R.y+R.h+R.timeH+R.rsiH*.6;
      await s.page.mouse.move(x,y); await s.page.mouse.down(); await s.page.mouse.move(x+20,y-3); await s.page.mouse.up();
      assert.deepEqual(await s.frame.evaluate(() => [chart.tf, chart.priceMode, drag]), [before.tf,before.mode,null], 'RSI inspect does not scale or drag price chart');
      await s.frame.evaluate(() => { buildIndMenu(); el('indmenu').classList.remove('hide'); });
      await s.frame.locator('[data-ind=rsima]').click();
      assert.equal(await s.frame.evaluate(() => chart.ind.rsima), false);
      await s.frame.locator('[data-ind=rsima]').click();
      assert.equal(await s.frame.evaluate(() => chart.ind.rsima), true);
      await s.frame.evaluate(() => { el('indmenu').classList.add('hide'); chart.cross=null; render(); });
      // Exercise timeframes, history, zoom density and the options panel with the new layout.
      await s.frame.evaluate(() => {
        for(const tf of [5000,60000,300000,3600000]) {chart.tf=tf;chart.vis=100;render();}
        chart.live=false; chart.anchorT=mnow()-chart.tf*100; render();
        chart.vis=500;render();chart.vis=60;chart.tf=300000;chart.live=true;render();
        const saved={...chart.ind};
        for(const key of ['ema9','ema21','ema50','ema200','sma50','boll','vwap','avwap'])chart.ind[key]=true;
        render();chart.ind=saved;
        setChain(true);render();setChain(false);render();
        buildTF();
      });
      if(process.env.SHOT_DIR) {fs.mkdirSync(process.env.SHOT_DIR,{recursive:true});await s.page.screenshot({path:process.env.SHOT_DIR+`/indicators-${width}.png`});}
      assert.equal(s.errors.length,0,JSON.stringify(s.errors));
      console.log(`PASS ${width}x${height} DPR ${dpr}: layout, RSI pointer, smoothing toggle, timeframes/history/zoom, options panel, runtime`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
