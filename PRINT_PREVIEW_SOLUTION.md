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