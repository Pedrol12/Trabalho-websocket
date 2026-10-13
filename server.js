
const express = require("express");
const http = require("http");
const session = require("express-session");
const { WebSocketServer } = require("ws");

// Importa as funções do banco
const banco = require("./database");

// Importa os serviços do jogo
const { verificarVencedor, verificarEmpate } = require("./src/services/regrasJogo");
const { obterPlacar, obterPlacarHostVisitante } = require("./src/services/placar");
const { criarServicoCronometro } = require("./src/services/cronometro");

const {
    gerarCodigoSala,
    criarEstruturaSala,
    criarServicoSalas
} = require("./src/services/salas");

const { criarServicoSalasPublicas } = require("./src/services/salasPublicas");
const { criarServicoChat } = require("./src/services/chat");
const { criarServicoJogadas } = require("./src/services/jogadas");
const { criarServicoRevanche } = require("./src/services/revanche");
const { criarServicoConexao } = require("./src/services/conexao");
const { criarServicoEntradaSalas } = require("./src/services/entradaSalas");

// Importa os auxiliares WebSocket
const { enviar, enviarParaSala } = require("./src/websocket/mensagens");
const { criarEventosWebSocket } = require("./src/websocket/eventos");

// Importa os controllers e as rotas
const { criarAuthController } = require("./src/controllers/auth.controller");
const { criarSalasController } = require("./src/controllers/salas.controller");
const { criarRotasAuth } = require("./src/routes/auth.routes");
const { criarRotasSalas } = require("./src/routes/salas.routes");

// Configura o servidor
const app = express();
const PORT = 3000;
const TEMPO_TURNO_MS = 15000;
const TEMPO_RECONEXAO_MS = 30000;
const rooms = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configura as sessões
app.use(session({
    secret: process.env.SESSION_SECRET || "jogo-da-velha-segredo-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 8
    }
}));

// Disponibiliza os arquivos do frontend
app.use(express.static("public"));

// Cria o servidor HTTP e WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Prepara o serviço de salas
const {
    recuperarSalasPrivadasPersistidas,
    buscarOuRecuperarSala
} = criarServicoSalas({
    rooms,
    listarSalasAguardandoBanco: banco.listarSalasAguardandoBanco,
    buscarSalaPorCodigoBanco: banco.buscarSalaPorCodigoBanco
});

// Prepara o serviço de salas públicas
const {
    enviarListaSalasPublicas,
    broadcastListaSalasPublicas
} = criarServicoSalasPublicas({
    rooms,
    wss,
    enviar
});

// Prepara o serviço de cronômetro
const {
    iniciarCronometroTurno,
    cancelarCronometroTurno
} = criarServicoCronometro({
    tempoTurnoMs: TEMPO_TURNO_MS,
    enviarParaSala,
    atualizarTurnoPartida: banco.atualizarTurnoPartida
});

// Prepara o serviço de chat
const { enviarMensagemChat } = criarServicoChat({
    rooms,
    enviar,
    enviarParaSala,
    registrarMensagemChat: banco.registrarMensagemChat
});

// Prepara o serviço de jogadas
const { executarJogada } = criarServicoJogadas({
    rooms,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    verificarVencedor,
    verificarEmpate,
    obterPlacar,
    obterPlacarHostVisitante,
    registrarJogada: banco.registrarJogada,
    atualizarTurnoPartida: banco.atualizarTurnoPartida,
    atualizarStatusSala: banco.atualizarStatusSala,
    finalizarPartida: banco.finalizarPartida,
    registrarVitoriaDerrota: banco.registrarVitoriaDerrota
});

// Prepara o serviço de revanche
const { solicitarRevanche } = criarServicoRevanche({
    rooms,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    obterPlacar,
    obterPlacarHostVisitante,
    atualizarStatusSala: banco.atualizarStatusSala,
    criarPartida: banco.criarPartida
});

