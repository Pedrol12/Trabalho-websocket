
 // Cria o serviço responsável pelas jogadas
function criarServicoJogadas({
    rooms,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    verificarVencedor,
    verificarEmpate,
    obterPlacar,
    obterPlacarHostVisitante,
    registrarJogada,
    atualizarTurnoPartida,
    atualizarStatusSala,
    finalizarPartida,
    registrarVitoriaDerrota
}) {

    // Recebe e processa uma jogada
    async function executarJogada(ws, mensagem) {
        const roomCode = ws.roomCode;
        const position = mensagem.position;

        // Verifica se o jogador está em uma sala
        if (!roomCode) {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "Você não está em uma sala."
            });
            return;
        }

        const sala = rooms.get(roomCode);

        // Verifica se a partida está ativa
        if (!sala || sala.status !== "PLAYING") {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "A partida não está disponível."
            });
            return;
        }

        // Verifica se todos os jogadores estão conectados
        if (sala.players.some(player => !player.connected)) {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "A partida está pausada aguardando reconexão."
            });
            return;
        }

        const simboloJogador = ws.playerSymbol;

        // Verifica se é a vez do jogador
        if (sala.currentTurn !== simboloJogador) {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "Não é a sua vez."
            });
            return;
        }

        // Valida a posição escolhida
        if (
            !Number.isInteger(position) ||
            position < 0 ||
            position > 8
        ) {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "Posição inválida."
            });
            return;
        }

        // Verifica se a posição está livre
        if (sala.board[position] !== "") {
            enviar(ws, {
                type: "INVALID_MOVE",
                message: "Essa posição já está ocupada."
            });
            return;
        }

        // Cancela o cronômetro e marca a posição
        cancelarCronometroTurno(sala);
        sala.board[position] = simboloJogador;

        // Registra a jogada no banco
        try {
            await registrarJogada(
                sala.idPartida,
                ws.playerId,
                position,
                simboloJogador
            );

            console.log(
                `Jogada registrada no banco: ` +
                `${ws.playerName} -> posição ${position}`
            );
        } catch (erro) {
            sala.board[position] = "";
            iniciarCronometroTurno(sala);

            console.error("Erro ao registrar jogada:", erro);

            enviar(ws, {
                type: "DATABASE_ERROR",
                message: "Não foi possível registrar a jogada."
            });
            return;
        }

        // Verifica se existe um vencedor
        const vencedor = verificarVencedor(sala.board);

        if (vencedor) {
            sala.status = "FINISHED";
            sala.currentTurn = null;
            cancelarCronometroTurno(sala);

            const jogadorVencedor = sala.players.find(
                player => player.symbol === vencedor
            );

            const jogadorPerdedor = sala.players.find(
                player => player !== jogadorVencedor
            );

            // Atualiza o placar do vencedor
            if (jogadorVencedor) {
                jogadorVencedor.score++;
            }

            const {
                placarHost,
                placarVisitante
            } = obterPlacarHostVisitante(sala);

            const statusResultado =
                jogadorVencedor === sala.players[0]
                    ? "VITORIA_HOST"
                    : "VITORIA_VISITANTE";

            // Salva o resultado no banco
            try {
                await atualizarStatusSala(
                    sala.idSala,
                    "FINALIZADA"
                );

                await finalizarPartida(
                    sala.idPartida,
                    jogadorVencedor.idJogador,
                    statusResultado,
                    placarHost,
                    placarVisitante
                );

                await registrarVitoriaDerrota(
                    jogadorVencedor.idJogador,
                    jogadorPerdedor.idJogador
                );
            } catch (erro) {
                console.error(
                    "Erro ao finalizar partida no banco:",
                    erro
                );
            }

            // Envia o tabuleiro atualizado
            enviarParaSala(sala, {
                type: "BOARD_UPDATE",
                board: sala.board,
                nextTurn: null
            });

            // Informa o vencedor
            enviarParaSala(sala, {
                type: "GAME_OVER",
                result: "WIN",
                winner: vencedor,
                winnerName: jogadorVencedor.name,
                score: obterPlacar(sala)
            });

            // Atualiza o placar dos jogadores
            enviarParaSala(sala, {
                type: "SCORE_UPDATE",
                score: obterPlacar(sala)
            });

            console.log(
                `Fim de jogo! ${jogadorVencedor.name} venceu com ${vencedor}.`
            );

            return;
        }

        // Verifica se a partida terminou empatada
        if (verificarEmpate(sala.board)) {
            sala.status = "FINISHED";
            sala.currentTurn = null;
            cancelarCronometroTurno(sala);

            const {
                placarHost,
                placarVisitante
            } = obterPlacarHostVisitante(sala);

            // Registra o empate no banco
            try {
                await atualizarStatusSala(
                    sala.idSala,
                    "FINALIZADA"
                );

                await finalizarPartida(
                    sala.idPartida,
                    null,
                    "EMPATE",
                    placarHost,
                    placarVisitante
                );
            } catch (erro) {
                console.error(
                    "Erro ao registrar empate no banco:",
                    erro
                );
            }

            // Atualiza o tabuleiro
            enviarParaSala(sala, {
                type: "BOARD_UPDATE",
                board: sala.board,
                nextTurn: null
            });

            // Informa o empate
            enviarParaSala(sala, {
                type: "GAME_OVER",
                result: "DRAW",
                winner: null,
                winnerName: null,
                score: obterPlacar(sala)
            });

            // Atualiza o placar
            enviarParaSala(sala, {
                type: "SCORE_UPDATE",
                score: obterPlacar(sala)
            });

            console.log("Fim de jogo! Empate.");
            return;
        }

        // Passa o turno para o próximo jogador
        sala.currentTurn =
            simboloJogador === "X" ? "O" : "X";

        // Atualiza o turno no banco
        try {
            await atualizarTurnoPartida(
                sala.idPartida,
                sala.currentTurn
            );
        } catch (erro) {
            console.error(
                "Erro ao atualizar turno da partida:",
                erro.message
            );
        }

        // Atualiza o tabuleiro dos jogadores
        enviarParaSala(sala, {
            type: "BOARD_UPDATE",
            board: sala.board,
            nextTurn: sala.currentTurn
        });

        console.log(`Próximo turno: ${sala.currentTurn}`);

        // Inicia o cronômetro do próximo turno
        iniciarCronometroTurno(sala);
    }

    // Disponibiliza a função do serviço
    return {
        executarJogada
    };
}

// Exporta o módulo
module.exports = {
    criarServicoJogadas
};
