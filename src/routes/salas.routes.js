
const express = require("express");

const {
    exigirAutenticacao
} = require("../middlewares/auth.middleware");

// Cria as rotas de gerenciamento das salas
function criarRotasSalas(salasController) {
    const router = express.Router();

    // Cria uma sala privada
    router.post(
        "/privadas",
        exigirAutenticacao,
        salasController.criarSalaPrivada
    );

    // Lista as salas públicas
    router.get(
        "/publicas",
        salasController.listarSalasPublicas
    );

    // Lista todas as salas
    router.get(
        "/",
        exigirAutenticacao,
        salasController.listarSalas
    );

    // Lista as salas privadas
    router.get(
        "/privadas",
        exigirAutenticacao,
        salasController.listarSalasPrivadas
    );

    // Consulta uma sala pelo código
    router.get(
        "/:codigo",
        exigirAutenticacao,
        salasController.consultarSala
    );

    return router;
}

// Exporta as rotas das salas
module.exports = {
    criarRotasSalas
};
