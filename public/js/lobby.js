
import {
    criarSocketLobby,
    enviarMensagem
} from "./lobby/socket.js";

import { criarServicoSalas } from "./lobby/salas.js";

import {
    criarTratadorEventosLobby
} from "./lobby/eventos.js";

const $ = (id) => document.getElementById(id);

let usuario = null;
let socket = null;

// Prepara o gerenciamento das salas
const salas = criarServicoSalas({
    obterSocket: () => socket,
    obterUsuario: () => usuario
});

// Prepara os eventos WebSocket
const tratarMensagemServidor = criarTratadorEventosLobby({
    renderizarSalasPublicas: salas.renderizarSalasPublicas,
    mostrarSalaEntrou: salas.mostrarSalaEntrou,
    guardarSala: salas.guardarSala,
    liberarBotoesLobby: salas.liberarBotoesLobby
});

// Verifica a sessão do usuário
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
        console.error("Erro ao verificar usuário:", erro);
        window.location.href = "/login.html";
        return null;
    }
}

// Configura a criação de sala privada
$("btn-criar").addEventListener("click", async () => {
    $("msg-lobby").textContent = "";

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        $("msg-lobby").textContent =
            "Aguarde a conexão com o servidor.";
        return;
    }

    $("btn-criar").disabled = true;

    const codigo = await salas.criarSalaPrivada();

    if (!codigo) {
        $("btn-criar").disabled = false;
        return;
    }

    salas.entrarNaSala(codigo);
});

// Configura a entrada por código
$("btn-entrar").addEventListener("click", () => {
    const codigo = $("input-codigo").value.trim().toUpperCase();

    if (!codigo) {
        $("msg-lobby").textContent =
            "Digite o código da sala.";
        return;
    }

    salas.entrarNaSala(codigo);
});

// Copia o código da sala
$("btn-copiar-codigo").addEventListener("click", async () => {
    const codigo = $("codigo-sala").textContent.trim();
    const botao = $("btn-copiar-codigo");

    if (!codigo) {
        return;
    }

    try {
        await navigator.clipboard.writeText(codigo);

        botao.textContent = "Copiado!";

        setTimeout(() => {
            botao.textContent = "Copiar";
        }, 2000);
    } catch (erro) {
        console.error("Erro ao copiar código:", erro);

        $("msg-lobby").textContent =
            "Não foi possível copiar o código.";
    }
});

// Configura o logout
$("btn-logout").addEventListener("click", async () => {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (erro) {
        console.error("Erro no logout:", erro);
    }

    sessionStorage.removeItem("roomCode");
    sessionStorage.removeItem("playerName");

    window.location.href = "/login.html";
});

// Inicializa o lobby
async function inicializarLobby() {
    usuario = await verificarUsuario();

    if (!usuario) {
        return;
    }

    $("nome-usuario-logado").textContent = usuario.nickname;

    socket = criarSocketLobby({
        aoAbrir: (conexao) => {
            $("status-conexao").textContent = "Conectado";

            salas.liberarBotoesLobby();

            enviarMensagem(conexao, {
                type: "LIST_ROOMS"
            });
        },

        aoMensagem: tratarMensagemServidor,

        aoErro: () => {
            $("status-conexao").textContent = "Erro de conexão";
        },

        aoFechar: () => {
            $("status-conexao").textContent =
                "Desconectado. Recarregue a página.";
        }
    });
}

inicializarLobby();
