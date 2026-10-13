
 // Cria o serviço responsável pelo chat
function criarServicoChat({
    rooms,
    enviar,
    enviarParaSala,
    registrarMensagemChat
}) {

    // Recebe e processa a mensagem enviada pelo jogador
    async function enviarMensagemChat(ws, mensagem) {
        const roomCode = ws.roomCode;

        // Verifica se o jogador está em uma sala
        if (!roomCode) {
            enviar(ws, {
                type: "CHAT_ERROR",
                message: "Você não está em uma sala."
            });

            return;
        }

        const sala = rooms.get(roomCode);

        // Verifica se a sala existe
        if (!sala) {
            enviar(ws, {
                type: "CHAT_ERROR",
                message: "Sala não encontrada."
            });

            return;
        }

        const texto = String(mensagem.message || "").trim();

        // Verifica se a mensagem está vazia
        if (!texto) {
            enviar(ws, {
                type: "CHAT_ERROR",
                message: "A mensagem não pode estar vazia."
            });

            return;
        }

        // Salva a mensagem no banco de dados
        try {
            await registrarMensagemChat(
                sala.idSala,
                ws.playerId,
                texto
            );
        } catch (erro) {
            console.error(
                "Erro ao registrar mensagem no banco:",
                erro
            );

            enviar(ws, {
                type: "CHAT_ERROR",
                message: "Não foi possível salvar a mensagem."
            });

            return;
        }

        // Envia a mensagem para os jogadores da sala
        enviarParaSala(sala, {
            type: "CHAT_MESSAGE",
            playerName: ws.playerName,
            playerSymbol: ws.playerSymbol,
            message: texto
        });

        console.log(
            `[CHAT ${roomCode}] ${ws.playerName}: ${texto}`
        );
    }

    // Disponibiliza a função do serviço
    return {
        enviarMensagemChat
    };
}

// Exporta o módulo
module.exports = {
    criarServicoChat
};
