
 // Cria o serviço responsável pelas revanches
function criarServicoRevanche({
    rooms,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    obterPlacar,
    obterPlacarHostVisitante,
    atualizarStatusSala,
    criarPartida
}) {

    // Processa a solicitação de revanche
    async function solicitarRevanche(ws) {
        const roomCode = ws.roomCode;

        // Verifica se o jogador está em uma sala
        if (!roomCode) {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "Você não está em uma sala."
            });
            return;
        }

        const sala = rooms.get(roomCode);

        // Verifica se a sala existe
        if (!sala) {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "Sala não encontrada."
            });
            return;
        }

        // Verifica se a partida terminou
        if (sala.status !== "FINISHED") {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "A partida atual ainda não terminou."
            });
            return;
        }

        // Impede revanche com jogador desconectado
        if (
            sala.players.length !== 2 ||
            sala.players.some(player => !player.connected)
        ) {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "O outro jogador saiu da sala."
            });
            return;
        }

        // Confirma que o pedido veio de um jogador da sala
        const jogador = sala.players.find(
            player =>
                player.socket === ws &&
                player.connected
        );

        if (!jogador) {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "Você não está conectado a esta sala."
            });
            return;
        }

        // Impede solicitações duplicadas
        if (sala.rematchRequests.has(ws)) {
            enviar(ws, {
                type: "NEW_GAME_ERROR",
                message: "Você já solicitou a revanche."
            });
            return;
        }

        // Registra a solicitação do jogador
        sala.rematchRequests.add(ws);

        console.log(
            `${ws.playerName} solicitou revanche na sala ${roomCode}`
        );

        // Aguarda a solicitação do segundo jogador
        if (sala.rematchRequests.size === 1) {
            enviarParaSala(sala, {
                type: "REMATCH_REQUESTED",
                requestedBy: ws.playerName,
                message:
                    `${ws.playerName} solicitou uma revanche.`
            });
            return;
        }

        // Inicia a revanche após as duas solicitações
        if (sala.rematchRequests.size === 2) {
            await iniciarNovaPartida(sala);
        }
    }

    // Reinicia os dados para uma nova partida
    async function iniciarNovaPartida(sala) {
        cancelarCronometroTurno(sala);

        // Limpa o tabuleiro
        sala.board = [
            "", "", "",
            "", "", "",
            "", "", ""
        ];

        // Alterna os símbolos dos jogadores
        for (const player of sala.players) {
            player.symbol =
                player.symbol === "X" ? "O" : "X";

            if (player.socket) {
                player.socket.playerSymbol =
                    player.symbol;
            }
        }

        // Reinicia o turno e o estado da partida
        sala.currentTurn = "X";
        sala.status = "PLAYING";
        sala.rematchRequests.clear();

        // Registra a nova partida no banco
        try {
            await atualizarStatusSala(
                sala.idSala,
                "EM_JOGO"
            );

            const {
                placarHost,
                placarVisitante
            } = obterPlacarHostVisitante(sala);

            sala.idPartida = await criarPartida(
                sala.idSala,
                sala.currentTurn,
                placarHost,
                placarVisitante
            );

            console.log(
                `Nova partida ${sala.idPartida} criada no banco.`
            );
        } catch (erro) {
            console.error(
                "Erro ao criar revanche no banco:",
                erro
            );

            enviarParaSala(sala, {
                type: "DATABASE_ERROR",
                message:
                    "Não foi possível criar a nova partida."
            });

            return;
        }

        // Envia os dados da nova partida
        enviarParaSala(sala, {
            type: "NEW_GAME_STARTED",
            roomCode: sala.code,
            board: sala.board,
            currentTurn: sala.currentTurn,
            players: sala.players.map((player) => ({
                name: player.name,
                symbol: player.symbol
            })),
            score: obterPlacar(sala)
        });

        console.log(
            `Nova partida iniciada na sala ${sala.code}`
        );

        // Inicia o cronômetro da nova partida
        iniciarCronometroTurno(sala);
    }

    // Disponibiliza as funções do serviço
    return {
        solicitarRevanche,
        iniciarNovaPartida
    };
}

// Exporta o módulo
module.exports = {
    criarServicoRevanche
};
