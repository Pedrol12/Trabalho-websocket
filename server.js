const express = require("express");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const PORT = 3000;

const TEMPO_TURNO_MS = 15000;
const TEMPO_RECONEXAO_MS = 30000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

app.get("/", (req, res) => {
    res.send("Servidor do Jogo da Velha funcionando!");
});

function gerarCodigoSala() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codigo = "";

    for (let i = 0; i < 6; i++) {
        const indice = Math.floor(Math.random() * caracteres.length);
        codigo += caracteres[indice];
    }

    return codigo;
}

function enviar(ws, dados) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(dados));
    }
}

function enviarParaSala(sala, dados) {
    for (const jogador of sala.players) {
        if (jogador.connected && jogador.socket) {
            enviar(jogador.socket, dados);
        }
    }
}

function obterPlacar(sala) {
    return sala.players.map((player) => ({
        name: player.name,
        symbol: player.symbol,
        score: player.score
    }));
}

function cancelarCronometroTurno(sala) {
    if (sala.turnTimer) {
        clearTimeout(sala.turnTimer);
        sala.turnTimer = null;
    }

    sala.turnDeadline = null;
}

function iniciarCronometroTurno(sala) {
    cancelarCronometroTurno(sala);

    if (sala.status !== "PLAYING" || !sala.currentTurn) {
        return;
    }

    // Se alguém estiver desconectado, a partida fica pausada
    if (sala.players.some((player) => !player.connected)) {
        return;
    }

    const simboloDoTurno = sala.currentTurn;

    sala.turnDeadline = Date.now() + TEMPO_TURNO_MS;

    enviarParaSala(sala, {
        type: "TURN_TIMER",
        currentTurn: simboloDoTurno,
        seconds: TEMPO_TURNO_MS / 1000,
        deadline: sala.turnDeadline
    });

    sala.turnTimer = setTimeout(() => {
        if (
            sala.status !== "PLAYING" ||
            sala.currentTurn !== simboloDoTurno
        ) {
            return;
        }

        const jogadorQuePerdeuOTurno = simboloDoTurno;

        sala.currentTurn =
            jogadorQuePerdeuOTurno === "X" ? "O" : "X";

        sala.turnTimer = null;
        sala.turnDeadline = null;

        enviarParaSala(sala, {
            type: "TURN_TIMEOUT",
            timedOutSymbol: jogadorQuePerdeuOTurno,
            nextTurn: sala.currentTurn,
            message: `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado.`
        });

        enviarParaSala(sala, {
            type: "BOARD_UPDATE",
            board: sala.board,
            nextTurn: sala.currentTurn
        });

        console.log(
            `Tempo do jogador ${jogadorQuePerdeuOTurno} esgotado. ` +
            `Próximo turno: ${sala.currentTurn}`
        );

        iniciarCronometroTurno(sala);

    }, TEMPO_TURNO_MS);
}

