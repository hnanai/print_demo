# 固定高度滚动容器的打印预览解决方案

> 目标：页面在常规浏览显示为固定高度滚动容器，内容溢出可滚动；使用浏览器打印预览时，能完整预览并打印滚动区域的全部内容；打印前可执行自定义逻辑（如注入水印、刷新数据、生成分页），打印后做清理。

## 方案总览
- 打印媒体样式覆盖：通过 `@media print` 将固定高度滚动容器在打印阶段展开为完整内容（`height: auto; overflow: visible`），并隐藏不需要打印的交互控件。
- 打印生命周期钩子：使用 `window.beforeprint` 与 `window.afterprint` 在打印前后执行自定义逻辑（如注入水印、准备数据、分页标记生成、状态回收）。
- 分页控制与内容不被切割：为内容项应用 `break-inside: avoid` 避免条目被分页切割；通过插入 `.page-break` 元素控制分页断点（`break-before: page`）。
- 嵌套子页面兼容（最新实现，双轨方案）：
  - 轨道一（高度扩展）：打印前动态将同源 `iframe` 高度设置为其文档总高度，并展开父容器，保证 iframe 自身能参与完整打印。
  - 轨道二（打印快照）：打印前将同源子页面完整内容克隆到父页面的打印专用容器里；打印媒体下隐藏真实 `iframe`，改为打印快照，彻底规避“仅视口渲染”的问题。

## 关键实现
### 样式（`index.html`）
```css
/* 打印相关样式 */
@page { size: A4; margin: 12mm; }

@media print {
  /* 隐藏交互控件，仅打印内容 */
  .controls { display: none !important; }

  /* 关键：将固定高度、滚动的容器在打印时展开为完整内容 */
  .content { height: auto !important; overflow: visible !important; }

  /* 关键：展开父页面中的 iframe 包裹容器与 iframe 自身 */
  .iframe-wrap { height: auto !important; overflow: visible !important; }
  .iframe-wrap iframe { height: auto !important; }

  /* 避免单个条目被分页切割 */
  .item { break-inside: avoid; page-break-inside: avoid; }

  /* 支持 JS 生成的分页标记 */
  .page-break { break-before: page; page-break-before: always; }

  /* 仅在打印时显示水印（由 JS 注入） */
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg); font-size: 120px; opacity: 0.08; color: #000; z-index: 9999; pointer-events: none; }

  /* 打印快照：打印时显示克隆内容，隐藏 iframe 区域，避免仅视口渲染 */
  #print-clone-root { display: block !important; margin-top: 12px; }
  .print-clone-section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; margin-top: 12px; }
  .frame-section { display: none !important; }
}
```

