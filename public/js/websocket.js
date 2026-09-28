// conexao
const socket = new WebSocket("ws://localhost:3000");

// Guarda o que o servidor disse
let meuSimbolo = null;
let codigoDaSala = null;
let meuNome = null;

const $ = (id) => document.getElementById(id);

// Pega todas as casas do tabuleiro
const celulas = document.querySelectorAll(".celula");

// Mostra so a tela pedida (lobby ou arena)
function mostrarTela(qual) {
  $("tela-lobby").hidden = qual !== "lobby";
  $("tela-arena").hidden = qual !== "arena";
}

socket.onopen = () => {
  console.log("Conectado ao servidor WebSocket");
  $("status-conexao").textContent = "Conectado";
};

socket.onclose = () => {
  console.log("Conexão encerrada");
  $("status-conexao").textContent = "Desconectado. Recarregue a página.";
};

socket.onmessage = (event) => {
  const mensagem = JSON.parse(event.data);
  console.log("Servidor:", mensagem);

  switch (mensagem.type) {
    case "CONNECTED":
      break;

    case "ROOM_JOINED":
      codigoDaSala = mensagem.roomCode;
      meuSimbolo = mensagem.playerSymbol;

      $("codigo-sala").textContent = codigoDaSala;
      $("area-sala").hidden = false;
      $("btn-criar").disabled = true;
      $("btn-entrar").disabled = true;
      $("msg-lobby").textContent = "";
      break;

    case "ROOM_NOT_FOUND":
      $("msg-lobby").textContent = "Sala não encontrada. Confira o código.";
      break;

    case "ROOM_FULL":
      $("msg-lobby").textContent = "Essa sala já está cheia.";
      break;

    // Erros gerais do servidor
    case "ERROR":
    case "DATABASE_ERROR":
      $("msg-lobby").textContent = mensagem.message;
      break;

    // Os dois jogadores entraram, abre a arena
    case "GAME_STARTED":
      iniciarPartida(mensagem);
      break;

    // Servidor mandou o tabuleiro novo
    case "BOARD_UPDATE":
      atualizarTabuleiro(mensagem.board, mensagem.nextTurn);
      break;

    // Servidor recusou a jogada
    case "INVALID_MOVE":
      mostrarJogadaInvalida(mensagem.message);
      break;

    // Partida terminou (vitoria, empate ou W.O.)
    case "GAME_OVER":
      mostrarFimDeJogo(mensagem);
      break;

    // Alguem pediu revanche
    case "REMATCH_REQUESTED":
      mostrarPedidoRevanche(mensagem.requestedBy);
      break;

    // Os dois aceitaram, nova partida comeca
    case "NEW_GAME_STARTED":
      iniciarRevanche(mensagem);
      break;

    // Servidor recusou o pedido de revanche
    case "NEW_GAME_ERROR":
      $("fim-revanche").textContent = mensagem.message;
      break;

  }
};

// lobby
function entrarNaSala(roomCode) {
  const nome = $("input-nome").value.trim();

  if (!nome) {
    $("msg-lobby").textContent = "Digite um apelido para continuar.";
    return;
  }

  meuNome = nome;

  $("msg-lobby").textContent = "";
  socket.send(JSON.stringify({
    type: "JOIN_ROOM",
    playerName: nome,
    roomCode: roomCode
  }));
}

// Criar sala
$("btn-criar").addEventListener("click", () => {
  entrarNaSala(null);
});

// Entrar em sala
$("btn-entrar").addEventListener("click", () => {
  const codigo = $("input-codigo").value.trim();

  if (!codigo) {
    $("msg-lobby").textContent = "Digite o código da sala.";
    return;
  }

  entrarNaSala(codigo);
});

// arena
function iniciarPartida(mensagem) {
  montarArena(
    mensagem.players,
    ["", "", "", "", "", "", "", "", ""],
    mensagem.currentTurn
  );
}