function verificarVencedor(board) {
    const combinacoes = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const combinacao of combinacoes) {
        const [a, b, c] = combinacao;

        if (
            board[a] !== "" &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}

function verificarEmpate(board) {
    return board.every((celula) => celula !== "");
}

wss.on("connection", (ws) => {
    console.log("Novo jogador conectado via WebSocket!");

    ws.roomCode = null;
    ws.playerName = null;
    ws.playerSymbol = null;

    enviar(ws, {
        type: "CONNECTED",
        message: "Conectado ao servidor WebSocket!"
    });

    ws.on("message", (data) => {
        try {
            const mensagem = JSON.parse(data.toString());

            console.log("Mensagem recebida:", mensagem);

            switch (mensagem.type) {
                case "JOIN_ROOM":
                    entrarNaSala(ws, mensagem);
                    break;

                case "MOVE":
                    executarJogada(ws, mensagem);
                    break;

                case "CHAT":
                    enviarMensagemChat(ws, mensagem);
                    break;

                case "NEW_GAME":
                    solicitarRevanche(ws);
                    break;

                default:
                    enviar(ws, {
                        type: "ERROR",
                        message: "Tipo de mensagem desconhecido."
                    });
            }

        } catch (erro) {
            console.log("Erro ao interpretar mensagem:", erro);

            enviar(ws, {
                type: "ERROR",
                message: "JSON inválido."
            });
        }
    });

    ws.on("close", () => {
        tratarDesconexao(ws);
    });
});

function entrarNaSala(ws, mensagem) {
    const playerName = String(mensagem.playerName || "").trim();
    let roomCode = mensagem.roomCode;

    if (!playerName) {
        enviar(ws, {
            type: "ERROR",
            message: "Nome do jogador é obrigatório."
        });

        return;
    }

    if (!roomCode) {
        do {
            roomCode = gerarCodigoSala();
        } while (rooms.has(roomCode));

        const novaSala = {
            code: roomCode,
            players: [],
            board: ["", "", "", "", "", "", "", "", ""],
            currentTurn: "X",
            status: "WAITING",
            rematchRequests: new Set(),
            turnTimer: null,
            turnDeadline: null
        };

        rooms.set(roomCode, novaSala);
    }

    roomCode = String(roomCode).trim().toUpperCase();

    const sala = rooms.get(roomCode);

    if (!sala) {
        enviar(ws, {
            type: "ROOM_NOT_FOUND",
            message: "Sala não encontrada."
        });

        return;
    }

    // Verifica se esse jogador está se reconectando
    const jogadorDesconectado = sala.players.find(
        (player) =>
            player.name === playerName &&
            !player.connected
    );

    if (jogadorDesconectado) {
        reconectarJogador(ws, sala, jogadorDesconectado);
        return;
    }

    if (sala.players.length >= 2) {
        enviar(ws, {
            type: "ROOM_FULL",
            message: "A sala já possui dois jogadores."
        });

        return;
    }

    const simbolo = sala.players.length === 0 ? "X" : "O";

    const jogador = {
        name: playerName,
        symbol: simbolo,
        socket: ws,
        score: 0,
        connected: true,
        disconnectTimer: null
    };

    sala.players.push(jogador);

    ws.roomCode = roomCode;
    ws.playerName = playerName;
    ws.playerSymbol = simbolo;

    enviar(ws, {
        type: "ROOM_JOINED",
        roomCode: roomCode,
        playerName: playerName,
        playerSymbol: simbolo
    });

    console.log(
        `${playerName} entrou na sala ${roomCode} como ${simbolo}`
    );

    if (sala.players.length === 2) {
        sala.status = "PLAYING";

        enviarParaSala(sala, {
            type: "GAME_STARTED",
            roomCode: roomCode,
            currentTurn: sala.currentTurn,

            players: sala.players.map((player) => ({
                name: player.name,
                symbol: player.symbol
            })),

            score: obterPlacar(sala)
        });

        console.log(`Partida iniciada na sala ${roomCode}`);

        iniciarCronometroTurno(sala);
    }
}

function executarJogada(ws, mensagem) {
    const roomCode = ws.roomCode;
    const position = mensagem.position;

    if (!roomCode) {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "Você não está em uma sala."
        });

        return;
    }

    const sala = rooms.get(roomCode);

    if (!sala || sala.status !== "PLAYING") {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "A partida não está disponível."
        });

        return;
    }

    if (sala.players.some((player) => !player.connected)) {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "A partida está pausada aguardando reconexão."
        });

        return;
    }

    const simboloJogador = ws.playerSymbol;

    if (sala.currentTurn !== simboloJogador) {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "Não é a sua vez."
        });

        return;
    }

    if (!Number.isInteger(position) || position < 0 || position > 8) {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "Posição inválida."
        });

        return;
    }

    if (sala.board[position] !== "") {
        enviar(ws, {
            type: "INVALID_MOVE",
            message: "Essa posição já está ocupada."
        });

        return;
    }

    cancelarCronometroTurno(sala);

    sala.board[position] = simboloJogador;

    console.log(
        `${ws.playerName} jogou na posição ${position}`
    );

    const vencedor = verificarVencedor(sala.board);

    if (vencedor) {
        sala.status = "FINISHED";
        sala.currentTurn = null;

        cancelarCronometroTurno(sala);

        const jogadorVencedor = sala.players.find(
            (player) => player.symbol === vencedor
        );

        if (jogadorVencedor) {
            jogadorVencedor.score++;
        }

        enviarParaSala(sala, {
            type: "BOARD_UPDATE",
            board: sala.board,
            nextTurn: null
        });

        enviarParaSala(sala, {
            type: "GAME_OVER",
            result: "WIN",
            winner: vencedor,
            winnerName: jogadorVencedor
                ? jogadorVencedor.name
                : ws.playerName,
            score: obterPlacar(sala)
        });

        enviarParaSala(sala, {
            type: "SCORE_UPDATE",
            score: obterPlacar(sala)
        });

        console.log(
            `Fim de jogo! ${ws.playerName} venceu com ${vencedor}.`
        );

        return;
    }

    if (verificarEmpate(sala.board)) {
        sala.status = "FINISHED";
        sala.currentTurn = null;

        cancelarCronometroTurno(sala);

        enviarParaSala(sala, {
            type: "BOARD_UPDATE",
            board: sala.board,
            nextTurn: null
        });

        enviarParaSala(sala, {
            type: "GAME_OVER",
            result: "DRAW",
            winner: null,
            winnerName: null,
            score: obterPlacar(sala)
        });

        enviarParaSala(sala, {
            type: "SCORE_UPDATE",
            score: obterPlacar(sala)
        });

        console.log("Fim de jogo! Empate.");

        return;
    }

    sala.currentTurn =
        simboloJogador === "X" ? "O" : "X";

    enviarParaSala(sala, {
        type: "BOARD_UPDATE",
        board: sala.board,
        nextTurn: sala.currentTurn
    });

    console.log(
        `Próximo turno: ${sala.currentTurn}`
    );

    iniciarCronometroTurno(sala);
}

