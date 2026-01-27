
import { UNIT_STATS } from '../data/units.js';

export default class CompositionScene extends Phaser.Scene {
    constructor() {
        super('CompositionScene');
    }

    create() {
        this.width = this.cameras.main.width;
        this.height = this.cameras.main.height;
        this.center = { x: this.width / 2, y: this.height / 2 };

        // Config
        this.scoreCap = 16;
        this.maxUnits = 10;
        this.costs = {
            leader: 4,
            heavy: 3,
            light: 2
        };

        // Limits
        this.limits = {
            heavy: 3,
            light: 7
        };

        // State
        this.composition = {
            leader: 1, // Fixed
            heavy: 0,
            light: 0
        };

        // UI Container
        this.createBackground();
        this.createHeader();
        this.createUnitControls();
        this.createSummary();
        this.createStartButton();

        this.updateUI();
    }

    createBackground() {
        this.add.rectangle(0, 0, this.width, this.height, 0x111111).setOrigin(0);

        // Panel
        const panelW = 800;
        const panelH = 650; // Increased height for stats
        const panel = this.add.rectangle(this.center.x, this.center.y, panelW, panelH, 0x222222);
        panel.setStrokeStyle(2, 0x444444);
    }

    createHeader() {
        this.add.text(this.center.x, 80, "Assemble Your Force", {
            fontSize: '40px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.pointsText = this.add.text(this.center.x, 130, "Points: 0 / 16", {
            fontSize: '28px',
            color: '#aaaaaa'
        }).setOrigin(0.5);
    }

    createUnitControls() {
        const startY = 220;
        const gapY = 110; // Increased gap for stats

        // Leader (Fixed)
        this.createRow(startY, "Leader", 4, 'leader', true);

        // Heavy
        this.createRow(startY + gapY, "Heavy Unit", 3, 'heavy', false);

        // Light
        this.createRow(startY + gapY * 2, "Light Unit", 2, 'light', false);
    }

    createRow(y, name, cost, type, isFixed) {
        const xStart = this.center.x - 250;

        // Name & Cost
        this.add.text(xStart, y, `${name} (${cost} pts)`, { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0.5);

        // Stats Display
        const stats = UNIT_STATS['A'][type]; // Default to faction A stats
        const perkDesc = this.getPerkDescription(stats.perk);
        const statText = `HP:${stats.hp} | ATK:${stats.atk} | MV:${stats.move} | [${stats.perk.toUpperCase()}]: ${perkDesc}`;

        this.add.text(xStart, y + 30, statText, {
            fontSize: '16px',
            color: '#aaaaaa',
            fontStyle: 'italic'
        }).setOrigin(0, 0.5);

        if (isFixed) {
            this.add.text(xStart + 350, y, "1 (Fixed)", { fontSize: '24px', color: '#888' }).setOrigin(0.5);
            return;
        }

        // Controls
        const minusBtn = this.createButton(xStart + 300, y, "-", () => this.modifyUnit(type, -1));
        const countText = this.add.text(xStart + 350, y, "0", { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
        const plusBtn = this.createButton(xStart + 400, y, "+", () => this.modifyUnit(type, 1));

        // Store refs to update
        this[`${type}CountText`] = countText;
    }

    getPerkDescription(perk) {
        switch (perk) {
            case 'skirmisher': return "Attack after move";
            case 'anchor': return "Bonus DEF on Control";
            case 'command': return "Draw card if hand low";
            default: return "";
        }
    }

    createButton(x, y, label, callback) {
        const btn = this.add.text(x, y, label, {
            fontSize: '30px',
            backgroundColor: '#444',
            padding: { x: 10, y: 5 },
            color: '#fff'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback)
            .on('pointerover', () => btn.setStyle({ backgroundColor: '#666' }))
            .on('pointerout', () => btn.setStyle({ backgroundColor: '#444' }));
        return btn;
    }

    modifyUnit(type, delta) {
        const currentScore = this.calculateScore();
        const currentCount = this.calculateTotalUnits();
        const unitCost = this.costs[type];
        const typeCount = this.composition[type];

        // Checks
        if (delta > 0) {
            if (currentScore + unitCost > this.scoreCap) return; // Cap check
            if (currentCount >= this.maxUnits) return; // Count check
            if (typeCount >= this.limits[type]) return; // Type Limit check
        } else {
            if (typeCount <= 0) return; // Min check
        }

        this.composition[type] += delta;
        this.updateUI();
    }

    calculateScore() {
        return (this.composition.leader * this.costs.leader) +
            (this.composition.heavy * this.costs.heavy) +
            (this.composition.light * this.costs.light);
    }

    calculateTotalUnits() {
        return this.composition.leader + this.composition.heavy + this.composition.light;
    }

    createSummary() {
        this.summaryText = this.add.text(this.center.x, 500, "", {
            fontSize: '20px',
            color: '#88ccff',
            align: 'center'
        }).setOrigin(0.5);
    }

    createStartButton() {
        this.startBtn = this.add.text(this.center.x, 600, "CONFIRM DEPLOYMENT", {
            fontSize: '32px',
            backgroundColor: '#008800',
            padding: { x: 20, y: 10 },
            color: '#fff',
            fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame())
            .on('pointerover', () => this.startBtn.setStyle({ backgroundColor: '#00aa00' }))
            .on('pointerout', () => this.startBtn.setStyle({ backgroundColor: '#008800' }));
    }

    updateUI() {
        // Update Counts
        if (this.heavyCountText) this.heavyCountText.setText(`${this.composition.heavy}/${this.limits.heavy}`);
        if (this.lightCountText) this.lightCountText.setText(`${this.composition.light}/${this.limits.light}`);

        // Update Score
        const score = this.calculateScore();
        this.pointsText.setText(`Points: ${score} / ${this.scoreCap}`);
        this.pointsText.setColor(score <= this.scoreCap ? '#aaffaa' : '#ff5555');

        // Update Summary
        const unitCount = this.calculateTotalUnits();
        this.summaryText.setText(`Total Units: ${unitCount} / ${this.maxUnits}`);
    }

    startGame() {
        // Pass data to Registry
        this.registry.set('playerComposition', this.composition);

        // Fixed Enemy Composition (1 Leader, 2 Heavy, 2 Light = 14 pts)
        // User asked for "2 heavy 2 light" explicitly (plus leader).
        const enemyComp = {
            leader: 1,
            heavy: 2,
            light: 2
        };
        this.registry.set('enemyComposition', enemyComp);

        this.scene.start('GameScene');
    }
}
