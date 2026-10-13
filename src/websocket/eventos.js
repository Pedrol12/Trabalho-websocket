
 // Cria os eventos do WebSocket
function criarEventosWebSocket({
    wss,
    enviar,
    enviarListaSalasPublicas,
    entrarNaSala,
    executarJogada,
    enviarMensagemChat,
    solicitarRevanche,
    tratarDesconexao,
    sairVoluntariamente
}) {
    // Configura a conexão dos jogadores
    function configurarEventos() {
        wss.on("connection", (ws) => {
            console.log("Novo jogador conectado via WebSocket!");

            // Inicializa os dados do jogador
            ws.roomCode = null;
            ws.playerName = null;
            ws.playerSymbol = null;
            ws.playerId = null;

            enviar(ws, {
                type: "CONNECTED",
                message: "Conectado ao servidor WebSocket!"
            });

            enviarListaSalasPublicas(ws);

            // Processa as mensagens recebidas
            ws.on("message", async (data) => {
                try {
                    const mensagem = JSON.parse(data.toString());

                    console.log("Mensagem recebida:", mensagem);

                    switch (mensagem.type) {
                        case "JOIN_ROOM":
                            await entrarNaSala(ws, mensagem);
                            break;

                        case "LIST_ROOMS":
                            enviarListaSalasPublicas(ws);
                            break;

                        case "MOVE":
                            await executarJogada(ws, mensagem);
                            break;

                        case "CHAT":
                            await enviarMensagemChat(ws, mensagem);
                            break;

                        case "NEW_GAME":
                            await solicitarRevanche(ws);
                            break;

                        // Trata a saída voluntária
                        case "LEAVE_ROOM":
                            await sairVoluntariamente(ws);
                            break;

                        default:
                            enviar(ws, {
                                type: "ERROR",
                                message: "Tipo de mensagem desconhecido."
                            });
                    }
                } catch (erro) {
                    console.error(
                        "Erro ao processar mensagem:",
                        erro
                    );

                    enviar(ws, {
                        type: "ERROR",
                        message: "Não foi possível processar a mensagem."
                    });
                }
            });

            // Trata a queda de conexão
            ws.on("close", () => {
                tratarDesconexao(ws).catch((erro) => {
                    console.error(
                        "Erro ao tratar desconexão:",
                        erro
                    );
                });
            });
        });
    }

    return {
        configurarEventos
    };
}

// Exporta o módulo
module.exports = {
    criarEventosWebSocket
};
