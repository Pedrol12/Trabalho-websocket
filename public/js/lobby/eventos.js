
const $ = (id) => document.getElementById(id);

// Cria o tratamento dos eventos WebSocket
export function criarTratadorEventosLobby({
    renderizarSalasPublicas,
    mostrarSalaEntrou,
    guardarSala,
    liberarBotoesLobby
}) {
    // Processa as mensagens recebidas
    return function tratarMensagemServidor(event) {
        let mensagem;

        try {
            mensagem = JSON.parse(event.data);
        } catch (erro) {
            console.error("Mensagem WebSocket inválida:", erro);
            return;
        }

        console.log("Servidor:", mensagem);

        switch (mensagem.type) {
            // Confirma a conexão
            case "CONNECTED":
                break;

            // Atualiza a lista de salas públicas
            case "ROOM_LIST_UPDATE":
                renderizarSalasPublicas(mensagem.rooms || []);
                break;

            // Confirma a entrada na sala
            case "ROOM_JOINED":
                mostrarSalaEntrou(mensagem.roomCode);
                break;

            // Recupera uma sala existente
            case "ROOM_RECONNECTED":
                guardarSala(mensagem.roomCode);

                if (mensagem.status === "PLAYING") {
                    window.location.href = "/jogo.html";
                    return;
                }

                mostrarSalaEntrou(mensagem.roomCode);
                break;

            // Trata sala não encontrada
            case "ROOM_NOT_FOUND":
                $("msg-lobby").textContent =
                    mensagem.message ||
                    "Sala não encontrada. Confira o código.";

                liberarBotoesLobby();
                break;

            // Trata sala cheia
            case "ROOM_FULL":
                $("msg-lobby").textContent =
                    mensagem.message ||
                    "Essa sala já está cheia.";

                liberarBotoesLobby();
                break;

            // Aguarda o host da sala
            case "ROOM_HOST_REQUIRED":
                $("msg-lobby").textContent =
                    mensagem.message ||
                    "Aguarde o host entrar na sala primeiro.";

                liberarBotoesLobby();
                break;

            // Trata erros do servidor
            case "ERROR":
            case "DATABASE_ERROR":
                $("msg-lobby").textContent =
                    mensagem.message || "Ocorreu um erro.";

                liberarBotoesLobby();
                break;

            // Abre a página da partida
            case "GAME_STARTED":
                if (mensagem.roomCode) {
                    guardarSala(mensagem.roomCode);
                }

                window.location.href = "/jogo.html";
                break;

            default:
                console.log(
                    "Evento não tratado no lobby:",
                    mensagem.type
                );
        }
    };
}
