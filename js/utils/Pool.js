/* ============================================================
   Pool.js - 通用对象池（子弹/粒子复用，避免 GC 卡顿）
   用法：
     const pool = new Pool(() => new Bullet(), (o) => o.reset(...));
     const b = pool.acquire(...args);
     pool.release(b);
   ============================================================ */
class Pool {
  constructor(factory, resetFn, prealloc = 0) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.free = [];
    this.active = [];
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }

  acquire(...args) {
    const obj = this.free.pop() || this.factory();
    if (this.resetFn) this.resetFn(obj, ...args);
    obj.dead = false;
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    // 由调用方标记 dead 后统一回收
  }

  // 每帧调用：把 dead 的对象回收到 free 列表
  sweep() {
    const stillActive = [];
    for (let i = 0; i < this.active.length; i++) {
      const o = this.active[i];
      if (o.dead) {
        o.poolReleased = true;
        this.free.push(o);
      } else {
        stillActive.push(o);
      }
    }
    this.active = stillActive;
  }

  clear() {
    for (const o of this.active) { o.dead = true; this.free.push(o); }
    this.active = [];
  }

  get count() { return this.active.length; }
}
