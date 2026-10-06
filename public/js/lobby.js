// ======================================================
// LOBBY
// ======================================================

// Usuário autenticado
let usuario = null;

// Sala atual
let codigoDaSala = null;

// WebSocket do lobby
let socket = null;

const $ = (id) =>
  document.getElementById(id);

// ======================================================
// AUTENTICAÇÃO
// ======================================================

// Confere se existe sessão ativa.
// Se não existir, volta para o login.
async function verificarUsuario() {

  try {

    const resposta =
      await fetch(
        "/api/auth/me",
        {
          credentials: "include"
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
      "Erro ao verificar usuário:",
      erro
    );

    window.location.href =
      "/login.html";

    return null;
  }
}

// ======================================================
// WEBSOCKET
// ======================================================

function socketEstaAberto() {

  return (
    socket &&
    socket.readyState ===
      WebSocket.OPEN
  );
}

// ======================================================
// CRIAR SALA PRIVADA POR HTTP
// ======================================================

async function criarSalaPrivada() {

  try {

    const resposta =
      await fetch(
        "/api/salas/privadas",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "include"
        }
      );

    const dados =
      await resposta.json();

    if (!resposta.ok) {

      console.error(dados);

      $("msg-lobby").textContent =
        dados.erro ||
        "Não foi possível criar a sala.";

      return null;
    }

    return dados.sala.roomCode;

  } catch (erro) {

    console.error(
      "Erro ao criar sala:",
      erro
    );

    $("msg-lobby").textContent =
      "Não foi possível conectar ao servidor.";

    return null;
  }
}

// ======================================================
// ENTRAR NA SALA
// ======================================================

function entrarNaSala(
  roomCode
) {

  $("msg-lobby").textContent =
    "";

  if (!socketEstaAberto()) {

    $("msg-lobby").textContent =
      "A conexão com o servidor ainda não está pronta.";

    return;
  }

  const codigo =
    String(
      roomCode || ""
    )
      .trim()
      .toUpperCase();

  if (!codigo) {

    $("msg-lobby").textContent =
      "Informe o código da sala.";

    return;
  }

  socket.send(
    JSON.stringify({
      type:
        "JOIN_ROOM",

      playerName:
        usuario.nickname,

      roomCode:
        codigo
    })
  );
}

// ======================================================
// SALAS PÚBLICAS
// ======================================================

function renderizarSalasPublicas(
  salas
) {

  const lista =
    $("lista-salas-publicas");

  const vazio =
    $("msg-salas-publicas");

  lista.innerHTML =
    "";

  if (
    !salas ||
    salas.length === 0
  ) {

    vazio.hidden =
      false;

    return;
  }

  vazio.hidden =
    true;

  salas.forEach(
    (sala) => {

      const item =
        document.createElement(
          "li"
        );

      const texto =
        document.createElement(
          "span"
        );

      texto.textContent =
        `${sala.hostName || "Sala"} · ${sala.roomCode}`;

      const botao =
        document.createElement(
          "button"
        );

      botao.type =
        "button";

      botao.textContent =
        "Entrar";

      botao.addEventListener(
        "click",
        () => {

          entrarNaSala(
            sala.roomCode
          );
        }
      );

      item.appendChild(
        texto
      );

      item.appendChild(
        botao
      );

      lista.appendChild(
        item
      );
    }
  );
}

// ======================================================
// GUARDAR DADOS DA SALA
// ======================================================

function guardarSala(
  roomCode
) {

  codigoDaSala =
    roomCode;

  sessionStorage.setItem(
    "roomCode",
    codigoDaSala
  );

  sessionStorage.setItem(
    "playerName",
    usuario.nickname
  );
}

// ======================================================
// SALA CRIADA / ENTRADA CONFIRMADA
// ======================================================

function mostrarSalaEntrou(
  roomCode
) {

  guardarSala(
    roomCode
  );

  $("codigo-sala").textContent =
    codigoDaSala;

  $("area-sala").hidden =
    false;

  $("btn-criar").disabled =
    true;

  $("btn-entrar").disabled =
    true;

  $("msg-lobby").textContent =
    "Aguardando o outro jogador...";
}

// ======================================================
// LIBERAR BOTÕES APÓS ERRO
// ======================================================

function liberarBotoesLobby() {

  if ($("btn-criar")) {

    $("btn-criar").disabled =
      false;
  }

  if ($("btn-entrar")) {

    $("btn-entrar").disabled =
      false;
  }
}

// ======================================================
// BOTÃO CRIAR SALA PRIVADA
// ======================================================