### 脚本（`script.js`，函数级注释已添加）
```js
// 打印预览触发函数：调用浏览器打印预览
function triggerPrint() {
  prepareAllFramesForPrint();
  buildPrintClones(); // 参见 script.js:50
  setTimeout(() => window.print(), 50);
}

// 打印前预处理：注入水印，准备数据或分页标记
function handleBeforePrint() {
  const wm = document.createElement('div');
  wm.className = 'watermark';
  wm.textContent = `打印预览 ${new Date().toLocaleString()}`;
  document.body.appendChild(wm);
  notifySubframes('app-print-prep');
}

// 打印后清理：移除打印阶段注入的元素或状态
function handleAfterPrint() {
  document.querySelectorAll('.watermark').forEach((el) => el.remove());
  notifySubframes('app-print-clean');
  restoreSubframeHeights();
  clearPrintClones();
}

// 切换分页标记：每若干条插入分页断点，便于控制分页
function togglePageBreaks() {
  const content = document.getElementById('content');
  const hasBreaks = content.querySelector('.page-break');
  if (hasBreaks) { content.querySelectorAll('.page-break').forEach((el) => el.remove()); return; }
  const items = content.querySelectorAll('.item');
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % 12 === 0) { const br = document.createElement('div'); br.className = 'page-break'; items[i].before(br); }
  }
}

// 打印前展开同源 iframe 高度：避免仅视口参与打印
function adjustSubframeHeightsForPrint() {
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f) => {
    try {
      const cw = f.contentWindow;
      const doc = cw?.document;
      if (!doc) return;
      const html = doc.documentElement;
      const body = doc.body;
      const fullHeight = Math.max(html.scrollHeight, body.scrollHeight);
      if (!f.dataset.originalHeight) f.dataset.originalHeight = f.style.height || '';
      f.style.height = `${fullHeight}px`;
      const wrap = f.parentElement;
      if (wrap && wrap.classList.contains('iframe-wrap')) {
        if (!wrap.dataset.originalHeight) wrap.dataset.originalHeight = wrap.style.height || '';
        wrap.style.height = 'auto';
        wrap.style.overflow = 'visible';
      }
    } catch (e) { /* 跨域跳过 */ }
  });
}

// 打印后恢复 iframe 高度与父容器滚动
function restoreSubframeHeights() {
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f) => {
    const orig = f.dataset.originalHeight;
    if (orig !== undefined) { f.style.height = orig; delete f.dataset.originalHeight; }
    const wrap = f.parentElement;
    if (wrap && wrap.classList.contains('iframe-wrap')) {
      const worig = wrap.dataset.originalHeight;
      if (worig !== undefined) { wrap.style.height = worig; delete wrap.dataset.originalHeight; }
      wrap.style.overflow = '';
    }
  });
}

// 构建打印快照：克隆同源子页面完整内容到父页面打印容器
function buildPrintClones() {
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  root.innerHTML = '';
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f, idx) => {
    try {
      const cw = f.contentWindow;
      const doc = cw?.document;
      if (!doc) return;
      const section = document.createElement('div');
      section.className = 'print-clone-section';
      const title = document.createElement('h2');
      title.textContent = `子页面快照 #${idx + 1}`;
      section.appendChild(title);
      const styleTexts = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '');
      if (styleTexts.length) { const styleEl = document.createElement('style'); styleEl.textContent = styleTexts.join('\n'); section.appendChild(styleEl); }
      const cloned = doc.body.cloneNode(true);
      section.appendChild(cloned);
      root.appendChild(section);
    } catch (e) { /* 跨域跳过 */ }
  });
  root.style.display = 'block';
}

// 清理打印快照
function clearPrintClones() {
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  root.innerHTML = '';
  root.style.display = 'none';
}
```

## 工作原理与关键点
- 浏览器打印流程会重新计算布局并应用打印媒体查询中的样式。默认情况下，固定高度滚动容器只能渲染视口内的内容；但在打印媒体下强制将容器高度恢复为 `auto` 并移除滚动（`overflow: visible`），从而让全部内容参与排版与分页。
- `@page` 可控制纸张尺寸与页边距，配合内容高度可更精准地分页。
- 为避免内容在分页时被截断，使用 `break-inside: avoid`（有时需要配合 `page-break-inside: avoid` 以兼容旧内核）。
- 通过插入 `.page-break` 元素并在打印媒体下设置 `break-before: page`，可以在任意位置强制分页，增强对版式的可控性。
- 打印生命周期钩子允许在渲染前准备好需要的资源与标记，在结束后做清理，保持页面状态整洁。
- 嵌套子页面的“双轨”保证完整性：一方面扩展 `iframe` 的高度，另一方面使用打印快照替代真实 `iframe` 的打印渲染，完全规避仅视口渲染问题。

## 使用步骤（Mac）
1. 启动本地服务：在项目根目录运行 `python3 -m http.server 8000`。
2. 打开 `http://localhost:8000/`。
3. 点击页面上的“打印预览”按钮进入打印预览；如需控制分页，点击“切换分页标记”。
4. 在打印预览中检查是否包含所有条目、条目是否被切割、水印是否显示。

## 常见问题与解决
- 只显示视口内容：未在打印媒体下覆盖容器的 `height` 与 `overflow`，确保 `.content { height: auto; overflow: visible }` 仅作用于 `@media print`。
- 条目被分页切割：给条目设置 `break-inside: avoid`。若仍被切割，检查条目是否包含大图或复杂布局，尝试给更高层级容器也设置避免切割。
- 页眉/页脚需求：可在打印媒体下使用固定定位元素作为水印/页眉/页脚；或借助支持运行页眉/页脚的排版方案。
- 图片/懒加载未完成：在 `beforeprint` 中提前触发加载或 await 数据渲染完成后再调用 `print()`（可在按钮触发逻辑里先准备数据，再 `window.print()`）。

