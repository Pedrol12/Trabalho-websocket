// conexao
const socket = new WebSocket("ws://localhost:3000");

// Guarda o que o servidor disse
let meuSimbolo = null;
let codigoDaSala = null;

const $ = (id) => document.getElementById(id);

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

  }
};

// lobby
function entrarNaSala(roomCode) {
  const nome = $("input-nome").value.trim();

  if (!nome) {
    $("msg-lobby").textContent = "Digite um apelido para continuar.";
    return;
  }

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