// Prepara o serviço de conexão e saída
const {
    tratarDesconexao,
    reconectarJogador,
    sairVoluntariamente
} = criarServicoConexao({
    rooms,
    tempoReconexaoMs: TEMPO_RECONEXAO_MS,
    enviar,
    enviarParaSala,
    cancelarCronometroTurno,
    iniciarCronometroTurno,
    broadcastListaSalasPublicas,
    removerSalaBanco: banco.removerSalaBanco,
    obterPlacar,
    obterPlacarHostVisitante,
    atualizarStatusSala: banco.atualizarStatusSala,
    finalizarPartida: banco.finalizarPartida,
    registrarVitoriaDerrota: banco.registrarVitoriaDerrota
});

// Prepara o serviço de entrada nas salas
const { entrarNaSala } = criarServicoEntradaSalas({
    rooms,
    enviar,
    enviarParaSala,
    gerarCodigoSala,
    criarEstruturaSala,
    buscarOuRecuperarSala,
    reconectarJogador,
    broadcastListaSalasPublicas,
    obterPlacar,
    obterPlacarHostVisitante,
    iniciarCronometroTurno,
    buscarOuCriarJogador: banco.buscarOuCriarJogador,
    codigoSalaExiste: banco.codigoSalaExiste,
    criarSalaBanco: banco.criarSalaBanco,
    adicionarVisitanteSala: banco.adicionarVisitanteSala,
    atualizarStatusSala: banco.atualizarStatusSala,
    criarPartida: banco.criarPartida
});

// Configura os eventos WebSocket
const { configurarEventos } = criarEventosWebSocket({
    wss,
    enviar,
    enviarListaSalasPublicas,
    entrarNaSala,
    executarJogada,
    enviarMensagemChat,
    solicitarRevanche,
    tratarDesconexao,
    sairVoluntariamente
});

// Registra os eventos WebSocket
configurarEventos();

// Prepara o controller de autenticação
const authController = criarAuthController({
    criarJogadorAutenticado: banco.criarJogadorAutenticado,
    buscarJogadorPorEmail: banco.buscarJogadorPorEmail,
    buscarJogadorPorId: banco.buscarJogadorPorId,
    buscarJogadorPorNickname: banco.buscarJogadorPorNickname,
    atualizarCredenciaisJogador: banco.atualizarCredenciaisJogador
});

// Prepara o controller de salas
const salasController = criarSalasController({
    rooms,
    gerarCodigoSala,
    criarEstruturaSala,
    codigoSalaExiste: banco.codigoSalaExiste,
    criarSalaBanco: banco.criarSalaBanco,
    listarSalasBanco: banco.listarSalasBanco,
    listarSalasPublicasBanco: banco.listarSalasPublicasBanco,
    listarSalasPrivadasBanco: banco.listarSalasPrivadasBanco,
    buscarSalaPorCodigoBanco: banco.buscarSalaPorCodigoBanco
});

// Rota principal
app.get("/", (req, res) => {
    res.send("Servidor do Jogo da Velha funcionando!");
});

// Rota de status
app.get("/api/status", (req, res) => {
    res.json({
        sucesso: true,
        servidor: "Jogo da Velha WebSocket + HTTP",
        websocket: `ws://localhost:${PORT}`
    });
});

// Registra as rotas HTTP
app.use("/api/auth", criarRotasAuth(authController));
app.use("/api/salas", criarRotasSalas(salasController));

// Inicializa o banco e recupera as salas
banco.inicializarBanco()
    .then(async () => {
        await recuperarSalasPrivadasPersistidas();

        // Inicia o servidor
        server.listen(PORT, () => {
            console.log(
                `Servidor rodando em http://localhost:${PORT}`
            );

            console.log(
                `WebSocket rodando em ws://localhost:${PORT}`
            );

            console.log("Autenticação HTTP disponível.");
            console.log("GET/POST de salas disponíveis.");
        });
    })
    .catch((erro) => {
        console.error(
            "Erro ao inicializar o servidor:",
            erro
        );

        process.exitCode = 1;
    });
