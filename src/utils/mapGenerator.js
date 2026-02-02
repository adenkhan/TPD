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
        // User requested: Single Control Zone at (0,0)
        const controlCoords = [{ q: 0, r: 0 }];
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

        // 5. Place High Ground (Elevation) - Mechanic 4
        // Scattered 4-7 tiles. Not adjacent to each other.
        // Cannot overlap Control, Cover, Road (not placed yet), Blocked (later), Spawns.
        // Spawn = Dist >= 4. So max Dist <= 3.
        // Control = Dist 0. So Dist >= 1.
        // Valid Range: Dist 1 to 3.

        let placedElevation = 0;
        const targetElevation = rng.nextInt(4, 7);
        let elevationSafety = 0;
        const elevationSet = new Set(); // To check adjacency

        while (placedElevation < targetElevation && elevationSafety < 200) {
            elevationSafety++;
            const idx = rng.nextInt(0, allCoords.length - 1);
            const c = allCoords[idx];
            const k = `${c.q},${c.r}`;
            const dist = HexUtils.hexDistance(c.q, c.r, 0, 0);

            // Constraints
            // 1. Valid Zone (Ring 1-3)
            if (dist < 1 || dist > 3) continue;

            // 2. Must be Neutral (avoids Cover/Control)
            if (tiles.get(k) !== 'neutral') continue;

            // 3. Not Adjacent to existing Elevation (Scattered)
            let adjacentToElevation = false;
            const neighbors = HexUtils.hexNeighbors(c.q, c.r);
            for (const n of neighbors) {
                if (elevationSet.has(`${n.q},${n.r}`)) {
                    adjacentToElevation = true;
                    break;
                }
            }
            if (adjacentToElevation) continue;

            // Place
            tiles.set(k, 'elevation');
            elevationSet.add(k);
            placedElevation++;
        }

        // 6. Place Roads (Fast Lanes) - Mechanic 3
        // Contiguous chain of 6-10 tiles in Ring 2-3 (Dist 2-3 from 0,0)
        // This avoids Control (Dist 0-1) and Spawn (Dist >=4)

        let roadPlaced = 0;
        let roadSafety = 0;

        while (roadPlaced === 0 && roadSafety < 50) {
            roadSafety++;

            // 1. Pick Start Node in Ring 2 or 3
            const candidates = allCoords.filter(c => {
                const d = HexUtils.hexDistance(c.q, c.r, 0, 0);
                const k = `${c.q},${c.r}`;
                return (d >= 2 && d <= 3) && tiles.get(k) === 'neutral';
            });

            if (candidates.length === 0) continue;

            const start = candidates[rng.nextInt(0, candidates.length - 1)];
            const roadChain = [start];
            const roadSet = new Set();
            roadSet.add(`${start.q},${start.r}`);

            // 2. Grow Chain (Random Walker)
            let curr = start;
            const targetLength = rng.nextInt(6, 10);

            for (let i = 0; i < targetLength; i++) {
                const neighbors = HexUtils.hexNeighbors(curr.q, curr.r);
                // Filter valid extensions
                const validNeighbors = neighbors.filter(n => {
                    const d = HexUtils.hexDistance(n.q, n.r, 0, 0);
                    const k = `${n.q},${n.r}`;
                    return (d >= 2 && d <= 3) &&
                        tiles.get(k) === 'neutral' &&
                        !roadSet.has(k);
                });

                if (validNeighbors.length > 0) {
                    const next = validNeighbors[rng.nextInt(0, validNeighbors.length - 1)];
                    roadChain.push(next);
                    roadSet.add(`${next.q},${next.r}`);
                    curr = next;
                } else {
                    break; // Stuck, stop here
                }
            }

            // 3. Commit if long enough
            if (roadChain.length >= 6) {
                roadChain.forEach(c => tiles.set(`${c.q},${c.r}`, 'road'));
                roadPlaced = roadChain.length;
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
        // Check neighbor of (0,0)
        const controls = [{ q: 0, r: 0 }];
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
