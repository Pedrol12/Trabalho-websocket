
const { executar } = require("./conexao");

// Registra uma jogada no banco de dados
async function registrarJogada(
    idPartida,
    idJogador,
    posicao,
    simbolo
) {

    // Salva a posição e o símbolo utilizado
    await executar(
        `INSERT INTO JOGADA (
            id_partida,
            id_jogador,
            posicao_celula,
            simbolo
        )
        VALUES (?, ?, ?, ?)`,
        [
            idPartida,
            idJogador,
            posicao,
            simbolo
        ]
    );
}

// Exporta a função do módulo
module.exports = {
    registrarJogada
};