## 跨浏览器注意事项
- Chrome/Edge（Blink）：支持 `@media print` 与 `break-*` 属性较好，但缩放与 DPI 会影响分页精度；必要时用基于高度的启发式分页。
- Safari（WebKit）：对分页控制的支持相对保守；若发现 `break-inside` 不生效，可适度调整布局层级并减少复杂嵌套。
- Firefox（Gecko）：分页支持较好，但某些情况下需要 `page-break-*` 旧属性以兼容；建议同时写两套以提高稳健性。

## 可扩展性建议
- 精准分页：根据 `@page` 尺寸与缩放计算每页可用高度，动态插入 `.page-break`，避免落差。
- 页码与公司信息：在打印媒体下增加固定定位的页眉/页脚；或在每页首部/尾部插入标记元素。
- 审计与日志：在 `beforeprint` 中记录打印操作（时间、用户、数据版本），并在后端建立审计链路。
- 资源准备：为图片与异步数据建立统一的“打印前就绪”检查，确保打印前资源已加载完成。

## 宽表（横向滚动）打印
### 场景与问题
- 字段较多的表格通常设置横向滚动，浏览器打印仅做纵向分页，宽度超出会被裁剪或不可见。

### 解决方案（双轨）
1. 自动缩放到页面宽度（优先）
   - 在打印前计算可打印宽度与表格实际宽度的比例，对 `.print-hscroll` 容器应用 `transform: scale(ratio)` 与 `transform-origin: top left`。
   - 可结合 `@page { size: A4 landscape; }` 提升可用宽度。
2. 列切片快照（超宽表格）
   - 按列宽将表格拆分为多个切片，每个切片只显示一段列范围；在打印媒体下隐藏原始宽表，仅打印切片快照，保证可读性。

### 样式补充示例（`index.html`）
```css
/* 常规浏览：横向滚动 */
.table-wrap { overflow-x: auto; }
.table-wrap table { width: max-content; min-width: 100%; border-collapse: collapse; }

@media print {
  /* 打印阶段移除横向滚动并展开宽度 */
  .print-hscroll { overflow: visible !important; width: auto !important; max-width: none !important; }
  /* 列切片模式隐藏原始宽表 */
  .print-hscroll[data-print-sliced="1"] { display: none !important; }
  .sticky { position: static !important; }
}
```

### 关键脚本（`script.js`，函数级注释已添加）
```js
// 准备宽表（横向滚动）参与打印：自适应缩放或列切片
function prepareWideTablesForPrint() {
  const wraps = document.querySelectorAll('.print-hscroll');
  wraps.forEach((wrap) => {
    const printable = document.documentElement.clientWidth;
    const table = wrap.querySelector('table') || wrap.firstElementChild || wrap;
    const actual = table?.scrollWidth || wrap.scrollWidth;
    const ratio = actual > 0 ? printable / actual : 1;
    if (ratio < 0.625) { buildTableColumnSlices(wrap); wrap.dataset.printSliced = '1'; }
    else { scaleToPrintableWidth(wrap); }
  });
}

// 将元素缩放到可打印宽度
function scaleToPrintableWidth(el) {
  const printable = document.documentElement.clientWidth;
  const content = el.querySelector('table') || el.firstElementChild || el;
  const actual = content?.scrollWidth || el.scrollWidth;
  const ratio = Math.min(1, printable / Math.max(1, actual));
  if (ratio < 1) { el.dataset.printScaled = '1'; el.style.transformOrigin = 'top left'; el.style.transform = `scale(${ratio})`; }
}

// 将宽表按列切片生成打印快照
function buildTableColumnSlices(wrap) {
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  const table = wrap.querySelector('table');
  const printable = document.documentElement.clientWidth;
  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  const cells = headerRow ? Array.from(headerRow.cells) : [];
  const colCount = cells.length;
  const widths = cells.map((c) => c.offsetWidth || 100);
  const groups = []; let start = 0; let acc = 0;
  for (let i = 0; i < colCount; i++) { const w = widths[i] || 100; if (acc + w > printable && i > start) { groups.push([start, i]); start = i; acc = 0; } acc += w; if (i === colCount - 1) groups.push([start, i + 1]); }
  groups.forEach(([from, to], idx) => { const section = document.createElement('div'); section.className = 'print-clone-section'; section.innerHTML = `<h2>表格列切片 #${idx + 1}（列 ${from + 1} ~ ${to}）</h2>`; const clone = table.cloneNode(true); Array.from(clone.rows).forEach((row) => { Array.from(row.cells).forEach((cell, ci) => { if (ci < from || ci >= to) cell.style.display = 'none'; }); }); section.appendChild(clone); root.appendChild(section); }); root.style.display = 'block';
}

