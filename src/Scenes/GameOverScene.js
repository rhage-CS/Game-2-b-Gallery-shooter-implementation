// Roman Hage
// Created: 5/4/2026
// Phaser: 3.70.0
//
// GameOverScene.js
//
// End-game screen shown when the player runs out of lives.
// Includes a visual component (explosion burst graphic),
// displays the final score, hi-score, and wave reached.
//
// SPACE or click — restart the game
// ESC            — return to the title screen

"use strict";

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameOverScene" });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Dark overlay behind all text
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85);

        // Visual component: explosion burst
        // Draw 16 rays radiating outward from the center like an explosion
        const gfx = this.add.graphics();
        for (let i = 0; i < 16; i++) {
            const angle  = (i / 16) * Math.PI * 2;            // evenly spaced angles
            const length = Phaser.Math.Between(30, 90);        // varied ray lengths
            const color  = [0xff4400, 0xffaa00, 0xff0000, 0xff8800][i % 4]; // rotating colors
            gfx.lineStyle(Phaser.Math.Between(2, 5), color, 1);
            gfx.beginPath();
            gfx.moveTo(W / 2, H / 2 - 40);
            gfx.lineTo(
                W / 2 + Math.cos(angle) * length,
                H / 2 - 40 + Math.sin(angle) * length
            );
            gfx.strokePath();
        }

        // Pulsing orange circle at the center of the burst
        const circle = this.add.circle(W / 2, H / 2 - 40, 28, 0xff4400);
        this.tweens.add({
            targets:  circle,
            scaleX:   1.5,
            scaleY:   1.5,
            alpha:    0.3,
            duration: 700,
            yoyo:     true,
            repeat:   -1 // loops forever
        });

        // Game over title
        this.add.text(W / 2, 60, "GAME OVER", {
            fontSize:        "48px",
            fontFamily:      "monospace",
            color:           "#ff2200",
            stroke:          "#440000",
            strokeThickness: 6
        }).setOrigin(0.5);

        // Final score
        this.add.text(W / 2, H / 2 + 20, `FINAL SCORE: ${gameState.score}`, {
            fontSize:   "24px",
            fontFamily: "monospace",
            color:      "#ffffff"
        }).setOrigin(0.5);

        // Check if the player just set a new hi-score
        const isNewHi = gameState.score > 0 && gameState.score >= gameState.hiScore;

        if (isNewHi) {
            // Blink the new hi-score label for emphasis
            const hiLabel = this.add.text(W / 2, H / 2 + 56, "✦ NEW HI-SCORE! ✦", {
                fontSize:   "20px",
                fontFamily: "monospace",
                color:      "#ffdd00"
            }).setOrigin(0.5);
            this.tweens.add({
                targets:  hiLabel,
                alpha:    0.3,
                yoyo:     true,
                duration: 500,
                repeat:   -1
            });
        } else {
            // Show the standing hi-score
            this.add.text(W / 2, H / 2 + 56, `HI-SCORE: ${gameState.hiScore}`, {
                fontSize:   "18px",
                fontFamily: "monospace",
                color:      "#ff8800"
            }).setOrigin(0.5);
        }

        // Wave reached
        this.add.text(W / 2, H / 2 + 90, `REACHED WAVE ${gameState.wave}`, {
            fontSize:   "16px",
            fontFamily: "monospace",
            color:      "#00ffcc"
        }).setOrigin(0.5);

        // Blinking restart prompt
        const prompt = this.add.text(W / 2, H - 60, "PRESS SPACE TO PLAY AGAIN", {
            fontSize:   "18px",
            fontFamily: "monospace",
            color:      "#ffff00"
        }).setOrigin(0.5);

        this.tweens.add({
            targets:  prompt,
            alpha:    0,
            duration: 600,
            yoyo:     true,
            repeat:   -1
        });

        // Title screen shortcut shown below the main prompt
        this.add.text(W / 2, H - 30, "ESC → TITLE SCREEN", {
            fontSize:   "13px",
            fontFamily: "monospace",
            color:      "#888888"
        }).setOrigin(0.5);

        // Input
        this.input.keyboard.once("keydown-SPACE", () => this._restart());
        this.input.keyboard.once("keydown-ESC",   () => this._title());
        this.input.on("pointerdown", () => this._restart());
    }

    // Reset all game state and restart from wave 1
    _restart() {
    gameState.score = 0;
    gameState.lives = 3;
    gameState.wave  = 1;
    this.scene.stop("GameOverScene");
    this.scene.stop("UIScene");
    this.scene.stop("GameScene");
    this.scene.start("GameScene");
    this.scene.start("UIScene");
}

    // Return to the title screen
    _title() {
        this.scene.stop("GameOverScene");
        this.scene.stop("GameScene");
        this.scene.start("TitleScene");
    }
}