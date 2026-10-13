
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Define o caminho do banco de dados
const caminhoBanco = path.join(__dirname, "jogo.db");

// Cria a conexão com o SQLite
const db = new sqlite3.Database(caminhoBanco, (erro) => {
    if (erro) {
        console.error(
            "Erro ao conectar ao SQLite:",
            erro.message
        );
        return;
    }

    console.log("Banco SQLite conectado com sucesso!");
});

// Executa comandos SQL
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

// Consulta um único registro
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

// Consulta vários registros
function consultarTodos(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parametros, (erro, linhas) => {
            if (erro) {
                reject(erro);
                return;
            }

            resolve(linhas);
        });
    });
}

// Exporta a conexão e as funções de consulta
module.exports = {
    db,
    executar,
    consultarUm,
    consultarTodos
};
