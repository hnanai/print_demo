// 统一日志输出（子页面）
// 参数：name - 方法名或标签；args - 额外信息
// 作用：在每个方法执行时输出结构化日志，含时间戳与上下文信息。
function log(name, ...args) {
  const ts = new Date().toISOString();
  console.log(`[PRINT-CHILD ${ts}]`, name, ...args);
}

// 初始化与打印钩子（子页面）
// 说明：子页面自身包含固定高度滚动容器，并在打印前后执行自定义逻辑；支持父页面消息通知与显式方法调用。
function bootstrapChild() {
  log('bootstrapChild:start');
  initChildContent(30);
  bindChildPrintLifecycle();
  bindMessageBridge();
  log('bootstrapChild:done');
}

// 初始化子页面内容
// 参数：count - 生成的条目数量
// 作用：填充子页面滚动容器内容。
function initChildContent(count) {
  log('initChildContent:start', { count });
  const container = document.getElementById('content');
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= count; i++) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <h3>子页面条目 #${i}</h3>
      <p>子页面示例文本，展示嵌套滚动容器的打印兼容。打印时应完整显示，而非仅视口内容。</p>
    `;
    frag.appendChild(el);
  }
  container.appendChild(frag);
  log('initChildContent:done', { total: container.children.length });
}

// 绑定打印生命周期（子页面内部）
// 作用：在子页面中直接监听打印事件，以便在独立打印时也能执行逻辑。
function bindChildPrintLifecycle() {
  log('bindChildPrintLifecycle:start');
  window.addEventListener('beforeprint', appBeforePrint);
  window.addEventListener('afterprint', appAfterPrint);
  log('bindChildPrintLifecycle:done');
}

// 父页面消息桥接
// 作用：响应父页面的打印前/后消息通知。
function bindMessageBridge() {
  log('bindMessageBridge:start');
  window.addEventListener('message', (evt) => {
    const { type } = evt.data || {};
    if (type === 'app-print-prep') appBeforePrint();
    if (type === 'app-print-clean') appAfterPrint();
  });
  log('bindMessageBridge:done');
}

// 打印前动作（子页面公开方法）
// 作用：注入水印或执行资源准备、分页等。
function appBeforePrint() {
  log('appBeforePrint:start');
  if (document.querySelector('.watermark')) return;
  const wm = document.createElement('div');
  wm.className = 'watermark';
  wm.textContent = `子页面打印 ${new Date().toLocaleString()}`;
  document.body.appendChild(wm);
  log('appBeforePrint:done');
}

// 打印后清理（子页面公开方法）
// 作用：移除打印阶段注入的元素或状态。
function appAfterPrint() {
  log('appAfterPrint:start');
  document.querySelectorAll('.watermark').forEach((el) => el.remove());
  log('appAfterPrint:done');
}

// 启动子页面
document.addEventListener('DOMContentLoaded', bootstrapChild);