
export default class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }

    preload() {
        this.load.path = 'assets/';
        this.load.image('karachi_map', 'karachi_map.png');
        this.load.image('pin', 'pin_red.png'); // Using 'pin_red.png' as requested or fallback
        this.load.image('lore_slide', 'lore_slide.png');
        this.load.video('intro_comic', 'comic.mp4');
    }

    create(data) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Check if returning from battle
        const hasPlayed = data && data.hasPlayed;

        // 1. Background (Map)
        if (this.textures.exists('karachi_map')) {
            const map = this.add.image(width / 2, height / 2, 'karachi_map');
            // Scale to cover screen (Cover mode)
            const scaleX = width / map.width;
            const scaleY = height / map.height;
            const scale = Math.max(scaleX, scaleY);
            map.setScale(scale).setAlpha(0.5);
        } else {
            // Fallback
            const g = this.add.graphics();
            g.fillStyle(0x2d2d2d, 1);
            g.fillRect(0, 0, width, height);
            this.add.text(width / 2, height / 2, 'Karachi Map Placeholder', { fontSize: '32px', fill: '#555' }).setOrigin(0.5);
        }

        // 2. Top Bar Text
        this.add.text(width / 2, 30, 'Karachi, 1998-11-14', {
            fontSize: '28px', fontFamily: 'Arial', fill: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        // 3. Pinpoint Marker / Red Circle
        const pinX = width * 0.65;
        const pinY = height * 0.45;

        if (hasPlayed) {
            // POST-BATTLE STATE

            // Red Circle (50px diam = 25px radius, 30% alpha)
            const g = this.add.graphics();
            g.fillStyle(0xff0000, 0.3);
            g.fillCircle(0, 0, 25);

            const circle = this.add.container(pinX, pinY);
            circle.add(g);

            // Pulse effect for Circle
            this.tweens.add({
                targets: circle,
                scale: 1.1,
                alpha: 0.5,
                duration: 1500,
                yoyo: true,
                repeat: -1
            });

            // Start Dialogue Loop
            this.startCivilianDialogues(pinX, pinY);

        } else {
            // INITIAL STATE
            let pin;
            if (this.textures.exists('pin')) {
                pin = this.add.image(pinX, pinY, 'pin').setInteractive({ useHandCursor: true });

                // Fix Scale: Target size ~64px
                const targetSize = 64;
                const scale = targetSize / pin.width;
                pin.setScale(scale);
            } else {
                // Fallback: Red Circle
                const g = this.add.graphics();
                g.fillStyle(0xff0000, 1);
                g.fillCircle(0, 0, 15);
                g.lineStyle(2, 0xffffff);
                g.strokeCircle(0, 0, 15);
                g.generateTexture('fallback_pin', 32, 32);

                pin = this.add.image(pinX, pinY, 'fallback_pin').setInteractive({ useHandCursor: true });
            }

            // Pulse animation for pin
            this.tweens.add({
                targets: pin,
                scale: pin.scale * 1.2,
                duration: 800,
                yoyo: true,
                repeat: -1
            });

            // Pin Click -> Mission Brief
            pin.on('pointerdown', () => {
                this.showMissionModal();
            });

            // Initial Tip
            this.add.text(pinX, pinY + 30, 'Click Target', { fontSize: '14px', fill: '#fff' }).setOrigin(0.5).setAlpha(0.8);
        }



        // 5. Start Button (Initially visible? Or only after closing brief? 
        // Request says "Below the mission brief area or on the main intro screen". 
        // Let's put it on main screen but maybe flash it or make it obvious.)
        this.createStartButton();
    }

    createStartButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const btn = this.add.container(width / 2, height - 80);

        const bg = this.add.rectangle(0, 0, 200, 50, 0x00aa00, 1).setStrokeStyle(2, 0xffffff);
        const txt = this.add.text(0, 0, 'START MISSION', { fontSize: '24px', fontStyle: 'bold', fill: '#fff' }).setOrigin(0.5);

        btn.add([bg, txt]);
        btn.setSize(200, 50);
        btn.setInteractive(new Phaser.Geom.Rectangle(-100, -25, 200, 50), Phaser.Geom.Rectangle.Contains);

        btn.on('pointerover', () => bg.setFillStyle(0x00cc00));
        btn.on('pointerout', () => bg.setFillStyle(0x00aa00));

        btn.on('pointerdown', () => {
            this.playIntroVideo();
        });
    }

    playIntroVideo() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Create Video
        const video = this.add.video(width / 2, height / 2, 'intro_comic');

        if (!video) {
            console.error("Video asset 'intro_comic' not found or failed to create.");
            this.showLoreSlide();
            return;
        }

        // Scale to Cover Screen
        const scaleX = width / video.width;
        const scaleY = height / video.height;
        const scale = Math.max(scaleX, scaleY);
        video.setScale(scale);

        video.setDepth(1000); // Ensure it's on top of everything

        // Play
        video.play();

        // Completion Handler
        const onComplete = () => {
            video.stop();
            video.destroy();
            this.showLoreSlide();
        };

        video.on('complete', onComplete);

        // Optional: Click to Skip
        video.setInteractive();
        video.on('pointerdown', onComplete);
    }

    showMissionModal() {
        if (this.missionModal) return this.missionModal.setVisible(true);

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.missionModal = this.add.container(width / 2, height / 2);

        // Background overlay
        const bg = this.add.rectangle(0, 0, 500, 400, 0x1a1a1a, 0.95).setStrokeStyle(2, 0x444444);

        // Content
        const title = this.add.text(0, -160, 'MISSION BRIEF', {
            fontSize: '32px', fill: '#ffaa00', fontStyle: 'bold'
        }).setOrigin(0.5);

        const briefText =
            "- Objective: Secure the central Power Station.\n\n" +
            "- Strategy: Use Influence to dominate sectors.\n\n" +
            "- Threat: Hostile groups are mobilizing.\n\n" +
            "- Intel: Enemy Leader sighted in Sector 7.";

        const desc = this.add.text(0, -20, briefText, {
            fontSize: '18px', fill: '#cccccc', align: 'left', wordWrap: { width: 440 }, lineSpacing: 10
        }).setOrigin(0.5);

        // Close Button
        const closeBtn = this.add.text(0, 150, '[ CLOSE INTEL ]', {
            fontSize: '20px', fill: '#fff', backgroundColor: '#333', padding: { x: 10, y: 5 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.missionModal.setVisible(false);
            });

        this.missionModal.add([bg, title, desc, closeBtn]);
        this.missionModal.setDepth(100);
    }

    showLoreSlide() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.container(width / 2, height / 2);
        overlay.setDepth(300); // Top layer

        // 1. Background (Deep Indigo/Purple)
        const bg = this.add.rectangle(0, 0, width, height, 0x2e003e, 1);
        overlay.add(bg);

        // 2. Text Object
        const fullText = "Before it all began...\n\n" +
            "The city has not exploded.\n\n" +
            "But it is humming.\n\n" +
            "Offices work. Buses run. Shops open.\n\n" +
            "And yet, the streets are louder than usual.\n\n" +
            "Someone has started asking who decides what Karachi is allowed to want.";

        const textObj = this.add.text(0, 0, '', {
            fontFamily: "Courier", fontSize: "28px", color: "#ffffff", align: "center",
            lineSpacing: 10, wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5);
        overlay.add(textObj);

        // 3. Typewriter Effect
        let charIndex = 0;
        const typeSpeed = 70; // ms per char (Slower, cinematic)

        const typeEvent = this.time.addEvent({
            delay: typeSpeed,
            callback: () => {
                textObj.text += fullText[charIndex];
                charIndex++;
                if (charIndex >= fullText.length) {
                    typeEvent.remove();
                    // Start auto-advance timer after typing finishes
                    this.time.delayedCall(4000, next);
                }
            },
            loop: true
        });

        // 4. Transition Logic
        const next = () => {
            if (charIndex < fullText.length) {
                // Formatting update: if clicked early, show full text immediately
                typeEvent.remove();
                textObj.text = fullText;
                charIndex = fullText.length;
                this.time.delayedCall(2000, next); // Wait a bit before advancing
                return;
            }

            // Pre-load Faction Select screen (Black BG) behind the Lore Slide
            this.showFactionSelect();

            // Add Blur FX if supported (Phaser 3.60+)
            if (overlay.postFX) {
                const blur = overlay.postFX.addBlur(0, 0, 0, 1);
                this.tweens.add({
                    targets: blur,
                    strength: 6,
                    duration: 1000
                });
            }

            // Fade out
            this.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    overlay.destroy();
                }
            });
        };

        // Click to skip typing or advance
        bg.setInteractive();
        bg.on('pointerdown', next);
    }

    showFactionSelect() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const overlay = this.add.container(width / 2, height / 2);

        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 1); // Full screen SOLID BLACK
        overlay.add(bg);

        const panel = this.add.rectangle(0, 0, 700, 400, 0x222222, 1).setStrokeStyle(4, 0x000000);
        overlay.add(panel);

        const title = this.add.text(0, -150, 'SELECT YOUR FACTION', { fontSize: '36px', fill: '#fff' }).setOrigin(0.5);
        overlay.add(title);

        // Faction A
        const descA = "CIVIL ALLIANCE\n\nEstablished power brokers of the city. They rely on heavy enforcement and defensive positioning. Slow but resilient.";

        const headerA = this.add.text(-180, -60, 'Civil Alliance', { fontSize: '24px', fill: '#00aaff', fontStyle: 'bold' }).setOrigin(0.5);
        const textA = this.add.text(-180, 20, descA, { fontSize: '14px', fill: '#aaa', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5);

        // Helper to create button
        const createFactionBtn = (x, y, text, color, bgColor, cb) => {
            const btn = this.add.container(x, y);
            const bgRect = this.add.rectangle(0, 0, 220, 50, bgColor).setStrokeStyle(2, color);
            const btnTxt = this.add.text(0, 0, text, { fontSize: '18px', fill: color, fontStyle: 'bold' }).setOrigin(0.5);

            btn.add([bgRect, btnTxt]);
            btn.setSize(220, 50);

            // Explicit Hit Area
            btn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);

            btn.on('pointerover', () => bgRect.setFillStyle(0x555555));
            btn.on('pointerout', () => bgRect.setFillStyle(bgColor));
            btn.on('pointerdown', (pointer, localX, localY, event) => {
                event.stopPropagation();
                btn.setAlpha(0.5);
                console.log(`Faction Button Clicked: ${text}`);
                cb();
            });

            return btn;
        };

        const btnA = createFactionBtn(-180, 120, 'SELECT CIVIL ALLIANCE', 0x00aaff, 0x002244, () => this.startGame('A'));

        // Add Faction A elements to overlay
        overlay.add([headerA, textA, btnA]);

        // Faction B
        const descB = "POPULAR FRONT\n\nRapidly expanding disrupters. They favor extensive mobility and aggressive expansion. Fragile but overwhelming.";

        const headerB = this.add.text(180, -60, 'Popular Front', { fontSize: '24px', fill: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5);
        const textB = this.add.text(180, 20, descB, { fontSize: '14px', fill: '#aaa', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5);

        const btnB = createFactionBtn(180, 120, 'SELECT POPULAR FRONT', 0xff4444, 0x441111, () => this.startGame('B'));

        // Add Faction B elements to overlay
        overlay.add([headerB, textB, btnB]);

        overlay.setDepth(200);
    }

    startGame(faction) {
        try {
            console.log(`IntroScene: Starting game with faction ${faction}`);
            // Store config
            this.registry.set('playerFaction', faction);

            // Sound or Transition effect could go here
            this.scene.start('CompositionScene');
        } catch (e) {
            console.error("IntroScene StartGame Error:", e);
            window.alert("IntroScene Error:\n" + e.message);
        }
    }
    startCivilianDialogues(x, y) {
        const lines = [
            "My children can't go to school because of all these protests.",
            "I can't afford roti anymore.",
            "This chaos is ruining our lives. We need peace!",
            "The streets are blocked, how can I get to work?",
            "I lost my business because of the fighting. What happened to this city?",
            "Why does the government let this happen? Why don’t they fix it?"
        ];

        let count = 0;
        const maxPopups = 6;

        // Loop
        const spawn = () => {
            if (count >= maxPopups) {
                // Sequence finished. Wait for last bubble to likely fade (3s) + buffer, then show foreign text.
                this.time.delayedCall(4000, () => {
                    this.showForeignPowerText(x, y);
                });
                return;
            }

            // Random text
            const text = lines[Math.floor(Math.random() * lines.length)];

            // Random Offset around circle (Radius ~100px area)
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 80;
            const offX = Math.cos(angle) * dist;
            const offY = Math.sin(angle) * dist;

            this.spawnDetailPopup(x + offX, y + offY, text);
            count++;

            // Next spawn in 2-3s
            this.time.delayedCall(2000 + Math.random() * 1000, spawn);
        };

        spawn(); // Start immediately
    }

    showForeignPowerText(x, y) {
        // "A certain foreign power is watching."
        const text = this.add.text(x, y, "A certain foreign power is watching.", {
            fontSize: '32px',
            fontStyle: 'italic',
            fill: '#D9D9D9',
            fontFamily: 'serif',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setAlpha(0);

        // Animation: Fade In (2s) -> Hold (5s) -> Fade Out (2s)
        this.tweens.chain({
            targets: text,
            tweens: [
                {
                    alpha: 1,
                    duration: 2000,
                    ease: 'Quad.out'
                },
                {
                    // Hold
                    alpha: 1,
                    duration: 5000
                },
                {
                    alpha: 0,
                    duration: 2000,
                    ease: 'Quad.in',
                    onComplete: () => {
                        text.destroy();
                    }
                }
            ]
        });
    }

    spawnDetailPopup(x, y, text) {
        const container = this.add.container(x, y);
        container.setAlpha(0);
        container.setScale(0);

        // Text Obj
        const txt = this.add.text(0, 0, text, {
            fontSize: '14px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 6 },
            wordWrap: { width: 220 }
        }).setOrigin(0.5);

        // Make it look like a bubble? Optional styling.
        // Just text on black bg as requested.

        container.add(txt);

        // Animate In
        this.tweens.add({
            targets: container,
            scale: 1,
            alpha: 1,
            duration: 400,
            ease: 'Back.out'
        });

        // Destroy after 3s
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: container,
                alpha: 0,
                y: y - 20, // Float up
                duration: 500,
                onComplete: () => container.destroy()
            });
        });
    }
}
