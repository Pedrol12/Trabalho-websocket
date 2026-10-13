
 // Verifica se o usuário está autenticado
function exigirAutenticacao(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({
            sucesso: false,
            erro: "Usuário não autenticado."
        });
    }

    next();
}

// Exporta o middleware
module.exports = {
    exigirAutenticacao
};