function enviarMensagemChat(ws, mensagem) {
    const roomCode = ws.roomCode;

    if (!roomCode) {
        enviar(ws, {
            type: "CHAT_ERROR",
            message: "Você não está em uma sala."
        });

        return;
    }

    const sala = rooms.get(roomCode);

    if (!sala) {
        enviar(ws, {
            type: "CHAT_ERROR",
            message: "Sala não encontrada."
        });

        return;
    }

    const texto =
        String(mensagem.message || "").trim();

    if (!texto) {
        enviar(ws, {
            type: "CHAT_ERROR",
            message: "A mensagem não pode estar vazia."
        });

        return;
    }

    enviarParaSala(sala, {
        type: "CHAT_MESSAGE",
        playerName: ws.playerName,
        playerSymbol: ws.playerSymbol,
        message: texto
    });

    console.log(
        `[CHAT ${roomCode}] ${ws.playerName}: ${texto}`
    );
}

function solicitarRevanche(ws) {
    const roomCode = ws.roomCode;

    if (!roomCode) {
        enviar(ws, {
            type: "NEW_GAME_ERROR",
            message: "Você não está em uma sala."
        });

        return;
    }

    const sala = rooms.get(roomCode);

    if (!sala) {
        enviar(ws, {
            type: "NEW_GAME_ERROR",
            message: "Sala não encontrada."
        });

        return;
    }

    if (sala.status !== "FINISHED") {
        enviar(ws, {
            type: "NEW_GAME_ERROR",
            message: "A partida atual ainda não terminou."
        });

        return;
    }

    if (sala.rematchRequests.has(ws)) {
        enviar(ws, {
            type: "NEW_GAME_ERROR",
            message: "Você já solicitou a revanche."
        });

        return;
    }

    sala.rematchRequests.add(ws);

    console.log(
        `${ws.playerName} solicitou revanche na sala ${roomCode}`
    );

    if (sala.rematchRequests.size === 1) {
        enviarParaSala(sala, {
            type: "REMATCH_REQUESTED",
            requestedBy: ws.playerName,
            message: `${ws.playerName} solicitou uma revanche.`
        });

        return;
    }

    if (sala.rematchRequests.size === 2) {
        iniciarNovaPartida(sala);
    }
}

function iniciarNovaPartida(sala) {
    cancelarCronometroTurno(sala);

    sala.board =
        ["", "", "", "", "", "", "", "", ""];

    for (const player of sala.players) {
        if (player.symbol === "X") {
            player.symbol = "O";
        } else {
            player.symbol = "X";
        }

        player.socket.playerSymbol = player.symbol;
    }

    sala.currentTurn = "X";
    sala.status = "PLAYING";
    sala.rematchRequests.clear();

    enviarParaSala(sala, {
        type: "NEW_GAME_STARTED",
        roomCode: sala.code,
        board: sala.board,
        currentTurn: sala.currentTurn,

        players: sala.players.map((player) => ({
            name: player.name,
            symbol: player.symbol
        })),

        score: obterPlacar(sala)
    });

    console.log(
        `Nova partida iniciada na sala ${sala.code}`
    );

    iniciarCronometroTurno(sala);
}

