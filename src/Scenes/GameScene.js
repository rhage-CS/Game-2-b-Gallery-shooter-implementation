// Roman Hage
// Created: 5/4/2026
// Phaser: 3.70.0
//
// GameScene.js
//
// Main gameplay scene for Cosmic Invaders. Implements all required
// assignment elements:
//   - Player avatar (SS Nimbus) moving left/right along the bottom
//   - Two enemy types: UFO Cruisers (grid formation) and Dive Critters (S-curves)
//   - Enemy paths via bounce-drift math (UFOs) and Phaser tweens (Critters)
//   - Player-emitted bullets (SPACE) and enemy-emitted bullets (timer)
//   - Phaser groups to keep all game objects organized
//   - Loop-based collision detection (no explicit per-pair lines)
//   - Score system with per-kill points and wave-clear bonus
//   - Health system with lives, invincibility frames, and destructible barriers
//   - init_game() function that fully resets all state for a clean restart
//   - Boss battle every 5 waves with 2 behavior phases (bonus)
//   - Scrolling starfield background (bonus)
//
// Art assets from Kenny Assets "Space Shooter Redux" set:
// https://kenney.nl/assets/space-shooter-redux

"use strict";

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
    }

    preload() {
        // Assets already loaded by TitleScene so nothing to reload here
        // Phaser caches all assets globally so every scene can use them
    }

    create() {
        // create() calls init_game() so the game can be fully reset
        // without reloading the scene from scratch
        this.init_game();
    }

    // INIT_GAME
    // Resets ALL game variables back to their starting conditions
    // Called by create() on first load and by GameOverScene on restart
    init_game() {
        if (!this.scale) return; // safety check in case scene is not ready

        const W = this.scale.width;
        const H = this.scale.height;

        // Destroy objects from any previous run
        if (this.playerGroup)   this.playerGroup.clear(true, true);
        if (this.enemyGroup)    this.enemyGroup.clear(true, true);
        if (this.pBulletGroup)  this.pBulletGroup.clear(true, true);
        if (this.eBulletGroup)  this.eBulletGroup.clear(true, true);
        if (this.barrierGroup)  this.barrierGroup.clear(true, true);
        if (this.particleGroup) this.particleGroup.clear(true, true);
        if (this.starGfx)       this.starGfx.clear();
        if (this.bossBar)       { this.bossBar.destroy(); this.bossBar = null; }

        // Cancel all timers and tweens from the previous run
        this.time.removeAllEvents();
        this.tweens.killAll();

        // State flags
        this.isGameOver      = false;  // true once the player runs out of lives
        this.waveClear       = false;  // true while between waves
        this.bossActive      = false;  // true while the mothership is on screen
        this.bossPhase       = 0;      // 0 = patrol, 1 = aggressive
        this.bossPhaseSet    = false;  // prevents phase 2 from triggering more than once
        this.bossMaxHp       = 1;      // set when boss spawns, used to draw the HP bar
        this.boss            = null;   // reference to the boss sprite
        this.bossBar         = null;   // graphics object for the HP bar
        this.canShoot        = true;   // false while player shoot cooldown is active
        this.driftDir        = 1;      // 1 = moving right, -1 = moving left
        this.driftSpeed      = 20;     // pixels per second for UFO formation drift
        this.driftDropY      = 0;      // extra downward pixels applied on wall bounce
        this.crittersThrough = 0;      // tracks how many critters have reached the bottom

        // Scrolling starfield
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x:     Phaser.Math.Between(0, W),
                y:     Phaser.Math.Between(0, H),
                speed: Phaser.Math.FloatBetween(0.5, 2.5),
                size:  Phaser.Math.Between(1, 3)
            });
        }
        // Reuse one graphics object instead of creating new rects every frame
        this.starGfx = this.add.graphics();

        // Groups keep all sprites of the same type organized in one place
        // making it easy to loop over them for collision and culling
        this.playerGroup   = this.physics.add.staticGroup();  // player (static = no gravity)
        this.enemyGroup    = this.physics.add.group();        // all enemies
        this.pBulletGroup  = this.physics.add.group();        // player bullets
        this.eBulletGroup  = this.physics.add.group();        // enemy bullets
        this.barrierGroup  = this.physics.add.staticGroup();  // barrier segments
        this.particleGroup = this.add.group();                // explosion sparks (no physics)

        // Player ship scaled down and positioned at the bottom
        this.player = this.physics.add.image(W / 2, H - 30, "player")
            .setCollideWorldBounds(true)  // cant move off the left/right edge
            .setScale(0.5);               // scaled down to fit the screen
        this.player.alive      = true;    // false when hit with no lives remaining
        this.player.invincible = false;   // true during the post-hit blink window
        this.playerGroup.add(this.player);

        // 4 bunkers placed across the bottom, each made of 5x3 segments
        // Each segment has 3 HP and fades as it takes damage
        const barrierXs = [120, 240, 400, 520];
        for (const bx of barrierXs) {
            for (let col = 0; col < 5; col++) {
                for (let row = 0; row < 3; row++) {
                    const seg = this.barrierGroup.create(
                        bx + col * 13,
                        H - 90 + row * 11,
                        "barrier"
                    );
                    seg.health = 3;     // takes 3 hits to destroy one segment
                    seg.refreshBody();  // required after manually placing static bodies
                }
            }
        }

        // Keyboard input
        this.cursors  = this.input.keyboard.createCursorKeys();  // arrow keys
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );

        // Spawn the first wave
        this.spawnWave(gameState.wave);

        // Start the enemy fire timer
        this._startEnemyFireTimer();

        // Tell the HUD to update immediately
        this.events.emit("uiUpdate");
    }

    // SPAWN WAVE
    // Places enemies for the given wave number
    // Every 5th wave spawns the Mothership boss instead of regulars
    spawnWave(wave) {
        this.waveClear       = false;
        this.crittersThrough = 0; // reset critter counter each new wave

        // Boss wave check (waves 5, 10, 15, ...)
        if (wave % 5 === 0) {
            this._spawnMothership();
            return;
        }

        this.bossActive = false;

        // UFO Cruisers arranged in a grid
        // Row count increases every 3 waves capped at 5 rows
        const rows     = Math.min(3 + Math.floor(wave / 3), 5);
        const cols     = 8;
        const startX   = 60;
        const startY   = 60;
        const spacingX = 66;
        const spacingY = 48;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const ufo = this.enemyGroup.create(
                    startX + col * spacingX,
                    startY + row * spacingY,
                    "ufo"
                ).setScale(0.5); // scaled down to fit the grid
                ufo.type   = "ufo";
                ufo.health = 1;   // one hit to kill
                ufo.points = 100; // score reward per kill
            }
        }

        // Dive Critters start top-right and dive on a timer
        // Count grows with each wave capped at 10
        const critterCount = Math.min(4 + wave, 10);
        for (let i = 0; i < critterCount; i++) {
            const cx = 460 + (i % 4) * 44;
            const cy = 30  + Math.floor(i / 4) * 44;
            const c  = this.enemyGroup.create(cx, cy, "critter").setScale(0.5); // scaled down
            c.type   = "critter";
            c.health = 2;     // takes 2 hits to kill
            c.points = 200;   // worth more than a UFO
            c.setData("diveStarted", false); // flag so only one dive runs at a time
        }

        // Formation drift speed increases with each wave
        this.driftDir   = 1;
        this.driftSpeed = 20 + wave * 5;
        this.driftDropY = 0;

        // Critters dive toward the player on a repeating timer
        this.time.addEvent({
            delay:         3500,
            loop:          true,
            callback:      this._triggerCritterDive,
            callbackScope: this
        });
    }

    // MOTHERSHIP BOSS
    // Spawns the boss and starts its Phase 0 behavior
    _spawnMothership() {
        this.bossActive   = true;
        this.bossPhase    = 0;
        this.bossPhaseSet = false;

        const W = this.scale.width;

        // Create the boss sprite in the center at the top
        const boss = this.enemyGroup.create(W / 2, 60, "mothership");
        boss.type   = "boss";
        boss.health = 30 + gameState.wave * 2; // scales with wave number
        boss.points = 5000;
        boss.setScale(0.8); // scaled down to fit the screen

        // Store references for use in update() and hit detection
        this.boss      = boss;
        this.bossMaxHp = boss.health;

        // Start phase 0 movement
        this._bossPatrol();

        // Boss fires more frequently than regular enemies
        this.time.addEvent({
            delay: 800,
            loop:  true,
            callback: () => {
                if (this.bossActive && this.boss && this.boss.active) {
                    this._bossFire();
                }
            }
        });

        // Draw the HP bar at the top of the screen
        this.bossBar = this.add.graphics();
        this._drawBossBar();
    }

    // Phase 0 slow side-to-side patrol using a looping tween
    _bossPatrol() {
        const W = this.scale.width;
        if (!this.boss || !this.boss.active) return;
        this.tweens.killTweensOf(this.boss); // cancel any existing tween first
        this.tweens.add({
            targets:  this.boss,
            x:        { from: 80, to: W - 80 },
            duration: 3000,
            ease:     "Sine.InOut",
            yoyo:     true,
            repeat:   -1
        });
    }

    // Phase 1 faster zigzag that also dips lower toward the player
    _bossAggressive() {
        const W = this.scale.width;
        if (!this.boss || !this.boss.active) return;
        this.tweens.killTweensOf(this.boss);
        this.tweens.add({
            targets:  this.boss,
            x:        { from: 60, to: W - 60 },
            y:        { from: 60, to: 160 },    // dips much lower than phase 0
            duration: 1200,                     // faster than phase 0
            ease:     "Sine.InOut",
            yoyo:     true,
            repeat:   -1
        });
    }

    // Phase 0 fires single shot straight down
    // Phase 1 fires a three-way spread shot
    _bossFire() {
        if (!this.boss || !this.boss.active) return;
        const angles = this.bossPhase === 0 ? [270] : [250, 270, 290];
        for (const angle of angles) {
            const b = this.eBulletGroup.create(
                this.boss.x, this.boss.y + 22, "ebullet"
            );
            b.setScale(0.6); // increased size so bullets are easier to see
            this.physics.velocityFromAngle(angle, 260, b.body.velocity);
        }
    }

    // Redraw the boss HP bar called every frame while boss is alive
    _drawBossBar() {
        if (!this.bossBar || !this.boss) return;
        const W   = this.scale.width;
        const pct = this.boss.health / this.bossMaxHp; // 0.0 to 1.0
        this.bossBar.clear();
        this.bossBar.fillStyle(0x440000);                         // background
        this.bossBar.fillRect(W / 2 - 100, 8, 200, 12);
        this.bossBar.fillStyle(pct > 0.5 ? 0x00ff44 : 0xff4400); // green then red
        this.bossBar.fillRect(W / 2 - 100, 8, 200 * pct, 12);
        this.bossBar.lineStyle(1, 0xffffff);
        this.bossBar.strokeRect(W / 2 - 100, 8, 200, 12);        // white border
    }

    // ENEMY FORMATION DRIFT
    // Moves the entire UFO grid left/right
    // When it hits a wall it reverses direction and drops down a fixed number of pixels
    _updateFormationDrift(delta) {
        const W    = this.scale.width;
        const ufos = this.enemyGroup.getChildren().filter(e => e.type === "ufo");
        if (ufos.length === 0) return;

        // Find the leftmost and rightmost UFO to check wall proximity
        let minX = Infinity, maxX = -Infinity;
        for (const u of ufos) {
            if (u.x < minX) minX = u.x;
            if (u.x > maxX) maxX = u.x;
        }

        // Bounce when the edge UFO hits the wall
        if (maxX >= W - 30 && this.driftDir > 0) {
            this.driftDir   = -1;
            this.driftDropY = 12; // drop 12px on this frame
        }
        if (minX <= 30 && this.driftDir < 0) {
            this.driftDir   = 1;
            this.driftDropY = 12;
        }

        // delta/1000 converts milliseconds to seconds for frame-rate-independent movement
        const dx = this.driftDir * this.driftSpeed * (delta / 1000);
        const dy = this.driftDropY;
        this.driftDropY = 0; // reset so we only drop once per bounce

        for (const u of ufos) {
            u.x += dx;
            u.y += dy;
        }
    }

    // DIVE CRITTER
    // Picks a random idle Critter and sends it on an S-curve dive
    // toward the bottom of the screen using a Phaser tween
    _triggerCritterDive() {
        if (this.isGameOver) return;

        // Only pick critters that are not already mid-dive
        const ready = this.enemyGroup.getChildren().filter(
            e => e.type === "critter" && !e.getData("diveStarted") && e.active
        );
        if (ready.length === 0) return;

        const c = Phaser.Utils.Array.GetRandom(ready);
        c.setData("diveStarted", true);

        const W = this.scale.width;
        const H = this.scale.height;

        // The S-curve combines a Sine.Out ease on x (swings sideways)
        // with a Sine.In ease on y (accelerates downward)
        this.tweens.add({
            targets:  c,
            x:        { value: c.x + Phaser.Math.Between(-130, 130), ease: "Sine.Out" },
            y:        { value: H + 20, ease: "Sine.In" },
            duration: Math.max(800, 1800 - gameState.wave * 40), // faster each wave
            onComplete: () => {
                // Recycle the critter back to the top instead of destroying it
                if (c && c.active) {
                    c.y = -20;
                    c.x = Phaser.Math.Between(40, W - 40);
                    c.setData("diveStarted", false);
                }
            }
        });
    }

    // ENEMY FIRE
    // A random enemy fires a bullet straight down at the player
    // The timer delay decreases each wave so enemies fire faster
    _startEnemyFireTimer() {
        const delay = Math.max(400, 2000 - gameState.wave * 100); // floor at 400ms
        this.time.addEvent({
            delay:         delay,
            loop:          true,
            callback:      this._enemyFire,
            callbackScope: this
        });
    }

    _enemyFire() {
        if (this.isGameOver) return;
        const alive = this.enemyGroup.getChildren().filter(e => e.active);
        if (alive.length === 0) return;

        // Pick a random active enemy to shoot
        const shooter = Phaser.Utils.Array.GetRandom(alive);
        const b = this.eBulletGroup.create(shooter.x, shooter.y + 16, "ebullet");
        b.setVelocityY(180 + gameState.wave * 12); // bullet speeds up each wave
        b.setScale(0.6); // increased size so bullets are easier to see
    }

    // PLAYER SHOOT
    // Fires a bullet upward from the player position
    // A 250ms cooldown prevents holding SPACE to spam
    _playerShoot() {
        if (!this.player.alive || !this.canShoot) return;

        // Play shoot sound effect
        this.sound.play("sfx_shoot", { volume: 0.5 });

        const b = this.pBulletGroup.create(
            this.player.x, this.player.y - 60, "pbullet" // spawns above barriers
        );
        b.setVelocityY(-500); // negative Y = upward
        b.setScale(0.3);      // scaled down so bullet fits the screen

        // Lock shooting until the cooldown expires
        this.canShoot = false;
        this.time.delayedCall(250, () => { this.canShoot = true; });
    }

    // EXPLOSION
    // Spawns a burst of spark particles that fly outward and fade
    _explode(x, y, count = 8) {
        // Play explosion sound effect
        this.sound.play("sfx_explode", { volume: 0.6 });

        for (let i = 0; i < count; i++) {
            const p     = this.add.image(x, y, "spark");
            const angle = Phaser.Math.Between(0, 360);
            const dist  = Phaser.Math.Between(20, 60);
            this.particleGroup.add(p);
            this.tweens.add({
                targets:  p,
                x:        x + Math.cos(angle) * dist,
                y:        y + Math.sin(angle) * dist,
                alpha:    0,    // fade out
                scale:    0.2,  // shrink
                duration: Phaser.Math.Between(300, 600),
                onComplete: () => p.destroy() // clean up when done
            });
        }
    }

    // HIT ENEMY
    // Called when a player bullet overlaps an enemy
    _hitEnemy(bullet, enemy) {
        bullet.destroy(); // remove the bullet regardless of outcome
        enemy.health--;

        if (enemy.health <= 0) {
            // Enemy is dead
            this._explode(enemy.x, enemy.y, enemy.type === "boss" ? 20 : 8);
            gameState.score += enemy.points;

            if (enemy.type === "boss") {
                this.bossActive = false;
                if (this.bossBar) { this.bossBar.destroy(); this.bossBar = null; }
                // Reward 1 life for killing the boss capped at 5
                gameState.lives = Math.min(gameState.lives + 1, 5);
            }

            enemy.destroy();
        } else {
            // Enemy survived the hit so flash it briefly
            this.tweens.add({
                targets:  enemy,
                alpha:    0.2,
                yoyo:     true,
                duration: 80,
                repeat:   2,
                onComplete: () => { if (enemy.active) enemy.alpha = 1; }
            });

            // Check if boss should enter phase 2 at 50% HP
            if (enemy.type === "boss" && !this.bossPhaseSet &&
                enemy.health <= this.bossMaxHp / 2) {
                this.bossPhase    = 1;
                this.bossPhaseSet = true;
                this._bossAggressive();
                this._showBanner("BOSS ENRAGED!", "#ff4400");
            }

            // Update HP bar on hit
            if (this.bossBar) this._drawBossBar();
        }

        // Refresh the score in the HUD
        this.events.emit("uiUpdate");
    }

    // HIT PLAYER
    // Called when an enemy bullet overlaps the player
    _hitPlayer(player, obj) {
        if (player.invincible) return; // ignore hits during blink window

        obj.destroy();

        // Play hit sound effect
        this.sound.play("sfx_hit", { volume: 0.7 });

        this._explode(player.x, player.y, 12);
        gameState.lives--;
        this.events.emit("uiUpdate");

        if (gameState.lives <= 0) {
            this._gameOver();
            return;
        }

        // Give the player a brief invincibility window after being hit
        player.invincible = true;
        this.tweens.add({
            targets:  player,
            alpha:    0,       // blink by alternating full and transparent
            yoyo:     true,
            duration: 120,
            repeat:   10,
            onComplete: () => {
                player.alpha      = 1;
                player.invincible = false;
            }
        });
    }

    // HIT BARRIER
    // Called when any bullet overlaps a barrier segment
    _hitBarrier(bullet, seg) {
        bullet.destroy();
        seg.health--;
        seg.setAlpha(seg.health / 3); // visually degrade as HP drops
        if (seg.health <= 0) seg.destroy();
    }

    // WAVE CLEAR CHECK
    // Called every frame and triggers the wave-clear sequence
    // when all enemies are gone
    _checkWaveClear() {
        if (this.waveClear || this.isGameOver) return;
        if (this.enemyGroup.countActive() === 0) {
            this.waveClear = true;
            this.time.removeAllEvents(); // stop enemy fire timer

            // Play wave clear sound effect
            this.sound.play("sfx_waveclear", { volume: 0.8 });

            // Award a wave-clear bonus that grows with wave number
            const bonus = 500 * gameState.wave;
            gameState.score += bonus;
            this._showBanner(`WAVE ${gameState.wave} CLEAR!  +${bonus}`, "#00ffcc");

            // Wait 2.2 seconds then spawn the next wave
            this.time.delayedCall(2200, () => {
                gameState.wave++;
                this._startEnemyFireTimer(); // restart fire timer for new wave speed
                this.spawnWave(gameState.wave);
                this.events.emit("uiUpdate");
            });
        }
    }

    // SHOW BANNER
    // Displays a temporary floating text message in the center of the screen
    _showBanner(msg, color = "#ffffff") {
        const W = this.scale.width;
        const H = this.scale.height;
        const t = this.add.text(W / 2, H / 2, msg, {
            fontSize:        "28px",
            fontFamily:      "monospace",
            color:           color,
            stroke:          "#000000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(10); // depth 10 draws above all game sprites

        // Float upward and fade out
        this.tweens.add({
            targets:  t,
            y:        H / 2 - 60,
            alpha:    0,
            duration: 1800,
            ease:     "Quad.Out",
            onComplete: () => t.destroy()
        });
    }

    // GAME OVER
    _gameOver() {
        if (this.isGameOver) return;
        this.isGameOver   = true;
        this.player.alive = false;
        this.time.removeAllEvents();
        this.tweens.killAll();

        // Save hi-score before leaving the scene
        if (gameState.score > gameState.hiScore) {
            gameState.hiScore = gameState.score;
        }

        // Brief pause before showing the game over screen
        this.time.delayedCall(800, () => {
            this.scene.stop("UIScene");
            this.scene.start("GameOverScene");
        });
    }

    // UPDATE
    // Runs every frame
    update(time, delta) {
        if (this.isGameOver) return;

        const H = this.scale.height;

        // Redraw starfield each frame
        this.starGfx.clear();
        for (const s of this.stars) {
            s.y += s.speed;
            if (s.y > H) s.y = 0;
            this.starGfx.fillStyle(0xffffff, Math.min(s.speed / 2.5, 1));
            this.starGfx.fillRect(s.x, s.y, s.size, s.size);
        }

        // Player movement - gallery shooter so left and right only
        if (this.player.alive) {
            const speed = 480; // pixels per second

            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-speed);
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(speed);
            } else {
                this.player.setVelocityX(0); // stop immediately when key released
            }
            this.player.setVelocityY(0); // no vertical movement locked to bottom row

            // JustDown fires once per press not every frame the key is held
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this._playerShoot();
            }
        }

        // Skip formation drift during boss waves since boss uses its own tween
        if (!this.bossActive) {
            this._updateFormationDrift(delta);
        }

        // Remove bullets that have left the screen to avoid memory buildup
        for (const b of this.pBulletGroup.getChildren()) {
            if (b.y < -20) b.destroy();
        }
        for (const b of this.eBulletGroup.getChildren()) {
            if (b.y > H + 20) b.destroy();
        }

        // Collision detection using loops so it works for any number of
        // bullets and enemies without writing a line for every possible pair

        // Player bullets vs enemies
        for (const pb of this.pBulletGroup.getChildren()) {
            for (const e of this.enemyGroup.getChildren()) {
                if (pb.active && e.active &&
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        pb.getBounds(), e.getBounds()
                    )) {
                    this._hitEnemy(pb, e);
                    break; // bullet is destroyed so stop checking further enemies
                }
            }
        }

        // Enemy bullets vs player
        if (this.player.alive) {
            for (const eb of this.eBulletGroup.getChildren()) {
                if (eb.active &&
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        eb.getBounds(), this.player.getBounds()
                    )) {
                    this._hitPlayer(this.player, eb);
                }
            }
        }

        // Enemy bullets vs barriers
        for (const eb of this.eBulletGroup.getChildren()) {
            for (const seg of this.barrierGroup.getChildren()) {
                if (eb.active && seg.active &&
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        eb.getBounds(), seg.getBounds()
                    )) {
                    this._hitBarrier(eb, seg);
                    break;
                }
            }
        }

        // UFOs or boss reaching the bottom triggers immediate game over
        // Critters trigger game over only after 3 have gotten through
        for (const e of this.enemyGroup.getChildren()) {
            if (e.active && e.y >= H - 20) {
                if (e.type === "critter") {
                    this.crittersThrough++;
                    e.y = -20; // recycle back to top
                    e.x = Phaser.Math.Between(40, this.scale.width - 40);
                    e.setData("diveStarted", false);
                    if (this.crittersThrough >= 3) {
                        this._gameOver();
                        return;
                    }
                } else {
                    this._gameOver();
                    return;
                }
            }
        }

        // Refresh boss HP bar every frame while boss is alive
        if (this.bossActive && this.bossBar) {
            this._drawBossBar();
        }

        // Check if all enemies are gone to trigger wave clear
        this._checkWaveClear();
    }
}