
const {
    executar,
    consultarTodos
} = require("./conexao");

// Adiciona uma coluna caso ela não exista
async function adicionarColunaSeNaoExistir(
    tabela,
    coluna,
    definicao
) {
    const colunas = await consultarTodos(
        `PRAGMA table_info(${tabela})`
    );

    const existe = colunas.some(
        item => item.name === coluna
    );

    if (!existe) {
        await executar(`
            ALTER TABLE ${tabela}
            ADD COLUMN ${coluna} ${definicao}
        `);

        console.log(
            `Migração: coluna ${tabela}.${coluna} criada.`
        );
    }
}

// Inicializa as tabelas do banco
async function inicializarBanco() {

    // Ativa as chaves estrangeiras
    await executar("PRAGMA foreign_keys = ON");

    // Cria a tabela de jogadores
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

    // Atualiza bancos antigos
    await adicionarColunaSeNaoExistir(
        "JOGADOR",
        "senha_hash",
        "TEXT"
    );

    // Impede e-mails duplicados
    await executar(`
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_jogador_email_unico
        ON JOGADOR(LOWER(email))
        WHERE email IS NOT NULL
        AND email <> ''
    `);

    // Cria a tabela de salas
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

    // Cria a tabela de partidas
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

    // Cria a tabela de jogadas
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

    // Cria a tabela de mensagens
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

    console.log(
        "Tabelas do banco criadas/verificadas com sucesso!"
    );
}

// Exporta a inicialização do banco
module.exports = {
    inicializarBanco
};
