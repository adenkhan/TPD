
import { HexUtils } from '../utils/hex.js';
import { UNIT_STATS } from '../data/units.js';
import { StateMachine, GameStates } from '../utils/stateMachine.js';
import { ENEMY_AUTOMA } from '../data/enemyAutoma.js';
import { DECKS } from '../data/cards.js';
import { MapGenerator } from '../utils/mapGenerator.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        try {
            this.boardRadius = 6;

            // Auto-scale hex size to fit screen
            const boardHeight = (this.boardRadius * 2 + 1);
            const totalRows = this.boardRadius * 2 + 1;
            const maxBoardPx = this.sys.game.config.height * 0.9;

            this.hexSize = maxBoardPx / (totalRows * 1.6);
            this.hexSize = Math.min(this.hexSize, 40);

            this.tiles = new Map();
            this.units = new Map();

            // Game State
            this.influence = 6;
            this.turnFlags = {
                hasMoved: false,
                hasAttacked: false,
                cardPlayed: false
            };

            // Center the board
            this.boardOriginX = this.sys.game.config.width / 2;
            this.boardOriginY = this.sys.game.config.height / 2;

            this.generateBoard();

            // Graphics for highlights
            this.highlightGraphics = this.add.graphics();
            this.moveHighlightGraphics = this.add.graphics();
            this.pathGraphics = this.add.graphics();

            this.input.on('pointerdown', this.onPointerDown, this);
            this.input.on('pointermove', this.onPointerMove, this);

            // Launch UI Scene in parallel
            this.scene.launch('UIScene');
            this.uiScene = this.scene.get('UIScene');

            this.placedUnitsHistory = [];
            this.fsm = new StateMachine(GameStates.PLAYER_SELECT_UNIT, this);
            this.createFactionSelectionUI();

            // Card System
            this.deck = [];
            this.hand = [];
            this.discard = [];
            this.events.on('cardClicked', this.onCardClicked, this);

            // Targeting
            this.pendingCard = null;

        } catch (e) {
            console.error("GameScene Create Error:", e);
            window.alert("GameScene Create Error:\n" + e.message + "\n" + e.stack);
        }
    }

    updateUI() {
        if (this.uiScene && this.uiScene.updateStats) {
            // Placement Status
            let placementStatus = "";
            if (this.fsm.getState() === GameStates.PLACEMENT && this.placementQueue && this.placementQueue.length > 0) {
                const next = this.placementQueue[0];
                placementStatus = `Placing: ${next.toUpperCase()} (${this.placementQueue.length} left)`;
            }

            this.uiScene.updateStats({
                influence: this.influence,
                state: this.fsm.getState(),
                turn: this.currentTurn || 0,
                placement: placementStatus
            });
            this.uiScene.updateHand(this.hand, this);
        }
    }

    initializeDeck(faction) {
        console.log(`Initializing Deck for ${faction}`);
        const template = DECKS[faction];
        if (!template) console.error("No Deck Found for faction: " + faction);
        this.deck = JSON.parse(JSON.stringify(template));
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        this.hand = [];
        this.discard = [];
    }

    drawCard() {
        if (this.hand.length >= 3) {
            console.log("Hand full, cannot draw.");
            return;
        }
        if (this.deck.length === 0) {
            if (this.discard.length === 0) return;
            this.deck = [...this.discard];
            this.discard = [];
            for (let i = this.deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
            }
        }
        const card = this.deck.pop();
        this.hand.push(card);
        this.updateUI();
    }

    onCardClicked(card) {
        if (this.turnFlags.cardPlayed) {
            console.log("Already played a card this turn.");
            return;
        }
        this.pendingCard = card;
        this.enterTargetingMode(card);
    }

    enterTargetingMode(card) {
        this.fsm.transition(GameStates.PLAYER_PLAY_CARD);
        this.highlightGraphics.clear();
        this.moveHighlightGraphics.clear();
        this.logAction(`Select target for ${card.name}`);
    }

    createFactionSelectionUI() {
        this.selectFaction(this.registry.get('playerFaction') || 'A');
    }

    selectFaction(faction) {
        this.playerFaction = faction;
        this.enemyFaction = faction === 'A' ? 'B' : 'A';
        this.enterPlacementPhase();
        this.createEndTurnButton();
    }

    createEndTurnButton() {
        this.endTurnBtn = this.add.text(this.sys.game.config.width - 150, this.sys.game.config.height - 50, 'End Turn', {
            fontSize: '24px', fill: '#fff', backgroundColor: '#555', padding: { x: 15, y: 8 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .on('pointerdown', () => {
                if (this.fsm.getState() === GameStates.PLACEMENT) {
                    this.showFloatingText(this.endTurnBtn.x, this.endTurnBtn.y - 50, "Place all units first!", '#ff5555');
                    return;
                }
                if (this.fsm.getState() === GameStates.END_PLAYER_TURN) return; // Prevent double clicks

                if (this.fsm.getState() !== GameStates.ENEMY_TURN) {
                    if (this.hand.length > 0 && !this.turnFlags.cardPlayed) {
                        this.showFloatingText(this.endTurnBtn.x, this.endTurnBtn.y - 50, "Must play 1 card!", '#ff5555');
                        return;
                    }
                    this.playClickSound();
                    this.endPlayerTurn();
                }
            });
    }

    playClickSound() { }
    playAttackSound() { }

    enterPlacementPhase() {
        console.log("Entering Placement Phase");
        this.fsm.transition(GameStates.PLACEMENT);

        // 1. Get Composition
        const playerComp = this.registry.get('playerComposition') || { leader: 1, heavy: 1, light: 1 };

        // 2. Build Queue
        this.placementQueue = [];
        for (let i = 0; i < playerComp.leader; i++) this.placementQueue.push('leader');
        for (let i = 0; i < playerComp.heavy; i++) this.placementQueue.push('heavy');
        for (let i = 0; i < playerComp.light; i++) this.placementQueue.push('light');

        // Sort: Leader first, then Heavy, then Light
        const priority = { 'leader': 0, 'heavy': 1, 'light': 2 };
        this.placementQueue.sort((a, b) => priority[a] - priority[b]);

        this.placedUnitsHistory = []; // For Undo

        // 3. Highlight Spawn Zone
        this.highlightSpawnZones();

        this.updateUI();
        this.showFloatingText(this.boardOriginX, this.boardOriginY, "PLACEMENT PHASE", '#00aaff');
        this.createFinishPlacementButton();
    }

    getValidSpawnHexes(faction) {
        const valid = [];
        const isPlayer = faction === this.playerFaction;
        const minQ = isPlayer ? null : 3;
        const maxQ = isPlayer ? -3 : null;

        this.tiles.forEach((tile, key) => {
            if (tile.type === 'blocked') return;
            const dist = HexUtils.hexDistance(tile.q, tile.r, 0, 0);
            if (dist >= 4 && dist <= 6) {
                // Constraint: 
                // Player: q <= -3
                // Enemy: q >= 3
                let ok = true;
                if (minQ !== null && tile.q < minQ) ok = false;
                if (maxQ !== null && tile.q > maxQ) ok = false;

                if (ok) {
                    // Check if occupied
                    if (!this.units.has(key)) {
                        valid.push(tile);
                    }
                }
            }
        });
        return valid;
    }

    highlightSpawnZones() {
        this.moveHighlightGraphics.clear();
        const valid = this.getValidSpawnHexes(this.playerFaction);
        valid.forEach(tile => {
            const pos = HexUtils.axialToPixel(tile.q, tile.r, this.hexSize);
            const x = this.boardOriginX + pos.x;
            const y = this.boardOriginY + pos.y;
            this.drawHex(this.moveHighlightGraphics, x, y, 0x00ff88, 0.2);
        });
    }

    deployEnemy() {
        console.log("Deploying Enemy...");
        const enemyComp = this.registry.get('enemyComposition') || { leader: 1, heavy: 1, light: 1 };
        const queue = [];
        for (let i = 0; i < enemyComp.leader; i++) queue.push('leader');
        for (let i = 0; i < enemyComp.heavy; i++) queue.push('heavy');
        for (let i = 0; i < enemyComp.light; i++) queue.push('light');
        queue.sort((a, b) => { const p = { 'leader': 0, 'heavy': 1, 'light': 2 }; return p[a] - p[b]; });

        queue.forEach(type => {
            const valid = this.getValidSpawnHexes(this.enemyFaction);
            console.log(`Deploying ${type}: Found ${valid.length} valid spots`);
            if (valid.length > 0) {
                const idx = Math.floor(Math.random() * valid.length);
                const tile = valid[idx];
                this.spawnUnit(tile.q, tile.r, this.enemyFaction, type);
                console.log(`Spawned Enemy ${type} at ${tile.q},${tile.r}`);
            } else {
                console.warn(`Failed to spawn Enemy ${type} - No valid spots!`);
                // Fallback
                const fallback = [];
                this.tiles.forEach(t => { if (t.type !== 'blocked' && !this.units.has(`${t.q},${t.r}`)) fallback.push(t); });
                if (fallback.length > 0) {
                    const t = fallback[Math.floor(Math.random() * fallback.length)];
                    this.spawnUnit(t.q, t.r, this.enemyFaction, type);
                }
            }
        });
    }

    startTurn1() {
        this.moveHighlightGraphics.clear();
        this.currentTurn = 1; // Actually 0->1 transition happens in startPlayerTurn
        // But startPlayerTurn increments it.
        this.currentTurn = 0;

        this.startPlayerTurn();
        this.createDebugButtons();
    }

    createFinishPlacementButton() {
        // Prevent duplicate
        if (this.finishPlacementBtn) return;

        this.finishPlacementBtn = this.add.text(this.sys.game.config.width - 150, this.sys.game.config.height - 100, 'Finish Placement', {
            fontSize: '24px', fill: '#fff', backgroundColor: '#008800', padding: { x: 15, y: 8 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setVisible(true) // Visible always, logic check inside
            .on('pointerdown', () => {
                if (this.placementQueue.length > 0) {
                    this.showFloatingText(this.finishPlacementBtn.x, this.finishPlacementBtn.y - 50, "Place all units first!", '#ff5555');
                    return;
                }

                // Start Game
                this.deployEnemy();
                this.startTurn1();

                this.finishPlacementBtn.destroy();
                this.finishPlacementBtn = null;
            });
    }

    createDebugButtons() {
        // Force Victory
        const winBtn = this.add.text(100, this.sys.game.config.height - 50, 'FORCE VICTORY', {
            fontSize: '20px', fill: '#00ff00', backgroundColor: '#333333', padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .on('pointerdown', () => {
                this.gameOver(true, "Forced Victory");
            });

        // Forfeit
        const loseBtn = this.add.text(250, this.sys.game.config.height - 50, 'FORFEIT', {
            fontSize: '20px', fill: '#ff0000', backgroundColor: '#333333', padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .on('pointerdown', () => {
                this.gameOver(false, "Forfeited");
            });
    }

    spawnUnit(q, r, faction, typeKey) {
        const stats = UNIT_STATS[faction][typeKey];
        const id = Math.random().toString(36).substr(2, 9);
        const unit = {
            id,
            faction,
            type: stats.type,
            hp: stats.hp,
            maxHp: stats.maxHp,
            atk: stats.atk,
            move: stats.move,
            cost: stats.cost,
            perk: stats.perk,
            q,
            r,
            hasActed: false
        };

        const pos = HexUtils.axialToPixel(q, r, this.hexSize);
        const x = this.boardOriginX + pos.x;
        const y = this.boardOriginY + pos.y;
        const spriteKey = `${faction}_${typeKey}`;

        // Container for Unit
        const container = this.add.container(x, y);

        // const sprite = this.add.image(0, 0, spriteKey);

        // --- Procedural Unit Visuals ---
        const baseGraphics = this.add.graphics();
        // Faction Colors: Blue (A) vs Red (B)
        const baseColor = faction === 'A' ? 0x0088ff : 0xdd3333;
        const baseRadius = this.hexSize * 0.65;

        // 1. Draw Cell Background (Circle)
        baseGraphics.fillStyle(baseColor, 1);
        baseGraphics.lineStyle(2, 0xffffff, 1);
        baseGraphics.fillCircle(0, 0, baseRadius);
        baseGraphics.strokeCircle(0, 0, baseRadius);
        container.add(baseGraphics);

        // 2. Draw Unit Icon (Shape)
        const iconGraphics = this.add.graphics();
        iconGraphics.fillStyle(0xffffff, 1);
        const iconSize = baseRadius * 0.7;

        if (typeKey === 'light') {
            // Triangle (Dagger/Speed)
            const h = iconSize * 0.866;
            const w = iconSize;
            iconGraphics.beginPath();
            iconGraphics.moveTo(0, -h / 2);
            iconGraphics.lineTo(w / 2, h / 2);
            iconGraphics.lineTo(-w / 2, h / 2);
            iconGraphics.closePath();
            iconGraphics.fillPath();
        }
        else if (typeKey === 'heavy') {
            // Shield (Square-ish)
            const s = iconSize * 0.8;
            iconGraphics.fillRect(-s / 2, -s / 2, s, s);
            // Detail
            iconGraphics.fillStyle(baseColor, 1);
            iconGraphics.fillRect(-s / 6, -s / 3, s / 3, s / 1.5);
        }
        else if (typeKey === 'leader') {
            // Star (Crown)
            const points = 5;
            const outer = iconSize * 0.6;
            const inner = iconSize * 0.25;
            const starPoints = [];
            for (let i = 0; i < points * 2; i++) {
                const r = (i % 2 === 0) ? outer : inner;
                const angle = (i * Math.PI) / points - Math.PI / 2;
                starPoints.push({
                    x: Math.cos(angle) * r,
                    y: Math.sin(angle) * r
                });
            }
            iconGraphics.fillPoints(starPoints, true);
        }

        container.add(iconGraphics);

        // Add Type Indicator (Text/Icon)
        let typeSymbol = '';
        let symbolColor = '#ffffff';
        if (typeKey === 'light') { typeSymbol = '●'; symbolColor = '#00ff00'; } // Circle/Dot
        else if (typeKey === 'heavy') { typeSymbol = '■'; symbolColor = '#0088ff'; } // Square
        else if (typeKey === 'leader') { typeSymbol = '★'; symbolColor = '#ffaa00'; } // Star

        const indicator = this.add.text(0, 0, typeSymbol, {
            fontSize: '24px',
            fontStyle: 'bold',
            fill: symbolColor,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // container.add(indicator);

        // HP Bar
        const hpBar = this.add.graphics();
        container.add(hpBar);
        unit.hpBar = hpBar;
        this.updateHPBar(unit);

        container.setInteractive(new Phaser.Geom.Circle(0, 0, this.hexSize * 0.75), Phaser.Geom.Circle.Contains);
        container.setData('unitId', id);
        container.setData('isUnit', true);
        unit.sprite = container;
        unit.visual = baseGraphics; // Store reference to the actual image for tinting

        this.units.set(`${q},${r}`, unit);
    }

    selectUnit(unit) {
        if (this.selectedUnit && this.selectedUnit.visual) {
            this.selectedUnit.visual.clearTint();
        }

        this.selectedUnit = unit;
        if (unit.visual) unit.visual.setAlpha(0.6);

        this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);
        this.showMoveHighlights(unit);
        this.showAttackHighlights(unit);
    }

    clearSelection() {
        if (this.selectedUnit && this.selectedUnit.visual) {
            this.selectedUnit.visual.setAlpha(1);
        }
        this.selectedUnit = null;
        this.moveHighlightGraphics.clear();
        this.highlightGraphics.clear();
    }

    createFinishPlacementButton() {
        this.finishPlacementBtn = this.add.text(this.sys.game.config.width / 2, this.sys.game.config.height - 100, 'Finish Placement', {
            fontSize: '28px', fill: '#00ff00', backgroundColor: '#333', padding: { x: 20, y: 10 },
            stroke: '#000', strokeThickness: 4
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .on('pointerdown', () => {
                if (this.placementQueue.length > 0) {
                    this.showFloatingText(this.finishPlacementBtn.x, this.finishPlacementBtn.y - 50, "Place all units first!", '#ff5555');
                    return;
                }

                this.deployEnemy();
                this.startTurn1();
                this.finishPlacementBtn.destroy();
                this.finishPlacementBtn = null;
            });
    }

    // enterPlacementPhase is already defined above at line 178.
    // This duplicate block hardcodes values and causes the bug.
    // Removing it to use the correct logic.

    updateHPBar(unit) {
        if (!unit.hpBar) return;
        unit.hpBar.clear();
        unit.hpBar.fillStyle(0x00ff00);
        // Draw HP pips
        const size = 6;
        const gap = 2;
        const totalW = (size + gap) * unit.maxHp;
        const startX = -totalW / 2;
        const y = -this.hexSize * 0.5;

        for (let i = 0; i < unit.maxHp; i++) {
            if (i < unit.hp) unit.hpBar.fillStyle(0x00ff00); // Green
            else unit.hpBar.fillStyle(0x555555); // Gray/Empty

            unit.hpBar.fillRect(startX + i * (size + gap), y, size, size);
        }
    }

    generateBoard() {
        const seed = this.registry.get('seed') || Date.now();
        console.log("Generating Map with Seed:", seed);

        const generator = new MapGenerator(this.boardRadius);
        const mapData = generator.generate(seed, 1.0);

        mapData.forEach((type, key) => {
            const [q, r] = key.split(',').map(Number);
            this.createTile(q, r, type);
        });
    }

    getHexPoints(x, y, size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // Pointy Top
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: x + size * Math.cos(angle_rad),
                y: y + size * Math.sin(angle_rad)
            });
        }
        return points;
    }

    createTile(q, r, type) {
        const pos = HexUtils.axialToPixel(q, r, this.hexSize);
        const x = this.boardOriginX + pos.x;
        const y = this.boardOriginY + pos.y;

        // Map generator uses 'neutral', 'blocked', 'cover', 'control'
        // spriteKey: hex_neutral, hex_blocked, hex_cover
        // For control, use neutral but tint it? Or assume asset exists?
        // Let's use neutral and tint GOLD.

        let spriteKey = `hex_${type}`;
        if (type === 'control') spriteKey = 'hex_neutral'; // Fallback to neutral sprite base
        if (!this.textures.exists(spriteKey)) spriteKey = 'hex_neutral'; // Safety

        const sprite = this.add.image(x, y, spriteKey);

        if (type === 'control') {
            sprite.setTint(0xffd700); // GOLD
        }

        const scale = (this.hexSize * 2) / sprite.height;
        sprite.setScale(scale);

        // 1. Mask (World Coordinates)
        const maskSize = this.hexSize * 0.98;
        const worldMaskPoints = this.getHexPoints(x, y, maskSize);

        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillPoints(worldMaskPoints, true, true);
        const mask = maskShape.createGeometryMask();
        sprite.setMask(mask);

        // 2. Interaction
        const localPoints = this.getHexPoints(0, 0, this.hexSize);
        const hitPoly = new Phaser.Geom.Polygon(localPoints);

        sprite.setInteractive(hitPoly, Phaser.Geom.Polygon.Contains);

        sprite.setData('q', q);
        sprite.setData('r', r);
        sprite.setData('type', type);
        sprite.setData('isTile', true);

        this.tiles.set(`${q},${r}`, { q, r, type, sprite });
    }

    logAction(msg) {
        if (this.uiScene && this.uiScene.log) {
            this.uiScene.log(msg);
        }
    }

    onPointerDown(pointer) {
        if (this.fsm.getState() === GameStates.GAME_OVER) return;

        const localX = pointer.x - this.boardOriginX;
        const localY = pointer.y - this.boardOriginY;
        const axial = HexUtils.pixelToAxial(localX, localY, this.hexSize);
        const q = axial.q;
        const r = axial.r;

        // Check bounds/existence
        if (!this.tiles.has(`${q},${r}`)) return; // Clicked outside map

        const tile = this.tiles.get(`${q},${r}`);
        const unit = this.units.get(`${q},${r}`);

        console.log(`Pointer Down at: ${q},${r} | Unit: ${unit ? unit.type : 'none'}`);

        // --- PLACEMENT PHASE ---
        if (this.fsm.getState() === GameStates.PLACEMENT) {
            console.log("Placement Phase Click");
            // Validate
            const valid = this.getValidSpawnHexes(this.playerFaction);
            const isValid = valid.some(v => v.q === q && v.r === r);

            if (isValid && this.placementQueue.length > 0) {
                const type = this.placementQueue.shift();
                this.spawnUnit(q, r, this.playerFaction, type);

                // Track for Undo
                const u = this.units.get(`${q},${r}`);
                this.placedUnitsHistory.push(u);

                this.highlightSpawnZones(); // Refresh
                this.updateUI();

                if (this.placementQueue.length === 0) {
                    this.time.delayedCall(500, () => {
                        this.deployEnemy();
                        this.startTurn1();
                    });
                }
            }
            return;
        }

        // --- SKIRMISH MOVE ---
        if (this.fsm.getState() === GameStates.PLAYER_SKIRMISH_MOVE) {
            if (this.selectedUnit && this.units.has(`${q},${r}`) && this.units.get(`${q},${r}`) === this.selectedUnit) {
                // Click self to skip
                this.logAction("Skirmish Move skipped");
                this.selectedUnit.hasActed = true;
                this.clearSelection();
                this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);
                this.highlightGraphics.clear();
                this.moveHighlightGraphics.clear();
                return;
            }

            const u = this.selectedUnit;
            const dist = HexUtils.hexDistance(u.q, u.r, q, r);
            if (dist === 1 && !this.units.has(`${q},${r}`) && this.tiles.get(`${q},${r}`).type !== 'blocked') {
                this.moveUnit(u, q, r);
                this.logAction("Skirmish Move successful");
            } else {
                console.log("Invalid Skirmish Move");
            }

            u.hasActed = true;
            this.clearSelection();
            this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);
            this.highlightGraphics.clear();
            this.moveHighlightGraphics.clear();
            return;
        }

        if (this.fsm.getState() === GameStates.ENEMY_TURN) return;

        // --- CARD TARGETING ---
        if (this.fsm.getState() === GameStates.PLAYER_PLAY_CARD && this.pendingCard) {
            let target = null;
            if (unit) target = unit;
            else if (tile) target = { q: tile.q, r: tile.r, type: tile.type };

            if (target) this.processCardTarget(target);
            return;
        }

        // --- NORMAL SELECTION / MOVE / ATTACK ---
        if (unit) {
            if (unit.faction === this.playerFaction) {
                this.selectUnit(unit);
            } else {
                if (this.selectedUnit && !this.turnFlags.hasAttacked && !this.selectedUnit.hasActed) {
                    this.tryAttack(this.selectedUnit, unit);
                }
            }
        } else if (tile) {
            if (this.selectedUnit && !this.turnFlags.hasMoved && !this.selectedUnit.hasActed) {
                this.tryMove(this.selectedUnit, q, r);
            }
        }
    }

    processCardTarget(target) {
        const card = this.pendingCard;
        // Handle Multi-Target Cards
        if (card.effectKey === 'REPOSITION') {
            if (!this.cardTargets) this.cardTargets = [];
            if (!target.faction) return; // Must be unit

            this.cardTargets.push(target);
            if (target.visual) target.visual.setTint(0x00ff00);

            if (this.cardTargets.length >= 2) {
                this.resolveCard(card, this.cardTargets);
                this.cardTargets = [];
            }
        } else if (card.effectKey === 'DENY_CONTROL') {
            if (!this.cardTargets) this.cardTargets = [];
            if (this.cardTargets.length === 0) {
                if (target.faction === this.enemyFaction && target.q === 0 && target.r === 0) {
                    this.cardTargets.push(target);
                    if (target.visual) target.visual.setTint(0xff0000);
                }
            } else {
                if (!target.faction && !this.tiles.get(`${target.q},${target.r}`).type === 'blocked') {
                    if (HexUtils.hexDistance(0, 0, target.q, target.r) === 1) {
                        this.resolveCard(card, [this.cardTargets[0], target]);
                        this.cardTargets = [];
                    }
                }
            }
        } else {
            this.resolveCard(card, target);
        }
    }

    // onGameObjectClicked replaced by onPointerDown for reliability
    // kept as placeholder if needed later or can be removed fully.
    onGameObjectClicked(pointer, gameObject) {
        // Disabled
    }

    resolveCard(card, target) {
        let success = false;
        const isFriend = (t) => t && t.faction === this.playerFaction;
        const isEnemy = (t) => t && t.faction === this.enemyFaction;

        switch (card.effectKey) {
            case 'RAPID_PUSH':
                if (isFriend(target)) {
                    target.move += 2;
                    this.logAction(`Rapid Push: ${target.type} move +2`);
                    success = true;
                }
                break;
            case 'REPOSITION':
                if (Array.isArray(target) && target.length === 2) {
                    const [u1, u2] = target;
                    if (isFriend(u1) && isFriend(u2)) {
                        const p1 = { q: u1.q, r: u1.r };
                        const p2 = { q: u2.q, r: u2.r };

                        this.units.delete(`${p1.q},${p1.r}`);
                        this.units.delete(`${p2.q},${p2.r}`);

                        u1.q = p2.q; u1.r = p2.r;
                        u2.q = p1.q; u2.r = p1.r;

                        this.units.set(`${u1.q},${u1.r}`, u1);
                        this.units.set(`${u2.q},${u2.r}`, u2);

                        this.updateUnitPos(u1);
                        this.updateUnitPos(u2);
                        this.logAction(`Reposition: Swapped units`);
                        success = true;
                    }
                }
                break;
            case 'SPRINT':
                if (isFriend(target)) {
                    target.hasSprint = true;
                    this.logAction(`Sprint: ${target.type} ready!`);
                    success = true;
                }
                break;
            case 'FALLBACK':
                if (isFriend(target)) {
                    const neighbors = HexUtils.getReachableHexes(target.q, target.r, 1, this.getBlockedSet());
                    let nearest = null;
                    let minDist = 999;
                    this.units.forEach(u => {
                        if (u.faction === this.enemyFaction) {
                            const d = HexUtils.hexDistance(u.q, u.r, target.q, target.r);
                            if (d < minDist) { minDist = d; nearest = u; }
                        }
                    });

                    if (neighbors.length > 0) {
                        neighbors.sort((a, b) => {
                            const da = nearest ? HexUtils.hexDistance(a.q, a.r, nearest.q, nearest.r) : 0;
                            const db = nearest ? HexUtils.hexDistance(b.q, b.r, nearest.q, nearest.r) : 0;
                            return db - da;
                        });
                        const dest = neighbors[0];
                        this.moveUnitForce(target, dest.q, dest.r);
                        this.logAction(`Fallback: ${target.type} retreated`);
                        success = true;
                    }
                }
                break;
            case 'FOCUSED_STRIKE':
                if (isFriend(target)) {
                    target.atkBuff = (target.atkBuff || 0) + 1;
                    this.logAction(`Focused Strike: ${target.type} +1 ATK`);
                    success = true;
                }
                break;
            case 'HOLD_GROUND':
                if (isFriend(target)) {
                    target.defBuff = (target.defBuff || 0) + 1;
                    this.logAction(`Hold Ground: ${target.type} +1 DEF`);
                    success = true;
                }
                break;
            case 'DISRUPT':
                if (isEnemy(target)) {
                    let adj = false;
                    const neighbors = HexUtils.hexNeighbors(target.q, target.r);
                    for (const n of neighbors) {
                        const u = this.units.get(`${n.q},${n.r}`);
                        if (u && u.faction === this.playerFaction) { adj = true; break; }
                    }

                    if (adj) {
                        target.isRooted = true;
                        this.showFloatingText(target.sprite.x, target.sprite.y, "ROOTED", '#ffff00');
                        this.logAction(`Disrupt: ${target.type} Rooted`);
                        success = true;
                    }
                }
                break;
            case 'AMBUSH':
                if (isFriend(target)) {
                    const tile = this.tiles.get(`${target.q},${target.r}`);
                    if (tile && tile.type === 'cover') {
                        target.atkBuff = (target.atkBuff || 0) + 1;
                        this.logAction(`Ambush: ${target.type} +1 ATK (Cover)`);
                        success = true;
                    }
                }
                break;
            case 'SECURE_AREA':
                {
                    const u = this.units.get("0,0");
                    if (u && u.faction === this.playerFaction) {
                        this.influence += 2;
                        this.logAction(`Secure Area: +2 Influence`);
                        success = true;
                    }
                }
                break;
            case 'DENY_CONTROL':
                if (Array.isArray(target) && target.length === 2) {
                    const [enemy, tile] = target;
                    this.moveUnitForce(enemy, tile.q, tile.r);
                    this.logAction("Deny Control: Enemy Pushed");
                    success = true;
                }
                break;
        }

        if (success) {
            this.discardCard(card);
            this.turnFlags.cardPlayed = true;
            this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);
            if (this.selectedUnit && this.selectedUnit.visual) this.selectedUnit.visual.setAlpha(1);
            this.selectedUnit = null;
            this.pendingCard = null;
            this.cardTargets = null;
            this.highlightGraphics.clear();
        }
    }

    discardCard(card) {
        const idx = this.hand.indexOf(card);
        if (idx > -1) {
            this.hand.splice(idx, 1);
            this.discard.push(card);
            this.updateUI();
        }
    }

    moveUnitForce(unit, q, r) {
        this.units.delete(`${unit.q},${unit.r}`);
        unit.q = q; unit.r = r;
        this.units.set(`${q},${r}`, unit);
        this.updateUnitPos(unit);
    }

    updateUnitPos(unit) {
        const pos = HexUtils.axialToPixel(unit.q, unit.r, this.hexSize);
        this.tweens.add({
            targets: unit.sprite,
            x: this.boardOriginX + pos.x,
            y: this.boardOriginY + pos.y,
            duration: 300
        });
    }

    getUnitById(id) {
        return Array.from(this.units.values()).find(u => u.id === id);
    }

    selectUnit(unit) {
        if (this.selectedUnit && this.selectedUnit.visual) {
            this.selectedUnit.visual.setAlpha(1);
        }

        this.selectedUnit = unit;
        if (unit.visual) unit.visual.setAlpha(0.6);

        this.fsm.transition(GameStates.PLAYER_SKIRMISH_MOVE);
        this.showMoveHighlights(unit);
        this.showAttackHighlights(unit);
    }

    showAttackHighlights(unit) {
        if (this.turnFlags.hasAttacked || unit.hasActed) return;

        const neighbors = HexUtils.hexNeighbors(unit.q, unit.r);
        neighbors.forEach(n => {
            const k = `${n.q},${n.r}`;
            const target = this.units.get(k);
            if (target && target.faction !== unit.faction) {
                const pos = HexUtils.axialToPixel(n.q, n.r, this.hexSize);
                const x = this.boardOriginX + pos.x;
                const y = this.boardOriginY + pos.y;
                this.drawHex(this.moveHighlightGraphics, x, y, 0xff0000, 0.4);
            }
        });
    }

    showMoveHighlights(unit) {
        this.moveHighlightGraphics.clear();
        if (this.turnFlags.hasMoved || unit.hasActed) return;

        const blockedSet = new Set();
        this.tiles.forEach((t, k) => { if (t.type === 'blocked') blockedSet.add(k); });
        this.units.forEach((u, k) => blockedSet.add(k));

        const reachable = HexUtils.getReachableHexes(unit.q, unit.r, unit.move, blockedSet);

        reachable.forEach(coord => {
            const pos = HexUtils.axialToPixel(coord.q, coord.r, this.hexSize);
            const x = this.boardOriginX + pos.x;
            const y = this.boardOriginY + pos.y;
            this.drawHex(this.moveHighlightGraphics, x, y, 0x0088ff, 0.4);
        });

        this.validMoves = reachable.map(c => `${c.q},${c.r}`);
    }

    tryMove(unit, q, r) {
        if (this.validMoves && this.validMoves.includes(`${q},${r}`)) {
            this.logAction(`${unit.type} moved to(${q}, ${r})`);

            this.units.delete(`${unit.q},${unit.r}`);
            unit.q = q;
            unit.r = r;
            this.units.set(`${q},${r}`, unit);

            const pos = HexUtils.axialToPixel(q, r, this.hexSize);
            this.tweens.add({
                targets: unit.sprite,
                x: this.boardOriginX + pos.x,
                y: this.boardOriginY + pos.y,
                duration: 200
            });

            this.turnFlags.hasMoved = true;
            this.moveHighlightGraphics.clear();
            this.showAttackHighlights(unit);
            this.fsm.transition(GameStates.PLAYER_MOVE);
            this.validMoves = [];
        }
    }

    tryAttack(attacker, defender) {
        const dist = HexUtils.hexDistance(attacker.q, attacker.r, defender.q, defender.r);
        const range = 1;

        if (dist <= range) {
            let damage = attacker.atk;

            const defTile = this.tiles.get(`${defender.q},${defender.r}`);
            let reduction = 0;
            if (defTile && defTile.type === 'cover') {
                reduction++;
            }

            // Anchor Perk (Heavy)
            if (defender.perk === 'anchor') {
                if (defTile && (defTile.type === 'neutral' || defTile.type === 'control')) {
                    reduction++;
                    this.showFloatingText(defender.sprite.x, defender.sprite.y, "Anchor!", '#8888ff');
                }
            }

            damage = Math.max(0, damage - reduction);

            defender.hp -= damage;
            this.logAction(`${attacker.type} attacked ${defender.type} for ${damage} dmg`);

            const color = damage > 0 ? '#ff0000' : '#cccccc';
            const msg = damage > 0 ? `- ${damage}` : 'Blocked';
            this.showFloatingText(defender.sprite.x, defender.sprite.y, msg, color);
            this.updateHPBar(defender);

            this.turnFlags.hasAttacked = true;

            // Check Skirmisher Perk
            if (attacker.perk === 'skirmisher' && !attacker.hasMovedThisTurn && attacker.faction === this.playerFaction) {
                this.showFloatingText(attacker.sprite.x, attacker.sprite.y, "Skirmisher!", '#00aaff');
                this.enterSkirmishMove(attacker);
                // Do not set hasActed yet
                return;
            }

            attacker.hasActed = true;
            this.clearSelection();

            if (attacker.sprite) attacker.sprite.clearTint(); // Keep sprite clearTint if sprite exists, or remove if unused
            // But attacker.visual is the graphics now.
            if (attacker.visual) attacker.visual.setAlpha(1);
            this.selectedUnit = null;

            if (defender.hp <= 0) {
                this.killUnit(defender);
            }

            this.fsm.transition(GameStates.PLAYER_ATTACK);
            this.moveHighlightGraphics.clear();
        }
    }

    killUnit(unit) {
        this.units.delete(`${unit.q},${unit.r}`);
        unit.sprite.destroy();

        if (unit.type === 'leader') {
            if (unit.faction === this.playerFaction) {
                this.influence = -100;
                this.checkWinCondition();
            } else {
                this.influence += 2;
                const txt = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 100, 'ENEMY LEADER SLAIN!', {
                    fontSize: '40px', fill: '#ffaa00', stroke: '#000', strokeThickness: 4
                }).setOrigin(0.5).setDepth(200);

                this.tweens.add({
                    targets: txt,
                    scale: 1.5,
                    alpha: 0,
                    duration: 3000,
                    onComplete: () => txt.destroy()
                });

                this.updateUI();
            }
        }
    }

    endPlayerTurn() {
        this.fsm.transition(GameStates.END_PLAYER_TURN);

        // Check Control Tile Influence
        const controlKeys = ["0,0", "2,-2"];
        let occupiedCount = 0;

        controlKeys.forEach(key => {
            const u = this.units.get(key);
            if (u && u.faction === this.playerFaction) {
                occupiedCount++;
            }
        });

        if (occupiedCount > 0) {
            if (!this.influenceBlocked) {
                const gain = occupiedCount === 2 ? 3 : 1;
                this.influence += gain;
                this.showFloatingText(this.boardOriginX, this.boardOriginY, `+${gain} Influence`, '#00ff00');
            } else {
                this.showFloatingText(this.boardOriginX, this.boardOriginY, "Influence Blocked!", '#ff8800');
                this.influenceBlocked = false; // Reset flag
            }
        }


        this.checkWinCondition();
        if (this.fsm.getState() !== GameStates.GAME_OVER) {
            this.startEnemyTurn();
        }
    }

    startEnemyTurn() {
        this.fsm.transition(GameStates.ENEMY_TURN);
        this.updateUI();

        if (!this.enemyDeck || this.enemyDeck.length === 0) {
            this.enemyDeck = ENEMY_AUTOMA.getDeck();
        }

        const card = this.enemyDeck.pop();
        if (this.uiScene) {
            this.uiScene.showEnemyAction(card);
        }

        console.log(`Enemy Turn: Drawing ${card.name} (${card.actionKey})`);

        this.time.delayedCall(300, () => {
            this.resolveEnemyAction(card);

            this.time.delayedCall(300, () => {
                // Check enemy influence
                const controlKeys = ["0,0", "2,-2"];
                let occupiedCount = 0;
                controlKeys.forEach(key => {
                    const u = this.units.get(key);
                    if (u && u.faction === this.enemyFaction) {
                        occupiedCount++;
                    }
                });

                if (occupiedCount > 0) {
                    const loss = occupiedCount === 2 ? 3 : 1;
                    this.influence -= loss;
                    this.showFloatingText(this.boardOriginX, this.boardOriginY, `-${loss} Influence`, '#ff0000');
                }

                this.startPlayerTurn();
            });
        });
    }

    startPlayerTurn() {
        this.currentTurn++;
        // Reset Flags
        this.turnFlags = { hasMoved: false, hasAttacked: false, cardPlayed: false };
        this.units.forEach(u => {
            if (u.faction === this.playerFaction) {
                u.hasActed = false;
                u.hasMovedThisTurn = false;
            }
        });

        this.influenceBlocked = false;

        // Command Perk (Leader)
        const leader = Array.from(this.units.values()).find(u => u.faction === this.playerFaction && u.type === 'leader');
        if (leader) {
            if (this.hand.length < 3) {
                this.drawCard();
                this.showFloatingText(leader.sprite.x, leader.sprite.y, "Command!", '#00ffff');
            }
        }

        this.drawCard();
        this.checkWinCondition();

        if (this.fsm.getState() !== GameStates.GAME_OVER) {
            this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);
            this.updateUI();
            this.showFloatingText(this.boardOriginX, this.boardOriginY, `TURN ${this.currentTurn}`, '#ffffff');
        }
    }

    resolveEnemyAction(card) {
        const friends = Array.from(this.units.values()).filter(u => u.faction === this.enemyFaction);
        const enemies = Array.from(this.units.values()).filter(u => u.faction === this.playerFaction);

        const moveUnit = (unit, q, r) => {
            this.units.delete(`${unit.q},${unit.r}`);
            unit.q = q; unit.r = r;
            this.units.set(`${q},${r}`, unit);
            const pos = HexUtils.axialToPixel(q, r, this.hexSize);
            this.tweens.add({
                targets: unit.sprite,
                x: this.boardOriginX + pos.x,
                y: this.boardOriginY + pos.y,
                duration: 200
            });
            this.logAction(`Enemy ${unit.type} moved to ${q},${r}`);
        };

        const attackUnit = (attacker, defender) => {
            let damage = attacker.atk;
            const defTile = this.tiles.get(`${defender.q},${defender.r}`);
            if (defTile && defTile.type === 'cover') {
                damage = Math.max(0, damage - 1);
            }
            defender.hp -= damage;
            this.showFloatingText(defender.sprite.x, defender.sprite.y, `- ${damage} `, '#ff0000');
            this.updateHPBar(defender);
            this.logAction(`Enemy ${attacker.type} attacked ${defender.type} (${damage} dmg)`);
            if (defender.hp <= 0) this.killUnit(defender);
        };

        switch (card.actionKey) {
            case 'ADVANCE_CONTROL':
                {
                    let bestUnit = null;
                    let bestPathLen = 999;
                    let bestMove = null;

                    friends.forEach(u => {
                        const path = this.findPath(u, 0, 0);
                        if (path && path.length < bestPathLen && path.length > 0) {
                            bestUnit = u;
                            bestPathLen = path.length;
                            bestMove = path[0];
                        }
                    });

                    if (bestUnit && bestMove) {
                        const targetKey = `${bestMove.q},${bestMove.r}`;
                        if (!this.units.has(targetKey)) {
                            moveUnit(bestUnit, bestMove.q, bestMove.r);
                        } else {
                            const u = this.units.get(targetKey);
                            if (u && u.faction === this.playerFaction) {
                                attackUnit(bestUnit, u);
                            }
                        }
                    }
                }
                break;
            case 'FLANK':
                {
                    const sorted = [...friends].sort((a, b) => b.move - a.move);
                    const unit = sorted[0];
                    if (unit) {
                        const neighbors = HexUtils.getReachableHexes(unit.q, unit.r, 1, this.getBlockedSet());
                        neighbors.sort((a, b) => {
                            const da = HexUtils.hexDistance(a.q, a.r, 0, 0);
                            const db = HexUtils.hexDistance(b.q, b.r, 0, 0);
                            if (da !== db) return da - db;
                            const ta = this.tiles.get(`${a.q},${a.r}`);
                            const tb = this.tiles.get(`${b.q},${b.r}`);
                            const ca = ta.type === 'cover' ? 1 : 0;
                            const cb = tb.type === 'cover' ? 1 : 0;
                            return cb - ca;
                        });

                        if (neighbors.length > 0) moveUnit(unit, neighbors[0].q, neighbors[0].r);
                    }
                }
                break;
            case 'PRESS':
                {
                    const sorted = [...friends].sort((a, b) => {
                        const da = HexUtils.hexDistance(a.q, a.r, 0, 0);
                        const db = HexUtils.hexDistance(b.q, b.r, 0, 0);
                        return da - db;
                    });
                    const toMove = sorted.slice(0, 2);
                    toMove.forEach(u => {
                        const path = this.findPath(u, 0, 0);
                        if (path && path.length > 0) moveUnit(u, path[0].q, path[0].r);
                    });
                }
                break;
            case 'STRIKE_WEAK':
                {
                    const sorted = [...friends].sort((a, b) => b.atk - a.atk);
                    let acted = false;
                    for (const u of sorted) {
                        const adjEnemies = enemies.filter(e => HexUtils.hexDistance(u.q, u.r, e.q, e.r) <= 1);
                        if (adjEnemies.length > 0) {
                            adjEnemies.sort((a, b) => a.hp - b.hp);
                            attackUnit(u, adjEnemies[0]);
                            acted = true;
                            break;
                        }
                    }
                    if (!acted) this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                }
                break;
            case 'TARGET_LEADER':
                {
                    let acted = false;
                    for (const u of friends) {
                        const adjEnemies = enemies.filter(e => HexUtils.hexDistance(u.q, u.r, e.q, e.r) <= 1);
                        const leader = adjEnemies.find(e => e.type === 'leader');
                        if (leader) {
                            attackUnit(u, leader);
                            acted = true;
                            break;
                        }
                    }
                    if (!acted) this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                }
                break;
            case 'TRADE':
                {
                    let bestAction = null;
                    for (const u of friends) {
                        const adjEnemies = enemies.filter(e => HexUtils.hexDistance(u.q, u.r, e.q, e.r) <= 1);
                        for (const e of adjEnemies) {
                            let dmg = u.atk;
                            const t = this.tiles.get(`${e.q},${e.r}`);
                            if (t && t.type === 'cover') dmg = Math.max(0, dmg - 1);
                            if (e.hp <= dmg) {
                                bestAction = { u, e };
                                break;
                            }
                        }
                        if (bestAction) break;
                    }

                    if (bestAction) {
                        attackUnit(bestAction.u, bestAction.e);
                    } else {
                        this.resolveEnemyAction({ actionKey: 'STRIKE_WEAK' });
                    }
                }
                break;
            case 'FORTIFY':
                {
                    let acted = false;
                    for (const u of friends) {
                        const tile = this.tiles.get(`${u.q},${u.r}`);
                        if (tile.type === 'cover' && u.hp < u.maxHp) {
                            u.hp = Math.min(u.hp + 1, u.maxHp);
                            this.showFloatingText(u.sprite.x, u.sprite.y, "+1 HP", '#00ff00');
                            acted = true;
                            break;
                        }
                    }
                    if (!acted) {
                        this.resolveEnemyAction({ actionKey: 'FLANK' });
                    }
                }
                break;
            case 'REGROUP':
                {
                    const leader = friends.find(u => u.type === 'leader');
                    if (leader) {
                        friends.forEach(u => {
                            if (u === leader) return;
                            if (HexUtils.hexDistance(u.q, u.r, leader.q, leader.r) > 1) {
                                const path = this.findPath(u, leader.q, leader.r);
                                if (path && path.length > 0) moveUnit(u, path[0].q, path[0].r);
                            }
                        });
                    } else {
                        this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                    }
                }
                break;
            case 'WAIT':
                {
                    friends.forEach(u => u.atk += 1);
                    this.resolveEnemyAction({ actionKey: 'STRIKE_WEAK' });
                    this.time.delayedCall(250, () => friends.forEach(u => u.atk -= 1));
                }
                break;
            case 'DENY_CONTROL':
                {
                    let done = false;
                    const neighbors = HexUtils.hexNeighbors(0, 0);
                    for (const n of neighbors) {
                        const u = this.units.get(`${n.q},${n.r}`);
                        if (u && u.faction === this.enemyFaction) {
                            if (!this.units.has("0,0")) {
                                moveUnit(u, 0, 0);
                                done = true;
                                break;
                            }
                        }
                    }
                    if (!done) this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                }
                break;
            case 'BLOCK':
                {
                    const u = this.units.get("0,0");
                    if (u && u.faction === this.enemyFaction) {
                        this.influenceBlocked = true;
                        this.showFloatingText(this.boardOriginX, this.boardOriginY, "Influence Blocked", '#ff0000');
                    } else {
                        this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                    }
                }
                break;
            case 'PUSH_OFF':
                {
                    const u = this.units.get("0,0");
                    if (u && u.faction === this.playerFaction) {
                        const neighbors = HexUtils.hexNeighbors(0, 0);
                        const enemyAdj = neighbors.some(n => {
                            const unit = this.units.get(`${n.q},${n.r}`);
                            return unit && unit.faction === this.enemyFaction;
                        });

                        if (enemyAdj) {
                            const free = neighbors.find(n => !this.units.has(`${n.q},${n.r}`) && this.tiles.get(`${n.q},${n.r}`).type !== 'blocked');
                            if (free) {
                                this.units.delete("0,0");
                                u.q = free.q; u.r = free.r;
                                this.units.set(`${free.q},${free.r}`, u);
                                const pos = HexUtils.axialToPixel(free.q, free.r, this.hexSize);
                                u.sprite.x = this.boardOriginX + pos.x;
                                u.sprite.y = this.boardOriginY + pos.y;
                                this.showFloatingText(u.sprite.x, u.sprite.y, "Pushed!", '#ff0000');
                            }
                        }
                    } else {
                        this.resolveEnemyAction({ actionKey: 'ADVANCE_CONTROL' });
                    }
                }
                break;
        }
    }

    getBlockedSet() {
        const blocked = new Set();
        this.tiles.forEach((t, k) => { if (t.type === 'blocked') blocked.add(k); });
        this.units.forEach((u, k) => blocked.add(k));
        return blocked;
    }

    findPath(unit, targetQ, targetR) {
        const start = { q: unit.q, r: unit.r };
        const goal = { q: targetQ, r: targetR };

        const frontier = [];
        frontier.push(start);
        const cameFrom = new Map();
        cameFrom.set(`${start.q},${start.r}`, null);

        const blocked = this.getBlockedSet();

        while (frontier.length > 0) {
            const current = frontier.shift();

            if (current.q === goal.q && current.r === goal.r) {
                break;
            }

            const neighbors = HexUtils.hexNeighbors(current.q, current.r);
            for (const next of neighbors) {
                const key = `${next.q},${next.r}`;
                if (!this.tiles.has(key) || this.tiles.get(key).type === 'blocked') continue;
                if (blocked.has(key) && key !== `${goal.q},${goal.r}`) continue;

                if (!cameFrom.has(key)) {
                    frontier.push(next);
                    cameFrom.set(key, current);
                }
            }
        }

        const path = [];
        let curr = goal;
        if (!cameFrom.has(`${goal.q},${goal.r}`)) return null;

        while (curr.q !== start.q || curr.r !== start.r) {
            path.push(curr);
            curr = cameFrom.get(`${curr.q},${curr.r}`);
        }
        path.reverse();
        return path;
    }

    createHexMask(x, y, w, h) {
        // Redundant with getHexPoints now usually, but kept for legacy calls if any
        const shape = this.make.graphics();
        shape.fillStyle(0xffffff);
        const size = (w / 2) * 0.95;
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30;
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: x + size * Math.cos(angle_rad),
                y: y + size * Math.sin(angle_rad)
            });
        }
        shape.fillPoints(points, true, true);
        return shape.createGeometryMask();
    }

    checkWinCondition() {
        if (this.influence >= 14) {
            this.gameOver(true, "Domination Victory!");
        } else if (this.influence <= 0) {
            this.gameOver(false, "Influence Lost!");
        }

        // Round Limit
        const MAX_ROUNDS = 12;
        if (this.currentTurn > MAX_ROUNDS) {
            if (this.influence >= 10) {
                this.gameOver(true, "Time Limit Reached (>10 Inf)");
            } else {
                this.gameOver(false, "Time Limit Reached (<10 Inf)");
            }
        }

        const playerLeader = Array.from(this.units.values()).find(u => u.faction === this.playerFaction && u.type === 'leader');
        const enemyLeader = Array.from(this.units.values()).find(u => u.faction === this.enemyFaction && u.type === 'leader');

        if (!playerLeader) {
            this.gameOver(false, "Leader Fallen!");
        } else if (!enemyLeader) {
            this.gameOver(true, "Enemy Leader Slain!");
        }
    }

    // --- TURN LOGIC ---
    startPlayerTurn() {
        this.currentTurn++;
        this.fsm.transition(GameStates.PLAYER_SELECT_UNIT);

        // Reset Unit State
        this.units.forEach(u => u.hasActed = false);

        // Player has 1 action: Select Unit -> Move OR Attack -> End Turn
        this.playerHasActed = false;

        this.updateUI();
        this.showFloatingText(this.boardOriginX, this.boardOriginY, `TURN ${this.currentTurn}`, '#ffffff');
    }

    onPointerDown(pointer) {
        if (this.fsm.getState() === GameStates.GAME_OVER) return;

        const localX = pointer.x - this.boardOriginX;
        const localY = pointer.y - this.boardOriginY;
        const axial = HexUtils.pixelToAxial(localX, localY, this.hexSize);
        const q = axial.q;
        const r = axial.r;

        // --- PLACEMENT PHASE ---
        if (this.fsm.getState() === GameStates.PLACEMENT) {
            // (Existing Placement Logic)
            if (!this.tiles.has(`${q},${r}`)) return;
            const valid = this.getValidSpawnHexes(this.playerFaction);
            const isValid = valid.some(v => v.q === q && v.r === r);

            if (isValid && this.placementQueue.length > 0) {
                const type = this.placementQueue.shift();
                this.spawnUnit(q, r, this.playerFaction, type);
                this.placedUnitsHistory.push(this.units.get(`${q},${r}`));
                this.highlightSpawnZones();
                this.updateUI();

                // Removed auto-deploy to prevent double spawning / race condition with button.
                // User must click "Finish Placement".
            }
            return;
        }

        // --- PLAYER TURN ---
        if (this.fsm.getState() === GameStates.PLAYER_SELECT_UNIT && !this.playerHasActed) {
            const unit = this.units.get(`${q},${r}`);
            if (unit && unit.faction === this.playerFaction && !unit.hasActed) {
                this.selectUnit(unit);
            }
            return;
        }

        if (this.fsm.getState() === GameStates.PLAYER_SKIRMISH_MOVE) { // "Selected" state
            // Clicked on Tile? (Move)
            // Clicked on Enemy? (Attack)
            // Clicked on Self? (Cancel)

            const targetUnit = this.units.get(`${q},${r}`);
            const targetTile = this.tiles.get(`${q},${r}`);

            if (targetUnit && targetUnit === this.selectedUnit) {
                // Cancel selection
                this.clearSelection();
                return;
            }

            if (targetUnit && targetUnit.faction === this.enemyFaction) {
                // Try Attack
                // Check Adjacency
                const dist = HexUtils.hexDistance(this.selectedUnit.q, this.selectedUnit.r, q, r);
                if (dist === 1) {
                    this.executeAttack(this.selectedUnit, targetUnit);
                } else {
                    console.log("Too far to attack");
                }
                return;
            }

            if (!targetUnit && targetTile && targetTile.type !== 'blocked') {
                // Try Move
                // Check Range
                const dist = HexUtils.hexDistance(this.selectedUnit.q, this.selectedUnit.r, q, r);
                if (dist <= this.selectedUnit.move) {
                    // Check path (simple line check for now, or bfs if blocked)
                    const path = this.findPath(this.selectedUnit, q, r);
                    if (path && path.length <= this.selectedUnit.move) {
                        this.executeMove(this.selectedUnit, q, r);
                    }
                }
                return;
            }

            // If clicked elsewhere, deselect
            this.clearSelection();
        }
    }

    executeMove(unit, q, r) {
        this.units.delete(`${unit.q},${unit.r}`);
        unit.q = q; unit.r = r;
        this.units.set(`${q},${r}`, unit);

        const pos = HexUtils.axialToPixel(q, r, this.hexSize);
        this.tweens.add({
            targets: unit.sprite,
            x: this.boardOriginX + pos.x,
            y: this.boardOriginY + pos.y,
            duration: 200
        });

        this.finishPlayerAction(unit, `Moved to ${q},${r}`);
    }

    executeAttack(attacker, defender) {
        let damage = attacker.atk;
        const defTile = this.tiles.get(`${defender.q},${defender.r}`);
        if (defTile && defTile.type === 'cover') {
            damage = Math.max(0, damage - 1);
            this.showFloatingText(defender.sprite.x, defender.sprite.y - 20, "Cover!", '#aaaaff');
        }

        defender.hp -= damage;
        this.updateHPBar(defender);
        this.createHitEffect(defender.sprite.x, defender.sprite.y);

        this.showFloatingText(defender.sprite.x, defender.sprite.y, `-${damage}`, '#ff0000');

        if (defender.hp <= 0) {
            this.killUnit(defender);
            this.finishPlayerAction(attacker, `Killed ${defender.type}!`);
        } else {
            this.finishPlayerAction(attacker, `Attacked ${defender.type}`);
        }
    }

    createHitEffect(x, y) {
        const star = this.add.star(x, y, 5, 10, 20, 0xffff00);
        this.tweens.add({
            targets: star,
            scale: 2,
            alpha: 0,
            angle: 180,
            duration: 300,
            onComplete: () => star.destroy()
        });
    }

    finishPlayerAction(unit, logMsg) {
        unit.hasActed = true;
        this.playerHasActed = true;
        this.clearSelection();
        this.logAction(logMsg);

        // Auto End Turn? No, user explicitly said "End of Player's Turn" is a step.
        // It's better UX to let them click "End Turn" or have a delay.
        // "3. End of Player's Turn: Influence is scored..."
        // I'll auto-end for flow if 1 action only, or button. 
        // User request: "The player selects one unit to act... End of Player's turn".
        // Let's rely on the End Turn Button to confirm "I am done".
        // But since they can't do anything else, I'll allow the button to be clickable now.
        this.fsm.transition(GameStates.PLAYER_WAIT); // Wait for End Turn click
        this.showFloatingText(this.endTurnBtn.x, this.endTurnBtn.y - 50, "Click End Turn", '#00ff00');
    }

    endPlayerTurn() {
        console.log("Ending Player Turn");

        // Scoring
        let gain = 0;
        const controls = [{ q: 0, r: 0 }, { q: 3, r: -3 }];
        let held = 0;

        controls.forEach(c => {
            const u = this.units.get(`${c.q},${c.r}`);
            if (u && u.faction === this.playerFaction) {
                held++;
            }
        });

        if (held === 1) gain = 1;
        if (held === 2) gain = 3;

        if (gain > 0) {
            this.influence += gain;
            this.showFloatingText(this.boardOriginX, this.boardOriginY, `+${gain} Influence`, '#ffff00');
            this.logAction(`Influence +${gain} (Held ${held} Zones)`);
        }

        this.checkWinCondition();
        if (this.fsm.getState() === GameStates.GAME_OVER) return;

        this.startEnemyTurn();
    }

    startEnemyTurn() {
        this.fsm.transition(GameStates.ENEMY_TURN);
        this.logAction("Enemy Turn...");

        // AI Logic: Priority Ladder
        // 1. Capture Control, 2. Attack Leader, 3. Attack Unit, 4. Move Control, 5. Hold
        // All enemy units act? Prompt says: "ENEMY TURN: ... Enemy units follow the priority ladder". Plural.
        // So all enemies act.

        const enemies = Array.from(this.units.values()).filter(u => u.faction === this.enemyFaction);

        // Sequential execution for visuals
        let sequence = Promise.resolve();

        enemies.forEach(unit => {
            sequence = sequence.then(() => {
                if (unit.hp <= 0) return Promise.resolve(); // Died during turn?
                return this.resolveEnemyUnitAction(unit);
            });
        });

        sequence.then(() => {
            if (this.fsm.getState() !== GameStates.GAME_OVER) {
                this.startPlayerTurn();
            }
        });
    }

    resolveEnemyUnitAction(unit) {
        return new Promise(resolve => {
            // Delay for pacing
            this.time.delayedCall(600, () => {
                this._aiStep(unit);
                resolve();
            });
        });
    }

    _aiStep(unit) {
        if (!this.units.has(`${unit.q},${unit.r}`)) return; // Unit dead?

        const neighbors = HexUtils.hexNeighbors(unit.q, unit.r);
        const playerUnits = Array.from(this.units.values())
            .filter(u => u.faction === this.playerFaction);
        const playerLeader = playerUnits.find(u => u.type === 'leader');
        const controls = [{ q: 0, r: 0 }, { q: 3, r: -3 }];

        // 1. Capture Control Zone (Move into if adjacent and empty)
        // Find adjacent empty control zone
        for (const c of controls) {
            const dist = HexUtils.hexDistance(unit.q, unit.r, c.q, c.r);
            if (dist === 1) {
                if (!this.units.has(`${c.q},${c.r}`)) {
                    this.moveEnemy(unit, c.q, c.r);
                    this.logAction(`Enemy ${unit.type} captured Zone`);
                    return;
                }
            }
        }

        // 2. Attack Player Leader (if adjacent)
        if (playerLeader) {
            const dist = HexUtils.hexDistance(unit.q, unit.r, playerLeader.q, playerLeader.r);
            if (dist === 1) {
                this.attackEnemy(unit, playerLeader);
                return;
            }
        }

        // 3. Attack Player Unit (Weakest adjacent)
        const adjEnemies = playerUnits.filter(p => HexUtils.hexDistance(unit.q, unit.r, p.q, p.r) === 1);
        if (adjEnemies.length > 0) {
            // Sort by HP ascending
            adjEnemies.sort((a, b) => a.hp - b.hp);
            this.attackEnemy(unit, adjEnemies[0]);
            return;
        }

        // 4. Move Towards Control Zone (Nearest)
        // Find nearest control zone
        let bestTarget = null;
        let minDist = 999;

        controls.forEach(c => {
            const d = HexUtils.hexDistance(unit.q, unit.r, c.q, c.r);
            if (d < minDist) {
                minDist = d;
                bestTarget = c;
            }
        });

        if (bestTarget) {
            // Pathfind
            const path = this.findPath(unit, bestTarget.q, bestTarget.r);
            if (path && path.length > 0) {
                // Move one step? "Move towards". Assuming full move range? 
                // Assuming standard move.
                let steps = Math.min(path.length, unit.move);
                // We need to stop if blocked (pathfinder handles blocked by walls/units, but dynamic?)
                // findPath ignores units in path usually unless we specify.

                // Let's pick the furthest reachable valid hex on path
                // path[0] is first step.
                // We need to ensure we don't land on occupied (except target if we could attack? No, logic 4 is move).

                for (let i = steps - 1; i >= 0; i--) {
                    const dest = path[i];
                    if (!this.units.has(`${dest.q},${dest.r}`)) {
                        this.moveEnemy(unit, dest.q, dest.r);
                        return;
                    }
                }
            }
        }

        // 5. Hold Position
        this.logAction(`Enemy ${unit.type} holds`);
    }

    moveEnemy(unit, q, r) {
        this.units.delete(`${unit.q},${unit.r}`);
        unit.q = q; unit.r = r;
        this.units.set(`${q},${r}`, unit);
        const pos = HexUtils.axialToPixel(q, r, this.hexSize);
        this.tweens.add({
            targets: unit.sprite,
            x: this.boardOriginX + pos.x,
            y: this.boardOriginY + pos.y,
            duration: 500
        });
    }

    attackEnemy(attacker, defender) {
        let damage = attacker.atk;
        const defTile = this.tiles.get(`${defender.q},${defender.r}`);
        if (defTile && defTile.type === 'cover') {
            damage = Math.max(0, damage - 1);
        }
        defender.hp -= damage;
        this.updateHPBar(defender);
        this.createHitEffect(defender.sprite.x, defender.sprite.y);
        this.showFloatingText(defender.sprite.x, defender.sprite.y, `-${damage}`, '#ff0000');
        this.logAction(`Enemy ${attacker.type} attacks ${defender.type}`);

        if (defender.hp <= 0) this.killUnit(defender);
    }

    checkWinCondition() {
        if (this.influence >= 14) {
            this.gameOver(true, "Influence Goal Reached (14)!");
        } else if (this.influence <= 0) {
            this.gameOver(false, "Zero Influence!");
        }

        const playerLeader = Array.from(this.units.values()).find(u => u.faction === this.playerFaction && u.type === 'leader');
        if (!playerLeader) {
            this.gameOver(false, "Leader Fallen!");
        }
    }

    gameOver(win, reason = "") {
        this.fsm.transition(GameStates.GAME_OVER);
        if (this.uiScene) {
            this.uiScene.showGameOver(win, reason, this.playerFaction);
        }
    }


    restartGame() {
        this.scene.restart();
    }

    showFloatingText(x, y, msg, color) {
        const txt = this.add.text(x, y - 20, msg, { fontSize: '20px', fill: color, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
        this.tweens.add({
            targets: txt,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => txt.destroy()
        });
    }

    onPointerMove(pointer) {
        const localX = pointer.x - this.boardOriginX;
        const localY = pointer.y - this.boardOriginY;
        const axial = HexUtils.pixelToAxial(localX, localY, this.hexSize);
        const tile = this.tiles.get(`${axial.q},${axial.r}`);

        if (tile) {
            if (this.fsm.getState() === GameStates.PLACEMENT) {
                // Ghost Logic
                this.highlightGraphics.clear();

                const valid = this.getValidSpawnHexes(this.playerFaction);
                const isValid = valid.some(v => v.q === tile.q && v.r === tile.r);

                if (isValid && this.placementQueue.length > 0) {
                    const nextUnit = this.placementQueue[0]; // 'leader', 'heavy', etc.
                    // Color based on unit type
                    let color = 0x00ff00;
                    if (nextUnit === 'leader') color = 0xffff00; // Gold
                    else if (nextUnit === 'heavy') color = 0x8888ff; // Blueish
                    else if (nextUnit === 'light') color = 0x00ff88; // Greenish

                    this.drawHex(this.highlightGraphics, tile.sprite.x, tile.sprite.y, color, 0.5, 2);

                    // Optional: Show text tooltip?
                    // this.showFloatingText(tile.sprite.x, tile.sprite.y, nextUnit.toUpperCase(), '#ffffff');
                }
            } else {
                this.highlightTile(tile);
            }
        } else {
            this.highlightGraphics.setVisible(false);
        }
    }

    highlightTile(tile) {
        this.highlightGraphics.clear();
        this.drawHex(this.highlightGraphics, tile.sprite.x, tile.sprite.y, 0xffffff, 0, 2);
    }

    updateHPBar(unit) {
        if (!unit.hpBar) return;
        const barW = 40;
        const barH = 6;
        const y = 30;
        unit.hpBar.clear();

        // Background
        unit.hpBar.fillStyle(0x000000);
        unit.hpBar.fillRect(-barW / 2, y, barW, barH);

        // Health
        const pct = Math.max(0, unit.hp / unit.maxHp);
        const color = pct > 0.5 ? 0x00ff00 : (pct > 0.25 ? 0xffff00 : 0xff0000);
        unit.hpBar.fillStyle(color);
        unit.hpBar.fillRect(-barW / 2, y, barW * pct, barH);
    }

    drawHex(graphics, x, y, fillColor, fillAlpha = 1, lineWidth = 0) {
        if (lineWidth > 0) graphics.lineStyle(lineWidth, fillColor, 1);
        if (fillAlpha > 0) graphics.fillStyle(fillColor, fillAlpha);

        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // Pointy top
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: x + (this.hexSize - 2) * Math.cos(angle_rad),
                y: y + (this.hexSize - 2) * Math.sin(angle_rad)
            });
        }
        if (fillAlpha > 0) graphics.fillPoints(points, true);
        if (lineWidth > 0) graphics.strokePoints(points, true, true);
        graphics.setVisible(true);
    }
}
