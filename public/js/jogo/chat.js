
const $ = (id) => document.getElementById(id);

// Adiciona uma mensagem ao chat
export function adicionarMensagemChat(nome, texto, simbolo) {
    const item = document.createElement("li");
    const nomeElemento = document.createElement("strong");

    nomeElemento.className = simbolo === "X" ? "x" : "o";
    nomeElemento.textContent = `${nome}:`;

    item.appendChild(nomeElemento);
    item.append(` ${texto}`);

    const lista = $("chat-mensagens");
    lista.appendChild(item);
    lista.scrollTop = lista.scrollHeight;
}

// Configura o envio das mensagens
export function configurarChat({
    socketEstaAberto,
    enviarMensagem
}) {
    $("form-chat").addEventListener("submit", (event) => {
        event.preventDefault();

        const campo = $("input-chat");
        const texto = campo.value.trim();

        if (!texto) {
            return;
        }

        if (!socketEstaAberto()) {
            $("msg-arena").textContent =
                "Sem conexão com o servidor.";
            return;
        }

        enviarMensagem({
            type: "CHAT",
            message: texto
        });

        campo.value = "";
    });
}
