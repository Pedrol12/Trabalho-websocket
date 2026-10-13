
import { criarServicoSocket } from "./jogo/socket.js";

import { configurarJogadas } from "./jogo/tabuleiro.js";

import { atualizarPlacar } from "./jogo/placar.js";

import { configurarChat } from "./jogo/chat.js";

import {
    configurarRevanche,
    configurarSaida
} from "./jogo/modal.js";

import {
    criarTratadorEventosJogo
} from "./jogo/eventos.js";

const $ = (id) => document.getElementById(id);

// Recupera a sala selecionada
const codigoDaSala = sessionStorage.getItem("roomCode");

// Compartilha o estado da partida
const estado = {
    codigoDaSala,
    meuNome: null,
    meuSimbolo: null,
    partidaAtiva: false,
    tentativasHost: 0,
    atualizarPlacar,
    enviarEntradaNaSala: null,
    confirmarSaida: null
};

let servicoSocket = null;

// Verifica a sessão do jogador
async function verificarUsuario() {
    try {
        const resposta = await fetch("/api/auth/me", {
            credentials: "include"
        });

        if (!resposta.ok) {
            window.location.href = "/login.html";
            return null;
        }

        const dados = await resposta.json();

        return dados.usuario;
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);

        window.location.href = "/login.html";

        return null;
    }
}

// Solicita a entrada na sala
function enviarEntradaNaSala() {
    if (
        !servicoSocket.socketEstaAberto() ||
        !estado.meuNome ||
        !estado.codigoDaSala
    ) {
        return;
    }

    servicoSocket.enviarMensagem({
        type: "JOIN_ROOM",
        playerName: estado.meuNome,
        roomCode: estado.codigoDaSala
    });
}

estado.enviarEntradaNaSala = enviarEntradaNaSala;

// Inicializa os serviços da partida
async function inicializarJogo() {
    if (!codigoDaSala) {
        window.location.href = "/lobby.html";
        return;
    }

    const usuario = await verificarUsuario();

    if (!usuario) {
        return;
    }

    estado.meuNome = usuario.nickname;

    sessionStorage.setItem(
        "playerName",
        estado.meuNome
    );

    // Prepara o tratamento das mensagens
    const tratarMensagem = criarTratadorEventosJogo(estado);

    // Prepara a conexão WebSocket
    servicoSocket = criarServicoSocket({
        aoAbrir: () => {
            console.log("WebSocket conectado.");

            $("status-conexao").textContent = "Conectado";

            enviarEntradaNaSala();
        },

        aoMensagem: tratarMensagem,

        aoErro: (erro) => {
            console.error("Erro WebSocket:", erro);
        },

        aoFechar: () => {
            $("status-conexao").textContent =
                "Reconectando...";
        }
    });

    // Configura as jogadas
    configurarJogadas({
        socketEstaAberto: servicoSocket.socketEstaAberto,
        partidaEstaAtiva: () => estado.partidaAtiva,
        enviarMensagem: servicoSocket.enviarMensagem
    });

    // Configura o chat
    configurarChat({
        socketEstaAberto: servicoSocket.socketEstaAberto,
        enviarMensagem: servicoSocket.enviarMensagem
    });

    // Configura a revanche
    configurarRevanche({
        socketEstaAberto: servicoSocket.socketEstaAberto,
        enviarMensagem: servicoSocket.enviarMensagem
    });

    // Configura a saída voluntária
    const { confirmarSaida } = configurarSaida({
        enviarMensagem: servicoSocket.enviarMensagem,
        desconectar: servicoSocket.desconectar
    });

    estado.confirmarSaida = confirmarSaida;

    // Conecta ao servidor
    servicoSocket.conectar();
}

// Inicia o jogo
inicializarJogo();
