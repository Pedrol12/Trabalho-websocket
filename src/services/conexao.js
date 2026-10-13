
 // Cria o serviço de conexão dos jogadores
function criarServicoConexao({
    rooms,
    tempoReconexaoMs,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    broadcastListaSalasPublicas,
    removerSalaBanco,
    obterPlacar,
    obterPlacarHostVisitante,
    atualizarStatusSala,
    finalizarPartida,
    registrarVitoriaDerrota
}) {
    // Trata a desconexão de um jogador
    async function tratarDesconexao(ws, voluntaria = false) {
        const roomCode = ws.roomCode;

        if (!roomCode) {
            console.log(
                "Cliente desconectado antes de entrar em uma sala."
            );
            return;
        }

        const sala = rooms.get(roomCode);

        if (!sala) {
            return;
        }

        // Procura o jogador pela conexão atual
        const jogador = sala.players.find(
            player => player.socket === ws
        );

        // Ignora conexões antigas ou já desconectadas
        if (!jogador || !jogador.connected) {
            return;
        }

        jogador.connected = false;
        jogador.socket = null;

        console.log(
            `${jogador.name} ${
                voluntaria ? "saiu" : "desconectou"
            } da sala ${roomCode}`
        );

        // Avisa sobre a saída após o fim da partida
        if (sala.status === "FINISHED") {
            sala.rematchRequests.clear();

            enviarParaSala(sala, {
                type: "PLAYER_LEFT_ROOM",
                playerName: jogador.name,
                message: `${jogador.name} saiu da sala.`
            });

            return;
        }

        // Trata salas que aguardam jogadores
        if (sala.status === "WAITING") {
            if (voluntaria) {
                enviarParaSala(sala, {
                    type: "PLAYER_LEFT_ROOM",
                    playerName: jogador.name,
                    message: `${jogador.name} saiu da sala.`
                });
            }

            if (sala.private) {
                console.log(
                    `Sala privada ${roomCode} permanece ` +
                    "persistida aguardando reconexão."
                );
                return;
            }

            // Remove salas públicas sem partida iniciada
            rooms.delete(roomCode);

            try {
                await removerSalaBanco(sala.idSala);
            } catch (erro) {
                console.error(
                    "Erro ao remover sala pública:",
                    erro
                );
            }

            broadcastListaSalasPublicas();
            return;
        }

        if (sala.status !== "PLAYING") {
            return;
        }

        // Pausa o cronômetro
        cancelarCronometroTurno(sala);

        // Encerra imediatamente a saída voluntária
        if (voluntaria) {
            await finalizarPorWO(sala, jogador);

            enviarParaSala(sala, {
                type: "PLAYER_LEFT_ROOM",
                playerName: jogador.name,
                message: `${jogador.name} saiu da partida.`
            });

            return;
        }

        // Avisa sobre a queda de conexão
        enviarParaSala(sala, {
            type: "PLAYER_DISCONNECTED",
            playerName: jogador.name,
            playerSymbol: jogador.symbol,
            reconnectSeconds: tempoReconexaoMs / 1000,
            message:
                `${jogador.name} desconectou. ` +
                `Aguardando reconexão por ${
                    tempoReconexaoMs / 1000
                } segundos.`
        });

        // Aguarda a reconexão antes do W.O.
        jogador.disconnectTimer = setTimeout(() => {
            finalizarPorWO(sala, jogador).catch(erro => {
                console.error(
                    "Erro ao finalizar por W.O.:",
                    erro
                );
            });
        }, tempoReconexaoMs);
    }

    // Processa a saída voluntária
    async function sairVoluntariamente(ws) {
        if (ws.saidaVoluntaria) {
            return;
        }

        // Evita tratar o fechamento como queda de conexão
        ws.saidaVoluntaria = true;

        try {
            await tratarDesconexao(ws, true);
        } finally {
            // Confirma a saída ao navegador
            enviar(ws, {
                type: "LEAVE_ROOM_ACK",
                message: "Saída confirmada."
            });
        }
    }

    // Restaura a conexão do jogador
    function reconectarJogador(ws, sala, jogador) {
        // Cancela o prazo de reconexão
        if (jogador.disconnectTimer) {
            clearTimeout(jogador.disconnectTimer);
            jogador.disconnectTimer = null;
        }

        jogador.socket = ws;
        jogador.connected = true;

        ws.roomCode = sala.code;
        ws.playerName = jogador.name;
        ws.playerSymbol = jogador.symbol;
        ws.playerId = jogador.idJogador;

        // Envia o estado atual da sala
        enviar(ws, {
            type: "ROOM_RECONNECTED",
            roomCode: sala.code,
            playerName: jogador.name,
            playerSymbol: jogador.symbol,
            board: sala.board,
            currentTurn: sala.currentTurn,
            status: sala.status,
            score: obterPlacar(sala),
            players: sala.players.map(player => ({
                name: player.name,
                symbol: player.symbol,
                connected: player.connected
            }))
        });

        // Avisa sobre a reconexão
        enviarParaSala(sala, {
            type: "PLAYER_RECONNECTED",
            playerName: jogador.name,
            playerSymbol: jogador.symbol,
            message: `${jogador.name} reconectou à partida.`
        });

        console.log(
            `${jogador.name} reconectou na sala ${sala.code}`
        );

        // Reinicia o cronômetro
        if (sala.status === "PLAYING") {
            iniciarCronometroTurno(sala);
        }
    }

    // Finaliza a partida por W.O.
    async function finalizarPorWO(sala, jogadorDesconectado) {
        jogadorDesconectado.disconnectTimer = null;

        if (jogadorDesconectado.connected) {
            return;
        }

        if (sala.status !== "PLAYING") {
            return;
        }

        cancelarCronometroTurno(sala);

        // Procura o adversário conectado
        const vencedor = sala.players.find(
            player =>
                player !== jogadorDesconectado &&
                player.connected
        );

        sala.status = "FINISHED";
        sala.currentTurn = null;
        sala.rematchRequests.clear();

        if (!vencedor) {
            console.log(
                `Partida ${sala.code} encerrada sem vencedor.`
            );
            return;
        }

        vencedor.score++;

        const {
            placarHost,
            placarVisitante
        } = obterPlacarHostVisitante(sala);

        const statusResultado =
            vencedor === sala.players[0]
                ? "VITORIA_HOST"
                : "VITORIA_VISITANTE";

        // Registra o resultado no banco
        try {
            await atualizarStatusSala(
                sala.idSala,
                "FINALIZADA"
            );

            await finalizarPartida(
                sala.idPartida,
                vencedor.idJogador,
                statusResultado,
                placarHost,
                placarVisitante
            );

            await registrarVitoriaDerrota(
                vencedor.idJogador,
                jogadorDesconectado.idJogador
            );
        } catch (erro) {
            console.error(
                "Erro ao registrar W.O. no banco:",
                erro
            );
        }

        // Informa o resultado
        enviarParaSala(sala, {
            type: "GAME_OVER",
            result: "WO",
            winner: vencedor.symbol,
            winnerName: vencedor.name,
            disconnectedPlayer: jogadorDesconectado.name,
            score: obterPlacar(sala)
        });

        // Atualiza o placar
        enviarParaSala(sala, {
            type: "SCORE_UPDATE",
            score: obterPlacar(sala)
        });

        console.log(
            `${vencedor.name} venceu por W.O. ` +
            `após a saída de ${jogadorDesconectado.name}.`
        );
    }

    // Exporta as funções do serviço
    return {
        tratarDesconexao,
        sairVoluntariamente,
        reconectarJogador,
        finalizarPorWO
    };
}

module.exports = {
    criarServicoConexao
};
