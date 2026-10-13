
const $ = (id) => document.getElementById(id);

// Monta os dados dos jogadores na arena
export function montarArena(players, board, turno, score, estado) {
    $("nome-x").textContent = "-";
    $("nome-o").textContent = "-";

    players.forEach((jogador) => {
        if (jogador.symbol === "X") {
            $("nome-x").textContent = jogador.name;
        }

        if (jogador.symbol === "O") {
            $("nome-o").textContent = jogador.name;
        }
    });

    $("arena-codigo").textContent = estado.codigoDaSala;
    $("arena-simbolo").textContent = estado.meuSimbolo || "-";
    $("msg-arena").textContent = "";
    $("aviso-desconexao").hidden = true;

    if (Array.isArray(score) && score.length) {
        estado.atualizarPlacar(score);
    }

    atualizarTabuleiro(board, turno, estado.meuSimbolo);
}

// Atualiza o tabuleiro e o indicador de turno
export function atualizarTabuleiro(board, nextTurn, meuSimbolo) {
    if (!Array.isArray(board)) {
        return;
    }

    document.querySelectorAll(".celula").forEach((celula, i) => {
        const valor = board[i] || "";

        celula.textContent = valor;
        celula.classList.toggle("x", valor === "X");
        celula.classList.toggle("o", valor === "O");
    });

    const indicador = $("indicador-turno");
    indicador.classList.remove("minha-vez");

    if (nextTurn === null) {
        indicador.textContent = "Fim de jogo";
        $("cronometro").textContent = "";
    } else if (nextTurn === meuSimbolo) {
        indicador.textContent = `Sua vez (${nextTurn})`;
        indicador.classList.add("minha-vez");
    } else if (nextTurn) {
        indicador.textContent = `Vez do oponente (${nextTurn})`;
    } else {
        indicador.textContent = "Aguardando...";
    }

    $("msg-arena").textContent = "";
}

let timerErro = null;

// Exibe uma jogada inválida
export function mostrarJogadaInvalida(texto) {
    $("msg-arena").textContent = texto || "Jogada inválida.";

    const tabuleiro = $("tabuleiro");
    tabuleiro.classList.remove("tremer");

    void tabuleiro.offsetWidth;
    tabuleiro.classList.add("tremer");

    clearTimeout(timerErro);

    timerErro = setTimeout(() => {
        $("msg-arena").textContent = "";
    }, 3000);
}

// Configura os cliques nas células
export function configurarJogadas({
    socketEstaAberto,
    partidaEstaAtiva,
    enviarMensagem
}) {
    document.querySelectorAll(".celula").forEach((celula) => {
        celula.addEventListener("click", () => {
            if (!socketEstaAberto()) {
                mostrarJogadaInvalida("Sem conexão com o servidor.");
                return;
            }

            if (!partidaEstaAtiva()) {
                mostrarJogadaInvalida("A partida ainda não começou.");
                return;
            }

            enviarMensagem({
                type: "MOVE",
                position: Number(celula.dataset.pos)
            });
        });
    });
}
