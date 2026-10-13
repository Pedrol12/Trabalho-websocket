
const { WebSocket } = require("ws");

// Cria o serviço de entrada e criação de salas
function criarServicoEntradaSalas({
    rooms,
    enviar,
    enviarParaSala,
    gerarCodigoSala,
    criarEstruturaSala,
    buscarOuRecuperarSala,
    reconectarJogador,
    broadcastListaSalasPublicas,
    obterPlacar,
    obterPlacarHostVisitante,
    iniciarCronometroTurno,
    buscarOuCriarJogador,
    codigoSalaExiste,
    criarSalaBanco,
    adicionarVisitanteSala,
    atualizarStatusSala,
    criarPartida
}) {

    // Processa a entrada ou criação de uma sala
    async function entrarNaSala(ws, mensagem) {
        const playerName = String(
            mensagem.playerName || ""
        ).trim();

        let roomCode = mensagem.roomCode;

        // Valida o nome do jogador
        if (!playerName) {
            enviar(ws, {
                type: "ERROR",
                message: "Nome do jogador é obrigatório."
            });
            return;
        }

        try {
            let sala;
            let jogadorBanco;

            // Cria uma nova sala
            if (!roomCode) {
                jogadorBanco = await buscarOuCriarJogador(
                    playerName
                );

                const privada = mensagem.private !== false;
                let codigoJaExiste;

                // Gera um código que ainda não foi utilizado
                do {
                    roomCode = gerarCodigoSala();

                    codigoJaExiste =
                        rooms.has(roomCode) ||
                        await codigoSalaExiste(roomCode);

                } while (codigoJaExiste);

                // Registra a sala no banco
                const idSala = await criarSalaBanco(
                    roomCode,
                    jogadorBanco.id_jogador,
                    privada
                );

                // Cria a sala na memória
                sala = criarEstruturaSala({
                    idSala,
                    roomCode,
                    privada,
                    hostId: jogadorBanco.id_jogador,
                    hostName: playerName
                });

                rooms.set(roomCode, sala);

                console.log(
                    `Sala ${roomCode} criada no banco com ID ${idSala}. ` +
                    `Privada: ${privada}`
                );

            } else {

                // Normaliza o código da sala
                roomCode = String(roomCode)
                    .trim()
                    .toUpperCase();

                // Busca a sala existente
                sala = await buscarOuRecuperarSala(
                    roomCode
                );

                if (!sala) {
                    enviar(ws, {
                        type: "ROOM_NOT_FOUND",
                        message:
                            "Sala não encontrada ou não está disponível para entrada."
                    });
                    return;
                }

                // Verifica se o jogador já pertence à sala
                const jogadorExistente = sala.players.find(
                    player => player.name === playerName
                );

                if (jogadorExistente) {
                    const socketAntigo =
                        jogadorExistente.socket;

                    // Substitui a conexão anterior
                    reconectarJogador(
                        ws,
                        sala,
                        jogadorExistente
                    );

                    // Encerra o WebSocket antigo
                    if (
                        socketAntigo &&
                        socketAntigo !== ws &&
                        (
                            socketAntigo.readyState === WebSocket.OPEN ||
                            socketAntigo.readyState === WebSocket.CONNECTING
                        )
                    ) {
                        try {
                            socketAntigo.close(
                                1000,
                                "Conexao substituida pela pagina do jogo"
                            );
                        } catch (erro) {
                            console.log(
                                "Socket antigo já estava encerrado."
                            );
                        }
                    }

                    return;
                }

                // Verifica se o host da sala privada está presente
                if (
                    sala.private &&
                    sala.hostName &&
                    playerName !== sala.hostName
                ) {
                    const hostNaSala = sala.players.find(
                        player =>
                            player.name === sala.hostName ||
                            player.idJogador === sala.hostId
                    );

                    if (!hostNaSala || !hostNaSala.connected) {
                        enviar(ws, {
                            type: "ROOM_HOST_REQUIRED",
                            message:
                                "Aguarde o host entrar na sala primeiro."
                        });
                        return;
                    }
                }

                // Impede a entrada de um terceiro jogador
                if (sala.players.length >= 2) {
                    enviar(ws, {
                        type: "ROOM_FULL",
                        message:
                            "A sala já possui dois jogadores."
                    });
                    return;
                }

                jogadorBanco = await buscarOuCriarJogador(
                    playerName
                );
            }

            // Define o símbolo do jogador
            const simbolo =
                sala.players.length === 0 ? "X" : "O";

            // Cria os dados do jogador
            const jogador = {
                idJogador: jogadorBanco.id_jogador,
                name: playerName,
                symbol: simbolo,
                socket: ws,
                score: 0,
                connected: true,
                disconnectTimer: null
            };

            // Define o host da sala
            if (sala.players.length === 0) {
                sala.hostId = jogadorBanco.id_jogador;
                sala.hostName = playerName;
            }

            // Registra o visitante no banco
            if (sala.players.length === 1) {
                await adicionarVisitanteSala(
                    sala.idSala,
                    jogadorBanco.id_jogador
                );
            }

            // Adiciona o jogador à sala
            sala.players.push(jogador);

            // Associa a conexão à sala
            ws.roomCode = roomCode;
            ws.playerName = playerName;
            ws.playerSymbol = simbolo;
            ws.playerId = jogadorBanco.id_jogador;

            // Confirma a entrada na sala
            enviar(ws, {
                type: "ROOM_JOINED",
                roomCode,
                playerName,
                playerSymbol: simbolo,
                private: sala.private
            });

            console.log(
                `${playerName} entrou na sala ${roomCode} como ${simbolo}`
            );

            // Atualiza a lista de salas públicas
            broadcastListaSalasPublicas();

            // Inicia a partida quando houver dois jogadores
            if (sala.players.length === 2) {
                sala.status = "PLAYING";

                await atualizarStatusSala(
                    sala.idSala,
                    "EM_JOGO"
                );

                const {
                    placarHost,
                    placarVisitante
                } = obterPlacarHostVisitante(sala);

                // Registra a partida no banco
                sala.idPartida = await criarPartida(
                    sala.idSala,
                    sala.currentTurn,
                    placarHost,
                    placarVisitante
                );

                console.log(
                    `Partida ${sala.idPartida} criada no banco.`
                );

                // Informa que a partida começou
                enviarParaSala(sala, {
                    type: "GAME_STARTED",
                    roomCode,
                    currentTurn: sala.currentTurn,
                    players: sala.players.map(player => ({
                        name: player.name,
                        symbol: player.symbol
                    })),
                    score: obterPlacar(sala)
                });

                console.log(
                    `Partida iniciada na sala ${roomCode}`
                );

                broadcastListaSalasPublicas();

                // Inicia o cronômetro da primeira jogada
                iniciarCronometroTurno(sala);
            }

        } catch (erro) {
            console.error(
                "Erro ao registrar jogador/sala/partida no banco:",
                erro
            );

            enviar(ws, {
                type: "DATABASE_ERROR",
                message:
                    "Não foi possível registrar os dados no banco."
            });
        }
    }

    // Disponibiliza a função do serviço
    return {
        entrarNaSala
    };
}

// Exporta o módulo
module.exports = {
    criarServicoEntradaSalas
};
