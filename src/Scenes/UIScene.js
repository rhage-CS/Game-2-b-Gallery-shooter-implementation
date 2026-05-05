// Roman Hage
// Created: 5/4/2026
// Phaser: 3.70.0
//
// UIScene.js
//
// HUD overlay scene that runs in parallel with GameScene.
// Displays the player's current score, all-time hi-score,
// current wave number, and remaining lives as heart symbols.
//
// Listens for a "uiUpdate" event emitted by GameScene whenever
// the score, lives, or wave number changes.

"use strict";

class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: "UIScene" });
    }

    create() {
        const W = this.scale.width;

        // Score display top left
        this.scoreText = this.add.text(10, 10, "", {
            fontSize:   "16px",
            fontFamily: "monospace",
            color:      "#ffffff"
        });

        // Hi-score display top center
        this.hiText = this.add.text(W / 2, 10, "", {
            fontSize:   "16px",
            fontFamily: "monospace",
            color:      "#ff8800"
        }).setOrigin(0.5, 0);

        // Wave number top right
        this.waveText = this.add.text(W - 10, 10, "", {
            fontSize:   "16px",
            fontFamily: "monospace",
            color:      "#00ffcc"
        }).setOrigin(1, 0);

        // Lives displayed as heart symbols below the score
        this.livesText = this.add.text(10, 30, "", {
            fontSize:   "14px",
            fontFamily: "monospace",
            color:      "#ff4444"
        });

        // Listen for uiUpdate events from GameScene
        // This fires whenever score, lives, or wave changes
        const gameScene = this.scene.get("GameScene");
        gameScene.events.on("uiUpdate", this._refresh, this);

        // Draw the initial values right away
        this._refresh();
    }

    // Pull current values from gameState and update all text objects
    _refresh() {
        if (!gameState) return;
        this.scoreText.setText(`SCORE: ${gameState.score}`);
        this.hiText.setText(`HI: ${gameState.hiScore}`);
        this.waveText.setText(`WAVE ${gameState.wave}`);
        this.livesText.setText("♥".repeat(Math.max(0, gameState.lives)));
    }
}