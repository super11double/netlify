/* ============================================================
   SkillSystem.js - 技能芯片效果管理
   负责：3选1 抽卡、装备芯片、应用效果到玩家、升级经验
   【彻底加固】
     1) addExp while 循环：批量升级完成后只弹 1 次 offerChoice
     2) 循环上限 50 次（防异常死循环）
     3) offerChoice 队列上限 3：超过时直接转 Score 奖励（不再无限堆积）
     4) Boss 战中不弹芯片面板（pausedForChip 会让玩家以为死机）：转 300 分奖励
     5) 升级时若处于 BOSS/暂停状态，延迟到 PLAYING 状态再弹
   ============================================================ */
class SkillSystem {
  constructor(game) {
    this.game = game;
    this._pendingChoices = 0;   // 排队次数
    this._chipOpen = false;     // 芯片面板是否已打开
    this._pendingMax = 3;       // 队列上限：超过则转奖励
  }

  // 抽 3 张不重复芯片卡
  roll3() {
    const pool = SKILL_POOL.slice();
    const out = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  // 玩家拾取 X 道具 / 升级时调用
  offerChoice() {
    // 队列上限保护：超过时直接转 300 分，避免无限堆积（防止玩家不点芯片导致 109+ 队列）
    if (this._pendingChoices >= this._pendingMax) {
      const p = this.game.player;
      if (p) {
        this.game.addScore(300);
        this.game.spawnFloatText(p.x, p.y - 30, "芯片溢出 +300", CONFIG.COLORS.neonYellow);
      }
      return;
    }
    // Boss 战中不弹面板（pausedForChip 会让玩家以为死机），转奖励
    // 注意：&& 优先级高于 ||，必须用括号明确意图
    const s = this.game.state.state;
    // 只有严格处于 PLAYING 且未被芯片暂停时，才允许弹面板
    // 其余所有状态（BOSS / GAMEOVER / VICTORY / PAUSED / MENU）统一转 300 分
    const allowPanel = (s === "PLAYING") && !this.game.pausedForChip;
    if (!allowPanel) {
      const p = this.game.player;
      if (p) {
        this.game.addScore(300);
        if (this.game.spawnFloatText) this.game.spawnFloatText(p.x, p.y - 30, s === "BOSS" ? "战场紧凑 +300分" : "时机未到 +300分", CONFIG.COLORS.neonYellow);
      }
      return;
    }
    this._pendingChoices++;
    this._tryShowNextChoice();
  }

  _tryShowNextChoice() {
    if (this._chipOpen) return;
    if (this._pendingChoices <= 0) return;
    // 二次检查：Boss 战/非游玩状态不弹
    const s = this.game.state.state;
    if (s !== "PLAYING") {
      // 把队列里的请求转成奖励
      while (this._pendingChoices > 0) {
        this._pendingChoices--;
        const p = this.game.player;
        if (p) {
          this.game.addScore(300);
          if (this.game.spawnFloatText) this.game.spawnFloatText(p.x, p.y - 30, "战场紧凑 +300", CONFIG.COLORS.neonYellow);
        }
      }
      return;
    }
    this._pendingChoices = Math.max(0, this._pendingChoices - 1);
    this._chipOpen = true;

    const cards = this.roll3();
    this.game.ui.showChip(cards, (id) => {
      try { this.pick(id); } catch (e) { console.error("[chip.pick]", e); }
      try { this.game.ui.hideChip(); } catch (e) {}
      try { this.game.resumeAfterChip(); } catch (e) {}
      this._chipOpen = false;
      // 短延迟后显示下一张，避免连续弹窗卡 UX
      setTimeout(() => {
        try { this._tryShowNextChoice(); } catch (e) { console.error("[chip.next]", e); }
      }, 100);
    });
    this.game.pauseForChip();
  }

  pick(id) {
    const p = this.game.player;
    if (!p) return;
    const existing = p.equippedChips.find(c => c.id === id);
    const def = SKILL_DATA[id];
    if (existing) {
      if (existing.level < def.max) existing.level++;
      else { this.game.addScore(300); this.game.spawnFloatText(p.x, p.y - 30, "已满级 +300", CONFIG.COLORS.neonYellow); }
    } else {
      p.equippedChips.push({ id, level: 1 });
    }
    p.applyChips(p.equippedChips);
    const lvl = (existing ? existing.level : 1);
    this.game.spawnFloatText(p.x, p.y - 30, def.name + " Lv." + lvl,
      def.cat === "red" ? CONFIG.COLORS.neonRed : (def.cat === "blue" ? CONFIG.COLORS.neonCyan : CONFIG.COLORS.neonYellow));
    this.game.syncWingmen();
  }

  // 升级经验管理
  addExp(amount) {
    const g = this.game;
    const p = g.player;
    if (!p) return;
    const gain = amount * (p.expMul || 1);
    if (!isFinite(gain) || gain <= 0) return;
    g.state.exp += gain;

    const MAX_LEVEL_UPS = 50;
    let leveled = 0;
    let safety = 0;
    while (g.state.exp >= g.state.expToNext && safety++ < MAX_LEVEL_UPS) {
      g.state.exp -= g.state.expToNext;
      g.state.level++;
      g.state.expToNext = Math.round(CONFIG.EXP_BASE * Math.pow(CONFIG.EXP_GROWTH, g.state.level - 1));
      if (!isFinite(g.state.expToNext) || g.state.expToNext < 1) g.state.expToNext = CONFIG.EXP_BASE;
      leveled++;
    }

    if (leveled > 0) {
      if (g.audio) g.audio.play("levelup");
      g.spawnRing(p.x, p.y, CONFIG.COLORS.neonYellow, 60);
      g.spawnFloatText(p.x, p.y - 40, leveled > 1 ? `LV UP ×${leveled}!` : "LV UP!", CONFIG.COLORS.neonYellow);
      // 批量升级后只弹 1 次 offerChoice（内部会判断 Boss 战时转奖励）
      this.offerChoice();
    }
  }
}
