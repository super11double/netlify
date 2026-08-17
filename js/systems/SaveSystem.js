/* ============================================================
   SaveSystem.js - localStorage 存档管理
   持久化：最高分、战机解锁、选择战机、战绩、设置、金币、解锁进度
   ============================================================ */
class SaveSystem {
  constructor() {
    this.key = CONFIG.SAVE_KEY;
    this.data = this._load();
  }

  _default() {
    return {
      highScore: 0,
      coins: 0,
      selectedPlane: "F01",
      unlockedPlanes: ["F01"],
      // 通关进度
      progress: {
        chapterCleared: 0,        // 已通关章节数（已完整打过的最大章节号）
        maxUnlockedChapter: 1,    // 已解锁的最大章节号（初始 1，过 1-1 开 1-2，过 1-5 开 2-1 ...）
        maxUnlockedStage: 1,      // 对应章节下已解锁的最大关号（1~5）
        allLevelSGrade: false,    // 是否所有关卡S级
        endless10min: false,      // 无尽存活10分钟
        roguelikeCleared: false,  // 远征通关
      },
      scores: [],                 // 历史战绩 [{mode, plane, score, date}]
      settings: { sfx: 60, bgm: 40, shake: true, lowperf: false },
      easterEggs: {               // 彩蛋触发记录
        konami: false,
        hundredKills: false,
        noDamageBoss: false,
      },
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this._default();
      const obj = JSON.parse(raw);
      return Object.assign(this._default(), obj);
    } catch (e) {
      return this._default();
    }
  }

  get() { return this.data; }

  update(patch) {
    this.data = Object.assign(this.data, patch);
    this._save();
  }

  _save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { console.warn("保存失败", e); }
  }

  reset() {
    this.data = this._default();
    this._save();
  }

  // 记录一次战绩
  addScore(record) {
    this.data.scores.push(record);
    this.data.scores.sort((a, b) => b.score - a.score);
    this.data.scores = this.data.scores.slice(0, 20);
    if (record.score > this.data.highScore) this.data.highScore = record.score;
    if (record.coins) this.data.coins += record.coins;
    this._save();
  }

  unlockPlane(id) {
    if (!this.data.unlockedPlanes.includes(id)) {
      this.data.unlockedPlanes.push(id);
      this._save();
      return true; // 新解锁
    }
    return false;
  }

  // 标记进度
  markProgress(key, value = true) {
    this.data.progress[key] = value;
    this._save();
  }

  /**
   * 标记某 (chapter, stage) 已通过，并解锁后续关卡
   * - 通过 N-M → 解锁 N-(M+1)；若 M=STAGES_PER_CHAPTER 则解锁 (N+1)-1
   * - 不会回退解锁进度（max 函数保护）
   */
  markLevelCleared(chapter, stage) {
    const p = this.data.progress;
    const totalCh = CONFIG.CHAPTER_COUNT;
    const stPerCh = CONFIG.STAGES_PER_CHAPTER;
    // 下一关坐标
    let nextCh = chapter, nextSt = stage + 1;
    if (nextSt > stPerCh) {
      nextCh = chapter + 1; nextSt = 1;
      // 同时更新 chapterCleared（完成整个章节数）
      p.chapterCleared = Math.max(p.chapterCleared || 0, chapter);
    }
    // 解锁下一关（不超过最大值）
    if (nextCh <= totalCh) {
      const curCh = p.maxUnlockedChapter || 1;
      if (nextCh > curCh) {
        p.maxUnlockedChapter = nextCh;
        p.maxUnlockedStage = nextSt;
      } else if (nextCh === curCh) {
        p.maxUnlockedStage = Math.max(p.maxUnlockedStage || 1, nextSt);
      }
    }
    // 保护：chapterCleared / maxUnlocked 不越上限
    p.chapterCleared = Math.min(p.chapterCleared || 0, totalCh);
    p.maxUnlockedChapter = Math.min(p.maxUnlockedChapter || 1, totalCh);
    this._save();
  }

  /** 判断某关卡是否解锁可玩 */
  isLevelUnlocked(chapter, stage) {
    const p = this.data.progress;
    const curCh = p.maxUnlockedChapter || 1;
    if (chapter < curCh) return true; // 之前的章节全部解锁
    if (chapter === curCh) return stage <= (p.maxUnlockedStage || 1);
    return false;
  }

  /** 判断战机是否解锁 */
  isPlaneUnlocked(planeId) {
    if (!planeId) return false;
    const d = PLANE_DATA[planeId];
    if (!d) return false;
    if (d.unlock === "default") return true;
    return Array.isArray(this.data.unlockedPlanes) && this.data.unlockedPlanes.includes(planeId);
  }

  markEasterEgg(key) {
    if (!this.data.easterEggs[key]) {
      this.data.easterEggs[key] = true;
      this._save();
      return true;
    }
    return false;
  }
}
