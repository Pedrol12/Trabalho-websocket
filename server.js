const express = require("express");
const http = require("http");
const session = require("express-session");
const { WebSocketServer, WebSocket } = require("ws");

const {
    inicializarBanco,

    buscarOuCriarJogador,
    registrarVitoriaDerrota,

    codigoSalaExiste,
    criarSalaBanco,
    adicionarVisitanteSala,
    atualizarStatusSala,
    removerSalaBanco,

    buscarSalaPorCodigoBanco,
    listarSalasAguardandoBanco,

    criarPartida,
    atualizarTurnoPartida,
    finalizarPartida,

    registrarJogada,
    registrarMensagemChat
} = require("./database/database");

// TÓPICO PROFESSOR: ROTAS HTTP MODULARIZADAS
const authRoutes =
    require("./src/routes/auth.routes");

const {
    exigirAutenticacao
} =
    require("./src/middlewares/auth.middleware");

const {
    criarSalasController
} =
    require("./src/controllers/salas.controller");

const {
    criarSalasRoutes
} =
    require("./src/routes/salas.routes");

// ======================================================
// CONFIGURAÇÃO
// ======================================================

const app = express();

const PORT = 3000;

const TEMPO_TURNO_MS = 15000;

// Janela de reconexão antes do W.O.
const TEMPO_RECONEXAO_MS = 30000;

// Intervalo de verificação das conexões WebSocket.
const HEARTBEAT_INTERVAL_MS = 10000;

// ======================================================
// TÓPICO PROFESSOR: REGRAS HTTP
// ======================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: false
    })
);

// ======================================================
// SESSÃO / LOGIN
// ======================================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "jogo-da-velha-segredo-dev",

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {
            httpOnly:
                true,

            sameSite:
                "lax",

            secure:
                false,

            maxAge:
                1000 * 60 * 60 * 8
        }
    })
);

app.use(
    express.static("public")
);

// ======================================================
// TÓPICO PROFESSOR: ROTAS HTTP MODULARIZADAS
// ======================================================

app.use(
    "/api/auth",
    authRoutes
);

// ======================================================
// HTTP + WEBSOCKET
// ======================================================

// TÓPICO PROFESSOR: INSTÂNCIA DO WEBSOCKET
const server =
    http.createServer(app);

const wss =
    new WebSocketServer({
        server
    });

// TÓPICO PROFESSOR: ESTADO EM MEMÓRIA
const rooms =
    new Map();

// ======================================================
// ROTAS BÁSICAS
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.send(
            "Servidor do Jogo da Velha funcionando!"
        );
    }
);

app.get(
    "/api/status",
    (req, res) => {

        res.json({
            sucesso:
                true,

            servidor:
                "Jogo da Velha WebSocket + HTTP",

            websocket:
                `ws://localhost:${PORT}`
        });
    }
);

// ======================================================
// FUNÇÕES AUXILIARES DE SALA
// ======================================================

function gerarCodigoSala() {

    const caracteres =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let codigo =
        "";

    for (
        let i = 0;
        i < 6;
        i++
    ) {

        const indice =
            Math.floor(
                Math.random() *
                caracteres.length
            );

        codigo +=
            caracteres[indice];
    }

    return codigo;
}

function criarEstruturaSala({
    idSala,
    roomCode,
    privada,
    hostId = null,
    hostName = null
}) {

    return {
        idSala,

        idPartida:
            null,

        code:
            roomCode,

        private:
            Boolean(
                privada
            ),

        hostId,

        hostName,

        players:
            [],

        board: [
            "", "", "",
            "", "", "",
            "", "", ""
        ],

        currentTurn:
            "X",

        status:
            "WAITING",

        rematchRequests:
            new Set(),

        turnTimer:
            null,

        turnDeadline:
            null
    };
}

function salaBancoParaMemoria(
    salaBanco
) {

    return criarEstruturaSala({
        idSala:
            salaBanco.id_sala,

        roomCode:
            salaBanco.codigo_sala,

        privada:
            Number(
                salaBanco.privada
            ) === 1,

        hostId:
            salaBanco.id_jogador_host,

        hostName:
            salaBanco.host_nickname ||
            null
    });
}

// ======================================================
// TÓPICO PROFESSOR: ROTAS DE SALAS MODULARIZADAS
// ======================================================

const salasController =
    criarSalasController({
        rooms,
        gerarCodigoSala,
        criarEstruturaSala
    });

app.use(
    "/api/salas",

    criarSalasRoutes({
        controller:
            salasController,

        exigirAutenticacao
    })
);

// ======================================================
// RECUPERA SALAS PRIVADAS APÓS REINICIAR NODE
// ======================================================