// 清理宽表打印状态
function cleanupWideTablePrint() {
  document.querySelectorAll('.print-hscroll[data-printScaled="1"]').forEach((el) => { el.style.transform = ''; el.style.transformOrigin = ''; delete el.dataset.printScaled; });
  document.querySelectorAll('.print-hscroll[data-print-sliced="1"]').forEach((el) => { delete el.dataset.printSliced; });
}
```

### 验证建议
- 在示例页面使用“宽表示例”检查打印预览：
  - 中度超宽：开启缩放，所有列在一页宽度内可见（高度分页）。
  - 极端超宽：生成多个列切片快照，每段显示部分列，纵向依次排列。
- 打印后确认：缩放与切片状态清理，页面恢复。

### 注意事项
- Safari 对缩放的处理与 Chrome 有细微差异，阈值可按实际项目调整。
- 存在冻结列/粘性表头时，建议优先列切片以避免遮罩与偏移问题。

## 复杂页面的打印快照
### 问题
- 子页面可能包含外链样式、动态表单值、Canvas绘图、复杂布局（sticky/fixed），简单克隆会出现样式缺失或内容为空。

### 方案
1. 异步快照构建
   - 在打印前异步提取同源外链样式（`<link rel="stylesheet">`），与内联 `<style>` 合并注入到快照段落。
   - 固化表单状态：将 `input/select/textarea` 的当前值写入克隆节点（属性和值）。
   - 复制画布：将 `canvas` 转为 `dataURL` 并以 `img` 替换，避免跨域导致空白。
2. 生命周期接入
   - 打印入口改为异步，确保快照构建完成后再进入打印预览。
3. 限制与回退
   - 跨域子页面无法访问其文档与样式，保持高度扩展策略；若需要快照，需后端代理或同源化处理。

### 关键脚本（`script.js`）
```js
// 构建打印快照（异步，兼容复杂页面）
async function buildPrintClonesAsync() {
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  root.innerHTML = '';
  const frames = document.querySelectorAll('iframe');
  for (let idx = 0; idx < frames.length; idx++) {
    const f = frames[idx];
    const cw = f.contentWindow; const doc = cw?.document; if (!doc) continue;
    const section = document.createElement('div'); section.className = 'print-clone-section';
    const title = document.createElement('h2'); title.textContent = `子页面快照 #${idx + 1}`; section.appendChild(title);
    const styleTexts = await extractStylesFromDocAsync(doc);
    if (styleTexts.length) { const styleEl = document.createElement('style'); styleEl.textContent = styleTexts.join('\n'); section.appendChild(styleEl); }
    const cloned = doc.body.cloneNode(true); section.appendChild(cloned);
    materializeFormValues(doc, cloned);
    await copyCanvasBitmapsAsync(doc, cloned);
    root.appendChild(section);
  }
  root.style.display = 'block';
}

// 提取文档中的样式（异步）
async function extractStylesFromDocAsync(doc) {
  const texts = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '');
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const ext = await Promise.all(links.map(async (link) => {
    const href = link.getAttribute('href'); if (!href) return '';
    const url = new URL(href, doc.baseURI); if (url.origin !== window.location.origin) return '';
    const res = await fetch(url.href); if (!res.ok) return ''; return await res.text();
  }));
  return texts.concat(ext.filter(Boolean));
}

