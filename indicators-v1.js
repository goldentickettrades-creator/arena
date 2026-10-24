/* Golden Ticket chart presentation. No network, identity, order or account changes.
   The loader applies this only to the recognized live client's indicator rendering anchors. */
(function(root) {
  'use strict';
  function rsiArr(v, p) {
    const out = new Array(v.length).fill(null);
    if (!Number.isInteger(p) || p < 1) return out;
    let gain = 0, loss = 0, count = 0;
    for (let i = 1; i < v.length; i++) {
      if (!Number.isFinite(v[i]) || !Number.isFinite(v[i - 1])) {
        gain = loss = count = 0;
        continue;
      }
      const delta = v[i] - v[i - 1], up = Math.max(delta, 0), down = Math.max(-delta, 0);
      if (count < p) {
        gain += up; loss += down; count++;
        if (count < p) continue;
        gain /= p; loss /= p;
      } else {
        gain = (gain * (p - 1) + up) / p;
        loss = (loss * (p - 1) + down) / p;
      }
      out[i] = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    return out;
  }
  function _gtRsiMean(values, period) {
    const result = new Array(values.length).fill(null);
    let sum = 0, count = 0;
    for (let i = 0; i < values.length; i++) {
      if (Number.isFinite(values[i])) { sum += values[i]; count++; }
      if (i >= period && Number.isFinite(values[i - period])) { sum -= values[i - period]; count--; }
      if (i >= period - 1 && count === period) result[i] = sum / period;
    }
    return result;
  }
  function _gtDrawRsi(R, closes, vis, warm, xForK) {
    if (R.rsiH < 42) return;
    const top = R.y + R.h + R.timeH + 4, height = R.rsiH - 8;
    const head = height >= 80 ? 24 : 18, py = top + head, ph = height - head - 8;
    const yFor = v => py + ph * (1 - Math.max(0, Math.min(100, v)) / 100);
    const rsi = rsiArr(closes, 14), mean = _gtRsiMean(rsi, 14), signal = chart.ind.rsima !== false;
    const purple = '#b4a0ff', gold = '#dfbd6a', muted = '#8c97ad';
    const c = chart.cross, inPane = c && c.x >= R.x && c.x <= R.x + R.w && c.y >= top && c.y <= top + height;
    const inspect = c && c.x >= R.x && c.x <= R.x + R.w && (inPane || (c.y >= R.y && c.y <= R.y + R.h));
    let index = vis.length - 1;
    if (inspect && vis.length > 1) {
      const step = xForK(vis[1].k) - xForK(vis[0].k);
      index = Math.round((c.x - xForK(vis[0].k)) / step);
      if (index < 0 || index >= vis.length) index = -1;
    }
    const value = index >= 0 ? rsi[warm + index] : null, avg = index >= 0 ? mean[warm + index] : null;
    ctx.save();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]);
    ctx.fillStyle = '#0c111c'; ctx.fillRect(R.x, top, R.w + R.axisR, height);
    ctx.strokeStyle = '#293346'; ctx.lineWidth = pxW(1);
    ctx.beginPath(); ctx.moveTo(R.x, pxL(top)); ctx.lineTo(R.x + R.w + R.axisR, pxL(top)); ctx.stroke();
    ctx.fillStyle = 'rgba(255,105,130,.045)'; ctx.fillRect(R.x, py, R.w, yFor(70) - py);
    ctx.fillStyle = 'rgba(166,139,250,.065)'; ctx.fillRect(R.x, yFor(70), R.w, yFor(30) - yFor(70));
    ctx.fillStyle = 'rgba(56,211,165,.045)'; ctx.fillRect(R.x, yFor(30), R.w, py + ph - yFor(30));
    ctx.font = '11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    [30, 50, 70].forEach(level => {
      ctx.strokeStyle = level === 50 ? '#30394b' : '#4a4564';
      ctx.lineWidth = pxW(.7); ctx.setLineDash(level === 50 ? [2, 5] : [5, 5]);
      ctx.beginPath(); ctx.moveTo(R.x, pxL(yFor(level), .7)); ctx.lineTo(R.x + R.w, pxL(yFor(level), .7)); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, py, R.w, ph); ctx.clip();
    function line(values, color, width) {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < vis.length; i++) {
        const v = values[warm + i];
        if (!Number.isFinite(v)) { started = false; continue; }
        const x = xForK(vis[i].k), y = yFor(v);
        if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
      }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    }
    if (signal) line(mean, gold, 1.25);
    line(rsi, purple, 1.8);
    if (inspect && index >= 0 && Number.isFinite(value)) {
      const x = xForK(vis[index].k), y = yFor(value);
      ctx.strokeStyle = '#76829a'; ctx.lineWidth = pxW(.7); ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = purple; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const badgeY = Number.isFinite(value) ? Math.max(py + 8, Math.min(py + ph - 8, yFor(value))) : null;
    [30, 50, 70].forEach(level => {
      if (badgeY !== null && Math.abs(yFor(level) - badgeY) < 15) return;
      ctx.fillStyle = muted; ctx.fillText(level.toFixed(0), R.x + R.w + 8, yFor(level));
    });
    if (badgeY !== null) {
      ctx.fillStyle = inspect ? '#3e4960' : '#a48ae8';
      ctx.fillRect(R.x + R.w + 2, badgeY - 8, Math.min(R.axisR - 5, 52), 16);
      ctx.fillStyle = inspect ? '#f2f4fa' : '#111321';
      ctx.fillText(value.toFixed(1), R.x + R.w + 6, badgeY + .5);
    }
    ctx.font = '600 11px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#c4cddd'; ctx.fillText('RSI 14', R.x + 8, top + head / 2);
    ctx.font = '11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.fillStyle = purple; ctx.fillText(Number.isFinite(value) ? value.toFixed(2) : '—', R.x + 56, top + head / 2);
    if (signal && R.w > 245) {
      ctx.fillStyle = gold; ctx.fillText('SMA 14  ' + (Number.isFinite(avg) ? avg.toFixed(2) : '—'), R.x + 110, top + head / 2);
    }
    ctx.textAlign = 'right'; ctx.fillStyle = muted;
    if (R.w > 230) ctx.fillText(inspect ? 'CURSOR' : chart.live ? 'LIVE' : 'HISTORY', R.x + R.w - 8, top + head / 2);
    ctx.restore();
  }
  function _gtBandFill(R, upper, lower, vis, warm, xForK, yForP) {
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    let start = -1;
    function fill(end) {
      if (start < 0 || end <= start) return;
      ctx.beginPath(); ctx.moveTo(xForK(vis[start].k), yForP(upper[warm + start]));
      for (let i = start + 1; i <= end; i++) ctx.lineTo(xForK(vis[i].k), yForP(upper[warm + i]));
      for (let i = end; i >= start; i--) ctx.lineTo(xForK(vis[i].k), yForP(lower[warm + i]));
      ctx.closePath(); ctx.fillStyle = 'rgba(139,158,204,.075)'; ctx.fill();
    }
    for (let i = 0; i < vis.length; i++) {
      if (Number.isFinite(upper[warm + i]) && Number.isFinite(lower[warm + i])) {
        if (start < 0) start = i;
      } else { fill(i - 1); start = -1; }
    }
    fill(vis.length - 1); ctx.restore();
  }
  function apply(html) {
    if (html.includes('/*gt:indicators-v1*/')) return html;
    const calc = /function rsiArr\(v,p\)\{[^\r\n]+\}/g;
    const paint = /  if\(chart.ind.rsi\)\{const ry=R.y\+R.h\+R.timeH\+6,[^\r\n]+\}/g;
    const warm = 'const WARM=Math.min(50,Math.max(0,leftK));';
    const size = 'const h=Math.max(110,VH-top-bottom-timeH-rsiH);';
    if ([...html.matchAll(calc)].length !== 1 || [...html.matchAll(paint)].length !== 1 || !html.includes(warm) || !html.includes(size)) return html;
    html = html.replace(calc, () => '/*gt:indicators-v1*/' + rsiArr + '\n' + _gtRsiMean + '\n' + _gtDrawRsi + '\n' + _gtBandFill);
    html = html.replace(paint, '  if(chart.ind.rsi)_gtDrawRsi(R,closes,vis,WARM,xForK);');
    // More settled seed history prevents the start of the visible window dominating smoothing.
    html = html.replace(warm, 'const WARM=Math.min(chart.ind.ema200?600:chart.ind.rsi?200:chart.ind.ema50?200:100,Math.max(0,leftK));');
    html = html.replace(size, 'const _gtAvailable=Math.max(0,VH-top-bottom-timeH);rsiH=chart.ind.rsi?Math.max(0,Math.min(mobile?144:190,Math.round(_gtAvailable*.28),_gtAvailable-110)):0;' + size);
    html = html.replace('["rsi","RSI"]', '["rsi","RSI · 14 close"],["rsima","RSI smoothing · SMA 14"]');
    html = html.replace('rsi:false,lv:true', 'rsi:false,rsima:true,lv:true');
    html = html.replace('chart.ind[k]=!chart.ind[k];', 'chart.ind[k]=k==="rsima"?chart.ind[k]===false:!chart.ind[k];');
    html = html.replace('ctx.globalAlpha=.85;ctx.lineWidth=wd||1.3;', 'ctx.globalAlpha=.95;ctx.lineWidth=wd||1.5;');
    html = html.replace('plot(up,"#7d8696",1);plot(dn,"#7d8696",1);plot(m,"#7d8696",1);',
      '_gtBandFill(R,up,dn,vis,WARM,xForK,yForP);plot(up,"#8b9ecc",1);plot(dn,"#8b9ecc",1);ctx.setLineDash([4,4]);plot(m,"#8b9ecc",1);ctx.setLineDash([]);');
    html = html.replace('["boll","Bollinger"]', '["boll","Bollinger · 20, 2σ"]');
    html = html.replace('["vwap","VWAP"]', '["vwap","Visible-range VWAP"]');
    // Touching the RSI inspects it without scaling the time axis or creating a drawing on the price pane.
    const pointer = `\n(function(){
      function inside(e){if(viewMode!=="game"||!MAP||!chart.ind.rsi)return false;const R=MAP.R;return e.clientX>=R.x&&e.clientX<=R.x+R.w&&e.clientY>=R.y+R.h+R.timeH+4&&e.clientY<=R.y+R.h+R.timeH+R.rsiH;}
      let held=null;
      canvas.addEventListener("pointerdown",function(e){if(!inside(e))return;held=e.pointerId;chart.cross={x:e.clientX,y:e.clientY};e.preventDefault();e.stopImmediatePropagation();try{canvas.setPointerCapture(e.pointerId);}catch(_){}render();},true);
      canvas.addEventListener("pointermove",function(e){if(held!==e.pointerId&&!inside(e))return;if(drag||pinch)return;chart.cross={x:e.clientX,y:e.clientY};if(held===e.pointerId){e.preventDefault();e.stopImmediatePropagation();}render();},true);
      function end(e){if(held!==e.pointerId)return;held=null;try{canvas.releasePointerCapture(e.pointerId);}catch(_){} }
      canvas.addEventListener("pointerup",end,true);canvas.addEventListener("pointercancel",end,true);
    })();\n`;
    return html.replace('</body>', '<script>' + pointer + '<\/script></body>');
  }
  const api = { apply, rsiArr, mean: _gtRsiMean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArenaIndicatorsPatch = api;
})(typeof window === 'undefined' ? globalThis : window);
