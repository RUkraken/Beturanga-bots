

export interface IGameState {
    fen: string;
    legalMoves: string[];
    legalPieces: string[];
    undo: null | boolean;
}



export enum ColorVariant {
    white = 'w',
    black = 'b',
    none = '',
}
