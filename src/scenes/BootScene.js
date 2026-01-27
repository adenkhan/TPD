export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.path = 'assets/';

        // Asset Manifest
        this.assets = [
            { key: 'hex_neutral', type: 'image', path: 'hex_neutral.png', color: 0x888888 },
            { key: 'hex_cover', type: 'image', path: 'hex_cover.png', color: 0x448844 },
            { key: 'hex_control', type: 'image', path: 'hex_control.png', color: 0x884488 },
            { key: 'hex_blocked', type: 'image', path: 'hex_blocked.png', color: 0x333333 },
            { key: 'A_light', type: 'image', path: 'A_light.png', color: 0x00aaff },
            { key: 'A_heavy', type: 'image', path: 'A_heavy.png', color: 0x0055aa },
            { key: 'A_leader', type: 'image', path: 'A_leader.png', color: 0x00ffff },
            { key: 'B_light', type: 'image', path: 'B_light.png', color: 0xff4444 },
            { key: 'B_heavy', type: 'image', path: 'B_heavy.png', color: 0xaa2222 },
            { key: 'B_leader', type: 'image', path: 'B_leader.png', color: 0xff8888 },
            { key: 'card_frame', type: 'image', path: 'card_frame.png', color: 0x222222 }
        ];

        this.missingAssets = new Set();

        // Track errors
        this.load.on('loaderror', (fileObj) => {
            console.warn(`Asset failed to load: ${fileObj.key}`);
            this.missingAssets.add(fileObj.key);
        });

        // Load Assets
        this.assets.forEach(asset => {
            this.load.image(asset.key, asset.path);
        });
    }

    create() {
        console.log('BootScene: Processing assets...');

        // Process Hex Textures
        // MOVED TO GAMESCENE (Masking) to avoid RT issues
        /*
        const hexes = ['hex_neutral', 'hex_cover', 'hex_blocked', 'hex_control'];
        hexes.forEach(key => {
            if (this.textures.exists(key)) this.processHexTexture(key);
        });

        const units = ['A_light', 'A_heavy', 'A_leader', 'B_light', 'B_heavy', 'B_leader'];
        units.forEach(key => {
            if (this.textures.exists(key)) this.processUnitTexture(key);
        });
        */

        // Debug output
        if (this.missingAssets.size > 0) {
            let msg = "FAILED ASSETS:\n";
            this.missingAssets.forEach(k => msg += k + "\n");
            this.add.text(10, 10, msg, { fontSize: '24px', fill: '#ff0000', backgroundColor: '#000' }).setDepth(9999);
            this.time.delayedCall(5000, () => this.scene.start('IntroScene'));
        } else {
            console.log('Assets processed, starting IntroScene');
            this.scene.start('IntroScene');
        }
    }

    processHexTexture(key) {
        const src = this.textures.get(key).getSourceImage();
        const w = src.width;
        const h = src.height;
        const size = w / 2; // Approx for pointy top

        // Create a mask shape
        const shape = this.make.graphics();
        shape.fillStyle(0xffffff);

        // Pointy Topped Hexagon Math
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // Pointy top starts at -30 deg
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push({
                x: w / 2 + (size) * Math.cos(angle_rad),
                y: h / 2 + (size) * Math.sin(angle_rad) // Fix aspect ratio?
            });
        }
        // Tweak points to fit square image better? 
        // Generative images are 1:1. Hexagon of width W has height sqrt(3)/2 * W. 0.866.
        // If image is square, we mask a hex in the center.

        shape.fillPoints(points, true, true);

        // Create Render Texture
        const rt = this.make.renderTexture({ x: 0, y: 0, width: w, height: h });

        // Draw the image, masked by shape
        // Phaser 3 Masking in RT is tricky. simpler:
        // Draw shape with blend mode ERASE? No, we want to KEEP the hex.
        // Draw Hex. source-in image?

        rt.draw(shape, 0, 0); // Draw white hex
        rt.setBlendMode(Phaser.BlendModes.SOURCE_IN); // Not supported on canvas?
        // ERASER mode inverse?

        // Alternative: Use BitmapMask
        // Just create a new texture via RT that is the image masked.
        // Actually, just creating the mask logic in GameScene is safer if RT is complex.
        // BUT, generating a clean texture is better performance.

        // Let's try simpler path: standard Phaser Mask on the sprite in GameScene.
        // Revert this complexity if "clunky" means just white backgrounds.
        // User uploaded image shows WHITE SQUARE corners.
        // It's definitely the transparency missing.

        // Plan B: Use Canvas Texture manipulation to scan pixels? Slow.
        // Plan C: Create a "clean" version using `mask` in `BootScene`.

        const maskObj = shape.createGeometryMask();
        const img = this.make.image({ x: w / 2, y: h / 2, key: key, add: false });
        img.setMask(maskObj);

        rt.draw(img, w / 2, h / 2);

        // Save back
        rt.saveTexture(key + "_clean"); // Save as new key

        // Alias?
        // We will just update GameScene to use `_clean` keys or rename here.
        // You cannot overwrite existing texture key easily.
        // Let's delete old and add new? 
        this.textures.remove(key);
        this.textures.addRenderTexture(key, rt);

        console.log(`Processed ${key}`);
    }

    processUnitTexture(key) {
        const src = this.textures.get(key).getSourceImage();
        const w = src.width;
        const h = src.height;
        const size = Math.min(w, h) / 2;

        const shape = this.make.graphics();
        shape.fillStyle(0xffffff);
        shape.fillCircle(w / 2, h / 2, size);

        this.applyMaskToTexture(key, shape, w, h);
    }

    applyMaskToTexture(key, shape, w, h) {
        const rt = this.make.renderTexture({ x: 0, y: 0, width: w, height: h });
        const maskObj = shape.createGeometryMask();
        const img = this.make.image({ x: w / 2, y: h / 2, key: key, add: false });
        img.setMask(maskObj);

        rt.draw(img, w / 2, h / 2);
        rt.saveTexture(key + "_clean");

        // Swap key
        this.textures.remove(key);
        this.textures.addRenderTexture(key, rt);
        console.log(`Processed Unit ${key}`);
    }

    generateFallback(asset) {
        const size = 64; // Base size for generation
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(asset.color, 1);

        if (asset.key.includes('hex')) {
            // Draw Hexagon
            const points = [
                { x: size * 0.5, y: 0 },
                { x: size, y: size * 0.25 },
                { x: size, y: size * 0.75 },
                { x: size * 0.5, y: size },
                { x: 0, y: size * 0.75 },
                { x: 0, y: size * 0.25 }
            ];
            graphics.fillPoints(points, true, true);
        } else {
            // Draw Circle for units
            graphics.fillCircle(size / 2, size / 2, size / 2);
            // Add initial
            // Can't easily add text to texture via graphics without text object, 
            // but for fallback specific shape/color is enough.
        }

        graphics.generateTexture(asset.key, size, size);
    }
}
