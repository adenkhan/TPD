export default class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create() {
        this.infoText = this.add.text(20, 20, 'Waiting for setup...', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Segoe UI',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 10 }
        });

        this.handContainer = this.add.container(0, 0);
        this.cardPanels = [];

        this.enemyActionText = this.add.text(this.cameras.main.width / 2, 80, '', {
            fontSize: '24px',
            fill: '#ff4444',
            fontFamily: 'Segoe UI',
            backgroundColor: '#000000aa',
            padding: { x: 15, y: 10 }
        }).setOrigin(0.5).setVisible(false);
        this.createLogPanel();
        this.createGameControls();
        this.createGameOverModal();
        this.createSettingsModal();
        this.createTutorial();
        this.createInspectorPanel();

        // Show Tutorial if first time
        if (!localStorage.getItem('tutorialSeen')) {
            this.showTutorial();
        }
    }

    createGameControls() {
        // Top right buttons
        const x = this.cameras.main.width - 120;

        // Settings Button
        const settingsBtn = this.add.text(x - 80, 10, 'Settings', {
            fontSize: '14px', fill: '#fff', backgroundColor: '#555', padding: { x: 5, y: 5 }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showSettings());

        const restartBtn = this.add.text(x, 10, 'Restart', {
            fontSize: '14px', fill: '#fff', backgroundColor: '#555', padding: { x: 5, y: 5 }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.get('GameScene').restartGame();
            });
    }

    createSettingsModal() {
        const w = 400;
        const h = 300;
        this.settingsModal = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY).setVisible(false);

        const bg = this.add.rectangle(0, 0, w, h, 0x111111, 0.95).setStrokeStyle(2, 0x888888);
        const title = this.add.text(0, -120, 'SETTINGS', { fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5);

        // Seed Display
        this.seedText = this.add.text(0, -50, 'Current Seed: ???', { fontSize: '16px', fill: '#aaa' }).setOrigin(0.5);

        // Randomness Toggle (Visual only for now, logic needs to hook into registry)
        // Hard to change mid-game, usually requires restart. 
        // We'll just show current seed and allow Copy.

        const copyBtn = this.add.text(0, 0, 'Copy Seed to Clipboard', {
            fontSize: '16px', fill: '#000', backgroundColor: '#ddd', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const seed = this.scene.get('GameScene').registry.get('seed');
                navigator.clipboard.writeText(seed.toString());
                copyBtn.setText('Copied!');
                this.time.delayedCall(1000, () => copyBtn.setText('Copy Seed to Clipboard'));
            });

        const closeBtn = this.add.text(0, 100, 'Close', {
            fontSize: '18px', fill: '#fff', backgroundColor: '#444', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.settingsModal.setVisible(false));

        this.settingsModal.add([bg, title, this.seedText, copyBtn, closeBtn]);
        this.settingsModal.setDepth(2000);
    }

    showSettings() {
        const seed = this.scene.get('GameScene').registry.get('seed') || 'N/A';
        this.seedText.setText(`Current Seed: ${seed}`);
        this.settingsModal.setVisible(true);
    }

    createTutorial() {
        this.tutorialContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY).setVisible(false);
        const bg = this.add.rectangle(0, 0, 500, 300, 0x000033, 0.95).setStrokeStyle(2, 0x00aaff);

        const content =
            "HOW TO PLAY:\n\n" +
            "1. SELECT UNIT: Click your units to see movement range.\n" +
            "2. MOVE: Click blue hexes to move.\n" +
            "3. ATTACK: Click red hexes (adjacent only) to attack.\n" +
            "4. WIN: Reach 8 Influence or kill Enemy Leader.";

        const text = this.add.text(0, -20, content, {
            fontSize: '18px', fill: '#fff', lineSpacing: 10, wordWrap: { width: 450 }
        }).setOrigin(0.5);

        const closeBtn = this.add.text(0, 110, 'Got it', {
            fontSize: '20px', fill: '#fff', backgroundColor: '#0055aa', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.tutorialContainer.setVisible(false);
                localStorage.setItem('tutorialSeen', 'true');
            });

        this.tutorialContainer.add([bg, text, closeBtn]);
        this.tutorialContainer.setDepth(3000); // Top most
    }

    showTutorial() {
        this.tutorialContainer.setVisible(true);
    }

    createLogPanel() {
        const w = 250;
        const h = 200;
        const x = this.cameras.main.width - w - 10;
        const y = 50;

        this.logContainer = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setOrigin(0);
        const title = this.add.text(5, 5, 'Battle Log', { fontSize: '16px', fill: '#aaa' });

        this.logText = this.add.text(5, 30, '', {
            fontSize: '12px', fill: '#fff', wordWrap: { width: w - 10 }
        });

        this.logContainer.add([bg, title, this.logText]);
        this.logs = [];
    }

    log(msg) {
        if (!this.logs) return;
        this.logs.unshift(msg);
        if (this.logs.length > 8) this.logs.pop();
        if (this.logText) this.logText.setText(this.logs.join('\n\n'));
    }

    createGameControls() {
        // Top right buttons
        const x = this.cameras.main.width - 120;
        const restartBtn = this.add.text(x, 10, 'Restart', {
            fontSize: '14px', fill: '#fff', backgroundColor: '#555', padding: { x: 5, y: 5 }
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.get('GameScene').restartGame();
            });
        // New Game can act same as restart for now, or go to menu if we had one.
    }

    createGameOverModal() {
        this.modalContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY).setVisible(false);

        const bg = this.add.rectangle(0, 0, 400, 300, 0x000000, 0.9).setStrokeStyle(4, 0xffffff);
        this.modalTitle = this.add.text(0, -80, '', { fontSize: '40px', fontStyle: 'bold' }).setOrigin(0.5);
        this.modalReason = this.add.text(0, 0, '', { fontSize: '18px', fill: '#ccc', align: 'center', wordWrap: { width: 350 } }).setOrigin(0.5);

        const btn = this.add.text(0, 80, 'CONTINUE', {
            fontSize: '24px', fill: '#000', backgroundColor: '#fff', padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.modalContainer.setVisible(false);
                this.showPostMatchLore();
            });

        this.modalContainer.add([bg, this.modalTitle, this.modalReason, btn]);
        this.modalContainer.setDepth(1000);
    }

    showGameOver(win, reason, playerFaction) {
        this.modalTitle.setText(win ? 'VICTORY' : 'DEFEAT');
        this.modalTitle.setColor(win ? '#00ff00' : '#ff0000');
        this.modalReason.setText(reason);
        this.modalContainer.setVisible(true);

        // Store for lore calculation
        this.matchResult = { win, playerFaction };
    }

    showPostMatchLore() {
        const { win, playerFaction } = this.matchResult;

        // Determine Winner: 'A' (Civil Alliance) or 'B' (Popular Front)
        let winner = 'A';
        if (win) {
            winner = playerFaction;
        } else {
            winner = playerFaction === 'A' ? 'B' : 'A';
        }

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.container(width / 2, height / 2);
        overlay.setDepth(2000);

        // Background
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 1);
        overlay.add(bg);

        // Texts
        let headerText = "";
        let bodyText = "";

        if (winner === 'A') {
            // Civil Alliance Wins
            headerText = "CIVIL ALLIANCE wins";
            bodyText =
                "City State: Regulated Calm\n\n" +
                "The streets grow quieter, not because the questions have been answered, but because fewer people are allowed to ask them out loud. Temporary measures become standing directives. Barricades turn into checkpoints, and schedules replace spontaneity.\n\n" +
                "Municipal offices report record efficiency. Traffic flows better. Services stabilize. On paper, the city is improving.\n\n" +
                "But something subtle changes in the air. Conversations become shorter. Crowds dissolve more quickly. The city begins to behave, even when no one is watching.\n\n" +
                "Order has returned to Karachi.\n\n" +
                "Whether it arrived too early, or too forcefully, is a question that now belongs to history.";
        } else {
            // Popular Front Wins
            headerText = "POPULAR FRONT wins";
            bodyText =
                "City State: Awakened Streets\n\n" +
                "The city exhales. Not in relief, but in release.\n\n" +
                "Public spaces fill again, not with celebration, but with ownership. Murals replace notices. Debates replace announcements. The language of the streets grows louder than the language of offices.\n\n" +
                "Some institutions retreat quietly. Others attempt to adapt. None fully control the rhythm anymore.\n\n" +
                "Karachi becomes unpredictable, alive in a way that spreadsheets cannot measure. Neighborhoods organize themselves. Leaders rise and fall in weeks. Loyalty becomes local.\n\n" +
                "The city has remembered that it belongs to its people. It has not yet decided what to do with that memory.";
        }

        // Display Header
        const header = this.add.text(0, -height / 2 + 80, headerText, {
            fontSize: '32px', fontStyle: 'bold', fill: winner === 'A' ? '#00aaff' : '#ff4444'
        }).setOrigin(0.5);
        overlay.add(header);

        // Typewriter Body
        const textObj = this.add.text(0, 0, '', {
            fontFamily: "Courier", fontSize: "20px", color: "#cccccc", align: "center",
            lineSpacing: 8, wordWrap: { width: width * 0.7 }
        }).setOrigin(0.5);
        overlay.add(textObj);

        // Skip/Restart Logic
        let charIndex = 0;
        const typeSpeed = 5;

        const typeEvent = this.time.addEvent({
            delay: typeSpeed,
            callback: () => {
                textObj.text += bodyText[charIndex];
                charIndex++;
                if (charIndex >= bodyText.length) {
                    typeEvent.remove();
                    this.showRestartButton(overlay);
                }
            },
            loop: true
        });

        // Click to skip
        bg.setInteractive();
        bg.on('pointerdown', () => {
            if (charIndex < bodyText.length) {
                typeEvent.remove();
                textObj.text = bodyText;
                charIndex = bodyText.length;
                this.showRestartButton(overlay);
            }
        });
    }

    showRestartButton(container) {
        if (this.loreRestartBtn) return; // Prevent duplicates

        const btn = this.add.text(0, this.cameras.main.height / 2 - 80, 'RETURN TO TITLE', {
            fontSize: '24px', fill: '#fff', backgroundColor: '#333', padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Return to Title with Post-Battle flag
                this.scene.stop('GameScene');
                this.scene.stop('UIScene'); // Stop self? Usually better to just start Intro which might sleeping or stop others.
                // But Scene Manager 'start' usually shuts down if overwriting? IntroScene is likely sleeping or stopped.
                // Let's explicitly stop GameScene.
                this.scene.start('IntroScene', { hasPlayed: true });
            });

        container.add(btn);
        this.loreRestartBtn = btn;
    }

    updateStats(data) {
        if (!this.infoText) return; // Wait for create()
        // data: { influence, state, turn, placement? }
        if (data.placement) {
            this.infoText.setText(`Turn: ${data.turn} | Inf: ${data.influence} | ${data.placement}\nState: ${data.state}`);
            this.infoText.setColor('#ffff00'); // Highlight during placement
        } else {
            this.infoText.setText(`Turn: ${data.turn}\nInfluence: ${data.influence}\nState: ${data.state}`);
            this.infoText.setColor('#ffffff');
        }
    }

    showEnemyAction(card) {
        if (!this.enemyActionText) return; // Legacy text field, we'll replace with container

        // Remove old visual if exists
        if (this.enemyCardVisual) {
            this.enemyCardVisual.destroy();
        }

        const w = 140;
        const h = 200;
        const x = this.cameras.main.width / 2;
        const y = this.cameras.main.height / 2 - 50; // Center screen

        const container = this.add.container(x, y);

        // Check for PNG
        const hasImage = this.textures.exists(`enemy_${card.actionKey}`); // Convention

        if (hasImage) {
            const img = this.add.image(0, 0, `enemy_${card.actionKey}`);
            img.setDisplaySize(w, h);
            container.add(img);
        } else {
            // Fallback
            const g = this.add.graphics();
            g.fillStyle(0x442222, 1); // Enemy Red/Dark
            g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
            g.lineStyle(2, 0xff5555);
            g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

            // Header
            g.fillStyle(0x000000, 0.5);
            g.fillRect(-w / 2, -h / 2 + 25, w, 2);

            container.add(g);

            const title = this.add.text(0, -h / 2 + 12, card.name, {
                fontSize: '14px', fill: '#ffaaaa', fontStyle: 'bold', fontFamily: 'Arial'
            }).setOrigin(0.5);

            const type = this.add.text(0, -h / 2 + 35, card.type, {
                fontSize: '12px', fill: '#ff5555', fontStyle: 'bold'
            }).setOrigin(0.5);

            const rule = this.add.text(0, 10, card.ruleText, {
                fontSize: '12px', fill: '#fff', align: 'center', wordWrap: { width: w - 10 }
            }).setOrigin(0.5);

            // Icon
            this.drawEnemyIcon(container, card.type, 0, h / 2 - 30);

            container.add([title, type, rule]);
        }

        container.setScale(0);
        this.add.tween({
            targets: container,
            scale: 1,
            duration: 300,
            ease: 'Back.out'
        });

        this.enemyCardVisual = container;

        // Auto hide after 4s (longer to read)
        this.time.delayedCall(4000, () => {
            this.add.tween({
                targets: container,
                scale: 0,
                alpha: 0,
                duration: 300,
                onComplete: () => container.destroy()
            });
        });
    }

    drawEnemyIcon(container, type, x, y) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.1);
        g.fillCircle(x, y, 18);
        g.lineStyle(2, 0xff5555);
        g.strokeCircle(x, y, 18);

        g.fillStyle(0xff5555, 1);

        switch (type) {
            case 'ADVANCE': // Arrow Up
                g.fillTriangle(x - 6, y + 4, x + 6, y + 4, x, y - 6);
                break;
            case 'ATTACK': // Sword/Cross
                g.lineStyle(2, 0xff5555);
                g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6);
                g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6);
                g.strokePath();
                break;
            case 'HOLD': // Shield/Square
                g.fillRect(x - 6, y - 6, 12, 12);
                break;
            case 'DISRUPT': // Bolt/Exclamation
                g.fillRect(x - 2, y - 8, 4, 10);
                g.fillRect(x - 2, y + 4, 4, 4);
                break;
        }
        container.add(g);
    }

    updateHand(hand, sceneRef) {
        if (!this.handContainer) return;
        console.log(`UIScene: Updating Hand. Count: ${hand.length}`);
        // Clear old hand
        this.cardPanels.forEach(p => p.destroy());
        this.cardPanels = [];

        const cardWidth = 120;
        const cardHeight = 170;
        const spacing = 10;
        const startX = this.cameras.main.width / 2 - ((hand.length * (cardWidth + spacing)) - spacing) / 2 + cardWidth / 2;
        const y = this.cameras.main.height - 95;

        hand.forEach((card, index) => {
            const x = startX + index * (cardWidth + spacing);
            const container = this.createCardVisual(card, cardWidth, cardHeight);

            container.setPosition(x, y);

            // Interaction
            container.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);

            // Hover effect
            container.on('pointerover', () => {
                this.tweens.add({ targets: container, y: y - 20, duration: 100 });
            });
            container.on('pointerout', () => {
                this.tweens.add({ targets: container, y: y, duration: 100 });
            });

            container.on('pointerdown', () => {
                sceneRef.events.emit('cardClicked', card);
            });

            this.handContainer.add(container);
            this.cardPanels.push(container);
        });
    }

    createCardVisual(card, w, h) {
        const container = this.add.container(0, 0);

        // Background Frame
        if (this.textures.exists('card_frame')) {
            const bg = this.add.image(0, 0, 'card_frame');
            bg.setDisplaySize(w, h);
            container.add(bg);
        } else {
            // Fallback
            const g = this.add.graphics();
            g.fillStyle(0x222222, 1);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
            g.lineStyle(2, 0x00aaff);
            g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
            container.add(g);
        }

        // Title
        const title = this.add.text(0, -h / 2 + 25, card.name.toUpperCase(), {
            fontSize: '12px', fill: '#00ccff', fontStyle: 'bold', fontFamily: 'Courier New',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        // Type Badge
        const typeColor = this.getTypeColor(card.type);
        const typeText = this.add.text(0, -h / 2 + 105, card.type, {
            fontSize: '10px', fill: '#' + typeColor.toString(16), fontStyle: 'bold',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        // Description
        const desc = this.add.text(0, 0, card.description || "No description", {
            fontSize: '10px', fill: '#eee', align: 'center', wordWrap: { width: w - 20 }
        }).setOrigin(0.5);

        // Icon
        this.drawIcon(container, card.iconType, 0, -h / 3);

        container.add([title, typeText, desc]);

        return container;
    }

    getTypeColor(type) {
        switch (type) {
            case 'MOVE': return 0x4488ff;
            case 'COMBAT': return 0xff4444;
            case 'CONTROL': return 0xffaa00;
            default: return 0x888888;
        }
    }

    drawIcon(container, type, x, y) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.2);
        g.fillCircle(x, y, 15); // Icon bg

        g.fillStyle(0xffffff, 1);

        switch (type) {
            case 'move': // Arrow
                g.fillTriangle(x - 5, y + 5, x + 5, y + 5, x, y - 5);
                break;
            case 'sword': // Cross
                g.lineStyle(2, 0xffffff);
                g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5);
                g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5);
                g.strokePath();
                break;
            case 'flag': // Flag
                g.fillRect(x - 5, y - 8, 10, 8);
                g.fillRect(x - 5, y, 2, 10);
                break;
            default:
                g.fillCircle(x, y, 5);
        }
        container.add(g);
    }

    createInspectorPanel() {
        const x = 20;
        const y = this.cameras.main.height - 180;
        const w = 220;
        const h = 160;

        this.inspectorContainer = this.add.container(x, y).setVisible(false);

        const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.8).setOrigin(0).setStrokeStyle(2, 0x888888);
        const title = this.add.text(10, 10, 'UNIT INSPECTOR', { fontSize: '14px', fill: '#888' });

        this.inspectorName = this.add.text(10, 30, '', { fontSize: '20px', fill: '#fff', fontStyle: 'bold' });
        this.inspectorStats = this.add.text(10, 60, '', { fontSize: '16px', fill: '#ccc', lineSpacing: 5 });
        this.inspectorPerk = this.add.text(10, 120, '', { fontSize: '14px', fill: '#ffff00', wordWrap: { width: w - 20 } });

        this.inspectorContainer.add([bg, title, this.inspectorName, this.inspectorStats, this.inspectorPerk]);
    }

    showUnitDetails(unit) {
        if (!this.inspectorContainer) return;
        this.inspectorContainer.setVisible(true);

        // Name
        const factionName = unit.faction === 'A' ? "Civil Alliance" : "Popular Front";
        this.inspectorName.setText(`${factionName} ${unit.type.toUpperCase()}`);
        this.inspectorName.setColor(unit.faction === 'A' ? '#0088ff' : '#ff4444');

        // Stats
        this.inspectorStats.setText(
            `HP: ${unit.hp}/${unit.maxHp}\n` +
            `ATK: ${unit.atk}\n` +
            `MOVE: ${unit.move}`
        );

        // Perk
        let perkDesc = "";
        switch (unit.perk) {
            case 'skirmisher': perkDesc = "Skirmisher: Attack after move."; break;
            case 'anchor': perkDesc = "Anchor: Defensive bonus on control."; break;
            case 'command': perkDesc = "Command: Draw cards."; break;
        }
        this.inspectorPerk.setText(`[${unit.perk.toUpperCase()}]\n${perkDesc}`);
    }
}