// 固化表单状态到克隆节点
function materializeFormValues(origDoc, clonedRoot) {
  const origInputs = origDoc.querySelectorAll('input, select, textarea');
  const clonedInputs = clonedRoot.querySelectorAll('input, select, textarea');
  const n = Math.min(origInputs.length, clonedInputs.length);
  for (let i = 0; i < n; i++) { const o = origInputs[i]; const c = clonedInputs[i];
    if (o.tagName === 'INPUT') { const type = o.getAttribute('type') || 'text';
      if (type === 'checkbox' || type === 'radio') { c.checked = o.checked; if (o.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
      else { c.value = o.value; c.setAttribute('value', o.value); }
    } else if (o.tagName === 'TEXTAREA') { c.value = o.value; c.textContent = o.value; }
    else if (o.tagName === 'SELECT') { c.value = o.value; Array.from(c.options).forEach((opt) => { opt.selected = (opt.value === o.value); if (opt.selected) opt.setAttribute('selected', ''); else opt.removeAttribute('selected'); }); }
  }
}

// 复制画布位图到克隆节点（异步）
async function copyCanvasBitmapsAsync(origDoc, clonedRoot) {
  const origCanvases = origDoc.querySelectorAll('canvas');
  const clonedCanvases = clonedRoot.querySelectorAll('canvas');
  const n = Math.min(origCanvases.length, clonedCanvases.length);
  for (let i = 0; i < n; i++) { const src = origCanvases[i]; const dst = clonedCanvases[i];
    try { const dataURL = src.toDataURL('image/png'); const img = document.createElement('img'); img.src = dataURL; img.style.maxWidth = '100%'; dst.replaceWith(img); } catch {}
    await Promise.resolve();
  }
}
```

### 验证
- 复杂子页面包含：外链样式、表单、canvas、宽表。进入打印预览应看到：样式完整、表单值已固化、canvas显示为图片、宽表已缩放/切片。

## CRM 页签与分面打印
### 需求与设计
- 页签切换模拟 CRM 详情页的多分面视图（概览、活动、备注、附件、时间线）。
- 每个页签都有独立的“打印当前页签”按钮，打印范围仅限当前激活面板。
- 概览页签承载子页面（iframe）示例，打印时仅在概览页签下构建子页面快照。

### 页面布局调整（100% 宽度 + 40px 间距）
```css
.container { width: 100%; margin: 24px 0; padding: 0 40px; box-sizing: border-box; }
```

### 页签样式与打印媒体
```css
.tabs { position: sticky; top: 0; background: #fff; z-index: 9; padding: 8px 0; display: flex; gap: 8px; border-bottom: 1px solid #e5e7eb; }
.tab-btn { padding: 8px 12px; border-radius: 20px; border: 1px solid #d1d5db; background: #f3f4f6; cursor: pointer; }
.tab-btn.active { background: #e5e7eb; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

@media print {
  .tabs { display: none !important; }
}
```

### 表格横向滚动的增强
```css
.table-wrap { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.table-wrap table { border-collapse: collapse; width: max-content; min-width: 100%; }
.table-wrap th, .table-wrap td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 13px; white-space: nowrap; min-width: 200px; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; border: 1px solid #e5e7eb; }
.status { display: inline-block; padding: 2px 8px; border-radius: 6px; color: #fff; }
.status.ok { background: #10b981; }
.status.warn { background: #f59e0b; }
.status.err { background: #ef4444; }
```

### 交互与打印入口（`script.js`）
```js
// 绑定页签与打印按钮
function bindTabs() { /* 切换按钮与面板 active 状态 */ }
function setActiveTab(id) { /* 切换激活面板 */ }

// 打印入口：仅当激活页签为概览时构建子页面快照
async function triggerPrint() {
  prepareWideTablesForPrint(); // 只处理当前激活面板中的宽表
  prepareAllFramesForPrint();
  const activeTab = getActiveTabId();
  if (activeTab === 'tab-overview') { await buildPrintClonesAsync(); }
  processWideTablesInCloneRoot();
  window.print();
}

function getActiveTabId() {
  const panel = document.querySelector('.tab-panel.active');
  return panel ? panel.id : null;
}

// 仅处理当前面板中的宽表，避免跨面板误处理
function prepareWideTablesForPrint() {
  document.querySelectorAll('.print-hscroll').forEach((wrap) => {
    const panel = wrap.closest('.tab-panel');
    if (panel && !panel.classList.contains('active')) return;
    // 宽表缩放或列切片逻辑（见“宽表打印”章节）
  });
}
```

### 宽表数据模拟与横向滚动触发
```js
// 初始化“活动”页签的宽表数据（函数级注释与日志已在代码中）
function initActivitiesTableDemo(rows) {
  const table = document.querySelector('#wide-table-wrap table');
  const tbody = table.querySelector('tbody');
  const types = ['text','longtext','currency','percent','date','datetime','chip','status','link','email','phone','id','owner','stage','region','remark'];
  const fmtCurrency = (n) => `¥${(n / 100).toFixed(2)}`;
  const fmtPercent = (n) => `${Math.min(99, Math.max(0, n))}%`;
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rand(0, arr.length - 1)];
  tbody.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < types.length; c++) {
      const td = document.createElement('td');
      const t = types[c];
      if (t === 'text') td.textContent = `客户${rand(1000, 9999)}`;
      else if (t === 'longtext') td.textContent = `较长备注 ${r}-${c}`;
      else if (t === 'currency') td.textContent = fmtCurrency(rand(10000, 999999));
      else if (t === 'percent') td.textContent = fmtPercent(rand(0, 100));
      else if (t === 'date') td.textContent = new Date(Date.now() - rand(0, 10) * 86400000).toLocaleDateString();
      else if (t === 'datetime') td.textContent = new Date(Date.now() - rand(0, 10) * 86400000).toLocaleString();
      else if (t === 'chip') td.innerHTML = `<span class="chip">${pick(['新线索','跟进中','已成交','暂停'])}</span>`;
      else if (t === 'status') td.innerHTML = `<span class="status ${pick(['ok','warn','err'])}">${pick(['正常','预警','异常'])}</span>`;
      else if (t === 'link') td.innerHTML = `<a href="#" onclick="return false">查看详情</a>`;
      else if (t === 'email') td.textContent = `user${rand(1, 999)}@example.com`;
      else if (t === 'phone') td.textContent = `1${rand(3000000000, 3999999999)}`;
      else if (t === 'id') td.textContent = `ID-${rand(100000, 999999)}`;
      else if (t === 'owner') td.textContent = pick(['王一','李二','张三','赵四','刘五']);
      else if (t === 'stage') td.textContent = pick(['初访','方案','谈判','合同','回款']);
      else if (t === 'region') td.textContent = pick(['华北','华东','华南','西南','东北']);
      else if (t === 'remark') td.textContent = `备注#${rand(1, 999)}`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}
```

### 验收要点（页签打印）
- 任一页签点击“打印当前页签”，仅打印该面板内容。
- 概览页签打印时包含子页面快照（样式、表单、canvas）。
- 活动页签打印时宽表按策略显示所有列（缩放或切片）。
- 打印后清理：快照容器清空、宽表缩放/切片状态恢复、iframe高度与父容器滚动恢复。

## 验收清单（Checklist）
- 滚动容器在打印预览中完整展开，包含全部条目。
- 非打印元素（按钮、操作栏）在预览中隐藏。
- 条目分页不被无断点切割，必要位置有 `.page-break` 控制。
- 打印前后钩子执行成功：水印注入与清理正常；自定义逻辑可扩展。
- 跨浏览器观察无明显版式异常，必要时兼容 `page-break-*` 旧属性。

## 代码定位
- 页面结构与打印样式：`index.html`
- 交互与打印钩子逻辑：`script.js`
- 打印快照与 iframe 高度扩展：`script.js:50`, `script.js:95`, `script.js:147`