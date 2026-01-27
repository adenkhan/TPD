// Global Error Handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();
    const substring = "script error";
    if (string.indexOf(substring) > -1) {
        window.alert('Script Error: See Console for details.');
    } else {
        window.alert(`Global Error: ${msg}\nLine: ${lineNo}\nFile: ${url}`);
    }
    return false;
};

import BootScene from './scenes/BootScene.js';
import IntroScene from './scenes/IntroScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import CompositionScene from './scenes/CompositionScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        IntroScene,
        CompositionScene,
        GameScene,
        UIScene
    ]
};

const game = new Phaser.Game(config);
