
 // Verifica se algum jogador venceu a partida
function verificarVencedor(board) {

    // Define as combinações possíveis de vitória
    const combinacoes = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    // Percorre as combinações para encontrar um vencedor
    for (const combinacao of combinacoes) {
        const [a, b, c] = combinacao;

        if (
            board[a] !== "" &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    // Retorna null caso não exista vencedor
    return null;
}

// Verifica se todas as posições do tabuleiro estão preenchidas
function verificarEmpate(board) {
    return board.every(
        (celula) => celula !== ""
    );
}

// Exporta as funções do módulo
module.exports = {
    verificarVencedor,
    verificarEmpate
};
