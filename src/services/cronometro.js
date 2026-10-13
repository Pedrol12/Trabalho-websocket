
 // Cria o serviço de gerenciamento do cronômetro
function criarServicoCronometro({
    tempoTurnoMs,
    enviarParaSala,
    atualizarTurnoPartida
}) {

    // Cancela os cronômetros do turno
    function cancelarCronometroTurno(sala) {
        if (sala.turnTimer) {
            clearTimeout(sala.turnTimer);
            sala.turnTimer = null;
        }

        if (sala.turnInterval) {
            clearInterval(sala.turnInterval);
            sala.turnInterval = null;
        }

        sala.turnDeadline = null;
    }

    // Envia o tempo restante
    function enviarTempoRestante(sala) {
        if (!sala.turnDeadline) {
            return;
        }

        const tempoRestante = Math.max(
            0,
            Math.ceil(
                (sala.turnDeadline - Date.now()) / 1000
            )
        );

        enviarParaSala(sala, {
            type: "TURN_TIMER",
            currentTurn: sala.currentTurn,
            seconds: tempoRestante,
            deadline: sala.turnDeadline
        });
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

        // Verifica se todos estão conectados
        if (
            sala.players.some(player => !player.connected)
        ) {
            return;
        }

        const simboloDoTurno = sala.currentTurn;

        // Define o tempo limite
        sala.turnDeadline = Date.now() + tempoTurnoMs;

        // Mostra o tempo inicial
        enviarTempoRestante(sala);

        // Atualiza o contador a cada segundo
        sala.turnInterval = setInterval(() => {
            if (
                sala.status !== "PLAYING" ||
                sala.currentTurn !== simboloDoTurno ||
                sala.players.some(player => !player.connected)
            ) {
                cancelarCronometroTurno(sala);
                return;
            }

            enviarTempoRestante(sala);
        }, 1000);

        // Executa quando o tempo acaba
        sala.turnTimer = setTimeout(async () => {

            // Verifica se o turno ainda é válido
            if (
                sala.status !== "PLAYING" ||
                sala.currentTurn !== simboloDoTurno ||
                sala.players.some(player => !player.connected)
            ) {
                cancelarCronometroTurno(sala);
                return;
            }

            // Encerra o contador atual
            cancelarCronometroTurno(sala);

            const jogadorQuePerdeuOTurno = simboloDoTurno;

            // Passa a vez para o outro jogador
            sala.currentTurn =
                jogadorQuePerdeuOTurno === "X" ? "O" : "X";

            // Atualiza o turno no banco
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

            // Informa que o tempo acabou
            enviarParaSala(sala, {
                type: "TURN_TIMEOUT",
                timedOutSymbol: jogadorQuePerdeuOTurno,
                nextTurn: sala.currentTurn,
                message:
                    `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado.`
            });

            // Atualiza o tabuleiro
            enviarParaSala(sala, {
                type: "BOARD_UPDATE",
                board: sala.board,
                nextTurn: sala.currentTurn
            });

            console.log(
                `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado. ` +
                `Próximo turno: ${sala.currentTurn}`
            );

            // Inicia o próximo cronômetro
            iniciarCronometroTurno(sala);

        }, tempoTurnoMs);
    }

    // Exporta as funções do serviço
    return {
        cancelarCronometroTurno,
        iniciarCronometroTurno
    };
}

// Exporta o módulo
module.exports = {
    criarServicoCronometro
};
