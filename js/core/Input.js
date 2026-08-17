/* ============================================================
   Input.js - 输入管理（鼠标/触摸/键盘，双端适配增强版）
   桌面：鼠标拖拽 / WASD / 方向键 / 空格必杀 / P暂停 / ESC / B炸弹
   移动：左侧摇杆区滑动 / 右侧虚拟按钮（必杀💥 + 炸弹💣） / 双指必杀
   ============================================================ */
class Input {
  constructor(game) {
    this.game = game;
    this.keys = {};
    this.pointerDown = false;
    this.pointerX = 0; this.pointerY = 0;
    this.lastTapTime = 0;
    this.touchMode = false;

    // 摇杆相关（移动端左侧区域）
    this.joyActive = false;
    this.joyStartX = 0; this.joyStartY = 0;
    this.joyPointerId = null;

    this._bind();
  }

  _bind() {
    const canvas = this.game.canvas;

    // ===== 鼠标（PC端） =====
    canvas.addEventListener("mousedown", (e) => this._onPointerDown(e.clientX, e.clientY, false, e.button));
    window.addEventListener("mousemove", (e) => this._onPointerMove(e.clientX, e.clientY, false));
    window.addEventListener("mouseup", (e) => this._onPointerUp(false, e.button));
    canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); });

    // ===== 触摸（移动端）- canvas 主体区域（右半区+中间）处理直接瞄准 =====
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._enableTouchMode();
      for (const t of e.changedTouches) {
        // 判断是否在摇杆区（屏幕左半边）
        const inJoy = t.clientX < window.innerWidth * 0.5;
        if (inJoy && !this.joyActive) {
          this._startJoy(t.clientX, t.clientY, t.identifier);
        } else if (!inJoy) {
          // 右半区：直接移动飞机（类似拖拽瞄准）
          this._onPointerDown(t.clientX, t.clientY, true);
        }
      }
      if (e.touches.length >= 3) this._useSkill(); // 三指必杀（备选）
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joyActive && t.identifier === this.joyPointerId) {
          this._moveJoy(t.clientX, t.clientY);
        } else {
          this._onPointerMove(t.clientX, t.clientY, true);
        }
      }
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joyActive && t.identifier === this.joyPointerId) {
          this._endJoy();
        } else {
          this._onPointerUp(true);
        }
      }
    }, { passive: false });

    canvas.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      this._endJoy();
      this._onPointerUp(true);
    }, { passive: false });

    // ===== 移动端虚拟按钮（DOM层） =====
    document.addEventListener("DOMContentLoaded", () => {
      const touchSkill = document.getElementById("touch-skill");
      const touchBomb = document.getElementById("touch-bomb");
      const touchJoyZone = document.getElementById("touch-joystick-zone");

      // 虚拟必杀键
      if (touchSkill) {
        const trigger = (e) => { e.preventDefault(); e.stopPropagation(); this._useSkill(); };
        touchSkill.addEventListener("touchstart", trigger, { passive: false });
        touchSkill.addEventListener("mousedown", trigger);
      }
      // 虚拟炸弹键
      if (touchBomb) {
        const trigger = (e) => { e.preventDefault(); e.stopPropagation(); this._useBomb(); };
        touchBomb.addEventListener("touchstart", trigger, { passive: false });
        touchBomb.addEventListener("mousedown", trigger);
      }
      // 左半屏摇杆区（DOM版，与canvas摇杆互补）
      if (touchJoyZone) {
        touchJoyZone.addEventListener("touchstart", (e) => {
          e.preventDefault();
          this._enableTouchMode();
          const t = e.changedTouches[0];
          if (!this.joyActive) this._startJoy(t.clientX, t.clientY, t.identifier);
        }, { passive: false });
        touchJoyZone.addEventListener("touchmove", (e) => {
          e.preventDefault();
          for (const t of e.changedTouches) {
            if (this.joyActive && t.identifier === this.joyPointerId) {
              this._moveJoy(t.clientX, t.clientY);
            }
          }
        }, { passive: false });
        touchJoyZone.addEventListener("touchend", (e) => {
          e.preventDefault();
          for (const t of e.changedTouches) {
            if (this.joyActive && t.identifier === this.joyPointerId) this._endJoy();
          }
        }, { passive: false });
      }
    });

    // ===== 键盘 =====
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space") { e.preventDefault(); this._useSkill(); }
      if (e.code === "KeyP" || e.code === "Escape") { e.preventDefault(); this._togglePause(); }
      if (e.code === "KeyB") { this._useBomb(); }
      // 调试快捷键
      if (CONFIG.DEBUG) {
        if (e.code === "F2") this.game.debugNextWave();
        if (e.code === "F3") { if (this.game.player) this.game.player.powerLevel = Math.min(8, this.game.player.powerLevel + 1); }
      }
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
  }

  _enableTouchMode() {
    if (!this.touchMode) {
      this.touchMode = true;
      document.body.classList.add("touch");
    }
  }

  // ============ 虚拟摇杆 ============
  _startJoy(cx, cy, id) {
    this.joyActive = true;
    this.joyPointerId = id;
    this.joyStartX = cx;
    this.joyStartY = cy;
  }
  _moveJoy(cx, cy) {
    if (!this.game.player || !this.game.player.alive) return;
    if (this.game.state.state !== "PLAYING" && this.game.state.state !== "BOSS") return;

    // 计算摇杆偏移（以像素为单位）
    const dx = cx - this.joyStartX;
    const dy = cy - this.joyStartY;
    // 最大半径：屏幕短边的 1/8
    const maxR = Math.min(window.innerWidth, window.innerHeight) * 0.12;
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxR ? maxR / dist : 1;
    const nx = dx * scale / maxR;   // 归一化 -1 ~ 1
    const ny = dy * scale / maxR;

    const p = this.game.player;
    const sp = p.speed * 1.2;
    // 基于当前位置 + 偏移量（摇杆是增量式）
    p.targetX = Math2.clamp(p.x + nx * sp, 16, CONFIG.WIDTH - 16);
    p.targetY = Math2.clamp(p.y + ny * sp, 16, CONFIG.HEIGHT - 16);
  }
  _endJoy() {
    this.joyActive = false;
    this.joyPointerId = null;
  }

  // ============ 坐标转换 ============
  _toCanvas(clientX, clientY) {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = CONFIG.WIDTH / rect.width;
    const scaleY = CONFIG.HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  _onPointerDown(cx, cy, isTouch, button = 0) {
    if (this.game.state.state !== "PLAYING" && this.game.state.state !== "BOSS") return;
    if (isTouch) this._enableTouchMode();
    // 鼠标右键 = 炸弹
    if (!isTouch && button === 2) { this._useBomb(); return; }
    const p = this._toCanvas(cx, cy);
    this.pointerDown = true;
    this.pointerX = p.x; this.pointerY = p.y;
    if (this.game.player && this.game.player.alive) {
      // 直接跳到点击位置（让响应更跟手，PC拖拽体验更顺滑）
      if (!isTouch) {
        this.game.player.x = p.x;
        this.game.player.y = p.y;
      }
      this.game.player.targetX = p.x;
      this.game.player.targetY = p.y;
    }
  }

  _onPointerMove(cx, cy, isTouch) {
    if (!this.pointerDown) return;
    const p = this._toCanvas(cx, cy);
    this.pointerX = p.x; this.pointerY = p.y;
    if (this.game.player && this.game.player.alive) {
      if (!isTouch) {
        this.game.player.x = p.x;
        this.game.player.y = p.y;
      }
      this.game.player.targetX = p.x;
      this.game.player.targetY = p.y;
    }
  }

  _onPointerUp(isTouch, button = 0) {
    this.pointerDown = false;
    // 双击检测（移动端可触发其他操作，预留）
    const now = Date.now();
    if (now - this.lastTapTime < 280 && isTouch) {
      // 双击：预留功能，比如切换瞄准辅助
    }
    this.lastTapTime = now;
  }

  _useSkill() {
    if (this.game.state.state !== "PLAYING" && this.game.state.state !== "BOSS") return;
    this.game.tryUseSkill();
  }

  _useBomb() {
    if (this.game.state.state !== "PLAYING" && this.game.state.state !== "BOSS") return;
    this.game.useBomb();
  }

  _togglePause() {
    if (this.game.state.state === "PLAYING" || this.game.state.state === "BOSS") {
      this.game.pause();
    } else if (this.game.state.state === "PAUSED") {
      this.game.resume();
    }
  }

  // 每帧更新键盘移动（WASD/方向键）
  update() {
    if (!this.game.player || !this.game.player.alive) return;
    if (this.game.state.state !== "PLAYING" && this.game.state.state !== "BOSS") return;
    const p = this.game.player;
    const sp = p.speed;
    let dx = 0, dy = 0;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) dx -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) dx += 1;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) dy -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      // 键盘移动直接修改位置（覆盖拖拽目标）
      p.targetX = Math2.clamp(p.x + (dx / len) * sp, 16, CONFIG.WIDTH - 16);
      p.targetY = Math2.clamp(p.y + (dy / len) * sp, 16, CONFIG.HEIGHT - 16);
      p.x = p.targetX; p.y = p.targetY;
    }
  }
}
