const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = 3000;

const server = http.createServer(app);
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

// Facilita o envio de mensagens JSON
function enviar(ws, dados) {
    ws.send(JSON.stringify(dados));
}

wss.on("connection", (ws) => {
    console.log("Novo jogador conectado via WebSocket!");

    // Informações que vamos associar à conexão
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

    // Se não informou código, cria nova sala
    if (!roomCode) {
        do {
            roomCode = gerarCodigoSala();
        } while (rooms.has(roomCode));

        const novaSala = {
            code: roomCode,
            players: [],
            board: ["", "", "", "", "", "", "", "", ""],
            currentTurn: "X",
            status: "WAITING"
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
        socket: ws
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

    // Quando chegam 2 jogadores, começa a partida
    if (sala.players.length === 2) {
        sala.status = "PLAYING";

        for (const player of sala.players) {
            enviar(player.socket, {
                type: "GAME_STARTED",
                roomCode: roomCode,
                currentTurn: sala.currentTurn,
                players: sala.players.map((p) => ({
                    name: p.name,
                    symbol: p.symbol
                }))
            });
        }

        console.log(`Partida iniciada na sala ${roomCode}`);
    }
}

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`WebSocket rodando em ws://localhost:${PORT}`);
});