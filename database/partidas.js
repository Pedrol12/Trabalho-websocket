
const { executar } = require("./conexao");

// Cria uma nova partida no banco
async function criarPartida(
    idSala,
    simboloTurnoAtual,
    placarHost,
    placarVisitante
) {
    const resultado = await executar(
        `INSERT INTO PARTIDA (
            id_sala,
            simbolo_turno_atual,
            placar_host,
            placar_visitante,
            status_resultado
        )
        VALUES (?, ?, ?, ?, 'EM_ANDAMENTO')`,
        [
            idSala,
            simboloTurnoAtual,
            placarHost,
            placarVisitante
        ]
    );

    return resultado.lastID;
}

// Atualiza o turno atual da partida
async function atualizarTurnoPartida(
    idPartida,
    simboloTurnoAtual
) {
    await executar(
        `UPDATE PARTIDA
         SET simbolo_turno_atual = ?
         WHERE id_partida = ?`,
        [
            simboloTurnoAtual,
            idPartida
        ]
    );
}

// Registra o resultado final da partida
async function finalizarPartida(
    idPartida,
    idVencedor,
    statusResultado,
    placarHost,
    placarVisitante
) {
    await executar(
        `UPDATE PARTIDA
         SET id_vencedor = ?,
             simbolo_turno_atual = NULL,
             placar_host = ?,
             placar_visitante = ?,
             status_resultado = ?
         WHERE id_partida = ?`,
        [
            idVencedor,
            placarHost,
            placarVisitante,
            statusResultado,
            idPartida
        ]
    );
}

// Exporta as funções do módulo
module.exports = {
    criarPartida,
    atualizarTurnoPartida,
    finalizarPartida
};
