
 // Cria o serviço de gerenciamento do cronômetro
function criarServicoCronometro({
    tempoTurnoMs,
    enviarParaSala,
    atualizarTurnoPartida
}) {

    // Cancela o cronômetro do turno atual
    function cancelarCronometroTurno(sala) {
        if (sala.turnTimer) {
            clearTimeout(sala.turnTimer);
            sala.turnTimer = null;
        }

        sala.turnDeadline = null;
    }

    // Inicia o cronômetro do turno
    function iniciarCronometroTurno(sala) {
        cancelarCronometroTurno(sala);

        // Verifica se a partida está ativa
        if (
            sala.status !== "PLAYING" ||
            !sala.currentTurn
        ) {
            return;
        }

        // Verifica se todos os jogadores estão conectados
        if (
            sala.players.some(player => !player.connected)
        ) {
            return;
        }

        const simboloDoTurno = sala.currentTurn;

        // Define o prazo para finalizar o turno
        sala.turnDeadline = Date.now() + tempoTurnoMs;

        // Envia o tempo do turno para os jogadores
        enviarParaSala(sala, {
            type: "TURN_TIMER",
            currentTurn: simboloDoTurno,
            seconds: tempoTurnoMs / 1000,
            deadline: sala.turnDeadline
        });

        // Executa quando o tempo do turno acaba
        sala.turnTimer = setTimeout(async () => {

            // Verifica se o turno ainda é válido
            if (
                sala.status !== "PLAYING" ||
                sala.currentTurn !== simboloDoTurno
            ) {
                return;
            }

            const jogadorQuePerdeuOTurno = simboloDoTurno;

            // Passa o turno para o outro jogador
            sala.currentTurn =
                jogadorQuePerdeuOTurno === "X" ? "O" : "X";

            sala.turnTimer = null;
            sala.turnDeadline = null;

            // Atualiza o turno no banco de dados
            if (sala.idPartida) {
                try {
                    await atualizarTurnoPartida(
                        sala.idPartida,
                        sala.currentTurn
                    );
                } catch (erro) {
                    console.error(
                        "Erro ao atualizar turno no banco:",
                        erro.message
                    );
                }
            }

            // Informa que o tempo do jogador acabou
            enviarParaSala(sala, {
                type: "TURN_TIMEOUT",
                timedOutSymbol: jogadorQuePerdeuOTurno,
                nextTurn: sala.currentTurn,
                message:
                    `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado.`
            });

            // Atualiza o tabuleiro para os jogadores
            enviarParaSala(sala, {
                type: "BOARD_UPDATE",
                board: sala.board,
                nextTurn: sala.currentTurn
            });

            console.log(
                `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado. ` +
                `Próximo turno: ${sala.currentTurn}`
            );

            // Inicia o cronômetro do próximo jogador
            iniciarCronometroTurno(sala);

        }, tempoTurnoMs);
    }

    // Disponibiliza as funções do serviço
    return {
        cancelarCronometroTurno,
        iniciarCronometroTurno
    };
}

// Exporta o módulo de cronômetro
module.exports = {
    criarServicoCronometro
};
