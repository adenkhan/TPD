export const CARD_TYPES = {
    MOVE: 'MOVE',
    COMBAT: 'COMBAT',
    CONTROL: 'CONTROL'
};

const COMMON_EFFECTS = [
    // MOVE (4)
    {
        name: 'Rapid Push',
        type: CARD_TYPES.MOVE,
        desc: '+2 move for 1 selected friendly unit this turn.',
        key: 'RAPID_PUSH',
        params: { amount: 2 },
        icon: 'move'
    },
    {
        name: 'Reposition',
        type: CARD_TYPES.MOVE,
        desc: 'Swap positions of 2 friendly units within 2 hexes.',
        key: 'REPOSITION',
        params: { range: 2 },
        icon: 'move'
    },
    {
        name: 'Sprint',
        type: CARD_TYPES.MOVE,
        desc: 'Selected unit can both move and attack this turn.',
        key: 'SPRINT',
        params: {},
        icon: 'move'
    },
    {
        name: 'Fallback',
        type: CARD_TYPES.MOVE,
        desc: 'Move selected unit 1 hex away from nearest enemy.',
        key: 'FALLBACK',
        params: { amount: 1 },
        icon: 'move'
    },

    // COMBAT (4)
    {
        name: 'Focused Strike',
        type: CARD_TYPES.COMBAT,
        desc: '+1 attack for its next attack this turn.',
        key: 'FOCUSED_STRIKE',
        params: { amount: 1 },
        icon: 'sword'
    },
    {
        name: 'Hold Ground',
        type: CARD_TYPES.COMBAT,
        desc: '-1 damage from next hit this round.',
        key: 'HOLD_GROUND',
        params: { amount: 1 },
        icon: 'sword'
    },
    {
        name: 'Disrupt',
        type: CARD_TYPES.COMBAT,
        desc: 'Target adjacent enemy becomes Rooted (cannot move).',
        key: 'DISRUPT',
        params: {},
        icon: 'sword'
    },
    {
        name: 'Ambush',
        type: CARD_TYPES.COMBAT,
        desc: '+1 damage if selected unit is on Cover.',
        key: 'AMBUSH',
        params: { amount: 1, condition: 'cover' },
        icon: 'sword'
    },

    // CONTROL (2)
    {
        name: 'Secure Area',
        type: CARD_TYPES.CONTROL,
        desc: 'if player occupies Control hex, gain +2 influence.',
        key: 'SECURE_AREA',
        params: { amount: 2 },
        icon: 'flag'
    },
    {
        name: 'Deny Control',
        type: CARD_TYPES.CONTROL,
        desc: 'Push enemy off Control hex into adjacent free hex.',
        key: 'DENY_CONTROL',
        params: {},
        icon: 'flag'
    }
];

const generateDeck = (faction) => {
    return COMMON_EFFECTS.map((template, index) => ({
        id: `${faction}_card_${index}`,
        faction,
        name: template.name,
        type: template.type,
        description: template.desc,
        effectKey: template.key,
        params: template.params,
        iconType: template.icon
    }));
};

export const DECKS = {
    A: generateDeck('A'),
    B: generateDeck('B')
};
