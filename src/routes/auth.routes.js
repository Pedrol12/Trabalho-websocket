const express =
    require("express");

const {
    registrar,
    login,
    usuarioAtual,
    logout
} =
    require(
        "../controllers/auth.controller"
    );

const {
    exigirAutenticacao
} =
    require(
        "../middlewares/auth.middleware"
    );

// ======================================================
// TÓPICO PROFESSOR: ROTAS HTTP MODULARIZADAS
// ======================================================

const router =
    express.Router();

router.post(
    "/register",
    registrar
);

router.post(
    "/login",
    login
);

router.get(
    "/me",
    exigirAutenticacao,
    usuarioAtual
);

router.post(
    "/logout",
    logout
);

module.exports =
    router;