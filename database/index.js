
 // Importa a inicialização do banco
const { inicializarBanco } = require("./inicializacao");

// Importa os módulos de consultas
const jogadores = require("./jogadores");
const salas = require("./salas");
const partidas = require("./partidas");
const jogadas = require("./jogadas");
const chat = require("./chat");

// Exporta todas as funções do banco
module.exports = {
    inicializarBanco,
    ...jogadores,
    ...salas,
    ...partidas,
    ...jogadas,
    ...chat
};