// Trata desconexão de jogador
function tratarDesconexao(ws) {
    const roomCode = ws.roomCode;

    if (!roomCode) {
        console.log("Cliente desconectado antes de entrar em uma sala.");
        return;
    }

    const sala = rooms.get(roomCode);

    if (!sala) {
        return;
    }

    // Procura especificamente o jogador que usava este socket
    const jogador = sala.players.find(
        (player) => player.socket === ws
    );

    if (!jogador || !jogador.connected) {
        return;
    }

    jogador.connected = false;
    jogador.socket = null;

    console.log(
        `${jogador.name} desconectou da sala ${roomCode}`
    );

    // Se estava sozinho aguardando o segundo jogador,
    // remove a sala
    if (sala.status === "WAITING") {
        rooms.delete(roomCode);

        console.log(
            `Sala ${roomCode} removida porque ficou vazia.`
        );

        return;
    }

    // Se a partida já acabou, não existe W.O.
    if (sala.status !== "PLAYING") {
        return;
    }

    // Pausa o cronômetro de jogada
    cancelarCronometroTurno(sala);

    enviarParaSala(sala, {
        type: "PLAYER_DISCONNECTED",
        playerName: jogador.name,
        playerSymbol: jogador.symbol,
        reconnectSeconds: TEMPO_RECONEXAO_MS / 1000,
        message:
            `${jogador.name} desconectou. ` +
            `Aguardando reconexão por 30 segundos.`
    });

    jogador.disconnectTimer = setTimeout(() => {
        finalizarPorWO(sala, jogador);
    }, TEMPO_RECONEXAO_MS);
}

// Reconecta um jogador na mesma sala
function reconectarJogador(ws, sala, jogador) {
    if (jogador.disconnectTimer) {
        clearTimeout(jogador.disconnectTimer);
        jogador.disconnectTimer = null;
    }

    jogador.socket = ws;
    jogador.connected = true;

    ws.roomCode = sala.code;
    ws.playerName = jogador.name;
    ws.playerSymbol = jogador.symbol;

    enviar(ws, {
        type: "ROOM_RECONNECTED",
        roomCode: sala.code,
        playerName: jogador.name,
        playerSymbol: jogador.symbol,
        board: sala.board,
        currentTurn: sala.currentTurn,
        status: sala.status,
        score: obterPlacar(sala),

        players: sala.players.map((player) => ({
            name: player.name,
            symbol: player.symbol,
            connected: player.connected
        }))
    });

    enviarParaSala(sala, {
        type: "PLAYER_RECONNECTED",
        playerName: jogador.name,
        playerSymbol: jogador.symbol,
        message: `${jogador.name} reconectou à partida.`
    });

    console.log(
        `${jogador.name} reconectou na sala ${sala.code}`
    );

    // Se a partida ainda estiver acontecendo,
    // volta a contar o tempo do turno atual
    if (sala.status === "PLAYING") {
        iniciarCronometroTurno(sala);
    }
}

// Finaliza partida por W.O.
function finalizarPorWO(sala, jogadorDesconectado) {
    jogadorDesconectado.disconnectTimer = null;

    // Se ele já reconectou, não existe W.O.
    if (jogadorDesconectado.connected) {
        return;
    }

    if (sala.status !== "PLAYING") {
        return;
    }

    cancelarCronometroTurno(sala);

    const vencedor = sala.players.find(
        (player) =>
            player !== jogadorDesconectado &&
            player.connected
    );

    sala.status = "FINISHED";
    sala.currentTurn = null;
    sala.rematchRequests.clear();

    if (!vencedor) {
        console.log(
            `Partida da sala ${sala.code} encerrada sem vencedor.`
        );

        return;
    }

    vencedor.score++;

    enviarParaSala(sala, {
        type: "GAME_OVER",
        result: "WO",
        winner: vencedor.symbol,
        winnerName: vencedor.name,
        disconnectedPlayer: jogadorDesconectado.name,
        score: obterPlacar(sala)
    });

    enviarParaSala(sala, {
        type: "SCORE_UPDATE",
        score: obterPlacar(sala)
    });

    console.log(
        `${vencedor.name} venceu por W.O. ` +
        `após desconexão de ${jogadorDesconectado.name}.`
    );
}

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`WebSocket rodando em ws://localhost:${PORT}`);
});