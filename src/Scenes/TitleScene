// Roman Hage
// Created: 5/4/2026
// Phaser: 3.70.0
//
// TitleScene.js
//
// Animated title and attract screen. Displays the game title, hi-score,
// and a row of demo enemies marching across the screen. All shared
// sprites are loaded here in preload() so every other scene can use them.
//
// Controls:
//   SPACE or click — start the game
//
// Art assets from Kenny Assets "Space Shooter Redux" set:
// https://kenney.nl/assets/space-shooter-redux
//
// Art assets from Kenny Assets "Alien UFO Pack" set:
// https://kenney.nl/assets/alien-ufo-pack

"use strict";

class TitleScene extends Phaser.Scene {
    constructor() {
        super("TitleScene");
    }

    preload() {
        // Sprite assets from the assets/Characters/others/ folder
        this.load.setPath("assets/Characters/others/");
        this.load.image("player",     "Playership.png");    // SS Nimbus player ship
        this.load.image("ufo",        "Enemyship.png");     // UFO Cruiser enemy
        this.load.image("critter",    "Enemyship.png");     // Dive Critter enemy
        this.load.image("mothership", "Mothership.png");    // Mothership boss
        this.load.image("pbullet",    "Playerbullet.png");  // Player bullet
        this.load.image("ebullet",    "Enemybullet.png");   // Enemy bullet
        this.load.image("spark",      "Spark.png");         // Explosion particle
        this.load.image("barrier",    "Barrier.png");       // Barrier segment

        // Audio assets from the assets/music/ folder
        this.load.setPath("assets/music/");
        this.load.audio("bgmusic",       "bgmusic.mp3");
        this.load.audio("sfx_shoot",     "shoot.ogg");
        this.load.audio("sfx_explode",   "explosion.ogg");
        this.load.audio("sfx_hit",       "hit.ogg");
        this.load.audio("sfx_waveclear", "waveclear.ogg");
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Start background music looping as soon as the title screen appears
        this.bgMusic = this.sound.add("bgmusic", { loop: true, volume: 0.4 });
        this.bgMusic.play();

        // Scrolling starfield setup
        // Each star is an object with position, speed, and size
        this.stars = [];
        for (let i = 0; i < 120; i++) {
            this.stars.push({
                x:     Phaser.Math.Between(0, W),
                y:     Phaser.Math.Between(0, H),
                speed: Phaser.Math.FloatBetween(0.3, 1.5), // varied speeds for parallax feel
                size:  Phaser.Math.Between(1, 3)
            });
        }
        // Single graphics object redrawn every frame for the starfield
        this.starGfx = this.add.graphics();

        // Title text
        this.add.text(W / 2, 80, "COSMIC INVADERS", {
            fontSize:        "40px",
            fontFamily:      "monospace",
            color:           "#00ffff",
            stroke:          "#005555",
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle / author line
        this.add.text(W / 2, 130, "CMPM 120  ·  Roman Hage", {
            fontSize:   "14px",
            fontFamily: "monospace",
            color:      "#888888"
        }).setOrigin(0.5);

        // Hi-score display — refreshed when the attract loop resets
        this.hiText = this.add.text(W / 2, H - 120, `HI-SCORE: ${gameState.hiScore}`, {
            fontSize:   "16px",
            fontFamily: "monospace",
            color:      "#ff8800"
        }).setOrigin(0.5);

        // Attract demo enemies — a group of UFOs and critters that march
        // across the screen to show the player what enemies look like
        this.demoEnemies = this.add.group();
        this._spawnDemoEnemies();

        // Blinking start prompt
        this.promptText = this.add.text(W / 2, H - 80, "PRESS SPACE TO START", {
            fontSize:   "20px",
            fontFamily: "monospace",
            color:      "#ffff00"
        }).setOrigin(0.5);

        // Yoyo tween makes the text blink continuously
        this.tweens.add({
            targets:  this.promptText,
            alpha:    0,
            duration: 600,
            yoyo:     true,
            repeat:   -1
        });

        // Controls reminder at the very bottom
        this.add.text(W / 2, H - 50, "← → to move  |  SPACE to shoot", {
            fontSize:   "12px",
            fontFamily: "monospace",
            color:      "#aaaaaa"
        }).setOrigin(0.5);

        // once() so pressing space mid-transition doesnt double-fire
        this.input.keyboard.once("keydown-SPACE", () => this._startGame());
        this.input.on("pointerdown", () => this._startGame());

        // Clears and respawns demo enemies every 8 seconds
        this.time.addEvent({
            delay:         8000,
            loop:          true,
            callback:      this._respawnDemo,
            callbackScope: this
        });
    }

    update() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Redraw starfield each frame
        this.starGfx.clear();
        for (const s of this.stars) {
            s.y += s.speed;
            if (s.y > H) s.y = 0;  // wrap to top when it exits the bottom
            this.starGfx.fillStyle(0xffffff, 0.5 + s.speed * 0.2);
            this.starGfx.fillRect(s.x, s.y, s.size, s.size);
        }

        // Move demo enemies right with a sine wave vertical wobble
        for (const e of this.demoEnemies.getChildren()) {
            e.x += e.getData("vx");
            e.y += Math.sin(e.x * 0.02) * 1.2;  // wavy motion
            if (e.x > W + 40) e.x = -40;         // wrap around to the left side
        }
    }

    // Spawn 8 random demo enemies with random horizontal speed
    _spawnDemoEnemies() {
        const W     = this.scale.width;
        const types = ["ufo", "critter"];

        for (let i = 0; i < 8; i++) {
            const type = Phaser.Utils.Array.GetRandom(types);
            const e    = this.add.image(
                Phaser.Math.Between(-200, W),
                Phaser.Math.Between(160, 260),
                type
            ).setScale(0.9);
            e.setData("vx", Phaser.Math.FloatBetween(0.8, 2.0)); // speed stored on the object
            this.demoEnemies.add(e);
        }
    }

    // Clear old demo enemies and spawn a fresh batch
    _respawnDemo() {
        this.demoEnemies.clear(true, true);
        this._spawnDemoEnemies();
        this.hiText.setText(`HI-SCORE: ${gameState.hiScore}`); // update in case player just finished a run
    }

    // Reset shared state and transition to the game
    _startGame() {
        gameState.score = 0;
        gameState.lives = 3;
        gameState.wave  = 1;
        this.bgMusic.stop();         // stop title music before switching scenes
        this.scene.start("GameScene");
        this.scene.start("UIScene"); // UIScene runs in parallel with GameScene
    }
}