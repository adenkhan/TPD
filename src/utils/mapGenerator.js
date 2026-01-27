import { HexUtils } from './hex.js';

class SeededRNG {
    constructor(seed) {
        this.seed = seed || Date.now();
    }

    // Simple Linear Congruential Generator
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

export class MapGenerator {
    constructor(radius = 3) {
        this.radius = radius;
    }

    generate(seed, randomness = 1.0) {
        const rng = new SeededRNG(seed);
        let safety = 0;
        let mapData = null;

        while (safety < 200) {
            safety++;
            const candidate = this.generateCandidate(rng, randomness);
            if (this.validateMap(candidate)) {
                mapData = candidate;
                break;
            }
        }

        if (!mapData) {
            console.warn("Map Generation Failed (Soft-lock), using fallback deterministic map.");
            mapData = this.generateFallback();
        }

        console.log(`Map Generated in ${safety} attempts. Seed: ${seed}`);
        return mapData;
    }

    generateCandidate(rng, randomness) {
        const tiles = new Map(); // "q,r" -> type
        const allCoords = this.getAllHexes();
        const totalHexes = allCoords.length; // 127 for radius 6

        // 1. Initialize all as Neutral
        allCoords.forEach(c => tiles.set(`${c.q},${c.r}`, 'neutral'));

        // 2. Control Points (Fixed)
        // User requested: (0,0) and (3,-3)
        const controlCoords = [{ q: 0, r: 0 }, { q: 3, r: -3 }];
        controlCoords.forEach(c => tiles.set(`${c.q},${c.r}`, 'control'));

        // 3. Targets
        // 30% Blocked = ~38
        // 15% Cover = ~19
        const targetBlocked = Math.floor(totalHexes * 0.30);
        const targetCover = Math.floor(totalHexes * 0.15);

        // 4. Place Cover (Clustered)
        let placedCover = 0;
        let safety = 0;
        const usedForCover = new Set();
        controlCoords.forEach(c => usedForCover.add(`${c.q},${c.r}`));

        // Pick random centers for clumps
        const numClumps = 4;
        const clumps = [];

        for (let i = 0; i < numClumps; i++) {
            const idx = rng.nextInt(0, allCoords.length - 1);
            clumps.push(allCoords[idx]);
        }

        while (placedCover < targetCover && safety < 200) {
            safety++;
            // Bias towards clumps
            let center;
            if (Math.random() < 0.7 && clumps.length > 0) {
                center = clumps[rng.nextInt(0, clumps.length - 1)];
            } else {
                center = allCoords[rng.nextInt(0, allCoords.length - 1)];
            }

            // Get random neighbor or self
            const neighbors = HexUtils.getReachableHexes(center.q, center.r, 1, new Set());
            neighbors.push(center);

            const target = neighbors[rng.nextInt(0, neighbors.length - 1)];
            const key = `${target.q},${target.r}`;

            if (tiles.get(key) === 'neutral' && !usedForCover.has(key)) {
                tiles.set(key, 'cover');
                usedForCover.add(key);
                placedCover++;
            }
        }

        // 5. Place Blocked (Scattered but prefer edges slightly?)
        // Just random is fine given high density (30%)
        let placedBlocked = 0;
        safety = 0;

        while (placedBlocked < targetBlocked && safety < 500) {
            safety++;
            const idx = rng.nextInt(0, allCoords.length - 1);
            const c = allCoords[idx];
            const key = `${c.q},${c.r}`;

            if (tiles.get(key) === 'neutral') {
                // Constraint: Don't block all neighbors of control zones
                if (this.isCriticalPath(c, controlCoords)) continue;

                tiles.set(key, 'blocked');
                placedBlocked++;
            }
        }

        return tiles;
    }

    isCriticalPath(hex, controls) {
        // Simple check: don't encircle control points completely
        // This is expensive to check perfectly, heuristics:
        // If adjacent to a control point, ensure that point has at least 2 free neighbors

        for (const ctrl of controls) {
            const dist = HexUtils.hexDistance(hex.q, hex.r, ctrl.q, ctrl.r);
            if (dist === 1) {
                // This hex is adjacent to a control point.
                // We are proposing to block it. 
                // We should check if this would leave < 2 open neighbors.
                // But we don't have reference to "current" map state easily without passing tiles map everywhere.
                // Assuming "neutral" means open.
                // Let's rely on validateMap() to catch bad maps instead of preventing it here perfectly.
                // Just return false and let validation handle it.
            }
        }
        return false;
    }

