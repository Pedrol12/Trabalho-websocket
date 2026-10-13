// Importa a biblioteca WebSocket
const { WebSocket } = require("ws");

// Envia mensagem para um jogador
function enviar(ws, dados) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(dados));
    }
}

// Envia mensagem para todos os jogadores da sala
function enviarParaSala(sala, dados) {
    for (const jogador of sala.players) {

        // Verifica se o jogador está conectado
        if (jogador.connected && jogador.socket) {
            enviar(jogador.socket, dados);
        }
    }
}

// Exporta as funções do módulo
module.exports = {
    enviar,
    enviarParaSala
};