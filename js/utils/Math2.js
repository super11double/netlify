/* ============================================================
   Math2.js - 数学工具（向量、角度、随机、缓动辅助）
   全局对象：Math2
   ============================================================ */
const Math2 = {
  PI: Math.PI,
  TAU: Math.PI * 2,

  clamp(v, min, max) { return v < min ? min : (v > max ? max : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  // 角度差，归一到 [-PI, PI]
  angleDiff(a, b) {
    let d = (b - a) % this.TAU;
    if (d < -Math.PI) d += this.TAU;
    if (d > Math.PI) d -= this.TAU;
    return d;
  },
  // 角度转向量（弧度）
  angleToVec(rad) { return { x: Math.cos(rad), y: Math.sin(rad) }; },
  vecToAngle(x, y) { return Math.atan2(y, x); },
  // 两点距离平方
  dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  dist(ax, ay, bx, by) { return Math.sqrt(this.dist2(ax, ay, bx, by)); },

  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; }, // p 概率 true

  // 圆形碰撞
  circleHit(ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return this.dist2(ax, ay, bx, by) < r * r;
  },
  // AABB 矩形碰撞（中心点 + 半宽半高）
  rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) && Math.abs(ay - by) < (ah + bh);
  },

  // 角度平滑追踪（用于追踪弹/敌人朝向玩家）
  turnToward(current, target, maxStep) {
    const d = this.angleDiff(current, target);
    if (Math.abs(d) <= maxStep) return target;
    return current + Math.sign(d) * maxStep;
  },
};
