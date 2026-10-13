
import {
    montarArena,
    atualizarTabuleiro,
    mostrarJogadaInvalida
} from "./tabuleiro.js";

import { atualizarPlacar } from "./placar.js";

import { adicionarMensagemChat } from "./chat.js";

import {
    mostrarFimDeJogo,
    mostrarPedidoRevanche,
    mostrarJogadorSaiu
} from "./modal.js";

const $ = (id) => document.getElementById(id);

const TABULEIRO_VAZIO = [
    "", "", "",
    "", "", "",
    "", "", ""
];

// Cria o tratamento das mensagens WebSocket
export function criarTratadorEventosJogo(estado) {
    return function tratarMensagemServidor(event) {
        let mensagem;

        try {
            mensagem = JSON.parse(event.data);
        } catch (erro) {
            console.error("Mensagem inválida:", erro);
            return;
        }

        console.log("Servidor:", mensagem);

        switch (mensagem.type) {
            // Confirma a conexão
            case "CONNECTED":
                break;

            // Confirma a entrada na sala
            case "ROOM_JOINED":
                estado.meuSimbolo = mensagem.playerSymbol;
                estado.partidaAtiva = false;

                $("arena-codigo").textContent =
                    estado.codigoDaSala;

                $("arena-simbolo").textContent =
                    estado.meuSimbolo;

                $("msg-arena").textContent =
                    "Aguardando o outro jogador...";
                break;

            // Recupera a partida após reconexão
            case "ROOM_RECONNECTED":
                estado.tentativasHost = 0;
                estado.meuSimbolo = mensagem.playerSymbol;

                estado.partidaAtiva =
                    mensagem.status === "PLAYING";

                montarArena(
                    mensagem.players || [],
                    mensagem.board || TABULEIRO_VAZIO,
                    mensagem.currentTurn,
                    mensagem.score || [],
                    estado
                );

                if (mensagem.status === "FINISHED") {
                    $("indicador-turno").textContent =
                        "Fim de jogo";
                }
                break;

            // Aguarda a entrada do host
            case "ROOM_HOST_REQUIRED":
                estado.partidaAtiva = false;

                $("msg-arena").textContent =
                    mensagem.message ||
                    "Aguardando o host entrar na sala...";

                if (estado.tentativasHost < 10) {
                    estado.tentativasHost++;

                    setTimeout(() => {
                        estado.enviarEntradaNaSala();
                    }, 1000);
                }
                break;

            // Trata erros de entrada
            case "ROOM_NOT_FOUND":
            case "ROOM_FULL":
            case "ERROR":
            case "DATABASE_ERROR":
                estado.partidaAtiva = false;

                $("msg-arena").textContent =
                    mensagem.message ||
                    "Não foi possível entrar na sala.";
                break;

            // Inicia a partida
            case "GAME_STARTED":
                estado.tentativasHost = 0;
                estado.partidaAtiva = true;

                estado.meuSimbolo =
                    mensagem.players?.find(
                        jogador =>
                            jogador.name === estado.meuNome
                    )?.symbol || estado.meuSimbolo;

                montarArena(
                    mensagem.players || [],
                    TABULEIRO_VAZIO,
                    mensagem.currentTurn,
                    mensagem.score || [],
                    estado
                );
                break;

            // Atualiza o tabuleiro
            case "BOARD_UPDATE":
                atualizarTabuleiro(
                    mensagem.board,
                    mensagem.nextTurn,
                    estado.meuSimbolo
                );
                break;

            // Trata jogadas inválidas
            case "INVALID_MOVE":
                mostrarJogadaInvalida(mensagem.message);
                break;

            // Encerra a partida
            case "GAME_OVER":
                estado.partidaAtiva = false;

                if (mensagem.score) {
                    atualizarPlacar(mensagem.score);
                }

                mostrarFimDeJogo(
                    mensagem,
                    estado.meuSimbolo
                );
                break;

            // Atualiza o placar
            case "SCORE_UPDATE":
                atualizarPlacar(mensagem.score || []);
                break;

            // Recebe o pedido de revanche
            case "REMATCH_REQUESTED":
                mostrarPedidoRevanche(
                    mensagem.requestedBy,
                    estado.meuNome
                );
                break;

            // Inicia uma nova partida
            case "NEW_GAME_STARTED":
                estado.partidaAtiva = true;
                $("modal-fim").hidden = true;

                estado.meuSimbolo =
                    mensagem.players?.find(
                        jogador =>
                            jogador.name === estado.meuNome
                    )?.symbol || estado.meuSimbolo;

                montarArena(
                    mensagem.players || [],
                    mensagem.board || TABULEIRO_VAZIO,
                    mensagem.currentTurn,
                    mensagem.score || [],
                    estado
                );
                break;

            // Trata erros de revanche
            case "NEW_GAME_ERROR":
                $("fim-revanche").textContent =
                    mensagem.message;

                $("btn-jogar-novamente").disabled = false;
                break;

            // Atualiza o cronômetro
            case "TURN_TIMER":
                $("cronometro").textContent =
                    `Tempo restante: ${mensagem.seconds}s`;
                break;

            // Avisa sobre o tempo esgotado
            case "TURN_TIMEOUT":
                $("cronometro").textContent = "";

                $("msg-arena").textContent =
                    `Tempo do jogador ${mensagem.timedOutSymbol} esgotado.`;
                break;

            // Recebe mensagens do chat
            case "CHAT_MESSAGE":
                adicionarMensagemChat(
                    mensagem.playerName,
                    mensagem.message,
                    mensagem.playerSymbol
                );
                break;

            // Trata erros do chat
            case "CHAT_ERROR":
                $("msg-arena").textContent =
                    mensagem.message;

                console.error(
                    "Erro no chat:",
                    mensagem.message
                );
                break;

            // Avisa sobre desconexão temporária
            case "PLAYER_DISCONNECTED":
                $("aviso-desconexao").textContent =
                    mensagem.message;

                $("aviso-desconexao").hidden = false;
                break;

            // Confirma a reconexão
            case "PLAYER_RECONNECTED":
                $("aviso-desconexao").hidden = true;
                break;

            // Avisa sobre saída definitiva
            case "PLAYER_LEFT_ROOM":
                estado.partidaAtiva = false;
                mostrarJogadorSaiu(mensagem);
                break;

            // Confirma a saída voluntária
            case "LEAVE_ROOM_ACK":
                estado.confirmarSaida?.();
                break;

            default:
                console.log(
                    "Evento não tratado:",
                    mensagem.type
                );
        }
    };
}
