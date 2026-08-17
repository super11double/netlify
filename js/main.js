/* ============================================================
   main.js - 入口
   DOM 就绪后实例化 Game，处理首次音频解锁
   ============================================================ */
window.addEventListener("DOMContentLoaded", () => {
  // 创建游戏主实例（全局可访问，便于调试）
  const game = new Game();
  window.game = game;

  // 首次任意交互解锁 Web Audio（浏览器自动播放策略）
  const unlock = () => {
    if (game.audio) {
      game.audio.init();
      game.audio.resume();
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // 阻止移动端双击缩放
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  console.log("%c🚀 星际雷霆 · Stellar Thunder 已启动", "color:#00f0ff;font-size:16px;font-weight:bold;text-shadow:0 0 8px #00f0ff;");
  console.log("%c操作：鼠标/触摸拖拽移动 · 空格/右键必杀 · P暂停 · B炸弹", "color:#8aa0c4;");
  console.log("%c彩蛋：上上下下左右左右BA", "color:#fff200;");
});
