
 // Retorna o placar de todos os jogadores da sala
function obterPlacar(sala) {
    return sala.players.map((player) => ({
        name: player.name,
        symbol: player.symbol,
        score: player.score
    }));
}

// Retorna o placar separado entre host e visitante
function obterPlacarHostVisitante(sala) {
    return {
        placarHost: sala.players[0]?.score || 0,
        placarVisitante: sala.players[1]?.score || 0
    };
}

// Exporta as funções do módulo
module.exports = {
    obterPlacar,
    obterPlacarHostVisitante
};
