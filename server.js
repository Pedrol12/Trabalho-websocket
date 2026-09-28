const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = 3000;

// Cria o servidor HTTP
const server = http.createServer(app);

// Cria o servidor WebSocket usando o mesmo servidor HTTP
const wss = new WebSocketServer({ server });

// Salas abertas no servidor
const rooms = new Map();

app.get("/", (req, res) => {
    res.send("Servidor do Jogo da Velha funcionando!");
});

// Gera código aleatório de 6 caracteres
function gerarCodigoSala() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let codigo = "";

    for (let i = 0; i < 6; i++) {
        const indice = Math.floor(Math.random() * caracteres.length);
        codigo += caracteres[indice];
    }

    return codigo;
}

// Facilita o envio de mensagens JSON para um jogador
function enviar(ws, dados) {
    ws.send(JSON.stringify(dados));
}

// Envia uma mensagem para todos os jogadores da sala
function enviarParaSala(sala, dados) {
    for (const jogador of sala.players) {
        enviar(jogador.socket, dados);
    }
}

// Retorna o placar atual da sala
function obterPlacar(sala) {
    return sala.players.map((player) => ({
        name: player.name,
        symbol: player.symbol,
        score: player.score
    }));
}

// Verifica se existe uma combinação vencedora
function verificarVencedor(board) {
    const combinacoes = [
        // Horizontais
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        // Verticais
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        // Diagonais
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

// Verifica se todas as posições foram preenchidas
function verificarEmpate(board) {
    return board.every((celula) => celula !== "");
}

// Quando um jogador se conecta ao servidor WebSocket
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
        console.log("Jogador desconectado.");
    });
});

// Cria ou entra em uma sala
function entrarNaSala(ws, mensagem) {
    const playerName = mensagem.playerName;
    let roomCode = mensagem.roomCode;

    if (!playerName) {
        enviar(ws, {
            type: "ERROR",
            message: "Nome do jogador é obrigatório."
        });

        return;
    }

    // Se não informou código, cria uma nova sala
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

            // Jogadores que pediram revanche
            rematchRequests: new Set()
        };

        rooms.set(roomCode, novaSala);
    }

    roomCode = roomCode.toUpperCase();

    const sala = rooms.get(roomCode);

    if (!sala) {
        enviar(ws, {
            type: "ROOM_NOT_FOUND",
            message: "Sala não encontrada."
        });

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

        // Placar individual durante a sessão da sala
        score: 0
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

    // Quando chegam dois jogadores, inicia a partida
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
    }
}

// Processa uma jogada
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

    // Registra a jogada
    sala.board[position] = simboloJogador;

    console.log(
        `${ws.playerName} jogou na posição ${position}`
    );

    const vencedor = verificarVencedor(sala.board);

    // Vitória
    if (vencedor) {
        sala.status = "FINISHED";
        sala.currentTurn = null;

        const jogadorVencedor = sala.players.find(
            (player) => player.symbol === vencedor
        );

        // Soma um ponto para o vencedor
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

        console.log(
            "Placar:",
            obterPlacar(sala)
        );

        return;
    }

    // Empate
    if (verificarEmpate(sala.board)) {
        sala.status = "FINISHED";
        sala.currentTurn = null;

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

    // Continua a partida
    sala.currentTurn = simboloJogador === "X" ? "O" : "X";

    enviarParaSala(sala, {
        type: "BOARD_UPDATE",
        board: sala.board,
        nextTurn: sala.currentTurn
    });

    console.log(
        `Próximo turno: ${sala.currentTurn}`
    );
}

// Processa mensagens do chat
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

    const texto = String(mensagem.message || "").trim();

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

// Jogador solicita revanche
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

    // Só permite revanche depois que a partida terminar
    if (sala.status !== "FINISHED") {
        enviar(ws, {
            type: "NEW_GAME_ERROR",
            message: "A partida atual ainda não terminou."
        });

        return;
    }

    // Evita o mesmo jogador pedir duas vezes
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

    // Primeiro jogador pediu: aguarda o outro aceitar
    if (sala.rematchRequests.size === 1) {
        enviarParaSala(sala, {
            type: "REMATCH_REQUESTED",
            requestedBy: ws.playerName,
            message: `${ws.playerName} solicitou uma revanche.`
        });

        return;
    }

    // Quando os dois solicitarem, a revanche começa
    if (sala.rematchRequests.size === 2) {
        iniciarNovaPartida(sala);
    }
}

// Reinicia a partida sem destruir a sala
function iniciarNovaPartida(sala) {
    // Limpa o tabuleiro
    sala.board = ["", "", "", "", "", "", "", "", ""];

    // Inverte os símbolos dos dois jogadores
    for (const player of sala.players) {
        if (player.symbol === "X") {
            player.symbol = "O";
        } else {
            player.symbol = "X";
        }

        // Atualiza também o símbolo armazenado na conexão
        player.socket.playerSymbol = player.symbol;
    }

    // X começa a nova partida
    sala.currentTurn = "X";

    sala.status = "PLAYING";

    // Limpa os pedidos de revanche
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

    console.log(
        "Jogadores:",
        sala.players.map((player) => ({
            name: player.name,
            symbol: player.symbol
        }))
    );

    console.log(
        "Placar:",
        obterPlacar(sala)
    );
}

// Inicia o servidor
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`WebSocket rodando em ws://localhost:${PORT}`);
});