
const {
    executar,
    consultarUm,
    consultarTodos
} = require("./conexao");

// Verifica se o código da sala já existe
async function codigoSalaExiste(codigoSala) {
    const sala = await consultarUm(
        `SELECT id_sala
         FROM SALA_JOGO
         WHERE codigo_sala = ?`,
        [codigoSala]
    );

    return Boolean(sala);
}

// Cria uma nova sala no banco
async function criarSalaBanco(
    codigoSala,
    idJogadorHost,
    privada = true
) {
    const resultado = await executar(
        `INSERT INTO SALA_JOGO (
            id_jogador_host,
            codigo_sala,
            privada,
            status_sala
        )
        VALUES (?, ?, ?, 'AGUARDANDO')`,
        [
            idJogadorHost,
            codigoSala,
            privada ? 1 : 0
        ]
    );

    return resultado.lastID;
}

// Adiciona o visitante à sala
async function adicionarVisitanteSala(
    idSala,
    idJogadorVisitante
) {
    await executar(
        `UPDATE SALA_JOGO
         SET id_jogador_visitante = ?,
             status_sala = 'EM_JOGO'
         WHERE id_sala = ?`,
        [idJogadorVisitante, idSala]
    );
}

// Atualiza o status da sala
async function atualizarStatusSala(idSala, status) {
    await executar(
        `UPDATE SALA_JOGO
         SET status_sala = ?
         WHERE id_sala = ?`,
        [status, idSala]
    );
}

// Remove uma sala do banco
async function removerSalaBanco(idSala) {
    await executar(
        `DELETE FROM SALA_JOGO
         WHERE id_sala = ?`,
        [idSala]
    );
}

// Retorna os dados das salas e dos jogadores
const consultaSalas = `
    SELECT
        s.id_sala,
        s.codigo_sala,
        s.privada,
        s.status_sala,
        s.id_jogador_host,
        host.nickname AS host_nickname,
        s.id_jogador_visitante,
        visitante.nickname AS visitante_nickname
    FROM SALA_JOGO s
    LEFT JOIN JOGADOR host
        ON host.id_jogador = s.id_jogador_host
    LEFT JOIN JOGADOR visitante
        ON visitante.id_jogador = s.id_jogador_visitante
`;

// Lista todas as salas
async function listarSalasBanco() {
    return consultarTodos(
        `${consultaSalas}
         ORDER BY s.id_sala DESC`
    );
}

// Lista as salas públicas
async function listarSalasPublicasBanco() {
    return consultarTodos(
        `${consultaSalas}
         WHERE s.privada = 0
         ORDER BY s.id_sala DESC`
    );
}

// Lista as salas privadas
async function listarSalasPrivadasBanco() {
    return consultarTodos(
        `${consultaSalas}
         WHERE s.privada = 1
         ORDER BY s.id_sala DESC`
    );
}

// Busca uma sala pelo código
async function buscarSalaPorCodigoBanco(codigoSala) {
    return consultarUm(
        `${consultaSalas}
         WHERE s.codigo_sala = ?
         LIMIT 1`,
        [codigoSala]
    );
}

// Lista as salas aguardando jogadores
async function listarSalasAguardandoBanco() {
    return consultarTodos(
        `${consultaSalas}
         WHERE s.status_sala = 'AGUARDANDO'
         ORDER BY s.id_sala ASC`
    );
}

// Exporta as funções do módulo
module.exports = {
    codigoSalaExiste,
    criarSalaBanco,
    adicionarVisitanteSala,
    atualizarStatusSala,
    removerSalaBanco,
    listarSalasBanco,
    listarSalasPublicasBanco,
    listarSalasPrivadasBanco,
    buscarSalaPorCodigoBanco,
    listarSalasAguardandoBanco
};
