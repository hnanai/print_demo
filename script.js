// 统一日志输出
// 参数：name - 方法名或标签；args - 额外信息
// 作用：在每个方法执行时输出结构化日志，含时间戳与上下文信息。
function log(name, ...args) {
  const ts = new Date().toISOString();
  console.log(`[PRINT-DEMO ${ts}]`, name, ...args);
}

// 初始化示例数据与绑定事件
// 说明：页面加载后填充大量内容以形成滚动效果，并绑定打印相关逻辑。
function bootstrap() {
  log('bootstrap:start');
  initLongContent(40);
  initNotesDemo();
  initAttachmentsDemo();
  initTimelineDemo(30);
  initActivitiesTableDemo(30);
  bindUIEvents();
  bindTabs();
  bindPrintLifecycle();
  log('bootstrap:done');
}

// 初始化滚动容器内容
// 参数：count - 生成的条目数量
// 作用：向滚动容器插入指定数量的条目，制造溢出滚动场景。
function initLongContent(count) {
  log('initLongContent:start', { count });
  const container = document.getElementById('content');
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= count; i++) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <h3>条目 #${i}</h3>
      <p>这是一段示例文本，用于演示当容器高度固定且内容过多时的滚动与打印行为。打印时应包含所有条目，而不仅是当前视口可见部分。</p>
    `;
    frag.appendChild(el);
  }
  container.appendChild(frag);
  log('initLongContent:done', { total: container.children.length });
}

// 绑定交互控件事件
// 作用：为“打印预览”“切换分页标记”“添加更多内容”按钮绑定动作。
function bindUIEvents() {
  log('bindUIEvents:start');
  const btnPrint = document.getElementById('btnPrint');
  const btnPageBreak = document.getElementById('btnPageBreak');
  const btnAppend = document.getElementById('btnAppend');

  btnPrint.addEventListener('click', triggerPrint);
  btnPageBreak.addEventListener('click', togglePageBreaks);
  btnAppend.addEventListener('click', () => initLongContent(10));
  // 绑定各页签的打印按钮
  document.querySelectorAll('.btn-print[data-action="print"]').forEach((el) => {
    el.addEventListener('click', triggerPrint);
  });
  log('bindUIEvents:done');
}

// 绑定页签切换
// 作用：CRM页签切换不同组件面板，仅激活一个面板；打印默认只输出当前激活面板
function bindTabs() {
  log('bindTabs:start');
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-tab');
      setActiveTab(id);
    });
  });
  log('bindTabs:done');
}

// 设置激活页签
// 参数：id - 面板ID
// 作用：切换按钮激活态与面板显示状态
function setActiveTab(id) {
  log('setActiveTab:start', { id });
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === id));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === id));
  log('setActiveTab:done', { id });
}

// 初始化备注与表单示例
// 作用：预填充CRM详情页中的表单控件，便于打印快照固化状态
function initNotesDemo() {
  log('initNotesDemo:start');
  const contact = document.getElementById('contactInput');
  const priority = document.getElementById('prioritySelect');
  const notes = document.getElementById('notesTextarea');
  const follow = document.getElementById('followUpCheck');
  if (contact) contact.value = '张三';
  if (priority) priority.value = 'medium';
  if (notes) notes.value = '示例备注：客户对报价有疑问，需安排复谈。';
  if (follow) follow.checked = true;
  log('initNotesDemo:done');
}

// 初始化附件与画布示例
// 作用：在canvas中绘制简单图形，模拟CRM图表或签字板
function initAttachmentsDemo() {
  log('initAttachmentsDemo:start');
  const canvas = document.getElementById('demoCanvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(10, 10, 120, 60);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(200, 60, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = '14px -apple-system';
    ctx.fillText('CRM Demo Canvas', 10, 100);
  }
  log('initAttachmentsDemo:done');
}

// 初始化时间线示例
// 参数：count - 生成的条目数量
// 作用：生成纵向滚动的时间线，模拟CRM活动记录
function initTimelineDemo(count) {
  log('initTimelineDemo:start', { count });
  const tl = document.getElementById('timeline');
  if (!tl) { log('initTimelineDemo:skip'); return; }
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= count; i++) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<h3>事件 #${i}</h3><p>CRM时间线事件描述，包含客户互动、任务、邮件等。</p>`;
    frag.appendChild(el);
  }
  tl.appendChild(frag);
  log('initTimelineDemo:done', { total: tl.children.length });
}