// TÓPICO PROFESSOR: PERSISTÊNCIA DE DADOS
async function recuperarSalasPrivadasPersistidas() {

    const salas =
        await listarSalasAguardandoBanco();

    let recuperadas =
        0;

    for (
        const salaBanco
        of salas
    ) {

        if (
            Number(
                salaBanco.privada
            ) !== 1
        ) {

            continue;
        }

        if (
            !rooms.has(
                salaBanco.codigo_sala
            )
        ) {

            rooms.set(
                salaBanco.codigo_sala,

                salaBancoParaMemoria(
                    salaBanco
                )
            );

            recuperadas++;
        }
    }

    console.log(
        `Salas privadas persistidas recuperadas: ${recuperadas}`
    );
}

async function buscarOuRecuperarSala(
    roomCode
) {

    let sala =
        rooms.get(
            roomCode
        );

    if (
        sala
    ) {

        return sala;
    }

    const salaBanco =
        await buscarSalaPorCodigoBanco(
            roomCode
        );

    if (
        !salaBanco
    ) {

        return null;
    }

    if (
        salaBanco.status_sala !==
        "AGUARDANDO"
    ) {

        return null;
    }

    sala =
        salaBancoParaMemoria(
            salaBanco
        );

    rooms.set(
        roomCode,
        sala
    );

    return sala;
}

// ======================================================
// AUXILIARES WEBSOCKET
// ======================================================

function enviar(
    ws,
    dados
) {

    if (
        ws &&
        ws.readyState ===
            WebSocket.OPEN
    ) {

        ws.send(
            JSON.stringify(
                dados
            )
        );
    }
}

function enviarParaSala(
    sala,
    dados
) {

    for (
        const jogador
        of sala.players
    ) {

        if (
            jogador.connected &&
            jogador.socket
        ) {

            enviar(
                jogador.socket,
                dados
            );
        }
    }
}

// ======================================================
// SALAS PÚBLICAS NO WEBSOCKET
// ======================================================

function obterSalasPublicas() {

    return Array.from(
        rooms.values()
    )
        .filter(
            (sala) => {

                return (
                    sala.private ===
                        false &&

                    sala.status ===
                        "WAITING" &&

                    sala.players.length <
                        2
                );
            }
        )
        .map(
            (sala) => ({

                roomCode:
                    sala.code,

                hostName:
                    sala.players[0]?.name ||
                    sala.hostName ||
                    null,

                playersCount:
                    sala.players.length,

                maxPlayers:
                    2,

                status:
                    sala.status
            })
        );
}

function enviarListaSalasPublicas(
    ws
) {

    enviar(
        ws,
        {
            type:
                "ROOM_LIST_UPDATE",

            rooms:
                obterSalasPublicas()
        }
    );
}

function broadcastListaSalasPublicas() {

    const dados = {
        type:
            "ROOM_LIST_UPDATE",

        rooms:
            obterSalasPublicas()
    };

    for (
        const cliente
        of wss.clients
    ) {

        enviar(
            cliente,
            dados
        );
    }
}

// ======================================================
// PLACAR
// ======================================================

function obterPlacar(
    sala
) {

    return sala.players.map(
        (player) => ({

            name:
                player.name,

            symbol:
                player.symbol,

            score:
                player.score
        })
    );
}

function obterPlacarHostVisitante(
    sala
) {

    return {
        placarHost:
            sala.players[0]?.score ||
            0,

        placarVisitante:
            sala.players[1]?.score ||
            0
    };
}

// ======================================================
// CRONÔMETRO
// ======================================================

function cancelarCronometroTurno(
    sala
) {

    if (
        sala.turnTimer
    ) {

        clearTimeout(
            sala.turnTimer
        );

        sala.turnTimer =
            null;
    }

    sala.turnDeadline =
        null;
}

function iniciarCronometroTurno(
    sala
) {

    cancelarCronometroTurno(
        sala
    );

    if (
        sala.status !==
            "PLAYING" ||

        !sala.currentTurn
    ) {

        return;
    }

    if (
        sala.players.some(
            (player) =>
                !player.connected
        )
    ) {

        return;
    }

    const simboloDoTurno =
        sala.currentTurn;

    sala.turnDeadline =
        Date.now() +
        TEMPO_TURNO_MS;

    enviarParaSala(
        sala,
        {
            type:
                "TURN_TIMER",

            currentTurn:
                simboloDoTurno,

            seconds:
                TEMPO_TURNO_MS /
                1000,

            deadline:
                sala.turnDeadline
        }
    );

    sala.turnTimer =
        setTimeout(
            async () => {

                if (
                    sala.status !==
                        "PLAYING" ||

                    sala.currentTurn !==
                        simboloDoTurno
                ) {

                    return;
                }

                const jogadorQuePerdeuOTurno =
                    simboloDoTurno;

                sala.currentTurn =
                    jogadorQuePerdeuOTurno ===
                        "X"
                        ? "O"
                        : "X";

                sala.turnTimer =
                    null;

                sala.turnDeadline =
                    null;

                if (
                    sala.idPartida
                ) {

                    try {

                        await atualizarTurnoPartida(
                            sala.idPartida,

                            sala.currentTurn
                        );

                    } catch (erro) {

                        console.error(
                            "Erro ao atualizar turno no banco:",
                            erro.message
                        );
                    }
                }

                enviarParaSala(
                    sala,
                    {
                        type:
                            "TURN_TIMEOUT",

                        timedOutSymbol:
                            jogadorQuePerdeuOTurno,

                        nextTurn:
                            sala.currentTurn,

                        message:
                            `Tempo do jogador ` +
                            `${jogadorQuePerdeuOTurno} esgotado.`
                    }
                );

                enviarParaSala(
                    sala,
                    {
                        type:
                            "BOARD_UPDATE",

                        board:
                            sala.board,

                        nextTurn:
                            sala.currentTurn
                    }
                );

                console.log(
                    `Tempo do jogador ` +
                    `${jogadorQuePerdeuOTurno} esgotado. ` +
                    `Próximo turno: ${sala.currentTurn}`
                );

                iniciarCronometroTurno(
                    sala
                );

            },

            TEMPO_TURNO_MS
        );
}