// Preenche nomes, simbolo e tabuleiro da arena
function montarArena(players, board, turno) {
  // Nome de cada jogador (e o meu simbolo, que muda na revanche)
  players.forEach((jogador) => {
    if (jogador.symbol === "X") $("nome-x").textContent = jogador.name;
    if (jogador.symbol === "O") $("nome-o").textContent = jogador.name;
    if (jogador.name === meuNome) meuSimbolo = jogador.symbol;
  });

  $("arena-codigo").textContent = codigoDaSala;
  $("arena-simbolo").textContent = meuSimbolo;
  $("msg-arena").textContent = "";

  atualizarTabuleiro(board, turno);

  mostrarTela("arena");
}

// Clique na casa, so envia a jogada (o servidor decide se vale)
celulas.forEach((celula) => {
  celula.addEventListener("click", () => {
    socket.send(JSON.stringify({
      type: "MOVE",
      position: Number(celula.dataset.pos)
    }));
  });
});

// Escreve X ou O em cada casa e mostra de quem e a vez
function atualizarTabuleiro(board, nextTurn) {
  celulas.forEach((celula, i) => {
    const valor = board[i];
    celula.textContent = valor;
    celula.classList.toggle("x", valor === "X");
    celula.classList.toggle("o", valor === "O");
  });

  const indicador = $("indicador-turno");

  if (nextTurn === null) {
    indicador.textContent = "Fim de jogo";
    indicador.classList.remove("minha-vez");
  } else if (nextTurn === meuSimbolo) {
    indicador.textContent = `Sua vez (${nextTurn})`;
    indicador.classList.add("minha-vez");
  } else {
    indicador.textContent = `Vez do oponente (${nextTurn})`;
    indicador.classList.remove("minha-vez");
  }

  $("msg-arena").textContent = "";
}

// Jogada invalida
let timerErro = null;

function mostrarJogadaInvalida(texto) {
  $("msg-arena").textContent = texto || "Jogada inválida.";

  // Faz o tabuleiro tremer
  const tabuleiro = $("tabuleiro");
  tabuleiro.classList.remove("tremer");
  void tabuleiro.offsetWidth;
  tabuleiro.classList.add("tremer");

  // Some com a mensagem depois de 3 segundos
  clearTimeout(timerErro);
  timerErro = setTimeout(() => {
    $("msg-arena").textContent = "";
  }, 3000);
}

// game over
function mostrarFimDeJogo(mensagem) {
  if (mensagem.result === "WIN") {
    $("fim-titulo").textContent =
      mensagem.winner === meuSimbolo ? "Você venceu!" : "Você perdeu";
    $("fim-detalhe").textContent =
      `Fim de jogo! ${mensagem.winnerName} venceu com ${mensagem.winner}.`;

  } else if (mensagem.result === "WO") {
    $("fim-titulo").textContent =
      mensagem.winner === meuSimbolo ? "Você venceu!" : "Você perdeu";
    $("fim-detalhe").textContent =
      `Fim de jogo! ${mensagem.winnerName} venceu por W.O. ` +
      `(${mensagem.disconnectedPlayer} desconectou).`;

  } else {
    $("fim-titulo").textContent = "Empate";
    $("fim-detalhe").textContent = "Fim de jogo! Deu velha.";
  }

  // Botao de revanche volta ao normal
  $("fim-revanche").textContent = "";
  $("btn-jogar-novamente").disabled = false;

  $("modal-fim").hidden = false;
}

// Jogar de novo, pede a revanche (a partida so reinicia se os dois pedirem)
$("btn-jogar-novamente").addEventListener("click", () => {
  socket.send(JSON.stringify({ type: "NEW_GAME" }));
  $("btn-jogar-novamente").disabled = true;
});

// Mostra quem pediu revanche
function mostrarPedidoRevanche(quemPediu) {
  $("fim-revanche").textContent =
    quemPediu === meuNome
      ? "Aguardando o outro jogador aceitar..."
      : `${quemPediu} quer jogar de novo. Clique em "Jogar de novo" para aceitar.`;
}

// Nova partida: fecha o modal e limpa o tabuleiro
function iniciarRevanche(mensagem) {
  $("modal-fim").hidden = true;
  montarArena(mensagem.players, mensagem.board, mensagem.currentTurn);
}

// Voltar ao lobby, recarrega a pagina
$("btn-voltar").addEventListener("click", () => {
  location.reload();
});