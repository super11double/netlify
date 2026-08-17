/* ============================================================
   WaveSystem.js - 闯关模式波次/关卡管理
   按 waveData 的配置依次生成敌机波次，触发小Boss/章节Boss
   ============================================================ */
class WaveSystem {
  constructor(game) {
    this.game = game;
  }

  startLevel(chapter, stage) {
    const g = this.game;
    const ch = CHAPTERS[chapter - 1];
    if (!ch || !ch.stages[stage - 1]) { g.onLevelClear(); return; }
    this.stageDef = ch.stages[stage - 1];
    this.waveIndex = 0;
    this.waveTimer = 800;
    this.spawning = true;
    this.clearScheduled = false;
    this.bossPending = false;
    this.subBossSpawned = false;
    this.bossSpawned = false;
    g.state.chapter = chapter;
    g.state.stage = stage;
  }

  update(dt) {
    const g = this.game;
    if (g.state.mode !== "level") return;
    if (!this.spawning) {
      // 关卡完成判定：所有敌机清空且无Boss（用 clearScheduled 防止重复调度）
      if (!this.clearScheduled && !g.boss && g.enemies.length === 0 && g.enemyBullets.length === 0) {
        this.clearScheduled = true;
        setTimeout(() => { this.clearScheduled = false; g.onLevelClear(); }, 600);
      }
      return;
    }

    const waves = this.stageDef.waves;
    if (this.waveIndex >= waves.length) {
      // 所有普通波次播完，处理 Boss / 小Boss
      this._handleBosses();
      return;
    }
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      const wave = waves[this.waveIndex];
      this.waveTimer = 999999; // 等当前波全部生成后再进下一波（由 gap 控制间隔）
      let maxDelay = 0;
      for (const sp of wave.spawns) {
        const positions = FORMATIONS[sp.formation](sp.count, CONFIG.WIDTH / 2, -40);
        positions.forEach((pos, i) => {
          setTimeout(() => {
            if (g.state.state === "PLAYING" || g.state.state === "BOSS") {
              g.spawnEnemy(sp.type, pos.x, pos.y);
            }
          }, i * sp.gap);
          maxDelay = Math.max(maxDelay, i * sp.gap);
        });
      }
      // 下一波延迟
      setTimeout(() => {
        this.waveIndex++;
        this.waveTimer = 500;
      }, maxDelay + 800);
    }
  }

  _handleBosses() {
    const g = this.game;
    // 小 Boss
    if (this.stageDef.hasSubBoss && !this.subBossSpawned && !this.bossPending) {
      this.bossPending = true;
      g.showBossWarning(() => {
        this.bossPending = false;
        this.subBossSpawned = true;
        g.spawnBoss(this.stageDef.subBossId);
      });
      return;
    }
    // 章节 Boss
    if (this.stageDef.hasBoss && !this.bossSpawned && !this.bossPending) {
      this.bossPending = true;
      g.showBossWarning(() => {
        this.bossPending = false;
        this.bossSpawned = true;
        g.spawnBoss(this.stageDef.bossId);
      });
      return;
    }
    // Boss 在场或预警中 → 等待
    if (g.boss || this.bossPending) return;
    // 无 Boss 关卡，或 Boss 已死亡 → 标记可通关
    if (this.spawning) this.spawning = false;
  }

  // 调试用：直接跳到 Boss
  skipToBoss() {
    if (this.stageDef && this.stageDef.hasBoss) {
      this.waveIndex = this.stageDef.waves.length;
      this.subBossSpawned = true;
    }
  }
}
