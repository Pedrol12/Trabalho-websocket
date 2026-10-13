
const express = require("express");
const { exigirAutenticacao } = require(
    "../middlewares/auth.middleware"
);

// Cria as rotas de autenticação
function criarRotasAuth(authController) {
    const router = express.Router();

    // Rota de cadastro
    router.post(
        "/register",
        authController.cadastrar
    );

    // Rota de login
    router.post(
        "/login",
        authController.login
    );

    // Rota para consultar o usuário logado
    router.get(
        "/me",
        exigirAutenticacao,
        authController.consultarUsuario
    );

    // Rota para encerrar a sessão
    router.post(
        "/logout",
        authController.logout
    );

    return router;
}

// Exporta as rotas de autenticação
module.exports = {
    criarRotasAuth
};
