// ======================================================
// JOGO
// ======================================================

// O código da sala veio do lobby.
const codigoDaSala =
  sessionStorage.getItem(
    "roomCode"
  );

// O nome será confirmado através
// da sessão HTTP.
let meuNome =
  null;

let meuSimbolo =
  null;

let socket =
  null;

let partidaAtiva =
  false;

// Evita reconectar quando o jogador
// clicou em sair voluntariamente.
let saindoDoJogo =
  false;

// Controle de reconexão WebSocket
let tentativaReconexao =
  0;

let timerReconexao =
  null;

// Controle para ROOM_HOST_REQUIRED
let tentativasHost =
  0;

const MAX_TENTATIVAS_HOST =
  10;

const $ =
  (id) =>
    document.getElementById(
      id
    );

const celulas =
  document.querySelectorAll(
    ".celula"
  );

// ======================================================
// SEM SALA
// ======================================================

if (
  !codigoDaSala
) {

  window.location.href =
    "/lobby.html";
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function verificarUsuario() {

  try {

    const resposta =
      await fetch(
        "/api/auth/me",
        {
          credentials:
            "include"
        }
      );

    if (!resposta.ok) {

      window.location.href =
        "/login.html";

      return null;
    }

    const dados =
      await resposta.json();

    return dados.usuario;

  } catch (erro) {

    console.error(
      "Erro ao verificar sessão:",
      erro
    );

    window.location.href =
      "/login.html";

    return null;
  }
}

// ======================================================
// SOCKET ABERTO?
// ======================================================

function socketEstaAberto() {

  return (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
  );
}

// ======================================================
// JOIN_ROOM
// ======================================================

function enviarEntradaNaSala() {

  if (
    !socketEstaAberto() ||
    !meuNome ||
    !codigoDaSala
  ) {

    return;
  }

  socket.send(
    JSON.stringify({
      type:
        "JOIN_ROOM",

      playerName:
        meuNome,

      roomCode:
        codigoDaSala
    })
  );
}

// ======================================================
// CONECTAR WEBSOCKET
// ======================================================

function conectarWebSocket() {

  if (
    saindoDoJogo
  ) {

    return;
  }

  clearTimeout(
    timerReconexao
  );

  socket =
    new WebSocket(
      "ws://localhost:3000"
    );

  socket.onopen =
    () => {

      console.log(
        "WebSocket conectado."
      );

      tentativaReconexao =
        0;

      $("status-conexao")
        .textContent =
          "Conectado";

      enviarEntradaNaSala();
    };

  socket.onerror =
    (erro) => {

      console.error(
        "Erro WebSocket:",
        erro
      );
    };

  socket.onclose =
    () => {

      if (
        saindoDoJogo
      ) {

        return;
      }

      $("status-conexao")
        .textContent =
          "Reconectando...";

      tentativaReconexao++;

      // Tenta novamente rapidamente,
      // ficando dentro dos 30s do backend.
      timerReconexao =
        setTimeout(
          () => {

            conectarWebSocket();

          },
          1500
        );
    };

  socket.onmessage =
    tratarMensagemServidor;
}

// ======================================================
// MENSAGENS DO SERVIDOR
// ======================================================

function tratarMensagemServidor(
  event
) {

  const mensagem =
    JSON.parse(
      event.data
    );

  console.log(
    "Servidor:",
    mensagem
  );

  switch (
    mensagem.type
  ) {

    // ==============================================
    // CONECTADO
    // ==============================================

    case "CONNECTED":

      break;

    // ==============================================
    // PRIMEIRA ENTRADA
    // ==============================================

    case "ROOM_JOINED":

      meuSimbolo =
        mensagem.playerSymbol;

      partidaAtiva =
        false;

      $("arena-codigo")
        .textContent =
          codigoDaSala;

      $("arena-simbolo")
        .textContent =
          meuSimbolo;

      $("msg-arena")
        .textContent =
          "Aguardando o outro jogador...";

      break;

    // ==============================================
    // RECONEXÃO / TROCA DO SOCKET DO LOBBY
    // ==============================================

    case "ROOM_RECONNECTED":

      tentativasHost =
        0;

      meuSimbolo =
        mensagem.playerSymbol;

      partidaAtiva =
        mensagem.status ===
        "PLAYING";

      montarArena(
        mensagem.players ||
        [],

        mensagem.board ||
        [
          "", "", "",
          "", "", "",
          "", "", ""
        ],

        mensagem.currentTurn,

        mensagem.score ||
        []
      );

      if (
        mensagem.status ===
        "FINISHED"
      ) {

        $("indicador-turno")
          .textContent =
            "Fim de jogo";
      }

      break;

    // ==============================================
    // HOST AINDA NÃO ENTROU
    // ==============================================

    case "ROOM_HOST_REQUIRED":

      partidaAtiva =
        false;

      $("msg-arena")
        .textContent =
          mensagem.message ||
          "Aguardando o host entrar na sala...";

      // Pode acontecer durante uma corrida de
      // milissegundos entre lobby e jogo.
      //
      // Tenta novamente automaticamente.
      if (
        tentativasHost <
        MAX_TENTATIVAS_HOST
      ) {

        tentativasHost++;

        setTimeout(
          () => {

            enviarEntradaNaSala();

          },
          1000
        );
      }

      break;

    // ==============================================
    // ERROS DE SALA
    // ==============================================

    case "ROOM_NOT_FOUND":

    case "ROOM_FULL":

    case "ERROR":

    case "DATABASE_ERROR":

      partidaAtiva =
        false;

      $("msg-arena")
        .textContent =
          mensagem.message ||
          "Não foi possível entrar na sala.";

      break;

    // ==============================================
    // PARTIDA COMEÇOU
    // ==============================================

    case "GAME_STARTED":

      tentativasHost =
        0;

      partidaAtiva =
        true;

      meuSimbolo =
        mensagem.players
          ?.find(
            (jogador) =>
              jogador.name ===
              meuNome
          )
          ?.symbol ||
        meuSimbolo;

      montarArena(
        mensagem.players ||
        [],

        [
          "", "", "",
          "", "", "",
          "", "", ""
        ],

        mensagem.currentTurn,

        mensagem.score ||
        []
      );

      break;

    // ==============================================
    // TABULEIRO
    // ==============================================

    case "BOARD_UPDATE":

      atualizarTabuleiro(
        mensagem.board,
        mensagem.nextTurn
      );

      break;

    // ==============================================
    // JOGADA INVÁLIDA
    // ==============================================

    case "INVALID_MOVE":

      mostrarJogadaInvalida(
        mensagem.message
      );

      break;

    // ==============================================
    // FIM DO JOGO
    // ==============================================

    case "GAME_OVER":

      partidaAtiva =
        false;

      mostrarFimDeJogo(
        mensagem
      );

      break;

    // ==============================================
    // PLACAR
    // ==============================================

    case "SCORE_UPDATE":

      atualizarPlacar(
        mensagem.score ||
        []
      );

      break;

    // ==============================================
    // REVANCHE
    // ==============================================

    case "REMATCH_REQUESTED":

      mostrarPedidoRevanche(
        mensagem.requestedBy
      );

      break;

    // ==============================================
    // NOVA PARTIDA
    // ==============================================

    case "NEW_GAME_STARTED":

      partidaAtiva =
        true;

      $("modal-fim")
        .hidden =
          true;

      meuSimbolo =
        mensagem.players
          ?.find(
            (jogador) =>
              jogador.name ===
              meuNome
          )
          ?.symbol ||
        meuSimbolo;

      montarArena(
        mensagem.players ||
        [],

        mensagem.board ||
        [
          "", "", "",
          "", "", "",
          "", "", ""
        ],

        mensagem.currentTurn,

        mensagem.score ||
        []
      );

      break;

    case "NEW_GAME_ERROR":

      $("fim-revanche")
        .textContent =
          mensagem.message;

      break;

    // ==============================================
    // CRONÔMETRO
    // ==============================================

    case "TURN_TIMER":

      $("cronometro")
        .textContent =
          `Tempo restante: ${mensagem.seconds}s`;

      break;

    case "TURN_TIMEOUT":

      $("cronometro")
        .textContent =
          "";

      $("msg-arena")
        .textContent =
          `Tempo do jogador ${mensagem.timedOutSymbol} esgotado.`;

      break;

    // ==============================================
    // CHAT
    // ==============================================

    case "CHAT_MESSAGE":

      adicionarMensagemChat(
        mensagem.playerName,
        mensagem.message,
        mensagem.playerSymbol
      );

      break;

    case "CHAT_ERROR":

      $("msg-arena")
        .textContent =
          mensagem.message;

      console.error(
        "Erro no chat:",
        mensagem.message
      );

      break;

    // ==============================================
    // DESCONEXÃO
    // ==============================================

    case "PLAYER_DISCONNECTED":

      $("aviso-desconexao")
        .textContent =
          mensagem.message;

      $("aviso-desconexao")
        .hidden =
          false;

      break;

    case "PLAYER_RECONNECTED":

      $("aviso-desconexao")
        .hidden =
          true;

      break;
  }
}

// ======================================================
// MONTAR ARENA
// ======================================================

function montarArena(
  players,
  board,
  turno,
  score
) {

  $("nome-x").textContent =
    "-";

  $("nome-o").textContent =
    "-";

  players.forEach(
    (jogador) => {

      if (
        jogador.symbol ===
        "X"
      ) {

        $("nome-x")
          .textContent =
            jogador.name;
      }

      if (
        jogador.symbol ===
        "O"
      ) {

        $("nome-o")
          .textContent =
            jogador.name;
      }
    }
  );

  $("arena-codigo")
    .textContent =
      codigoDaSala;

  $("arena-simbolo")
    .textContent =
      meuSimbolo ||
      "-";

  $("msg-arena")
    .textContent =
      "";

  $("aviso-desconexao")
    .hidden =
      true;

  if (
    score &&
    score.length
  ) {

    atualizarPlacar(
      score
    );
  }

  atualizarTabuleiro(
    board,
    turno
  );
}

// ======================================================
// CLIQUE NO TABULEIRO
// ======================================================

celulas.forEach(
  (celula) => {

    celula.addEventListener(
      "click",

      () => {

        if (
          !socketEstaAberto()
        ) {

          mostrarJogadaInvalida(
            "Sem conexão com o servidor."
          );

          return;
        }

        if (
          !partidaAtiva
        ) {

          mostrarJogadaInvalida(
            "A partida ainda não começou."
          );

          return;
        }

        socket.send(
          JSON.stringify({

            type:
              "MOVE",

            position:
              Number(
                celula.dataset.pos
              )
          })
        );
      }
    );
  }
);

// ======================================================
// TABULEIRO
// ======================================================

function atualizarTabuleiro(
  board,
  nextTurn
) {

  if (
    !Array.isArray(
      board
    )
  ) {

    return;
  }

  celulas.forEach(
    (celula, i) => {

      const valor =
        board[i] ||
        "";

      celula.textContent =
        valor;

      celula.classList.toggle(
        "x",
        valor === "X"
      );

      celula.classList.toggle(
        "o",
        valor === "O"
      );
    }
  );

  const indicador =
    $("indicador-turno");

  if (
    nextTurn ===
    null
  ) {

    indicador.textContent =
      "Fim de jogo";

    indicador.classList.remove(
      "minha-vez"
    );

    $("cronometro")
      .textContent =
        "";

  } else if (
    nextTurn ===
    meuSimbolo
  ) {

    indicador.textContent =
      `Sua vez (${nextTurn})`;

    indicador.classList.add(
      "minha-vez"
    );

  } else if (
    nextTurn
  ) {

    indicador.textContent =
      `Vez do oponente (${nextTurn})`;

    indicador.classList.remove(
      "minha-vez"
    );

  } else {

    indicador.textContent =
      "Aguardando...";

    indicador.classList.remove(
      "minha-vez"
    );
  }

  $("msg-arena")
    .textContent =
      "";
}

// ======================================================
// JOGADA INVÁLIDA
// ======================================================

let timerErro =
  null;

function mostrarJogadaInvalida(
  texto
) {

  $("msg-arena")
    .textContent =
      texto ||
      "Jogada inválida.";

  const tabuleiro =
    $("tabuleiro");

  tabuleiro.classList.remove(
    "tremer"
  );

  void tabuleiro.offsetWidth;

  tabuleiro.classList.add(
    "tremer"
  );

  clearTimeout(
    timerErro
  );

  timerErro =
    setTimeout(
      () => {

        $("msg-arena")
          .textContent =
            "";

      },
      3000
    );
}

// ======================================================
// PLACAR
// ======================================================

function atualizarPlacar(
  score
) {

  if (
    !Array.isArray(
      score
    )
  ) {

    return;
  }

  score.forEach(
    (jogador) => {

      if (
        jogador.symbol ===
        "X"
      ) {

        $("placar-x")
          .textContent =
            jogador.score;
      }

      if (
        jogador.symbol ===
        "O"
      ) {

        $("placar-o")
          .textContent =
            jogador.score;
      }
    }
  );
}

// ======================================================
// CHAT
// ======================================================

function adicionarMensagemChat(
  nome,
  texto,
  simbolo
) {

  const item =
    document.createElement(
      "li"
    );

  const nomeElemento =
    document.createElement(
      "strong"
    );

  nomeElemento.className =
    simbolo === "X"
      ? "x"
      : "o";

  nomeElemento.textContent =
    `${nome}:`;

  item.appendChild(
    nomeElemento
  );

  item.append(
    ` ${texto}`
  );

  $("chat-mensagens")
    .appendChild(
      item
    );

  $("chat-mensagens")
    .scrollTop =
      $("chat-mensagens")
        .scrollHeight;
}

$("form-chat")
  .addEventListener(
    "submit",

    (event) => {

      event.preventDefault();

      const texto =
        $("input-chat")
          .value
          .trim();

      if (!texto) {

        return;
      }

      if (
        !socketEstaAberto()
      ) {

        $("msg-arena")
          .textContent =
            "Sem conexão com o servidor.";

        return;
      }

      socket.send(
        JSON.stringify({

          type:
            "CHAT",

          message:
            texto
        })
      );

      $("input-chat")
        .value =
          "";
    }
  );

// ======================================================
// GAME OVER
// ======================================================

function mostrarFimDeJogo(
  mensagem
) {

  if (
    mensagem.result ===
    "WIN"
  ) {

    $("fim-titulo")
      .textContent =

        mensagem.winner ===
        meuSimbolo

          ? "Você venceu!"

          : "Você perdeu";

    $("fim-detalhe")
      .textContent =

        `Fim de jogo! ` +
        `${mensagem.winnerName} venceu com ` +
        `${mensagem.winner}.`;

  } else if (
    mensagem.result ===
    "WO"
  ) {

    $("fim-titulo")
      .textContent =

        mensagem.winner ===
        meuSimbolo

          ? "Você venceu!"

          : "Você perdeu";

    $("fim-detalhe")
      .textContent =

        `Fim de jogo! ` +
        `${mensagem.winnerName} venceu por W.O. ` +
        `(${mensagem.disconnectedPlayer} desconectou).`;

  } else {

    $("fim-titulo")
      .textContent =
        "Empate";

    $("fim-detalhe")
      .textContent =
        "Fim de jogo! Deu velha.";
  }

  if (
    mensagem.score
  ) {

    atualizarPlacar(
      mensagem.score
    );
  }

  $("fim-revanche")
    .textContent =
      "";

  $("btn-jogar-novamente")
    .disabled =
      false;

  $("modal-fim")
    .hidden =
      false;
}

// ======================================================
// REVANCHE
// ======================================================

$("btn-jogar-novamente")
  .addEventListener(
    "click",

    () => {

      if (
        !socketEstaAberto()
      ) {

        $("fim-revanche")
          .textContent =
            "Sem conexão com o servidor.";

        return;
      }

      socket.send(
        JSON.stringify({
          type:
            "NEW_GAME"
        })
      );

      $("btn-jogar-novamente")
        .disabled =
          true;
    }
  );

function mostrarPedidoRevanche(
  quemPediu
) {

  $("fim-revanche")
    .textContent =

      quemPediu ===
      meuNome

        ? "Aguardando o outro jogador aceitar..."

        : `${quemPediu} quer jogar de novo. ` +
          `Clique em "Jogar de novo" para aceitar.`;
}

// ======================================================
// SAIR
// ======================================================

function sairDoJogo() {

  saindoDoJogo =
    true;

  clearTimeout(
    timerReconexao
  );

  if (
    socket &&
    (
      socket.readyState ===
        WebSocket.OPEN ||

      socket.readyState ===
        WebSocket.CONNECTING
    )
  ) {

    try {

      socket.close();

    } catch (erro) {

      console.error(
        "Erro ao fechar socket:",
        erro
      );
    }
  }

  sessionStorage.removeItem(
    "roomCode"
  );

  sessionStorage.removeItem(
    "playerName"
  );

  window.location.href =
    "/lobby.html";
}

$("btn-voltar")
  .addEventListener(
    "click",
    sairDoJogo
  );

$("btn-sair-jogo")
  .addEventListener(
    "click",
    sairDoJogo
  );

// ======================================================
// INICIALIZAÇÃO
// ======================================================

(async () => {

  const usuario =
    await verificarUsuario();

  if (!usuario) {

    return;
  }

  meuNome =
    usuario.nickname;

  // Mantemos também no sessionStorage
  // por compatibilidade com o restante
  // do frontend.
  sessionStorage.setItem(
    "playerName",
    meuNome
  );

  conectarWebSocket();

})();