    getAvailableSpawnHexes(tiles, tilesFilterFn) {
        const validCoords = [];
        tiles.forEach((type, key) => {
            if (type === 'blocked') return;
            const [q, r] = key.split(',').map(Number);
            if (tilesFilterFn(q, r)) {
                validCoords.push({ q, r });
            }
        });
        return validCoords;
    }

    validateMap(tiles) {
        // 1. Control Zones accessible?
        // Check neighbors of (0,0) and (3,-3)
        // Ensure at least 2 non-blocked neighbors for each
        const controls = [{ q: 0, r: 0 }, { q: 3, r: -3 }];
        for (const c of controls) {
            const neighbors = HexUtils.hexNeighbors(c.q, c.r);
            let free = 0;
            for (const n of neighbors) {
                if (tiles.get(`${n.q},${n.r}`) !== 'blocked') free++;
            }
            if (free < 2) return false;
        }

        // 2. Connectivity from Spawns
        // For Player (Left vs Right split usually):
        // Player starts Left (q <= -3?), Enemy Right (q >= 3?) due to Radius 6.
        // Let's define spawn zones for validation.
        // Player Zone: q <= -4? (Radius 6 is big).
        // Let's use Dist 5-6 bands.

        // Let's just pick a representative point for player and enemy
        const playerStart = { q: -5, r: 0 }; // Roughly left
        const enemyStart = { q: 5, r: 0 }; // Roughly right

        // If these specific tiles are blocked, we can try nearby
        if (tiles.get(`${playerStart.q},${playerStart.r}`) === 'blocked') return false;
        if (tiles.get(`${enemyStart.q},${enemyStart.r}`) === 'blocked') return false;

        // Path to Main Control (0,0)
        if (!this.bfsPathExists(playerStart, { q: 0, r: 0 }, tiles)) return false;
        if (!this.bfsPathExists(enemyStart, { q: 0, r: 0 }, tiles)) return false;

        // Path to Secondary Control (3, -3)
        if (!this.bfsPathExists(playerStart, { q: 3, r: -3 }, tiles)) return false;
        if (!this.bfsPathExists(enemyStart, { q: 3, r: -3 }, tiles)) return false;

        return true;
    }

    bfsPathExists(start, end, tiles) {
        const queue = [start];
        const visited = new Set();
        visited.add(`${start.q},${start.r}`);

        // Safety limit for large map
        let ops = 0;

        while (queue.length > 0 && ops < 1000) {
            ops++;
            const curr = queue.shift();
            if (curr.q === end.q && curr.r === end.r) return true;

            const neighbors = HexUtils.hexNeighbors(curr.q, curr.r);
            for (const n of neighbors) {
                const key = `${n.q},${n.r}`;
                const type = tiles.get(key);
                if (type && type !== 'blocked' && !visited.has(key)) {
                    visited.add(key);
                    queue.push(n);
                }
            }
        }
        return false;
    }

    generateFallback() {
        // Fallback for Radius 6
        const tiles = new Map();
        const all = this.getAllHexes();
        all.forEach(c => tiles.set(`${c.q},${c.r}`, 'neutral'));

        tiles.set("0,0", 'control');
        tiles.set("3,-3", 'control');

        // Simple Ring of cover
        const ring3 = all.filter(c => HexUtils.hexDistance(c.q, c.r, 0, 0) === 3);
        ring3.forEach(c => tiles.set(`${c.q},${c.r}`, 'cover'));

        return tiles;
    }

    getAllHexes() {
        const hexes = [];
        for (let q = -this.radius; q <= this.radius; q++) {
            for (let r = -this.radius; r <= this.radius; r++) {
                if (HexUtils.isInRadius(q, r, this.radius)) {
                    hexes.push({ q, r });
                }
            }
        }
        return hexes;
    }
}