// ======================================================
// REGRAS
// ======================================================

function verificarVencedor(
    board
) {

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

    for (
        const combinacao
        of combinacoes
    ) {

        const [a, b, c] =
            combinacao;

        if (
            board[a] !== "" &&

            board[a] ===
                board[b] &&

            board[a] ===
                board[c]
        ) {

            return board[a];
        }
    }

    return null;
}

function verificarEmpate(
    board
) {

    return board.every(
        (celula) =>
            celula !== ""
    );
}

// ======================================================
// WEBSOCKET
// ======================================================

// TÓPICO PROFESSOR: TRATAMENTO DE REDE
wss.on(
    "connection",

    (ws) => {

        console.log(
            "Novo jogador conectado via WebSocket!"
        );

        // TÓPICO PROFESSOR: HEARTBEAT DE REDE
        ws.isAlive =
            true;

        ws.on(
            "pong",

            () => {

                ws.isAlive =
                    true;
            }
        );

        ws.roomCode =
            null;

        ws.playerName =
            null;

        ws.playerSymbol =
            null;

        ws.playerId =
            null;

        enviar(
            ws,
            {
                type:
                    "CONNECTED",

                message:
                    "Conectado ao servidor WebSocket!"
            }
        );

        enviarListaSalasPublicas(
            ws
        );

        ws.on(
            "message",

            async (data) => {

                try {

                    // TÓPICO PROFESSOR: PARSE EM MEMÓRIA
                    const mensagem =
                        JSON.parse(
                            data.toString()
                        );

                    console.log(
                        "Mensagem recebida:",
                        mensagem
                    );

                    switch (
                        mensagem.type
                    ) {

                        case "JOIN_ROOM":

                            await entrarNaSala(
                                ws,
                                mensagem
                            );

                            break;

                        case "LIST_ROOMS":

                            enviarListaSalasPublicas(
                                ws
                            );

                            break;

                        case "MOVE":

                            await executarJogada(
                                ws,
                                mensagem
                            );

                            break;

                        case "CHAT":

                            await enviarMensagemChat(
                                ws,
                                mensagem
                            );

                            break;

                        case "NEW_GAME":

                            await solicitarRevanche(
                                ws
                            );

                            break;

                        default:

                            enviar(
                                ws,
                                {
                                    type:
                                        "ERROR",

                                    message:
                                        "Tipo de mensagem desconhecido."
                                }
                            );
                    }

                } catch (erro) {

                    console.error(
                        "Erro ao processar mensagem:",
                        erro
                    );

                    enviar(
                        ws,
                        {
                            type:
                                "ERROR",

                            message:
                                "Não foi possível processar a mensagem."
                        }
                    );
                }
            }
        );

        // TÓPICO PROFESSOR: ERRO DE REDE
        ws.on(
            "error",

            (erro) => {

                console.error(
                    "Erro na conexão WebSocket:",
                    erro.message
                );
            }
        );

        // TÓPICO PROFESSOR: DESCONEXÃO DE REDE
        ws.on(
            "close",

            () => {

                tratarDesconexao(
                    ws
                )
                    .catch(
                        (erro) => {

                            console.error(
                                "Erro ao tratar desconexão:",
                                erro
                            );
                        }
                    );
            }
        );
    }
);

// ======================================================
// TÓPICO PROFESSOR: HEARTBEAT / TRATAMENTO DE REDE
// ======================================================

const heartbeatInterval =
    setInterval(
        () => {

            for (
                const cliente
                of wss.clients
            ) {

                if (
                    cliente.isAlive ===
                    false
                ) {

                    console.log(
                        "Cliente WebSocket sem resposta. Encerrando conexão."
                    );

                    cliente.terminate();

                    continue;
                }

                cliente.isAlive =
                    false;

                if (
                    cliente.readyState ===
                    WebSocket.OPEN
                ) {

                    cliente.ping();
                }
            }
        },

        HEARTBEAT_INTERVAL_MS
    );

