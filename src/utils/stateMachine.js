export const GameStates = {
    PLAYER_SELECT_UNIT: 'PLAYER_SELECT_UNIT',
    PLACEMENT: 'PLACEMENT',
    PLAYER_MOVE: 'PLAYER_MOVE',
    PLAYER_ATTACK: 'PLAYER_ATTACK',
    PLAYER_SKIRMISH_MOVE: 'PLAYER_SKIRMISH_MOVE',
    PLAYER_PLAY_CARD: 'PLAYER_PLAY_CARD', // Not fully used for MVP but good to have
    END_PLAYER_TURN: 'END_PLAYER_TURN',
    ENEMY_TURN: 'ENEMY_TURN',
    CHECK_END: 'CHECK_END',
    GAME_OVER: 'GAME_OVER'
};

export class StateMachine {
    constructor(initialState, scene) {
        this.currentState = initialState;
        this.scene = scene;
        this.history = [];
    }

    transition(newState, data = {}) {
        if (this.currentState === newState) return;

        console.log(`State Transition: ${this.currentState} -> ${newState}`, data);
        this.history.push({ state: this.currentState, timestamp: Date.now() });
        this.currentState = newState;

        if (this.scene.onStateEnter) {
            this.scene.onStateEnter(newState, data);
        }
    }

    getState() {
        return this.currentState;
    }
}
