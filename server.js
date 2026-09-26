const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = 3000;

// Servidor HTTP
const server = http.createServer(app);

// Servidor WebSocket ligado ao mesmo servidor HTTP
const wss = new WebSocketServer({ server });

app.get("/", (req, res) => {
    res.send("Servidor do Jogo da Velha funcionando!");
});

// Quando um cliente conecta pelo WebSocket
wss.on("connection", (ws) => {
    console.log("Novo jogador conectado via WebSocket!");

    ws.send(
        JSON.stringify({
            type: "CONNECTED",
            message: "Conectado ao servidor WebSocket!"
        })
    );

    // Quando recebe uma mensagem
    ws.on("message", (data) => {
        console.log("Mensagem recebida:", data.toString());

        try {
            const mensagem = JSON.parse(data.toString());

            console.log("JSON recebido:", mensagem);

            ws.send(
                JSON.stringify({
                    type: "TEST_RESPONSE",
                    message: "Mensagem recebida pelo servidor!"
                })
            );
        } catch (erro) {
            console.log("Erro ao interpretar JSON.");
        }
    });

    ws.on("close", () => {
        console.log("Jogador desconectado.");
    });
});

// IMPORTANTE: usamos server.listen e NÃO app.listen
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`WebSocket rodando em ws://localhost:${PORT}`);
});
