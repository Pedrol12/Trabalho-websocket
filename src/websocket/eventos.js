
 // Cria o serviço responsável pelos eventos WebSocket
function criarEventosWebSocket({
    wss,
    enviar,
    enviarListaSalasPublicas,
    entrarNaSala,
    executarJogada,
    enviarMensagemChat,
    solicitarRevanche,
    tratarDesconexao
}) {

    // Configura a conexão dos jogadores
    function configurarEventos() {

        wss.on("connection", (ws) => {

            console.log(
                "Novo jogador conectado via WebSocket!"
            );

            // Inicializa os dados da conexão
            ws.roomCode = null;
            ws.playerName = null;
            ws.playerSymbol = null;
            ws.playerId = null;

            // Confirma a conexão com o servidor
            enviar(ws, {
                type: "CONNECTED",
                message: "Conectado ao servidor WebSocket!"
            });

            // Envia a lista inicial de salas públicas
            enviarListaSalasPublicas(ws);

            // Recebe e processa mensagens dos jogadores
            ws.on("message", async (data) => {
                try {
                    const mensagem = JSON.parse(
                        data.toString()
                    );

                    console.log(
                        "Mensagem recebida:",
                        mensagem
                    );

                    // Direciona a mensagem para o serviço correto
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

                        default:
                            enviar(ws, {
                                type: "ERROR",
                                message:
                                    "Tipo de mensagem desconhecido."
                            });
                    }

                } catch (erro) {
                    console.error(
                        "Erro ao processar mensagem:",
                        erro
                    );

                    enviar(ws, {
                        type: "ERROR",
                        message:
                            "Não foi possível processar a mensagem."
                    });
                }
            });

            // Trata a desconexão dos jogadores
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

    // Disponibiliza a configuração dos eventos
    return {
        configurarEventos
    };
}

// Exporta o módulo
module.exports = {
    criarEventosWebSocket
};
