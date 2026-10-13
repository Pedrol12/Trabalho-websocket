
const { executar } = require("./conexao");

// Registra uma mensagem do chat no banco
async function registrarMensagemChat(
    idSala,
    idJogador,
    texto
) {

    // Salva a mensagem e identifica o remetente
    await executar(
        `INSERT INTO MENSAGEM_CHAT (
            id_sala,
            id_jogador_remetente,
            conteudo_texto
        )
        VALUES (?, ?, ?)`,
        [
            idSala,
            idJogador,
            texto
        ]
    );
}

// Exporta a função do módulo
module.exports = {
    registrarMensagemChat
};
