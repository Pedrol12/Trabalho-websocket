
 // Cria o serviço de conexão WebSocket
export function criarServicoSocket({
    aoAbrir,
    aoMensagem,
    aoErro,
    aoFechar
}) {
    let socket = null;
    let timerReconexao = null;
    let tentativaReconexao = 0;
    let saindoDoJogo = false;

    // Verifica se a conexão está aberta
    function socketEstaAberto() {
        return socket?.readyState === WebSocket.OPEN;
    }

    // Envia mensagens ao servidor
    function enviarMensagem(dados) {
        if (!socketEstaAberto()) {
            return false;
        }

        socket.send(JSON.stringify(dados));
        return true;
    }

    // Abre a conexão WebSocket
    function conectar() {
        if (saindoDoJogo) {
            return;
        }

        clearTimeout(timerReconexao);

        const protocolo = window.location.protocol === "https:"
            ? "wss:"
            : "ws:";

        const conexao = new WebSocket(
            `${protocolo}//${window.location.host}`
        );

        socket = conexao;

        conexao.onopen = () => {
            if (saindoDoJogo) {
                conexao.close();
                return;
            }

            tentativaReconexao = 0;
            aoAbrir?.();
        };

        conexao.onmessage = (event) => {
            if (conexao !== socket || saindoDoJogo) {
                return;
            }

            aoMensagem?.(event);
        };

        conexao.onerror = (erro) => {
            aoErro?.(erro);
        };

        conexao.onclose = () => {
            if (saindoDoJogo || conexao !== socket) {
                return;
            }

            aoFechar?.();

            // Tenta reconectar após 1,5 segundo
            tentativaReconexao++;

            timerReconexao = setTimeout(() => {
                conectar();
            }, 1500);
        };
    }

    // Encerra a conexão voluntariamente
    function desconectar() {
        saindoDoJogo = true;

        clearTimeout(timerReconexao);

        if (
            socket &&
            (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            )
        ) {
            socket.close();
        }
    }

    // Consulta o estado da conexão
    function obterSocket() {
        return socket;
    }

    return {
        conectar,
        desconectar,
        enviarMensagem,
        socketEstaAberto,
        obterSocket
    };
}
