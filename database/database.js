const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const caminhoBanco = path.join(__dirname, "jogo.db");

const db = new sqlite3.Database(caminhoBanco, (erro) => {
    if (erro) {
        console.error("Erro ao conectar ao SQLite:", erro.message);
        return;
    }

    console.log("Banco SQLite conectado com sucesso!");
});

// ======================================================
// FUNÇÕES GENÉRICAS
// ======================================================

function executar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parametros, function (erro) {
            if (erro) {
                reject(erro);
                return;
            }

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function consultarUm(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, parametros, (erro, linha) => {
            if (erro) {
                reject(erro);
                return;
            }

            resolve(linha);
        });
    });
}

// ======================================================
// CRIAÇÃO DAS TABELAS
// ======================================================

async function inicializarBanco() {
    await executar("PRAGMA foreign_keys = ON");

    await executar(`
        CREATE TABLE IF NOT EXISTS JOGADOR (
            id_jogador INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            email TEXT,
            vitorias_totais INTEGER DEFAULT 0,
            derrotas_totais INTEGER DEFAULT 0,
            data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await executar(`
        CREATE TABLE IF NOT EXISTS SALA_JOGO (
            id_sala INTEGER PRIMARY KEY AUTOINCREMENT,
            id_jogador_host INTEGER,
            id_jogador_visitante INTEGER,
            codigo_sala TEXT NOT NULL UNIQUE,
            privada INTEGER DEFAULT 1,
            status_sala TEXT DEFAULT 'AGUARDANDO',

            FOREIGN KEY (id_jogador_host)
                REFERENCES JOGADOR(id_jogador),

            FOREIGN KEY (id_jogador_visitante)
                REFERENCES JOGADOR(id_jogador)
        )
    `);

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

            FOREIGN KEY (id_sala)
                REFERENCES SALA_JOGO(id_sala),

            FOREIGN KEY (id_vencedor)
                REFERENCES JOGADOR(id_jogador)
        )
    `);

    await executar(`
        CREATE TABLE IF NOT EXISTS JOGADA (
            id_jogada INTEGER PRIMARY KEY AUTOINCREMENT,
            id_partida INTEGER NOT NULL,
            id_jogador INTEGER NOT NULL,
            posicao_celula INTEGER NOT NULL,
            simbolo TEXT NOT NULL,
            timestamp_jogada DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (id_partida)
                REFERENCES PARTIDA(id_partida),

            FOREIGN KEY (id_jogador)
                REFERENCES JOGADOR(id_jogador)
        )
    `);

    await executar(`
        CREATE TABLE IF NOT EXISTS MENSAGEM_CHAT (
            id_mensagem INTEGER PRIMARY KEY AUTOINCREMENT,
            id_sala INTEGER NOT NULL,
            id_jogador_remetente INTEGER NOT NULL,
            conteudo_texto TEXT NOT NULL,
            timestamp_envio DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (id_sala)
                REFERENCES SALA_JOGO(id_sala),

            FOREIGN KEY (id_jogador_remetente)
                REFERENCES JOGADOR(id_jogador)
        )
    `);

    console.log("Tabelas do banco criadas/verificadas com sucesso!");
}

// ======================================================
// JOGADOR
// ======================================================

async function buscarOuCriarJogador(nickname) {
    const jogador = await consultarUm(
        `
        SELECT *
        FROM JOGADOR
        WHERE nickname = ?
        ORDER BY id_jogador DESC
        LIMIT 1
        `,
        [nickname]
    );

    if (jogador) {
        return jogador;
    }

    const resultado = await executar(
        `
        INSERT INTO JOGADOR (nickname)
        VALUES (?)
        `,
        [nickname]
    );

    return {
        id_jogador: resultado.lastID,
        nickname: nickname,
        vitorias_totais: 0,
        derrotas_totais: 0
    };
}

async function registrarVitoriaDerrota(
    idVencedor,
    idPerdedor
) {
    await executar(
        `
        UPDATE JOGADOR
        SET vitorias_totais = vitorias_totais + 1
        WHERE id_jogador = ?
        `,
        [idVencedor]
    );

    await executar(
        `
        UPDATE JOGADOR
        SET derrotas_totais = derrotas_totais + 1
        WHERE id_jogador = ?
        `,
        [idPerdedor]
    );
}

// ======================================================
// SALA
// ======================================================

async function codigoSalaExiste(codigoSala) {
    const sala = await consultarUm(
        `
        SELECT id_sala
        FROM SALA_JOGO
        WHERE codigo_sala = ?
        `,
        [codigoSala]
    );

    return Boolean(sala);
}

async function criarSalaBanco(
    codigoSala,
    idJogadorHost
) {
    const resultado = await executar(
        `
        INSERT INTO SALA_JOGO (
            id_jogador_host,
            codigo_sala,
            privada,
            status_sala
        )
        VALUES (?, ?, 1, 'AGUARDANDO')
        `,
        [
            idJogadorHost,
            codigoSala
        ]
    );

    return resultado.lastID;
}

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

async function atualizarStatusSala(
    idSala,
    status
) {
    await executar(
        `
        UPDATE SALA_JOGO
        SET status_sala = ?
        WHERE id_sala = ?
        `,
        [
            status,
            idSala
        ]
    );
}

async function removerSalaBanco(idSala) {
    await executar(
        `
        DELETE FROM SALA_JOGO
        WHERE id_sala = ?
        `,
        [idSala]
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
    const resultado = await executar(
        `
        INSERT INTO PARTIDA (
            id_sala,
            simbolo_turno_atual,
            placar_host,
            placar_visitante,
            status_resultado
        )
        VALUES (?, ?, ?, ?, 'EM_ANDAMENTO')
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

async function atualizarTurnoPartida(
    idPartida,
    simboloTurnoAtual
) {
    await executar(
        `
        UPDATE PARTIDA
        SET simbolo_turno_atual = ?
        WHERE id_partida = ?
        `,
        [
            simboloTurnoAtual,
            idPartida
        ]
    );
}

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
        WHERE id_partida = ?
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
// JOGADAS
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

    buscarOuCriarJogador,
    registrarVitoriaDerrota,

    codigoSalaExiste,
    criarSalaBanco,
    adicionarVisitanteSala,
    atualizarStatusSala,
    removerSalaBanco,

    criarPartida,
    atualizarTurnoPartida,
    finalizarPartida,

    registrarJogada,

    registrarMensagemChat
};

// ======================================================
// EXECUÇÃO DIRETA
// ======================================================

if (require.main === module) {
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