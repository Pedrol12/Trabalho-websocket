
const $ = (id) => document.getElementById(id);

// Exibe o resultado da partida
export function mostrarFimDeJogo(mensagem, meuSimbolo) {
    if (mensagem.result === "WIN") {
        $("fim-titulo").textContent =
            mensagem.winner === meuSimbolo
                ? "Você venceu!"
                : "Você perdeu";

        $("fim-detalhe").textContent =
            `Fim de jogo! ${mensagem.winnerName} venceu com ${mensagem.winner}.`;
    } else if (mensagem.result === "WO") {
        $("fim-titulo").textContent =
            mensagem.winner === meuSimbolo
                ? "Você venceu!"
                : "Você perdeu";

        $("fim-detalhe").textContent =
            `Fim de jogo! ${mensagem.winnerName} venceu por W.O. ` +
            `(${mensagem.disconnectedPlayer} desconectou).`;
    } else {
        $("fim-titulo").textContent = "Empate";
        $("fim-detalhe").textContent = "Fim de jogo! Deu velha.";
    }

    $("fim-revanche").textContent = "";
    $("btn-jogar-novamente").disabled = false;
    $("modal-fim").hidden = false;
}

// Exibe o pedido de revanche
export function mostrarPedidoRevanche(quemPediu, meuNome) {
    $("fim-revanche").textContent =
        quemPediu === meuNome
            ? "Aguardando o outro jogador aceitar..."
            : `${quemPediu} quer jogar de novo. ` +
              `Clique em "Jogar de novo" para aceitar.`;
}

// Avisa quando outro jogador sai
export function mostrarJogadorSaiu(mensagem) {
    $("fim-titulo").textContent = "Jogador saiu da sala";
    $("fim-detalhe").textContent =
        mensagem.message || `${mensagem.playerName} saiu da sala.`;

    $("fim-revanche").textContent =
        "Não é possível iniciar uma revanche.";

    $("btn-jogar-novamente").disabled = true;
    $("modal-fim").hidden = false;
    $("aviso-desconexao").hidden = true;
}

// Configura o botão de revanche
export function configurarRevanche({
    socketEstaAberto,
    enviarMensagem
}) {
    $("btn-jogar-novamente").addEventListener("click", () => {
        if (!socketEstaAberto()) {
            $("fim-revanche").textContent =
                "Sem conexão com o servidor.";
            return;
        }

        const enviado = enviarMensagem({
            type: "NEW_GAME"
        });

        if (enviado) {
            $("btn-jogar-novamente").disabled = true;
        }
    });
}

// Configura a saída voluntária
export function configurarSaida({
    enviarMensagem,
    desconectar
}) {
    let aguardandoSaida = false;
    let timerSaida = null;

    // Retorna ao lobby
    function voltarAoLobby() {
        clearTimeout(timerSaida);
        desconectar();

        sessionStorage.removeItem("roomCode");
        sessionStorage.removeItem("playerName");

        window.location.href = "/lobby.html";
    }

    // Solicita a saída ao servidor
    function sairDoJogo() {
        if (aguardandoSaida) {
            return;
        }

        aguardandoSaida = true;

        const enviado = enviarMensagem({
            type: "LEAVE_ROOM"
        });

        if (!enviado) {
            voltarAoLobby();
            return;
        }

        // Evita ficar preso esperando confirmação
        timerSaida = setTimeout(voltarAoLobby, 3000);
    }

    // Confirma a saída
    function confirmarSaida() {
        if (!aguardandoSaida) {
            return;
        }

        voltarAoLobby();
    }

    $("btn-voltar").addEventListener("click", sairDoJogo);
    $("btn-sair-jogo").addEventListener("click", sairDoJogo);

    return {
        confirmarSaida
    };
}
