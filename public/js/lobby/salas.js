
import {
    enviarMensagem,
    socketEstaAberto
} from "./socket.js";

const $ = (id) => document.getElementById(id);

// Cria as funções de gerenciamento de salas
export function criarServicoSalas({
    obterSocket,
    obterUsuario
}) {
    // Cria uma sala privada pela API
    async function criarSalaPrivada() {
        try {
            const resposta = await fetch("/api/salas/privadas", {
                method: "POST",
                credentials: "include"
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                $("msg-lobby").textContent =
                    dados.erro || "Não foi possível criar a sala.";

                return null;
            }

            return dados.sala.roomCode;
        } catch (erro) {
            console.error("Erro ao criar sala:", erro);

            $("msg-lobby").textContent =
                "Não foi possível conectar ao servidor.";

            return null;
        }
    }

    // Solicita entrada em uma sala
    function entrarNaSala(roomCode) {
        $("msg-lobby").textContent = "";

        const socket = obterSocket();
        const usuario = obterUsuario();

        if (!socketEstaAberto(socket)) {
            $("msg-lobby").textContent =
                "A conexão com o servidor ainda não está pronta.";

            return;
        }

        const codigo = String(roomCode || "")
            .trim()
            .toUpperCase();

        if (!codigo) {
            $("msg-lobby").textContent =
                "Informe o código da sala.";

            return;
        }

        enviarMensagem(socket, {
            type: "JOIN_ROOM",
            playerName: usuario.nickname,
            roomCode: codigo
        });
    }

    // Exibe as salas públicas disponíveis
    function renderizarSalasPublicas(salas) {
        const lista = $("lista-salas-publicas");
        const vazio = $("msg-salas-publicas");

        lista.innerHTML = "";

        if (!salas || salas.length === 0) {
            vazio.hidden = false;
            return;
        }

        vazio.hidden = true;

        salas.forEach((sala) => {
            const item = document.createElement("li");
            const texto = document.createElement("span");
            const botao = document.createElement("button");

            texto.textContent =
                `${sala.hostName || "Sala"} · ${sala.roomCode}`;

            botao.type = "button";
            botao.textContent = "Entrar";

            botao.addEventListener("click", () => {
                entrarNaSala(sala.roomCode);
            });

            item.appendChild(texto);
            item.appendChild(botao);
            lista.appendChild(item);
        });
    }

    // Salva os dados da sala atual
    function guardarSala(roomCode) {
        sessionStorage.setItem("roomCode", roomCode);
        sessionStorage.setItem(
            "playerName",
            obterUsuario().nickname
        );
    }

    // Exibe a sala após a entrada
    function mostrarSalaEntrou(roomCode) {
        guardarSala(roomCode);

        $("codigo-sala").textContent = roomCode;
        $("area-sala").hidden = false;

        $("btn-criar").disabled = true;
        $("btn-entrar").disabled = true;

        $("msg-lobby").textContent =
            "Aguardando o outro jogador...";
    }

    // Libera os botões do lobby
    function liberarBotoesLobby() {
        $("btn-criar").disabled = false;
        $("btn-entrar").disabled = false;
    }

    return {
        criarSalaPrivada,
        entrarNaSala,
        renderizarSalasPublicas,
        guardarSala,
        mostrarSalaEntrou,
        liberarBotoesLobby
    };
}
