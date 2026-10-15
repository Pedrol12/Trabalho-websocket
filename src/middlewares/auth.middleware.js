// TÓPICO PROFESSOR: MIDDLEWARE DE AUTENTICAÇÃO
// Protege rotas que exigem usuário logado.

function exigirAutenticacao(
    req,
    res,
    next
) {

    if (
        !req.session.usuario
    ) {

        return res
            .status(401)
            .json({
                sucesso:
                    false,

                erro:
                    "Usuário não autenticado."
            });
    }

    next();
}

module.exports = {
    exigirAutenticacao
};