// 初始化“活动”页签的宽表数据
// 参数：rows - 生成的行数
// 作用：填充宽表为多种数据类型，模拟CRM详情页的复杂单元格内容，并触发横向滚动
function initActivitiesTableDemo(rows) {
  log('initActivitiesTableDemo:start', { rows });
  const table = document.querySelector('#wide-table-wrap table');
  if (!table) { log('initActivitiesTableDemo:skip'); return; }
  const tbody = table.querySelector('tbody');
  if (!tbody) { log('initActivitiesTableDemo:no-tbody'); return; }
  tbody.innerHTML = '';

  const types = [
    'text', 'longtext', 'currency', 'percent', 'date', 'datetime', 'chip', 'status',
    'link', 'email', 'phone', 'id', 'owner', 'stage', 'region', 'remark'
  ];

  const fmtCurrency = (n) => `¥${(n / 100).toFixed(2)}`;
  const fmtPercent = (n) => `${Math.min(99, Math.max(0, n))}%`;
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[rand(0, arr.length - 1)];

  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < types.length; c++) {
      const td = document.createElement('td');
      const t = types[c];
      if (t === 'text') td.textContent = `客户${rand(1000, 9999)}`;
      else if (t === 'longtext') td.textContent = `这是一段较长的备注，用于模拟单元格长文本。${r}-${c}，请检查打印时是否会被切割。`;
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
  log('initActivitiesTableDemo:done', { rows: tbody.children.length, cols: types.length });
}

// 绑定打印生命周期事件
// 作用：在进入打印预览前执行预处理，在退出打印后执行清理。
function bindPrintLifecycle() {
  log('bindPrintLifecycle:start');
  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('afterprint', handleAfterPrint);
  log('bindPrintLifecycle:done');
}

// 打印预览触发函数
// 作用：调用浏览器打印预览。配合 beforeprint/afterprint 完成预处理与清理。
// 打印预览触发函数（异步快照版）
// 作用：在打印前准备宽表、通知子页面、构建复杂页面打印快照（异步），然后进入打印
async function triggerPrint() {
  log('triggerPrint:start');
  prepareWideTablesForPrint();
  prepareAllFramesForPrint();
  const activeTab = getActiveTabId();
  if (activeTab === 'tab-overview') {
    await buildPrintClonesAsync();
  }
  processWideTablesInCloneRoot();
  window.print();
  log('triggerPrint:invoke window.print');
}

// 获取当前激活的页签ID
// 作用：用于决定是否构建特定页签的打印快照（如概览中的子页面快照）
function getActiveTabId() {
  log('getActiveTabId:start');
  const panel = document.querySelector('.tab-panel.active');
  const id = panel ? panel.id : null;
  log('getActiveTabId:done', { id });
  return id;
}

// 打印前预处理
// 作用：
// 1) 注入水印，标注打印时间与环境；
// 2) 可在此处执行数据刷新、懒加载资源、生成分页标记等。
function handleBeforePrint() {
  log('handleBeforePrint:start');
  // 注入水印
  const wm = document.createElement('div');
  wm.className = 'watermark';
  const now = new Date();
  wm.textContent = `打印预览 ${now.toLocaleString()}`;
  document.body.appendChild(wm);

  // 示例：可选的动态分页标记生成（默认不启用，使用按钮控制）
  // generatePageBreaksHeuristic();

  notifySubframes('app-print-prep');
  log('handleBeforePrint:done');
}

// 打印后清理
// 作用：移除打印阶段注入的元素或状态，恢复页面。
function handleAfterPrint() {
  log('handleAfterPrint:start');
  document.querySelectorAll('.watermark').forEach((el) => el.remove());
  notifySubframes('app-print-clean');
  restoreSubframeHeights();
  cleanupWideTablePrint();
  clearPrintClones();
  log('handleAfterPrint:done');
}