server.on(
    "close",

    () => {

        clearInterval(
            heartbeatInterval
        );
    }
);

// ======================================================
// ENTRAR / CRIAR SALA
// ======================================================

async function entrarNaSala(
    ws,
    mensagem
) {

    const playerName =
        String(
            mensagem.playerName ||
            ""
        ).trim();

    let roomCode =
        mensagem.roomCode;

    if (
        !playerName
    ) {

        enviar(
            ws,
            {
                type:
                    "ERROR",

                message:
                    "Nome do jogador é obrigatório."
            }
        );

        return;
    }

    try {

        let sala;
        let jogadorBanco;

        if (
            !roomCode
        ) {

            jogadorBanco =
                await buscarOuCriarJogador(
                    playerName
                );

            const privada =
                mensagem.private !==
                false;

            let codigoJaExiste;

            do {

                roomCode =
                    gerarCodigoSala();

                codigoJaExiste =
                    rooms.has(
                        roomCode
                    ) ||
                    await codigoSalaExiste(
                        roomCode
                    );

            } while (
                codigoJaExiste
            );

            const idSala =
                await criarSalaBanco(
                    roomCode,

                    jogadorBanco.id_jogador,

                    privada
                );

            sala =
                criarEstruturaSala({
                    idSala,

                    roomCode,

                    privada,

                    hostId:
                        jogadorBanco.id_jogador,

                    hostName:
                        playerName
                });

            rooms.set(
                roomCode,
                sala
            );

            console.log(
                `Sala ${roomCode} criada no banco ` +
                `com ID ${idSala}. Privada: ${privada}`
            );

        } else {

            roomCode =
                String(
                    roomCode
                )
                    .trim()
                    .toUpperCase();

            sala =
                await buscarOuRecuperarSala(
                    roomCode
                );

            if (
                !sala
            ) {

                enviar(
                    ws,
                    {
                        type:
                            "ROOM_NOT_FOUND",

                        message:
                            "Sala não encontrada ou não está disponível para entrada."
                    }
                );

                return;
            }

            // TÓPICO PROFESSOR: RECONEXÃO / TROCA DE SOCKET
            const jogadorExistente =
                sala.players.find(
                    (player) =>
                        player.name ===
                        playerName
                );

            if (
                jogadorExistente
            ) {

                const socketAntigo =
                    jogadorExistente.socket;

                reconectarJogador(
                    ws,
                    sala,
                    jogadorExistente
                );

                if (
                    socketAntigo &&
                    socketAntigo !==
                        ws &&
                    (
                        socketAntigo.readyState ===
                            WebSocket.OPEN ||

                        socketAntigo.readyState ===
                            WebSocket.CONNECTING
                    )
                ) {

                    try {

                        socketAntigo.close(
                            1000,
                            "Conexao substituida por novo socket"
                        );

                    } catch (erro) {

                        console.log(
                            "Socket antigo já estava encerrado."
                        );
                    }
                }

                return;
            }

            if (
                sala.players.length ===
                    0 &&

                sala.hostName &&

                playerName !==
                    sala.hostName
            ) {

                enviar(
                    ws,
                    {
                        type:
                            "ROOM_HOST_REQUIRED",

                        message:
                            "Aguarde o host entrar na sala primeiro."
                    }
                );

                return;
            }

            if (
                sala.players.length >=
                2
            ) {

                enviar(
                    ws,
                    {
                        type:
                            "ROOM_FULL",

                        message:
                            "A sala já possui dois jogadores."
                    }
                );

                return;
            }

            jogadorBanco =
                await buscarOuCriarJogador(
                    playerName
                );
        }

        const simbolo =
            sala.players.length ===
                0
                ? "X"
                : "O";

        const jogador = {
            idJogador:
                jogadorBanco.id_jogador,

            name:
                playerName,

            symbol:
                simbolo,

            socket:
                ws,

            score:
                0,

            connected:
                true,

            disconnectTimer:
                null
        };

        if (
            sala.players.length ===
            0
        ) {

            sala.hostId =
                jogadorBanco.id_jogador;

            sala.hostName =
                playerName;
        }

        if (
            sala.players.length ===
            1
        ) {

            await adicionarVisitanteSala(
                sala.idSala,

                jogadorBanco.id_jogador
            );
        }

        sala.players.push(
            jogador
        );

        ws.roomCode =
            roomCode;

        ws.playerName =
            playerName;

        ws.playerSymbol =
            simbolo;

        ws.playerId =
            jogadorBanco.id_jogador;

        enviar(
            ws,
            {
                type:
                    "ROOM_JOINED",

                roomCode,

                playerName,

                playerSymbol:
                    simbolo,

                private:
                    sala.private
            }
        );

        console.log(
            `${playerName} entrou na sala ` +
            `${roomCode} como ${simbolo}`
        );

        broadcastListaSalasPublicas();

        if (
            sala.players.length ===
            2
        ) {

            sala.status =
                "PLAYING";

            await atualizarStatusSala(
                sala.idSala,
                "EM_JOGO"
            );

            const {
                placarHost,
                placarVisitante
            } =
                obterPlacarHostVisitante(
                    sala
                );

            sala.idPartida =
                await criarPartida(
                    sala.idSala,

                    sala.currentTurn,

                    placarHost,

                    placarVisitante
                );

            console.log(
                `Partida ${sala.idPartida} criada no banco.`
            );

            enviarParaSala(
                sala,
                {
                    type:
                        "GAME_STARTED",

                    roomCode,

                    currentTurn:
                        sala.currentTurn,

                    players:
                        sala.players.map(
                            (player) => ({
                                name:
                                    player.name,

                                symbol:
                                    player.symbol
                            })
                        ),

                    score:
                        obterPlacar(
                            sala
                        )
                }
            );

            console.log(
                `Partida iniciada na sala ${roomCode}`
            );

            broadcastListaSalasPublicas();

            iniciarCronometroTurno(
                sala
            );
        }

    } catch (erro) {

        console.error(
            "Erro ao registrar jogador/sala/partida no banco:",
            erro
        );

        enviar(
            ws,
            {
                type:
                    "DATABASE_ERROR",

                message:
                    "Não foi possível registrar os dados no banco."
            }
        );
    }
}

