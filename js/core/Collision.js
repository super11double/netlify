/* ============================================================
   Collision.js - 碰撞检测系统
   玩家弹→敌机/Boss、敌机弹→玩家、敌机撞玩家、道具拾取、激光命中
   ============================================================ */
class Collision {
  constructor(game) { this.game = game; }

  checkAll() {
    const g = this.game;
    const player = g.player;

    // ===== 玩家子弹 vs 敌机 / Boss =====
    // 优化：子弹已 dead 或命中后无 pierce 直接 break 内层循环
    const enemies = g.enemies;
    const bullets = g.bullets;
    const boss = g.boss;
    for (let bi = 0; bi < bullets.length; bi++) {
      const b = bullets[bi];
      if (b.dead || b.side !== "player") continue;
      // vs 敌机
      for (let ei = 0; ei < enemies.length; ei++) {
        const e = enemies[ei];
        if (e.dead) continue;
        if (b.hitTargets.has(e.id)) continue;
        if (Math2.circleHit(b.x, b.y, b.radius, e.x, e.y, e.def.hitRadius)) {
          this._onPlayerBulletHit(b, e, g);
          if (b.dead) break;
        }
      }
      if (b.dead) continue;
      // vs Boss
      if (boss && !boss.dead && !boss.dying) {
        if (!b.hitTargets.has(boss.id) && Math2.circleHit(b.x, b.y, b.radius, boss.x, boss.y, boss.hitRadius)) {
          this._onPlayerBulletHit(b, boss, g, true);
        }
      }
    }

    // ===== 敌机子弹 vs 玩家 =====
    if (player && player.alive) {
      const ebs = g.enemyBullets;
      for (let i = 0; i < ebs.length; i++) {
        const b = ebs[i];
        if (b.dead) continue;
        if (Math2.circleHit(b.x, b.y, b.radius, player.x, player.y, player.hitbox)) {
          b.dead = true;
          player.takeDamage(b.damage, g);
        }
      }

      // ===== 敌机撞玩家 =====
      const enemies = g.enemies;
      for (let ei = 0, en = enemies.length; ei < en; ei++) {
        const e = enemies[ei];
        if (e.dead) continue;
        if (Math2.circleHit(e.x, e.y, e.def.hitRadius, player.x, player.y, player.hitbox + 4)) {
          player.takeDamage(20, g);
          // 敌机也受伤（撞毁小型机）
          e.takeDamage(50, g);
        }
      }

      // ===== Boss 撞玩家 =====
      if (g.boss && !g.boss.dead && !g.boss.dying && !g.boss.entering) {
        if (Math2.circleHit(g.boss.x, g.boss.y, g.boss.hitRadius * 0.8, player.x, player.y, player.hitbox)) {
          player.takeDamage(15, g);
        }
      }

      // ===== Boss 激光命中玩家 =====
      if (g.bossLasers) {
        const bl = g.bossLasers;
        for (let li = 0, ln = bl.length; li < ln; li++) {
          const lz = bl[li];
          if (lz.dead || lz.phase !== "fire") continue;
          if (Math.abs(player.x - lz.x) < lz.width / 2 + player.hitbox) {
            player.takeDamage(lz.damage, g);
          }
        }
      }

      // ===== 道具拾取 =====
      const items = g.items;
      for (let ii = 0, in2 = items.length; ii < in2; ii++) {
        const it = items[ii];
        if (it.dead) continue;
        if (Math2.circleHit(it.x, it.y, it.radius, player.x, player.y, player.hitbox + 8)) {
          it.dead = true;
          player.pickupItem(it.type, g);
        }
      }
    }
  }

  _onPlayerBulletHit(bullet, target, game, isBoss = false) {
    bullet.hitTargets.add(target.id);
    const killed = target.takeDamage(bullet.damage, game, true);

    // 命中粒子
    game.spawnHitSpark(bullet.x, bullet.y, bullet.color);
    if (game.audio && Math.random() < 0.3) game.audio.play("hit");

    // 爆裂弹头：小范围爆炸
    if (bullet.explosive) {
      game.spawnExplosion(bullet.x, bullet.y, bullet.color, "small");
      const r = 40;
      const allEnemies = game.enemies;
      for (let ei2 = 0, ee2 = allEnemies.length; ei2 < ee2; ei2++) {
        const e = allEnemies[ei2];
        if (e.dead || e === target) continue;
        if (Math2.dist2(bullet.x, bullet.y, e.x, e.y) < r * r) {
          e.takeDamage(bullet.damage * 0.4, game, true);
        }
      }
    }

    // 穿透：还有次数则继续，否则销毁
    if (bullet.pierce > 0 && !isBoss) {
      bullet.pierce--;
    } else if (bullet.pierce < 90) { // 激光(pierce=99)不消耗
      bullet.dead = true;
    }
  }
}
