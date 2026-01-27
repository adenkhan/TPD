export const HexUtils = {
    // Pointy-topped hexes
    // size is the distance from center to a corner

    axialToPixel: (q, r, size) => {
        const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = size * (3 / 2 * r);
        return { x, y };
    },

    pixelToAxial: (x, y, size) => {
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
        const r = (2 / 3 * y) / size;
        return HexUtils.axialRound(q, r);
    },

    axialRound: (q, r) => {
        let s = -q - r;
        let roundQ = Math.round(q);
        let roundR = Math.round(r);
        let roundS = Math.round(s);

        const qDiff = Math.abs(roundQ - q);
        const rDiff = Math.abs(roundR - r);
        const sDiff = Math.abs(roundS - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            roundQ = -roundR - roundS;
        } else if (rDiff > sDiff) {
            roundR = -roundQ - roundS;
        } else {
            roundS = -roundQ - roundR;
        }

        return { q: roundQ, r: roundR };
    },

    hexNeighbors: (q, r) => {
        const directions = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
        ];
        return directions.map(d => ({ q: q + d.q, r: r + d.r }));
    },

    // Distance in hex grid steps
    hexDistance: (q1, r1, q2, r2) => {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    },

    isInRadius: (q, r, radius) => {
        // Distance from 0,0
        return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2 <= radius;
    },

    getReachableHexes: (startQ, startR, moveRange, blockedSet) => {
        const visited = new Set();
        visited.add(`${startQ},${startR}`);

        const results = []; // Array of {q, r}
        const fringe = [{ q: startQ, r: startR, dist: 0 }];

        while (fringe.length > 0) {
            const current = fringe.shift();

            if (current.dist > moveRange) continue;

            // Add to results if it's not the start node
            if (current.dist > 0) {
                results.push({ q: current.q, r: current.r });
            }

            if (current.dist < moveRange) {
                const neighbors = HexUtils.hexNeighbors(current.q, current.r);
                for (const n of neighbors) {
                    const key = `${n.q},${n.r}`;
                    if (!visited.has(key) && !blockedSet.has(key)) {
                        visited.add(key);
                        fringe.push({ q: n.q, r: n.r, dist: current.dist + 1 });
                    }
                }
            }
        }
        return results;
    }
};