$("btn-criar").addEventListener(
  "click",

  async () => {

    $("msg-lobby").textContent =
      "";

    if (!socketEstaAberto()) {

      $("msg-lobby").textContent =
        "Aguarde a conexão com o servidor.";

      return;
    }

    $("btn-criar").disabled =
      true;

    const codigo =
      await criarSalaPrivada();

    if (!codigo) {

      $("btn-criar").disabled =
        false;

      return;
    }

    entrarNaSala(
      codigo
    );
  }
);

// ======================================================
// ENTRAR POR CÓDIGO
// ======================================================

$("btn-entrar").addEventListener(
  "click",

  () => {

    const codigo =
      $("input-codigo")
        .value
        .trim()
        .toUpperCase();

    if (!codigo) {

      $("msg-lobby").textContent =
        "Digite o código da sala.";

      return;
    }

    entrarNaSala(
      codigo
    );
  }
);

// ======================================================
// LOGOUT
// ======================================================

$("btn-logout").addEventListener(
  "click",

  async () => {

    try {

      await fetch(
        "/api/auth/logout",
        {
          method:
            "POST",

          credentials:
            "include"
        }
      );

    } catch (erro) {

      console.error(
        "Erro no logout:",
        erro
      );
    }

    sessionStorage.removeItem(
      "roomCode"
    );

    sessionStorage.removeItem(
      "playerName"
    );

    window.location.href =
      "/login.html";
  }
);

// ======================================================
// INICIALIZAÇÃO
// ======================================================

(async () => {

  usuario =
    await verificarUsuario();

  if (!usuario) {

    return;
  }

  $("nome-usuario-logado")
    .textContent =
      usuario.nickname;

  // ====================================================
  // ABRE WEBSOCKET
  // ====================================================

  socket =
    new WebSocket(
      "ws://localhost:3000"
    );

  socket.onopen =
    () => {

      $("status-conexao")
        .textContent =
          "Conectado";

      liberarBotoesLobby();

      socket.send(
        JSON.stringify({
          type:
            "LIST_ROOMS"
        })
      );
    };

  socket.onerror =
    (erro) => {

      console.error(
        "Erro WebSocket:",
        erro
      );

      $("status-conexao")
        .textContent =
          "Erro de conexão";
    };

  socket.onclose =
    () => {

      $("status-conexao")
        .textContent =
          "Desconectado. Recarregue a página.";
    };

  // ====================================================
  // MENSAGENS DO SERVIDOR
  // ====================================================

  socket.onmessage =
    (event) => {

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
        // LISTA DE SALAS
        // ==============================================

        case "ROOM_LIST_UPDATE":

          renderizarSalasPublicas(
            mensagem.rooms ||
            []
          );

          break;

        // ==============================================
        // ENTROU NA SALA
        // ==============================================

        case "ROOM_JOINED":

          mostrarSalaEntrou(
            mensagem.roomCode
          );

          break;

        // ==============================================
        // RECONEXÃO
        // ==============================================
        //
        // Pode acontecer caso o navegador tenha
        // recarregado ou o servidor reconheça o
        // jogador como já pertencente à sala.
        // ==============================================

        case "ROOM_RECONNECTED":

          guardarSala(
            mensagem.roomCode
          );

          // Se a partida já estiver acontecendo,
          // vai direto para jogo.html.
          if (
            mensagem.status ===
            "PLAYING"
          ) {

            window.location.href =
              "/jogo.html";

            return;
          }

          mostrarSalaEntrou(
            mensagem.roomCode
          );

          break;

        // ==============================================
        // SALA NÃO ENCONTRADA
        // ==============================================

        case "ROOM_NOT_FOUND":

          $("msg-lobby")
            .textContent =
              mensagem.message ||
              "Sala não encontrada. Confira o código.";

          liberarBotoesLobby();

          break;

        // ==============================================
        // SALA CHEIA
        // ==============================================

        case "ROOM_FULL":

          $("msg-lobby")
            .textContent =
              mensagem.message ||
              "Essa sala já está cheia.";

          liberarBotoesLobby();

          break;

        // ==============================================
        // HOST AINDA NÃO ENTROU
        // ==============================================

        case "ROOM_HOST_REQUIRED":

          $("msg-lobby")
            .textContent =
              mensagem.message ||
              "Aguarde o host entrar na sala primeiro.";

          liberarBotoesLobby();

          break;

        // ==============================================
        // ERROS
        // ==============================================

        case "ERROR":

        case "DATABASE_ERROR":

          $("msg-lobby")
            .textContent =
              mensagem.message ||
              "Ocorreu um erro.";

          liberarBotoesLobby();

          break;

        // ==============================================
        // PARTIDA COMEÇOU
        // ==============================================

        case "GAME_STARTED":

          if (
            mensagem.roomCode
          ) {

            guardarSala(
              mensagem.roomCode
            );
          }

          window.location.href =
            "/jogo.html";

          break;
      }
    };

})();