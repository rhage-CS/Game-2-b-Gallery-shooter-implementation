// Roman Hage
// Created: 5/4/2026
// Phaser: 3.70.0
//
// Cosmic Invaders — main.js
//
// Entry point for the game. Defines the global gameState object shared
// across all scenes, and configures the Phaser game instance.
//
// Art assets from Kenny Assets "Space Shooter Redux" set:
// https://kenney.nl/assets/space-shooter-redux
//
// Art assets from Kenny Assets "Alien UFO Pack" set:
// https://kenney.nl/assets/alien-ufo-pack

// debug with extreme prejudice
"use strict";

// Global game state — read and written by all scenes
// Declared with var so every scene file can access it without importing
var gameState = {
    score:   0,     // current score for this run
    hiScore: 0,     // highest score across all runs (session only)
    lives:   3,     // player lives remaining
    wave:    1      // current wave number
};

// Phaser game configuration
let config = {
    type: Phaser.AUTO,          // let Phaser pick WebGL or Canvas
    width:  640,                // canvas width in pixels
    height: 480,                // canvas height in pixels
    backgroundColor: "#000010", // deep space dark blue

    // Arcade physics for simple velocity-based movement and collisions
    physics: {
        default: "arcade",
        arcade: { debug: false } // set true to see hitboxes during testing
    },

    // Scene order matters: TitleScene runs first on launch
    scene: [TitleScene, GameScene, UIScene, GameOverScene]
};

const game = new Phaser.Game(config);