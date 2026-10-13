
const {
    executar,
    consultarUm
} = require("./conexao");

// Busca um jogador ou cria um novo
async function buscarOuCriarJogador(nickname) {
    const jogador = await consultarUm(
        `SELECT *
         FROM JOGADOR
         WHERE nickname = ?
         ORDER BY id_jogador DESC
         LIMIT 1`,
        [nickname]
    );

    if (jogador) {
        return jogador;
    }

    const resultado = await executar(
        `INSERT INTO JOGADOR (nickname)
         VALUES (?)`,
        [nickname]
    );

    return {
        id_jogador: resultado.lastID,
        nickname,
        email: null,
        senha_hash: null,
        vitorias_totais: 0,
        derrotas_totais: 0
    };
}

// Registra a vitória e a derrota dos jogadores
async function registrarVitoriaDerrota(
    idVencedor,
    idPerdedor
) {
    await executar(
        `UPDATE JOGADOR
         SET vitorias_totais = vitorias_totais + 1
         WHERE id_jogador = ?`,
        [idVencedor]
    );

    await executar(
        `UPDATE JOGADOR
         SET derrotas_totais = derrotas_totais + 1
         WHERE id_jogador = ?`,
        [idPerdedor]
    );
}

// Cria um jogador com e-mail e senha
async function criarJogadorAutenticado(
    nickname,
    email,
    senhaHash
) {
    const emailNormalizado = String(email)
        .trim()
        .toLowerCase();

    const resultado = await executar(
        `INSERT INTO JOGADOR (
            nickname,
            email,
            senha_hash
         ) VALUES (?, ?, ?)`,
        [nickname, emailNormalizado, senhaHash]
    );

    return {
        id_jogador: resultado.lastID,
        nickname,
        email: emailNormalizado,
        vitorias_totais: 0,
        derrotas_totais: 0
    };
}

// Busca um jogador pelo e-mail
async function buscarJogadorPorEmail(email) {
    const emailNormalizado = String(email)
        .trim()
        .toLowerCase();

    return consultarUm(
        `SELECT
            id_jogador,
            nickname,
            email,
            senha_hash,
            vitorias_totais,
            derrotas_totais,
            data_registro
         FROM JOGADOR
         WHERE LOWER(email) = ?
         LIMIT 1`,
        [emailNormalizado]
    );
}

// Busca um jogador pelo ID
async function buscarJogadorPorId(idJogador) {
    return consultarUm(
        `SELECT
            id_jogador,
            nickname,
            email,
            vitorias_totais,
            derrotas_totais,
            data_registro
         FROM JOGADOR
         WHERE id_jogador = ?
         LIMIT 1`,
        [idJogador]
    );
}

// Busca um jogador pelo nickname
async function buscarJogadorPorNickname(nickname) {
    return consultarUm(
        `SELECT *
         FROM JOGADOR
         WHERE nickname = ?
         ORDER BY id_jogador DESC
         LIMIT 1`,
        [nickname]
    );
}

// Atualiza o e-mail e a senha de um jogador
async function atualizarCredenciaisJogador(
    idJogador,
    email,
    senhaHash
) {
    const emailNormalizado = String(email)
        .trim()
        .toLowerCase();

    await executar(
        `UPDATE JOGADOR
         SET email = ?, senha_hash = ?
         WHERE id_jogador = ?`,
        [emailNormalizado, senhaHash, idJogador]
    );

    return buscarJogadorPorId(idJogador);
}

// Exporta as funções do módulo
module.exports = {
    buscarOuCriarJogador,
    registrarVitoriaDerrota,
    criarJogadorAutenticado,
    buscarJogadorPorEmail,
    buscarJogadorPorId,
    buscarJogadorPorNickname,
    atualizarCredenciaisJogador
};