// ======================================================
// JOGADA
// ======================================================

async function executarJogada(
    ws,
    mensagem
) {

    const roomCode =
        ws.roomCode;

    const position =
        mensagem.position;

    if (
        !roomCode
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "Você não está em uma sala."
            }
        );

        return;
    }

    const sala =
        rooms.get(
            roomCode
        );

    if (
        !sala ||

        sala.status !==
            "PLAYING"
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "A partida não está disponível."
            }
        );

        return;
    }

    if (
        sala.players.some(
            (player) =>
                !player.connected
        )
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "A partida está pausada aguardando reconexão."
            }
        );

        return;
    }

    const simboloJogador =
        ws.playerSymbol;

    if (
        sala.currentTurn !==
        simboloJogador
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "Não é a sua vez."
            }
        );

        return;
    }

    if (
        !Number.isInteger(
            position
        ) ||

        position < 0 ||

        position > 8
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "Posição inválida."
            }
        );

        return;
    }

    if (
        sala.board[position] !==
        ""
    ) {

        enviar(
            ws,
            {
                type:
                    "INVALID_MOVE",

                message:
                    "Essa posição já está ocupada."
            }
        );

        return;
    }

    cancelarCronometroTurno(
        sala
    );

    sala.board[position] =
        simboloJogador;

    try {

        await registrarJogada(
            sala.idPartida,

            ws.playerId,

            position,

            simboloJogador
        );

        console.log(
            `Jogada registrada no banco: ` +
            `${ws.playerName} -> posição ${position}`
        );

    } catch (erro) {

        sala.board[position] =
            "";

        iniciarCronometroTurno(
            sala
        );

        console.error(
            "Erro ao registrar jogada:",
            erro
        );

        enviar(
            ws,
            {
                type:
                    "DATABASE_ERROR",

                message:
                    "Não foi possível registrar a jogada."
            }
        );

        return;
    }

    const vencedor =
        verificarVencedor(
            sala.board
        );

    if (
        vencedor
    ) {

        sala.status =
            "FINISHED";

        sala.currentTurn =
            null;

        cancelarCronometroTurno(
            sala
        );

        const jogadorVencedor =
            sala.players.find(
                (player) =>
                    player.symbol ===
                    vencedor
            );

        const jogadorPerdedor =
            sala.players.find(
                (player) =>
                    player !==
                    jogadorVencedor
            );

        if (
            jogadorVencedor
        ) {

            jogadorVencedor.score++;
        }

        const {
            placarHost,
            placarVisitante
        } =
            obterPlacarHostVisitante(
                sala
            );

        const statusResultado =
            jogadorVencedor ===
                sala.players[0]

                ? "VITORIA_HOST"

                : "VITORIA_VISITANTE";

        try {

            await atualizarStatusSala(
                sala.idSala,
                "FINALIZADA"
            );

            await finalizarPartida(
                sala.idPartida,

                jogadorVencedor.idJogador,

                statusResultado,

                placarHost,

                placarVisitante
            );

            await registrarVitoriaDerrota(
                jogadorVencedor.idJogador,

                jogadorPerdedor.idJogador
            );

        } catch (erro) {

            console.error(
                "Erro ao finalizar partida no banco:",
                erro
            );
        }

        enviarParaSala(
            sala,
            {
                type:
                    "BOARD_UPDATE",

                board:
                    sala.board,

                nextTurn:
                    null
            }
        );

        enviarParaSala(
            sala,
            {
                type:
                    "GAME_OVER",

                result:
                    "WIN",

                winner:
                    vencedor,

                winnerName:
                    jogadorVencedor.name,

                score:
                    obterPlacar(
                        sala
                    )
            }
        );

        enviarParaSala(
            sala,
            {
                type:
                    "SCORE_UPDATE",

                score:
                    obterPlacar(
                        sala
                    )
            }
        );

        console.log(
            `Fim de jogo! ` +
            `${jogadorVencedor.name} venceu ` +
            `com ${vencedor}.`
        );

        return;
    }

    if (
        verificarEmpate(
            sala.board
        )
    ) {

        sala.status =
            "FINISHED";

        sala.currentTurn =
            null;

        cancelarCronometroTurno(
            sala
        );

        const {
            placarHost,
            placarVisitante
        } =
            obterPlacarHostVisitante(
                sala
            );

        try {

            await atualizarStatusSala(
                sala.idSala,
                "FINALIZADA"
            );

            await finalizarPartida(
                sala.idPartida,

                null,

                "EMPATE",

                placarHost,

                placarVisitante
            );

        } catch (erro) {

            console.error(
                "Erro ao registrar empate no banco:",
                erro
            );
        }

        enviarParaSala(
            sala,
            {
                type:
                    "BOARD_UPDATE",

                board:
                    sala.board,

                nextTurn:
                    null
            }
        );

        enviarParaSala(
            sala,
            {
                type:
                    "GAME_OVER",

                result:
                    "DRAW",

                winner:
                    null,

                winnerName:
                    null,

                score:
                    obterPlacar(
                        sala
                    )
            }
        );

        enviarParaSala(
            sala,
            {
                type:
                    "SCORE_UPDATE",

                score:
                    obterPlacar(
                        sala
                    )
            }
        );

        console.log(
            "Fim de jogo! Empate."
        );

        return;
    }

    sala.currentTurn =
        simboloJogador ===
            "X"
            ? "O"
            : "X";

    try {

        await atualizarTurnoPartida(
            sala.idPartida,

            sala.currentTurn
        );

    } catch (erro) {

        console.error(
            "Erro ao atualizar turno da partida:",
            erro.message
        );
    }

    enviarParaSala(
        sala,
        {
            type:
                "BOARD_UPDATE",

            board:
                sala.board,

            nextTurn:
                sala.currentTurn
        }
    );

    console.log(
        `Próximo turno: ${sala.currentTurn}`
    );

    iniciarCronometroTurno(
        sala
    );
}