// 准备所有同源子页面参与打印
// 作用：打印前调用子页面的预处理逻辑（事件或显式方法），以便其也能注入水印/分页等。
function prepareAllFramesForPrint() {
  log('prepareAllFramesForPrint:start');
  // 广播打印前事件
  notifySubframes('app-print-prep');
  // 调整同源 iframe 高度以包含完整内容
  adjustSubframeHeightsForPrint();
  log('prepareAllFramesForPrint:done');
}

// 向同源 iframe 发送打印生命周期通知
// 参数：type - 打印阶段类型（app-print-prep/app-print-clean）
// 作用：通过 postMessage 通知子页面，若暴露方法则直接调用以提高可靠性。
function notifySubframes(type) {
  log('notifySubframes:start', { type });
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f) => {
    try {
      const cw = f.contentWindow;
      if (!cw) return;
      cw.postMessage({ type }, '*');
      if (typeof cw.appBeforePrint === 'function' && type === 'app-print-prep') cw.appBeforePrint();
      if (typeof cw.appAfterPrint === 'function' && type === 'app-print-clean') cw.appAfterPrint();
    } catch (e) {
      // 跨域 iframe 不可访问：此处忽略，依赖其自身实现
      log('notifySubframes:error', e && e.message);
    }
  });
  log('notifySubframes:done');
}

// 调整同源子页面 iframe 高度以包含其完整文档内容
// 作用：在打印前将 iframe 高度设置为其文档总高度，避免只打印视口区域；打印后恢复原始高度
function adjustSubframeHeightsForPrint() {
  log('adjustSubframeHeightsForPrint:start');
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f) => {
    try {
      const cw = f.contentWindow;
      const doc = cw?.document;
      if (!doc) return;
      const html = doc.documentElement;
      const body = doc.body;
      const fullHeight = Math.max(html.scrollHeight, body.scrollHeight);
      // 保存原始高度以便恢复
      if (!f.dataset.originalHeight) f.dataset.originalHeight = f.style.height || '';
      f.style.height = `${fullHeight}px`;
      // 若父容器可识别，亦展开
      const wrap = f.parentElement;
      if (wrap && wrap.classList.contains('iframe-wrap')) {
        if (!wrap.dataset.originalHeight) wrap.dataset.originalHeight = wrap.style.height || '';
        wrap.style.height = 'auto';
        wrap.style.overflow = 'visible';
      }
      log('adjustSubframeHeightsForPrint:frame', { id: f.id || null, fullHeight });
    } catch (e) {
      // 跨域 iframe：无法读取内容高度，跳过
      log('adjustSubframeHeightsForPrint:error', e && e.message);
    }
  });
  log('adjustSubframeHeightsForPrint:done');
}

// 恢复 iframe 到打印前的高度设置
// 作用：在打印后将 iframe 及其父容器高度恢复，避免影响页面布局
function restoreSubframeHeights() {
  log('restoreSubframeHeights:start');
  const frames = document.querySelectorAll('iframe');
  frames.forEach((f) => {
    const orig = f.dataset.originalHeight;
    if (orig !== undefined) {
      f.style.height = orig;
      delete f.dataset.originalHeight;
    }
    const wrap = f.parentElement;
    if (wrap && wrap.classList.contains('iframe-wrap')) {
      const worig = wrap.dataset.originalHeight;
      if (worig !== undefined) {
        wrap.style.height = worig;
        delete wrap.dataset.originalHeight;
      }
      // 恢复滚动
      wrap.style.overflow = '';
    }
    log('restoreSubframeHeights:frame', { id: f.id || null });
  });
  log('restoreSubframeHeights:done');
}

// 构建打印快照（克隆 iframe 内容到父页面）
// 作用：在打印前将同源子页面的完整内容克隆到父页面的打印专用容器，避免浏览器仅渲染 iframe 视口
function buildPrintClones() {
  log('buildPrintClones:start');
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

      // 复制子页面内联样式（仅复制 <style> 内容，外链样式此示例不处理）
      const styleTexts = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '');
      if (styleTexts.length) {
        const styleEl = document.createElement('style');
        styleEl.textContent = styleTexts.join('\n');
        section.appendChild(styleEl);
      }

      // 深度克隆子页面主体内容
      const cloned = doc.body.cloneNode(true);
      section.appendChild(cloned);
      root.appendChild(section);
      log('buildPrintClones:cloned', { index: idx + 1 });
    } catch (e) {
      // 跨域 iframe：无法克隆，跳过
      log('buildPrintClones:error', e && e.message);
    }
  });
  // 显示打印快照容器（打印媒体下会强制显示）
  root.style.display = 'block';
  log('buildPrintClones:done');
}

