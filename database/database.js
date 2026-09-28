const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Caminho do arquivo físico do banco
const caminhoBanco = path.join(__dirname, "jogo.db");

// Abre ou cria o banco
const db = new sqlite3.Database(caminhoBanco, (erro) => {
    if (erro) {
        console.error("Erro ao conectar ao SQLite:", erro.message);
        return;
    }

    console.log("Banco SQLite conectado com sucesso!");
});

// Cria as tabelas do projeto
function inicializarBanco() {
    db.serialize(() => {
        // Ativa suporte a chaves estrangeiras
        db.run("PRAGMA foreign_keys = ON");

        // Tabela de jogadores
        db.run(`
            CREATE TABLE IF NOT EXISTS JOGADOR (
                id_jogador INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                email TEXT,
                vitorias_totais INTEGER DEFAULT 0,
                derrotas_totais INTEGER DEFAULT 0,
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de salas
        db.run(`
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

        // Tabela de partidas
        db.run(`
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

        // Tabela de jogadas
        db.run(`
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

        // Tabela das mensagens do chat
        db.run(`
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
    });
}

// Permite importar o banco pelo server.js depois
module.exports = {
    db,
    inicializarBanco
};

// Se executar este arquivo diretamente, cria as tabelas
if (require.main === module) {
    inicializarBanco();
}