// ======================================================
// CHAT
// ======================================================

async function enviarMensagemChat(
    ws,
    mensagem
) {

    const roomCode =
        ws.roomCode;

    if (
        !roomCode
    ) {

        enviar(
            ws,
            {
                type:
                    "CHAT_ERROR",

                message:
                    "Você não está em uma sala."
            }
        );

        return;
    }

    const sala =
        rooms.get(
            roomCode
        );

    if (
        !sala
    ) {

        enviar(
            ws,
            {
                type:
                    "CHAT_ERROR",

                message:
                    "Sala não encontrada."
            }
        );

        return;
    }

    const texto =
        String(
            mensagem.message ||
            ""
        ).trim();

    if (
        !texto
    ) {

        enviar(
            ws,
            {
                type:
                    "CHAT_ERROR",

                message:
                    "A mensagem não pode estar vazia."
            }
        );

        return;
    }

    try {

        await registrarMensagemChat(
            sala.idSala,

            ws.playerId,

            texto
        );

    } catch (erro) {

        console.error(
            "Erro ao registrar mensagem no banco:",
            erro
        );

        enviar(
            ws,
            {
                type:
                    "CHAT_ERROR",

                message:
                    "Não foi possível salvar a mensagem."
            }
        );

        return;
    }

    enviarParaSala(
        sala,
        {
            type:
                "CHAT_MESSAGE",

            playerName:
                ws.playerName,

            playerSymbol:
                ws.playerSymbol,

            message:
                texto
        }
    );

    console.log(
        `[CHAT ${roomCode}] ` +
        `${ws.playerName}: ${texto}`
    );
}

// ======================================================
// REVANCHE
// ======================================================

