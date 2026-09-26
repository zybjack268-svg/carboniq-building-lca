// 页面过渡工具：以触发元素（图标/按钮/卡片）为锚点，新界面从锚点放大展开，
// 关闭时向锚点收缩还原。尊重 prefers-reduced-motion，动画缺失时优雅降级。

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function captureAnchor(event) {
  const el = event?.currentTarget;
  return el instanceof Element ? el : null;
}

function anchorRect(el) {
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return rect;
}

// 展开：surface 从 fromEl 的位置与尺寸放大到全屏，透明度 0→1。
export function animateExpand(surface, fromEl, duration = 480) {
  if (!surface || reduced()) return null;
  const rect = anchorRect(fromEl);
  if (!rect) return null;
  const to = surface.getBoundingClientRect();
  const sx = Math.max(0.05, rect.width / Math.max(1, to.width));
  const sy = Math.max(0.05, rect.height / Math.max(1, to.height));
  const dx = rect.left + rect.width / 2 - (to.left + to.width / 2);
  const dy = rect.top + rect.height / 2 - (to.top + to.height / 2);
  const animation = surface.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0, borderRadius: "28px" },
      { transform: "translate(0, 0) scale(1, 1)", opacity: 1, borderRadius: "0px" },
    ],
    { duration, easing: "cubic-bezier(.32,.72,0,1)", fill: "both" },
  );
  window.__lastExpand = animation;
  animation.addEventListener("cancel", () => { window.__expandCanceled = true; });
  animation.addEventListener("finish", () => { window.__expandFinished = true; });
  return animation;
}

// 收缩：surface 从全屏缩回 toEl 的位置与尺寸，透明度→0；返回 Promise，结束后再切换状态。
export function animateShrink(surface, toEl, duration = 400) {
  if (!surface || reduced()) return Promise.resolve();
  const rect = anchorRect(toEl);
  if (!rect) return Promise.resolve();
  const from = surface.getBoundingClientRect();
  const sx = Math.max(0.05, rect.width / Math.max(1, from.width));
  const sy = Math.max(0.05, rect.height / Math.max(1, from.height));
  const dx = rect.left + rect.width / 2 - (from.left + from.width / 2);
  const dy = rect.top + rect.height / 2 - (from.top + from.height / 2);
  const animation = surface.animate(
    [
      { transform: "translate(0, 0) scale(1, 1)", opacity: 1, borderRadius: "0px" },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0, borderRadius: "28px" },
    ],
    { duration, easing: "cubic-bezier(.4,0,.9,.6)", fill: "forwards" },
  );
  return animation.finished.catch(() => {});
}

// 锚点图标回弹：界面收回后，触发图标轻微放大弹出，提示"回到原处"。
export function popAnchor(el) {
  if (!el || reduced() || !el.isConnected) return;
  el.animate(
    [
      { transform: "scale(.82)", opacity: .4 },
      { transform: "scale(1.12)", opacity: 1, offset: .6 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 380, easing: "cubic-bezier(.34,1.56,.64,1)" },
  );
}
