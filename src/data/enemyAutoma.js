export const ENEMY_INTENT = {
    ADVANCE: 'ADVANCE',
    ATTACK: 'ATTACK',
    HOLD: 'HOLD',
    DISRUPT: 'DISRUPT'
};

const CARDS = [
    // Standard Advance
    { name: 'March Forward', actionKey: 'ADVANCE_CONTROL', type: ENEMY_INTENT.ADVANCE, ruleText: 'Move closest unit toward Control.' },
    { name: 'Flanking Maneuver', actionKey: 'FLANK', type: ENEMY_INTENT.ADVANCE, ruleText: 'Fastest unit moves toward Control (prefer Cover).' },
    { name: 'Mass Advance', actionKey: 'PRESS', type: ENEMY_INTENT.ADVANCE, ruleText: 'Move 2 units toward Control.' },

    // Attack
    { name: 'Aggression', actionKey: 'STRIKE_WEAK', type: ENEMY_INTENT.ATTACK, ruleText: 'Strongest unit attacks weakest adjacent enemy.' },
    { name: 'Headhunter', actionKey: 'TARGET_LEADER', type: ENEMY_INTENT.ATTACK, ruleText: 'Attack Leader if possible.' },
    { name: 'Calculated Risk', actionKey: 'TRADE', type: ENEMY_INTENT.ATTACK, ruleText: 'Attack if it kills, otherwise attack weakest.' },

    // Hold/Defend
    { name: 'Dug In', actionKey: 'FORTIFY', type: ENEMY_INTENT.HOLD, ruleText: 'Heal unit on Cover, or move to Cover.' },
    { name: 'Regroup', actionKey: 'REGROUP', type: ENEMY_INTENT.HOLD, ruleText: 'Move units adjacent to Leader.' },
    { name: 'Bide Time', actionKey: 'WAIT', type: ENEMY_INTENT.HOLD, ruleText: 'Wait. Next attack deals +1 damage.' },

    // Disrupt/Control
    { name: 'Seize Ground', actionKey: 'DENY_CONTROL', type: ENEMY_INTENT.DISRUPT, ruleText: 'Step onto Control hex if able.' },
    { name: 'Blockade', actionKey: 'BLOCK', type: ENEMY_INTENT.DISRUPT, ruleText: 'Block Influence gain this turn.' },
    { name: 'Force Out', actionKey: 'PUSH_OFF', type: ENEMY_INTENT.DISRUPT, ruleText: 'Push player unit off Control hex.' }
];

export const ENEMY_AUTOMA = {
    getDeck: () => {
        // Return shuffled copy
        const deck = [...CARDS];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
};
