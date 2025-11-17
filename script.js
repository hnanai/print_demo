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
  bindUIEvents();
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
  log('bindUIEvents:done');
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
function triggerPrint() {
  log('triggerPrint:start');
  prepareAllFramesForPrint();
  buildPrintClones();
  setTimeout(() => window.print(), 50);
  log('triggerPrint:invoke window.print');
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