// 构建打印快照（异步，兼容复杂页面）
// 作用：同源子页面的打印快照将包含其内联样式与可用的外链样式，同时固化表单状态与画布内容
async function buildPrintClonesAsync() {
  log('buildPrintClonesAsync:start');
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  root.innerHTML = '';
  const frames = document.querySelectorAll('iframe');
  for (let idx = 0; idx < frames.length; idx++) {
    const f = frames[idx];
    try {
      const cw = f.contentWindow;
      const doc = cw?.document;
      if (!doc) continue;
      const section = document.createElement('div');
      section.className = 'print-clone-section';
      const title = document.createElement('h2');
      title.textContent = `子页面快照 #${idx + 1}`;
      section.appendChild(title);

      const styleTexts = await extractStylesFromDocAsync(doc);
      if (styleTexts.length) {
        const styleEl = document.createElement('style');
        styleEl.textContent = styleTexts.join('\n');
        section.appendChild(styleEl);
      }

      const cloned = doc.body.cloneNode(true);
      section.appendChild(cloned);

      materializeFormValues(doc, cloned);
      await copyCanvasBitmapsAsync(doc, cloned);

      root.appendChild(section);
      log('buildPrintClonesAsync:cloned', { index: idx + 1 });
    } catch (e) {
      log('buildPrintClonesAsync:error', e && e.message);
    }
  }
  root.style.display = 'block';
  log('buildPrintClonesAsync:done');
}

// 提取文档中的样式（异步）
// 参数：doc - 需要提取样式的文档对象
// 返回：包含所有内联 <style> 文本与同源外链样式内容的字符串数组
async function extractStylesFromDocAsync(doc) {
  log('extractStylesFromDocAsync:start');
  const texts = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '');
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const tasks = links.map(async (link) => {
    try {
      const href = link.getAttribute('href');
      if (!href) return '';
      const url = new URL(href, doc.baseURI);
      if (url.origin !== window.location.origin) return '';
      const res = await fetch(url.href);
      if (!res.ok) return '';
      const css = await res.text();
      return css || '';
    } catch {
      return '';
    }
  });
  const ext = await Promise.all(tasks);
  const all = texts.concat(ext.filter(Boolean));
  log('extractStylesFromDocAsync:done', { count: all.length });
  return all;
}

