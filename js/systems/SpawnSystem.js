/* ============================================================
   SpawnSystem.js - 敌机/道具/粒子 生成系统
   负责无尽/限时模式的自动刷新，以及通用 spawn 工具方法

   注意：
   - 旧版无尽模式「所有波次都刷 BOSS_CH1 / SUBOSS_CH1 且血量不缩放」会导致：
     1) 玩家火力起来后 Boss 秒死没挑战
     2) 后期因小怪血量会 +15%/分钟，但 Boss 不变，Boss 反而比小怪脆
   - 修正：
     1) 每只 Boss 血量按 wave 线性放大（大Boss +30%/波，小Boss +22%/波），并加上限防止数值爆炸
     2) 波次阈值升级 Boss 档位：wave 1-29 用 CH1/2 档，30-59 用 CH3/4 档，60+ 用 CH5/6 档
   ============================================================ */
class SpawnSystem {
  constructor(game) {
    this.game = game;
    this.spawnTimer = 0;
    this.endlessTimer = 0;
    this.endlessWave = 0;
  }

  reset() {
    this.spawnTimer = 1500;
    this.endlessTimer = 0;
    this.endlessWave = 0;
  }

  // 无尽/限时模式刷新
  update(dt) {
    const g = this.game;
    if (g.state.mode !== "endless" && g.state.mode !== "timed") return;

    this.spawnTimer -= dt;
    this.endlessTimer += dt;

    // 难度随时间提升
    const minutes = this.endlessTimer / 60000;
    const diffMul = 1 + minutes * 0.15; // 每分钟血量+15%

    if (this.spawnTimer <= 0) {
      // 间隔随时间缩短
      const baseInterval = g.state.mode === "timed" ? 900 : 1200;
      this.spawnTimer = Math.max(300, baseInterval - minutes * 60);
      this._spawnWave(diffMul, minutes);
    }

    // 无尽模式：每 5 波小Boss，每 15 波大Boss
    if (g.state.mode === "endless") {
      g.state.wave = Math.floor(this.endlessTimer / 8000) + 1;
      if (this.endlessWave !== g.state.wave) {
        this.endlessWave = g.state.wave;
        if (g.state.wave % 15 === 0 && !g.boss) {
          // 大 Boss：根据档位挑 bossId，再按波次放大 hp
          const wave = g.state.wave;
          const tier = wave < 30 ? 1 : (wave < 60 ? 2 : 3);
          const bossId = tier === 1 ? "BOSS_CH2" : (tier === 2 ? "BOSS_CH4" : "BOSS_CH6");
          // hpMul = 1 + (wave / 15 - 1) * 0.30 → 第15波≈1x，第30波≈1.6x，第60波≈2.8x，第90波≈4x，第150波≈5.8x
          const mulRaw = 1 + Math.max(0, Math.floor(wave / 15) - 1) * 0.30 + (wave % 15) / 15 * 0.08;
          const hpMul = Math.max(1, Math.min(20, mulRaw));
          g.spawnBoss(bossId, {
            hpMul,
            nameOverride: `${BOSS_DATA[bossId].name} · W${wave} [×${hpMul.toFixed(1)}]`,
          });
        } else if (g.state.wave % 5 === 0 && !g.boss) {
          const wave = g.state.wave;
          const tier = wave < 30 ? 1 : (wave < 60 ? 2 : 3);
          const bossId = tier === 1 ? "SUBOSS_CH2" : (tier === 2 ? "SUBOSS_CH4" : "SUBOSS_CH6");
          // hpMul 增长稍慢：第5波≈1x，第30波≈1.9x，第60波≈3.2x，第120波≈5x
          const mulRaw = 1 + Math.max(0, Math.floor(wave / 5) - 1) * 0.16;
          const hpMul = Math.max(1, Math.min(18, mulRaw));
          g.spawnBoss(bossId, {
            hpMul,
            nameOverride: `${BOSS_DATA[bossId].name} · W${wave} [×${hpMul.toFixed(1)}]`,
          });
        }
      }
      // 存活 10 分钟解锁 F-04
      if (this.endlessTimer >= 600000) {
        if (g.save.markProgress("endless10min", true)) {
          g.save.unlockPlane("F04");
          g.showEasterEgg("🏆 解锁战机：量子幽灵！", "无尽模式存活10分钟");
        }
      }
    }
  }

  _spawnWave(hpMul, minutes) {
    const g = this.game;
    // 随机选一种编队
    const types = ["scout", "fighter", "interceptor"];
    if (minutes > 1) types.push("bomber");
    if (minutes > 2) types.push("carrier");
    const type = Math2.pick(types);
    const count = Math2.randInt(3, 6 + Math.floor(minutes));
    const formation = Math2.pick(["line", "v_formation", "zigzag", "random_top"]);
    const positions = FORMATIONS[formation](count, CONFIG.WIDTH / 2, -40);
    for (const pos of positions) {
      g.spawnEnemy(type, pos.x, pos.y, { hpMul });
    }
  }
}
