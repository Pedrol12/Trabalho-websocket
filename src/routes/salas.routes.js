const express =
    require("express");

// ======================================================
// TÓPICO PROFESSOR: ROTAS DE SALAS MODULARIZADAS
// ======================================================

function criarSalasRoutes({
    controller,
    exigirAutenticacao
}) {

    const router =
        express.Router();

    // POST /api/salas/privadas
    router.post(
        "/privadas",
        exigirAutenticacao,
        controller.criarSalaPrivada
    );

    // GET /api/salas/publicas
    router.get(
        "/publicas",
        controller.listarSalasPublicas
    );

    // GET /api/salas/privadas
    router.get(
        "/privadas",
        exigirAutenticacao,
        controller.listarSalasPrivadas
    );

    // GET /api/salas/:codigo
    router.get(
        "/:codigo",
        exigirAutenticacao,
        controller.buscarSalaPorCodigo
    );

    // GET /api/salas
    //
    // Deixamos "/" por último para manter
    // as rotas específicas fáceis de identificar.
    router.get(
        "/",
        exigirAutenticacao,
        controller.listarTodasSalas
    );

    return router;
}

module.exports = {
    criarSalasRoutes
};