async function solicitarRevanche(
    ws
) {

    const roomCode =
        ws.roomCode;

    if (
        !roomCode
    ) {

        enviar(
            ws,
            {
                type:
                    "NEW_GAME_ERROR",

                message:
                    "Você não está em uma sala."
            }
        );

        return;
    }

    const sala =
        rooms.get(
            roomCode
        );

    if (
        !sala
    ) {

        enviar(
            ws,
            {
                type:
                    "NEW_GAME_ERROR",

                message:
                    "Sala não encontrada."
            }
        );

        return;
    }

    if (
        sala.status !==
        "FINISHED"
    ) {

        enviar(
            ws,
            {
                type:
                    "NEW_GAME_ERROR",

                message:
                    "A partida atual ainda não terminou."
            }
        );

        return;
    }

    if (
        sala.rematchRequests
            .has(ws)
    ) {

        enviar(
            ws,
            {
                type:
                    "NEW_GAME_ERROR",

                message:
                    "Você já solicitou a revanche."
            }
        );

        return;
    }

    sala.rematchRequests
        .add(ws);

    console.log(
        `${ws.playerName} solicitou revanche ` +
        `na sala ${roomCode}`
    );

    if (
        sala.rematchRequests
            .size === 1
    ) {

        enviarParaSala(
            sala,
            {
                type:
                    "REMATCH_REQUESTED",

                requestedBy:
                    ws.playerName,

                message:
                    `${ws.playerName} solicitou uma revanche.`
            }
        );

        return;
    }

    if (
        sala.rematchRequests
            .size === 2
    ) {

        await iniciarNovaPartida(
            sala
        );
    }
}

async function iniciarNovaPartida(
    sala
) {

    cancelarCronometroTurno(
        sala
    );

    sala.board = [
        "", "", "",
        "", "", "",
        "", "", ""
    ];

    for (
        const player
        of sala.players
    ) {

        player.symbol =
            player.symbol ===
                "X"
                ? "O"
                : "X";

        if (
            player.socket
        ) {

            player.socket.playerSymbol =
                player.symbol;
        }
    }

    sala.currentTurn =
        "X";

    sala.status =
        "PLAYING";

    sala.rematchRequests
        .clear();

    try {

        await atualizarStatusSala(
            sala.idSala,
            "EM_JOGO"
        );

        const {
            placarHost,
            placarVisitante
        } =
            obterPlacarHostVisitante(
                sala
            );

        sala.idPartida =
            await criarPartida(
                sala.idSala,

                sala.currentTurn,

                placarHost,

                placarVisitante
            );

        console.log(
            `Nova partida ${sala.idPartida} criada no banco.`
        );

    } catch (erro) {

        console.error(
            "Erro ao criar revanche no banco:",
            erro
        );

        enviarParaSala(
            sala,
            {
                type:
                    "DATABASE_ERROR",

                message:
                    "Não foi possível criar a nova partida."
            }
        );

        return;
    }

    enviarParaSala(
        sala,
        {
            type:
                "NEW_GAME_STARTED",

            roomCode:
                sala.code,

            board:
                sala.board,

            currentTurn:
                sala.currentTurn,

            players:
                sala.players.map(
                    (player) => ({
                        name:
                            player.name,

                        symbol:
                            player.symbol
                    })
                ),

            score:
                obterPlacar(
                    sala
                )
        }
    );

    console.log(
        `Nova partida iniciada na sala ${sala.code}`
    );

    iniciarCronometroTurno(
        sala
    );
}

// ======================================================
// DESCONEXÃO
// ======================================================

async function tratarDesconexao(
    ws
) {

    const roomCode =
        ws.roomCode;

    if (
        !roomCode
    ) {

        console.log(
            "Cliente desconectado antes de entrar em uma sala."
        );

        return;
    }

    const sala =
        rooms.get(
            roomCode
        );

    if (
        !sala
    ) {

        return;
    }

    const jogador =
        sala.players.find(
            (player) =>
                player.socket ===
                ws
        );

    if (
        !jogador ||

        !jogador.connected
    ) {

        return;
    }

    jogador.connected =
        false;

    jogador.socket =
        null;

    console.log(
        `${jogador.name} desconectou ` +
        `da sala ${roomCode}`
    );

    if (
        sala.status ===
        "WAITING"
    ) {

        if (
            sala.private
        ) {

            console.log(
                `Sala privada ${roomCode} permanece ` +
                `persistida aguardando reconexão.`
            );

            return;
        }

        rooms.delete(
            roomCode
        );

        try {

            await removerSalaBanco(
                sala.idSala
            );

            console.log(
                `Sala pública ${roomCode} removida do banco.`
            );

        } catch (erro) {

            console.error(
                "Erro ao remover sala pública do banco:",
                erro.message
            );
        }

        broadcastListaSalasPublicas();

        return;
    }

    if (
        sala.status !==
        "PLAYING"
    ) {

        return;
    }

    cancelarCronometroTurno(
        sala
    );

    enviarParaSala(
        sala,
        {
            type:
                "PLAYER_DISCONNECTED",

            playerName:
                jogador.name,

            playerSymbol:
                jogador.symbol,

            reconnectSeconds:
                TEMPO_RECONEXAO_MS /
                1000,

            message:
                `${jogador.name} desconectou. ` +
                `Aguardando reconexão por 30 segundos.`
        }
    );

    jogador.disconnectTimer =
        setTimeout(
            () => {

                finalizarPorWO(
                    sala,
                    jogador
                )
                    .catch(
                        (erro) => {

                            console.error(
                                "Erro ao finalizar por W.O.:",
                                erro
                            );
                        }
                    );

            },

            TEMPO_RECONEXAO_MS
        );
}

