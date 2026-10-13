
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
    async function tratarDesconexao(ws) {
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
            `${jogador.name} desconectou da sala ${roomCode}`
        );

        // Mantém salas privadas aguardando reconexão
        if (sala.status === "WAITING") {
            if (sala.private) {
                console.log(
                    `Sala privada ${roomCode} permanece ` +
                    `persistida aguardando reconexão.`
                );
                return;
            }

            // Remove salas públicas sem partida iniciada
            rooms.delete(roomCode);

            try {
                await removerSalaBanco(sala.idSala);

                console.log(
                    `Sala pública ${roomCode} removida do banco.`
                );
            } catch (erro) {
                console.error(
                    "Erro ao remover sala pública do banco:",
                    erro.message
                );
            }

            broadcastListaSalasPublicas();
            return;
        }

        if (sala.status !== "PLAYING") {
            return;
        }

        // Pausa o cronômetro da partida
        cancelarCronometroTurno(sala);

        // Avisa os jogadores sobre a desconexão
        enviarParaSala(sala, {
            type: "PLAYER_DISCONNECTED",
            playerName: jogador.name,
            playerSymbol: jogador.symbol,
            reconnectSeconds: tempoReconexaoMs / 1000,
            message:
                `${jogador.name} desconectou. ` +
                `Aguardando reconexão por ${tempoReconexaoMs / 1000} segundos.`
        });

        // Aguarda a reconexão antes de aplicar W.O.
        jogador.disconnectTimer = setTimeout(() => {
            finalizarPorWO(sala, jogador).catch(erro => {
                console.error(
                    "Erro ao finalizar por W.O.:",
                    erro
                );
            });
        }, tempoReconexaoMs);
    }

    // Restaura a conexão de um jogador
    function reconectarJogador(ws, sala, jogador) {

        // Cancela o prazo de desconexão
        if (jogador.disconnectTimer) {
            clearTimeout(jogador.disconnectTimer);
            jogador.disconnectTimer = null;
        }

        // Atualiza a conexão do jogador
        jogador.socket = ws;
        jogador.connected = true;

        ws.roomCode = sala.code;
        ws.playerName = jogador.name;
        ws.playerSymbol = jogador.symbol;
        ws.playerId = jogador.idJogador;

        // Envia o estado atual da sala ao jogador
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

        // Avisa a sala que o jogador voltou
        enviarParaSala(sala, {
            type: "PLAYER_RECONNECTED",
            playerName: jogador.name,
            playerSymbol: jogador.symbol,
            message:
                `${jogador.name} reconectou à partida.`
        });

        console.log(
            `${jogador.name} reconectou na sala ${sala.code}`
        );

        // Reinicia o cronômetro caso a partida esteja ativa
        if (sala.status === "PLAYING") {
            iniciarCronometroTurno(sala);
        }
    }

    // Finaliza a partida por W.O.
    async function finalizarPorWO(sala, jogadorDesconectado) {
        jogadorDesconectado.disconnectTimer = null;

        // Cancela o W.O. se o jogador voltou
        if (jogadorDesconectado.connected) {
            return;
        }

        if (sala.status !== "PLAYING") {
            return;
        }

        cancelarCronometroTurno(sala);

        // Procura o jogador que permaneceu conectado
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
                `Partida da sala ${sala.code} encerrada sem vencedor.`
            );
            return;
        }

        // Atualiza o placar do vencedor
        vencedor.score++;

        const {
            placarHost,
            placarVisitante
        } = obterPlacarHostVisitante(sala);

        const statusResultado =
            vencedor === sala.players[0]
                ? "VITORIA_HOST"
                : "VITORIA_VISITANTE";

        // Registra o W.O. no banco
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

        // Informa o resultado da partida
        enviarParaSala(sala, {
            type: "GAME_OVER",
            result: "WO",
            winner: vencedor.symbol,
            winnerName: vencedor.name,
            disconnectedPlayer: jogadorDesconectado.name,
            score: obterPlacar(sala)
        });

        // Atualiza o placar dos jogadores
        enviarParaSala(sala, {
            type: "SCORE_UPDATE",
            score: obterPlacar(sala)
        });

        console.log(
            `${vencedor.name} venceu por W.O. após desconexão ` +
            `de ${jogadorDesconectado.name}.`
        );
    }

    // Disponibiliza as funções do serviço
    return {
        tratarDesconexao,
        reconectarJogador,
        finalizarPorWO
    };
}

// Exporta o módulo
module.exports = {
    criarServicoConexao
};