// 固化表单状态到克隆节点
// 参数：origDoc - 原始文档；clonedRoot - 克隆的根节点
// 作用：确保输入框、选择框、文本域在打印快照中展示当前值
function materializeFormValues(origDoc, clonedRoot) {
  log('materializeFormValues:start');
  const origInputs = origDoc.querySelectorAll('input, select, textarea');
  const clonedInputs = clonedRoot.querySelectorAll('input, select, textarea');
  const n = Math.min(origInputs.length, clonedInputs.length);
  for (let i = 0; i < n; i++) {
    const o = origInputs[i];
    const c = clonedInputs[i];
    if (o.tagName === 'INPUT') {
      const type = o.getAttribute('type') || 'text';
      if (type === 'checkbox' || type === 'radio') {
        c.checked = o.checked;
        if (o.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked');
      } else {
        c.value = o.value;
        c.setAttribute('value', o.value);
      }
    } else if (o.tagName === 'TEXTAREA') {
      c.value = o.value;
      c.textContent = o.value;
    } else if (o.tagName === 'SELECT') {
      c.value = o.value;
      Array.from(c.options).forEach((opt) => {
        opt.selected = (opt.value === o.value);
        if (opt.selected) opt.setAttribute('selected', ''); else opt.removeAttribute('selected');
      });
    }
  }
  log('materializeFormValues:done');
}

// 复制画布位图到克隆节点（异步）
// 参数：origDoc - 原始文档；clonedRoot - 克隆的根节点
// 作用：将原页面中的 canvas 渲染结果在快照中复现，避免空白
async function copyCanvasBitmapsAsync(origDoc, clonedRoot) {
  log('copyCanvasBitmapsAsync:start');
  const origCanvases = origDoc.querySelectorAll('canvas');
  const clonedCanvases = clonedRoot.querySelectorAll('canvas');
  const n = Math.min(origCanvases.length, clonedCanvases.length);
  for (let i = 0; i < n; i++) {
    const src = origCanvases[i];
    const dst = clonedCanvases[i];
    try {
      const dataURL = src.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataURL;
      img.style.maxWidth = '100%';
      dst.replaceWith(img);
    } catch (e) {
      // 某些跨域图片会导致 toDataURL 失败，忽略
      log('copyCanvasBitmapsAsync:error', e && e.message);
    }
    await Promise.resolve();
  }
  log('copyCanvasBitmapsAsync:done');
}

// 清理打印快照容器
// 作用：打印完成后清空并隐藏打印快照内容
function clearPrintClones() {
  log('clearPrintClones:start');
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  root.innerHTML = '';
  root.style.display = 'none';
  log('clearPrintClones:done');
}

// 准备宽表（横向滚动）参与打印
// 作用：在打印前针对 .print-hscroll 区域执行自适应处理：优先按页面宽度缩放，若过宽则按列切片生成打印快照
function prepareWideTablesForPrint() {
  log('prepareWideTablesForPrint:start');
  const wraps = document.querySelectorAll('.print-hscroll');
  wraps.forEach((wrap) => {
    try {
      // 仅处理当前可见面板中的宽表
      const panel = wrap.closest('.tab-panel');
      if (panel && !panel.classList.contains('active')) return;
      const printable = document.documentElement.clientWidth;
      const table = wrap.querySelector('table') || wrap.firstElementChild || wrap;
      const actual = table?.scrollWidth || wrap.scrollWidth;
      const ratio = actual > 0 ? printable / actual : 1;
      if (ratio < 0.625) { // 超宽：进入列切片
        buildTableColumnSlices(wrap);
        wrap.dataset.printSliced = '1';
        log('prepareWideTablesForPrint:slice', { actual, printable });
      } else {
        scaleToPrintableWidth(wrap);
        log('prepareWideTablesForPrint:scale', { actual, printable });
      }
    } catch (e) {
      log('prepareWideTablesForPrint:error', e && e.message);
    }
  });
  log('prepareWideTablesForPrint:done');
}

// 将元素缩放到可打印宽度
// 参数：el - 需要缩放的容器（通常为 .print-hscroll）
// 作用：根据内容实际宽度计算比例，对容器应用 transform 缩放，打印后可清理
function scaleToPrintableWidth(el) {
  log('scaleToPrintableWidth:start');
  const printable = document.documentElement.clientWidth;
  const content = el.querySelector('table') || el.firstElementChild || el;
  const actual = content?.scrollWidth || el.scrollWidth;
  const ratio = Math.min(1, printable / Math.max(1, actual));
  if (ratio < 1) {
    el.dataset.printScaled = '1';
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${ratio})`;
    log('scaleToPrintableWidth:applied', { ratio });
  } else {
    log('scaleToPrintableWidth:skip', { ratio });
  }
  log('scaleToPrintableWidth:done');
}

// 将宽表按列切片生成打印快照
// 参数：wrap - 包裹表格的容器（通常为 .print-hscroll）
// 作用：按可打印宽度将列分组，克隆表格并隐藏非本组列，克隆结果追加到 #print-clone-root
function buildTableColumnSlices(wrap) {
  log('buildTableColumnSlices:start');
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  const table = wrap.querySelector('table');
  if (!table) return;

  const printable = document.documentElement.clientWidth;
  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  const cells = headerRow ? Array.from(headerRow.cells) : [];
  const colCount = cells.length;
  const widths = cells.map((c) => c.offsetWidth || 100);

  const groups = [];
  let start = 0;
  let acc = 0;
  for (let i = 0; i < colCount; i++) {
    const w = widths[i] || 100;
    if (acc + w > printable && i > start) {
      groups.push([start, i]);
      start = i;
      acc = 0;
    }
    acc += w;
    if (i === colCount - 1) groups.push([start, i + 1]);
  }

  groups.forEach(([from, to], idx) => {
    const section = document.createElement('div');
    section.className = 'print-clone-section';
    const title = document.createElement('h2');
    title.textContent = `表格列切片 #${idx + 1}（列 ${from + 1} ~ ${to}）`;
    section.appendChild(title);

    const clone = table.cloneNode(true);
    Array.from(clone.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, ci) => {
        if (ci < from || ci >= to) cell.style.display = 'none';
      });
    });
    section.appendChild(clone);
    root.appendChild(section);
  });
  root.style.display = 'block';
  log('buildTableColumnSlices:done', { groups });
}