// ======================================================
// RECONEXÃO
// ======================================================

// TÓPICO PROFESSOR: RECONEXÃO AUTOMÁTICA - BACKEND
function reconectarJogador(
    ws,
    sala,
    jogador
) {

    if (
        jogador.disconnectTimer
    ) {

        clearTimeout(
            jogador.disconnectTimer
        );

        jogador.disconnectTimer =
            null;
    }

    jogador.socket =
        ws;

    jogador.connected =
        true;

    ws.roomCode =
        sala.code;

    ws.playerName =
        jogador.name;

    ws.playerSymbol =
        jogador.symbol;

    ws.playerId =
        jogador.idJogador;

    enviar(
        ws,
        {
            type:
                "ROOM_RECONNECTED",

            roomCode:
                sala.code,

            playerName:
                jogador.name,

            playerSymbol:
                jogador.symbol,

            board:
                sala.board,

            currentTurn:
                sala.currentTurn,

            status:
                sala.status,

            score:
                obterPlacar(
                    sala
                ),

            players:
                sala.players.map(
                    (player) => ({
                        name:
                            player.name,

                        symbol:
                            player.symbol,

                        connected:
                            player.connected
                    })
                )
        }
    );

    enviarParaSala(
        sala,
        {
            type:
                "PLAYER_RECONNECTED",

            playerName:
                jogador.name,

            playerSymbol:
                jogador.symbol,

            message:
                `${jogador.name} reconectou à partida.`
        }
    );

    console.log(
        `${jogador.name} reconectou ` +
        `na sala ${sala.code}`
    );

    if (
        sala.status ===
        "PLAYING"
    ) {

        iniciarCronometroTurno(
            sala
        );
    }
}

// ======================================================
// W.O.
// ======================================================

async function finalizarPorWO(
    sala,
    jogadorDesconectado
) {

    jogadorDesconectado
        .disconnectTimer =
        null;

    if (
        jogadorDesconectado
            .connected
    ) {

        return;
    }

    if (
        sala.status !==
        "PLAYING"
    ) {

        return;
    }

    cancelarCronometroTurno(
        sala
    );

    const vencedor =
        sala.players.find(
            (player) =>

                player !==
                    jogadorDesconectado &&

                player.connected
        );

    sala.status =
        "FINISHED";

    sala.currentTurn =
        null;

    sala.rematchRequests
        .clear();

    if (
        !vencedor
    ) {

        console.log(
            `Partida da sala ${sala.code} ` +
            `encerrada sem vencedor.`
        );

        return;
    }

    vencedor.score++;

    const {
        placarHost,
        placarVisitante
    } =
        obterPlacarHostVisitante(
            sala
        );

    const statusResultado =
        vencedor ===
            sala.players[0]

            ? "VITORIA_HOST"

            : "VITORIA_VISITANTE";

    try {

        await atualizarStatusSala(
            sala.idSala,
            "FINALIZADA"
        );

        await finalizarPartida(
            sala.idPartida,

            vencedor.idJogador,

            statusResultado,

            placarHost,

            placarVisitante
        );

        await registrarVitoriaDerrota(
            vencedor.idJogador,

            jogadorDesconectado.idJogador
        );

    } catch (erro) {

        console.error(
            "Erro ao registrar W.O. no banco:",
            erro
        );
    }

    enviarParaSala(
        sala,
        {
            type:
                "GAME_OVER",

            result:
                "WO",

            winner:
                vencedor.symbol,

            winnerName:
                vencedor.name,

            disconnectedPlayer:
                jogadorDesconectado.name,

            score:
                obterPlacar(
                    sala
                )
        }
    );

    enviarParaSala(
        sala,
        {
            type:
                "SCORE_UPDATE",

            score:
                obterPlacar(
                    sala
                )
        }
    );

    console.log(
        `${vencedor.name} venceu por W.O. ` +
        `após desconexão de ` +
        `${jogadorDesconectado.name}.`
    );
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

// TÓPICO PROFESSOR: INICIALIZAÇÃO DA PERSISTÊNCIA
inicializarBanco()

    .then(
        async () => {

            await recuperarSalasPrivadasPersistidas();

            server.listen(
                PORT,

                () => {

                    console.log(
                        `Servidor rodando em http://localhost:${PORT}`
                    );

                    console.log(
                        `WebSocket rodando em ws://localhost:${PORT}`
                    );

                    console.log(
                        "Autenticação HTTP disponível."
                    );

                    console.log(
                        "GET/POST de salas disponíveis."
                    );

                    console.log(
                        "Heartbeat WebSocket ativo."
                    );

                    console.log(
                        "Rotas HTTP modularizadas."
                    );
                }
            );
        }
    )

    .catch(
        (erro) => {

            console.error(
                "Não foi possível iniciar o banco:",
                erro
            );

            process.exit(
                1
            );
        }
    );