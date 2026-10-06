const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// ======================================================
// CONEXÃO COM O BANCO
// ======================================================

const caminhoBanco = path.join(
    __dirname,
    "jogo.db"
);

const db = new sqlite3.Database(
    caminhoBanco,
    (erro) => {
        if (erro) {
            console.error(
                "Erro ao conectar ao SQLite:",
                erro.message
            );

            return;
        }

        console.log(
            "Banco SQLite conectado com sucesso!"
        );
    }
);

// ======================================================
// FUNÇÕES GENÉRICAS
// ======================================================

function executar(
    sql,
    parametros = []
) {
    return new Promise(
        (resolve, reject) => {

            db.run(
                sql,
                parametros,
                function (erro) {

                    if (erro) {
                        reject(erro);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,

                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}

function consultarUm(
    sql,
    parametros = []
) {
    return new Promise(
        (resolve, reject) => {

            db.get(
                sql,
                parametros,
                (erro, linha) => {

                    if (erro) {
                        reject(erro);
                        return;
                    }

                    resolve(
                        linha
                    );
                }
            );
        }
    );
}

function consultarTodos(
    sql,
    parametros = []
) {
    return new Promise(
        (resolve, reject) => {

            db.all(
                sql,
                parametros,
                (erro, linhas) => {

                    if (erro) {
                        reject(erro);
                        return;
                    }

                    resolve(
                        linhas
                    );
                }
            );
        }
    );
}

// ======================================================
// MIGRAÇÕES
// ======================================================

// Como o banco já existia antes,
// CREATE TABLE IF NOT EXISTS não adiciona
// automaticamente novas colunas.
//
// Essa função verifica se uma coluna existe
// antes de executar ALTER TABLE.

async function adicionarColunaSeNaoExistir(
    tabela,
    coluna,
    definicao
) {
    const colunas =
        await consultarTodos(
            `PRAGMA table_info(${tabela})`
        );

    const existe =
        colunas.some(
            (item) =>
                item.name === coluna
        );

    if (!existe) {

        await executar(
            `
            ALTER TABLE ${tabela}
            ADD COLUMN ${coluna} ${definicao}
            `
        );

        console.log(
            `Migração: coluna ${tabela}.${coluna} criada.`
        );
    }
}

// ======================================================
// INICIALIZAÇÃO DO BANCO
// ======================================================

async function inicializarBanco() {

    await executar(
        "PRAGMA foreign_keys = ON"
    );

    // ==================================================
    // JOGADOR
    // ==================================================

    await executar(`
        CREATE TABLE IF NOT EXISTS JOGADOR (
            id_jogador INTEGER PRIMARY KEY AUTOINCREMENT,

            nickname TEXT NOT NULL,

            email TEXT,

            senha_hash TEXT,

            vitorias_totais INTEGER DEFAULT 0,

            derrotas_totais INTEGER DEFAULT 0,

            data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Bancos antigos ainda não possuem senha_hash
    await adicionarColunaSeNaoExistir(
        "JOGADOR",
        "senha_hash",
        "TEXT"
    );

    // Impede que dois usuários tenham
    // o mesmo e-mail.
    await executar(`
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_jogador_email_unico

        ON JOGADOR(
            LOWER(email)
        )

        WHERE email IS NOT NULL
        AND email <> ''
    `);

    // ==================================================
    // SALA
    // ==================================================

    await executar(`
        CREATE TABLE IF NOT EXISTS SALA_JOGO (
            id_sala INTEGER PRIMARY KEY AUTOINCREMENT,

            id_jogador_host INTEGER,

            id_jogador_visitante INTEGER,

            codigo_sala TEXT NOT NULL UNIQUE,

            privada INTEGER DEFAULT 1,

            status_sala TEXT DEFAULT 'AGUARDANDO',

            FOREIGN KEY (
                id_jogador_host
            )
                REFERENCES JOGADOR(
                    id_jogador
                ),

            FOREIGN KEY (
                id_jogador_visitante
            )
                REFERENCES JOGADOR(
                    id_jogador
                )
        )
    `);

    // ==================================================
    // PARTIDA
    // ==================================================

    await executar(`
        CREATE TABLE IF NOT EXISTS PARTIDA (
            id_partida INTEGER PRIMARY KEY AUTOINCREMENT,

            id_sala INTEGER NOT NULL,

            id_vencedor INTEGER,

            simbolo_turno_atual TEXT,

            placar_host INTEGER DEFAULT 0,

            placar_visitante INTEGER DEFAULT 0,

            status_resultado TEXT DEFAULT 'EM_ANDAMENTO',

            data_hora_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                id_sala
            )
                REFERENCES SALA_JOGO(
                    id_sala
                ),

            FOREIGN KEY (
                id_vencedor
            )
                REFERENCES JOGADOR(
                    id_jogador
                )
        )
    `);

    // ==================================================
    // JOGADA
    // ==================================================

    await executar(`
        CREATE TABLE IF NOT EXISTS JOGADA (
            id_jogada INTEGER PRIMARY KEY AUTOINCREMENT,

            id_partida INTEGER NOT NULL,

            id_jogador INTEGER NOT NULL,

            posicao_celula INTEGER NOT NULL,

            simbolo TEXT NOT NULL,

            timestamp_jogada DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                id_partida
            )
                REFERENCES PARTIDA(
                    id_partida
                ),

            FOREIGN KEY (
                id_jogador
            )
                REFERENCES JOGADOR(
                    id_jogador
                )
        )
    `);

    // ==================================================
    // CHAT
    // ==================================================

    await executar(`
        CREATE TABLE IF NOT EXISTS MENSAGEM_CHAT (
            id_mensagem INTEGER PRIMARY KEY AUTOINCREMENT,

            id_sala INTEGER NOT NULL,

            id_jogador_remetente INTEGER NOT NULL,

            conteudo_texto TEXT NOT NULL,

            timestamp_envio DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                id_sala
            )
                REFERENCES SALA_JOGO(
                    id_sala
                ),

            FOREIGN KEY (
                id_jogador_remetente
            )
                REFERENCES JOGADOR(
                    id_jogador
                )
        )
    `);

    console.log(
        "Tabelas do banco criadas/verificadas com sucesso!"
    );
}

// ======================================================
// JOGADOR
// ======================================================

// Função antiga usada pelo WebSocket.
// Continua funcionando normalmente.

async function buscarOuCriarJogador(
    nickname
) {
    const jogador =
        await consultarUm(
            `
            SELECT *

            FROM JOGADOR

            WHERE nickname = ?

            ORDER BY id_jogador DESC

            LIMIT 1
            `,
            [
                nickname
            ]
        );

    if (jogador) {

        return jogador;
    }

    const resultado =
        await executar(
            `
            INSERT INTO JOGADOR (
                nickname
            )

            VALUES (?)
            `,
            [
                nickname
            ]
        );

    return {

        id_jogador:
            resultado.lastID,

        nickname,

        email:
            null,

        senha_hash:
            null,

        vitorias_totais:
            0,

        derrotas_totais:
            0
    };
}

// ======================================================
// VITÓRIA / DERROTA
// ======================================================

async function registrarVitoriaDerrota(
    idVencedor,
    idPerdedor
) {

    await executar(
        `
        UPDATE JOGADOR

        SET
            vitorias_totais =
            vitorias_totais + 1

        WHERE id_jogador = ?
        `,
        [
            idVencedor
        ]
    );

    await executar(
        `
        UPDATE JOGADOR

        SET
            derrotas_totais =
            derrotas_totais + 1

        WHERE id_jogador = ?
        `,
        [
            idPerdedor
        ]
    );
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

// Cria um jogador novo já com
// e-mail e senha.

async function criarJogadorAutenticado(
    nickname,
    email,
    senhaHash
) {

    const emailNormalizado =
        String(
            email
        )
            .trim()
            .toLowerCase();

    const resultado =
        await executar(
            `
            INSERT INTO JOGADOR (
                nickname,
                email,
                senha_hash
            )

            VALUES (?, ?, ?)
            `,
            [
                nickname,
                emailNormalizado,
                senhaHash
            ]
        );

    return {

        id_jogador:
            resultado.lastID,

        nickname,

        email:
            emailNormalizado,

        vitorias_totais:
            0,

        derrotas_totais:
            0
    };
}

// ======================================================
// BUSCAR POR EMAIL
// ======================================================

async function buscarJogadorPorEmail(
    email
) {

    const emailNormalizado =
        String(
            email
        )
            .trim()
            .toLowerCase();

    return consultarUm(
        `
        SELECT
            id_jogador,
            nickname,
            email,
            senha_hash,
            vitorias_totais,
            derrotas_totais,
            data_registro

        FROM JOGADOR

        WHERE LOWER(email) = ?

        LIMIT 1
        `,
        [
            emailNormalizado
        ]
    );
}

// ======================================================
// BUSCAR POR ID
// ======================================================

async function buscarJogadorPorId(
    idJogador
) {

    return consultarUm(
        `
        SELECT
            id_jogador,
            nickname,
            email,
            vitorias_totais,
            derrotas_totais,
            data_registro

        FROM JOGADOR

        WHERE id_jogador = ?

        LIMIT 1
        `,
        [
            idJogador
        ]
    );
}

// ======================================================
// BUSCAR POR NICKNAME
// ======================================================

async function buscarJogadorPorNickname(
    nickname
) {

    return consultarUm(
        `
        SELECT *

        FROM JOGADOR

        WHERE nickname = ?

        ORDER BY id_jogador DESC

        LIMIT 1
        `,
        [
            nickname
        ]
    );
}

// ======================================================
// TRANSFORMAR JOGADOR ANTIGO EM CONTA
// ======================================================
//
// Exemplo:
//
// antes:
// nickname = Kaua
// email = null
// senha_hash = null
//
// depois:
// nickname = Kaua
// email = kaua@email.com
// senha_hash = ...
//
// Isso evita criar outro jogador duplicado.
//

async function atualizarCredenciaisJogador(
    idJogador,
    email,
    senhaHash
) {

    const emailNormalizado =
        String(
            email
        )
            .trim()
            .toLowerCase();

    await executar(
        `
        UPDATE JOGADOR

        SET
            email = ?,
            senha_hash = ?

        WHERE id_jogador = ?
        `,
        [
            emailNormalizado,
            senhaHash,
            idJogador
        ]
    );

    return buscarJogadorPorId(
        idJogador
    );
}

// ======================================================
// SALA
// ======================================================

// Verifica se o código já existe.

async function codigoSalaExiste(
    codigoSala
) {

    const sala =
        await consultarUm(
            `
            SELECT
                id_sala

            FROM SALA_JOGO

            WHERE codigo_sala = ?
            `,
            [
                codigoSala
            ]
        );

    return Boolean(
        sala
    );
}

// ======================================================
// CRIAR SALA
// ======================================================

async function criarSalaBanco(
    codigoSala,
    idJogadorHost,
    privada = true
) {

    const resultado =
        await executar(
            `
            INSERT INTO SALA_JOGO (
                id_jogador_host,
                codigo_sala,
                privada,
                status_sala
            )

            VALUES (
                ?, ?, ?, 'AGUARDANDO'
            )
            `,
            [
                idJogadorHost,
                codigoSala,

                privada
                    ? 1
                    : 0
            ]
        );

    return resultado.lastID;
}

// ======================================================
// ADICIONAR VISITANTE
// ======================================================

async function adicionarVisitanteSala(
    idSala,
    idJogadorVisitante
) {

    await executar(
        `
        UPDATE SALA_JOGO

        SET
            id_jogador_visitante = ?,
            status_sala = 'EM_JOGO'

        WHERE id_sala = ?
        `,
        [
            idJogadorVisitante,
            idSala
        ]
    );
}

// ======================================================
// ATUALIZAR STATUS
// ======================================================

async function atualizarStatusSala(
    idSala,
    status
) {

    await executar(
        `
        UPDATE SALA_JOGO

        SET
            status_sala = ?

        WHERE id_sala = ?
        `,
        [
            status,
            idSala
        ]
    );
}

// ======================================================
// REMOVER SALA
// ======================================================
//
// Mantemos essa função porque o
// server.js antigo ainda utiliza.
//
// Depois vamos ajustar para não remover
// sala privada persistida indevidamente.
//

async function removerSalaBanco(
    idSala
) {

    await executar(
        `
        DELETE FROM SALA_JOGO

        WHERE id_sala = ?
        `,
        [
            idSala
        ]
    );
}

// ======================================================
// LISTAR TODAS AS SALAS
// ======================================================

async function listarSalasBanco() {

    return consultarTodos(
        `
        SELECT
            s.id_sala,
            s.codigo_sala,
            s.privada,
            s.status_sala,

            s.id_jogador_host,

            host.nickname
                AS host_nickname,

            s.id_jogador_visitante,

            visitante.nickname
                AS visitante_nickname

        FROM SALA_JOGO s

        LEFT JOIN JOGADOR host
            ON host.id_jogador =
               s.id_jogador_host

        LEFT JOIN JOGADOR visitante
            ON visitante.id_jogador =
               s.id_jogador_visitante

        ORDER BY
            s.id_sala DESC
        `
    );
}

// ======================================================
// LISTAR SALAS PÚBLICAS
// ======================================================

async function listarSalasPublicasBanco() {

    return consultarTodos(
        `
        SELECT
            s.id_sala,
            s.codigo_sala,
            s.privada,
            s.status_sala,

            s.id_jogador_host,

            host.nickname
                AS host_nickname,

            s.id_jogador_visitante,

            visitante.nickname
                AS visitante_nickname

        FROM SALA_JOGO s

        LEFT JOIN JOGADOR host
            ON host.id_jogador =
               s.id_jogador_host

        LEFT JOIN JOGADOR visitante
            ON visitante.id_jogador =
               s.id_jogador_visitante

        WHERE s.privada = 0

        ORDER BY
            s.id_sala DESC
        `
    );
}

// ======================================================
// LISTAR SALAS PRIVADAS
// ======================================================

async function listarSalasPrivadasBanco() {

    return consultarTodos(
        `
        SELECT
            s.id_sala,
            s.codigo_sala,
            s.privada,
            s.status_sala,

            s.id_jogador_host,

            host.nickname
                AS host_nickname,

            s.id_jogador_visitante,

            visitante.nickname
                AS visitante_nickname

        FROM SALA_JOGO s

        LEFT JOIN JOGADOR host
            ON host.id_jogador =
               s.id_jogador_host

        LEFT JOIN JOGADOR visitante
            ON visitante.id_jogador =
               s.id_jogador_visitante

        WHERE s.privada = 1

        ORDER BY
            s.id_sala DESC
        `
    );
}

// ======================================================
// BUSCAR SALA PELO CÓDIGO
// ======================================================

async function buscarSalaPorCodigoBanco(
    codigoSala
) {

    return consultarUm(
        `
        SELECT
            s.id_sala,
            s.codigo_sala,
            s.privada,
            s.status_sala,

            s.id_jogador_host,

            host.nickname
                AS host_nickname,

            s.id_jogador_visitante,

            visitante.nickname
                AS visitante_nickname

        FROM SALA_JOGO s

        LEFT JOIN JOGADOR host
            ON host.id_jogador =
               s.id_jogador_host

        LEFT JOIN JOGADOR visitante
            ON visitante.id_jogador =
               s.id_jogador_visitante

        WHERE s.codigo_sala = ?

        LIMIT 1
        `,
        [
            codigoSala
        ]
    );
}

// ======================================================
// SALAS AGUARDANDO
// ======================================================
//
// Essa função será usada pelo server.js
// para recuperar salas persistidas
// quando o Node for reiniciado.
//

async function listarSalasAguardandoBanco() {

    return consultarTodos(
        `
        SELECT
            s.id_sala,
            s.codigo_sala,
            s.privada,
            s.status_sala,

            s.id_jogador_host,

            host.nickname
                AS host_nickname,

            s.id_jogador_visitante,

            visitante.nickname
                AS visitante_nickname

        FROM SALA_JOGO s

        LEFT JOIN JOGADOR host
            ON host.id_jogador =
               s.id_jogador_host

        LEFT JOIN JOGADOR visitante
            ON visitante.id_jogador =
               s.id_jogador_visitante

        WHERE
            s.status_sala =
            'AGUARDANDO'

        ORDER BY
            s.id_sala ASC
        `
    );
}

// ======================================================
// PARTIDA
// ======================================================

async function criarPartida(
    idSala,
    simboloTurnoAtual,
    placarHost,
    placarVisitante
) {

    const resultado =
        await executar(
            `
            INSERT INTO PARTIDA (
                id_sala,
                simbolo_turno_atual,
                placar_host,
                placar_visitante,
                status_resultado
            )

            VALUES (
                ?, ?, ?, ?,
                'EM_ANDAMENTO'
            )
            `,
            [
                idSala,
                simboloTurnoAtual,
                placarHost,
                placarVisitante
            ]
        );

    return resultado.lastID;
}

// ======================================================
// ATUALIZAR TURNO
// ======================================================

async function atualizarTurnoPartida(
    idPartida,
    simboloTurnoAtual
) {

    await executar(
        `
        UPDATE PARTIDA

        SET
            simbolo_turno_atual = ?

        WHERE
            id_partida = ?
        `,
        [
            simboloTurnoAtual,
            idPartida
        ]
    );
}

// ======================================================
// FINALIZAR PARTIDA
// ======================================================

async function finalizarPartida(
    idPartida,
    idVencedor,
    statusResultado,
    placarHost,
    placarVisitante
) {

    await executar(
        `
        UPDATE PARTIDA

        SET
            id_vencedor = ?,

            simbolo_turno_atual = NULL,

            placar_host = ?,

            placar_visitante = ?,

            status_resultado = ?

        WHERE
            id_partida = ?
        `,
        [
            idVencedor,
            placarHost,
            placarVisitante,
            statusResultado,
            idPartida
        ]
    );
}

// ======================================================
// JOGADA
// ======================================================

async function registrarJogada(
    idPartida,
    idJogador,
    posicao,
    simbolo
) {

    await executar(
        `
        INSERT INTO JOGADA (
            id_partida,
            id_jogador,
            posicao_celula,
            simbolo
        )

        VALUES (?, ?, ?, ?)
        `,
        [
            idPartida,
            idJogador,
            posicao,
            simbolo
        ]
    );
}

// ======================================================
// CHAT
// ======================================================

async function registrarMensagemChat(
    idSala,
    idJogador,
    texto
) {

    await executar(
        `
        INSERT INTO MENSAGEM_CHAT (
            id_sala,
            id_jogador_remetente,
            conteudo_texto
        )

        VALUES (?, ?, ?)
        `,
        [
            idSala,
            idJogador,
            texto
        ]
    );
}

// ======================================================
// EXPORTAÇÕES
// ======================================================

module.exports = {

    db,

    inicializarBanco,

    // ==================================================
    // JOGADOR / JOGO
    // ==================================================

    buscarOuCriarJogador,

    registrarVitoriaDerrota,

    // ==================================================
    // LOGIN
    // ==================================================

    criarJogadorAutenticado,

    buscarJogadorPorEmail,

    buscarJogadorPorId,

    buscarJogadorPorNickname,

    atualizarCredenciaisJogador,

    // ==================================================
    // SALAS
    // ==================================================

    codigoSalaExiste,

    criarSalaBanco,

    adicionarVisitanteSala,

    atualizarStatusSala,

    removerSalaBanco,

    // ==================================================
    // HTTP / CONSULTAS
    // ==================================================

    listarSalasBanco,

    listarSalasPublicasBanco,

    listarSalasPrivadasBanco,

    buscarSalaPorCodigoBanco,

    listarSalasAguardandoBanco,

    // ==================================================
    // PARTIDAS
    // ==================================================

    criarPartida,

    atualizarTurnoPartida,

    finalizarPartida,

    // ==================================================
    // JOGADAS
    // ==================================================

    registrarJogada,

    // ==================================================
    // CHAT
    // ==================================================

    registrarMensagemChat
};

// ======================================================
// EXECUÇÃO DIRETA
// ======================================================

if (
    require.main === module
) {

    inicializarBanco()

        .then(() => {

            console.log(
                "Banco inicializado com sucesso!"
            );
        })

        .catch((erro) => {

            console.error(
                "Erro ao inicializar banco:",
                erro.message
            );
        });
}