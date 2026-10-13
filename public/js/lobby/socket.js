
 // Verifica se o WebSocket está aberto
export function socketEstaAberto(socket) {
    return socket?.readyState === WebSocket.OPEN;
}

// Envia mensagens ao servidor
export function enviarMensagem(socket, dados) {
    if (!socketEstaAberto(socket)) {
        return false;
    }

    socket.send(JSON.stringify(dados));
    return true;
}

// Cria a conexão WebSocket
export function criarSocketLobby({
    aoAbrir,
    aoMensagem,
    aoErro,
    aoFechar
}) {
    const protocolo = window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    const socket = new WebSocket(
        `${protocolo}//${window.location.host}`
    );

    // Configura os eventos da conexão
    socket.onopen = () => {
        console.log("WebSocket do lobby conectado.");
        aoAbrir?.(socket);
    };

    socket.onmessage = (event) => {
        aoMensagem?.(event);
    };

    socket.onerror = (erro) => {
        console.error("Erro WebSocket:", erro);
        aoErro?.(erro);
    };

    socket.onclose = () => {
        aoFechar?.();
    };

    return socket;
}