// 清理宽表的打印阶段状态
// 作用：移除缩放样式与状态标记；切片快照由 clearPrintClones 统一清理
function cleanupWideTablePrint() {
  log('cleanupWideTablePrint:start');
  document.querySelectorAll('.print-hscroll[data-printScaled="1"]').forEach((el) => {
    el.style.transform = '';
    el.style.transformOrigin = '';
    delete el.dataset.printScaled;
    log('cleanupWideTablePrint:scaledCleared');
  });
  document.querySelectorAll('.print-hscroll[data-print-sliced="1"]').forEach((el) => {
    delete el.dataset.printSliced;
    log('cleanupWideTablePrint:slicedCleared');
  });
  log('cleanupWideTablePrint:done');
}

// 处理打印快照容器中的宽表（来自子页面克隆内容）
// 作用：在父页面构建子页面打印快照后，同样对其中的宽表执行列切片（或缩放）
function processWideTablesInCloneRoot() {
  log('processWideTablesInCloneRoot:start');
  const root = document.getElementById('print-clone-root');
  if (!root) return;
  const tables = root.querySelectorAll('table');
  const printable = document.documentElement.clientWidth;
  tables.forEach((table) => {
    try {
      const actual = table.scrollWidth;
      const ratio = actual > 0 ? printable / actual : 1;
      if (ratio < 0.625) {
        const section = table.closest('.print-clone-section');
        if (section) {
          const wrap = document.createElement('div');
          wrap.className = 'print-hscroll';
          wrap.appendChild(table.cloneNode(true));
          buildTableColumnSlices(wrap);
        }
        table.style.display = 'none';
        log('processWideTablesInCloneRoot:slice');
      } else if (ratio < 1) {
        table.style.transformOrigin = 'top left';
        table.style.transform = `scale(${ratio})`;
        log('processWideTablesInCloneRoot:scale', { ratio });
      }
    } catch (e) {
      log('processWideTablesInCloneRoot:error', e && e.message);
    }
  });
  log('processWideTablesInCloneRoot:done');
}

// 切换分页标记
// 作用：在若干条目后插入或移除分页标记，便于打印分页控制。
function togglePageBreaks() {
  log('togglePageBreaks:start');
  const content = document.getElementById('content');
  const hasBreaks = content.querySelector('.page-break');
  if (hasBreaks) {
    content.querySelectorAll('.page-break').forEach((el) => el.remove());
    log('togglePageBreaks:removed');
    return;
  }
  const items = content.querySelectorAll('.item');
  // 简单策略：每 12 条插入一个分页标记（实际项目中可根据高度与纸张尺寸更精细化计算）
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % 12 === 0) {
      const br = document.createElement('div');
      br.className = 'page-break';
      items[i].before(br);
    }
  }
  log('togglePageBreaks:inserted');
}

// 依据高度的分页标记生成（演示用）
// 作用：尝试按近似高度阈值（A4 页）生成分页标记；受缩放与样式影响，需根据实际项目调整参数。
function generatePageBreaksHeuristic() {
  log('generatePageBreaksHeuristic:start');
  const content = document.getElementById('content');
  content.querySelectorAll('.page-break').forEach((el) => el.remove());

  // 近似阈值（像素）：取决于浏览器 DPI 与缩放；这里仅示例。
  const pageHeightPx = 1000; // 可按需微调
  let acc = 0;

  const nodes = Array.from(content.children);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const rect = node.getBoundingClientRect();
    acc += rect.height;
    if (acc >= pageHeightPx && node.classList.contains('item')) {
      const br = document.createElement('div');
      br.className = 'page-break';
      node.before(br);
      acc = 0;
    }
  }
  log('generatePageBreaksHeuristic:done');
}

// 启动
document.addEventListener('DOMContentLoaded', bootstrap);