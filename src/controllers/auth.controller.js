const bcrypt =
    require("bcryptjs");

const {
    criarJogadorAutenticado,
    buscarJogadorPorEmail,
    buscarJogadorPorId,
    buscarJogadorPorNickname,
    atualizarCredenciaisJogador
} =
    require(
        "../../database/database"
    );

// ======================================================
// TÓPICO PROFESSOR: CONTROLLER DE AUTENTICAÇÃO
// ======================================================

function usuarioSeguro(
    jogador
) {

    return {
        idJogador:
            jogador.id_jogador,

        nickname:
            jogador.nickname,

        email:
            jogador.email,

        vitoriasTotais:
            jogador.vitorias_totais || 0,

        derrotasTotais:
            jogador.derrotas_totais || 0
    };
}

// ======================================================
// CADASTRO
// ======================================================

async function registrar(
    req,
    res
) {

    try {

        const nickname =
            String(
                req.body.nickname || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

        const senha =
            String(
                req.body.senha || ""
            );

        if (
            nickname.length < 2
        ) {

            return res
                .status(400)
                .json({
                    sucesso:
                        false,

                    erro:
                        "O nickname precisa ter pelo menos 2 caracteres."
                });
        }

        if (
            !email ||
            !email.includes("@")
        ) {

            return res
                .status(400)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Informe um e-mail válido."
                });
        }

        if (
            senha.length < 6
        ) {

            return res
                .status(400)
                .json({
                    sucesso:
                        false,

                    erro:
                        "A senha precisa ter pelo menos 6 caracteres."
                });
        }

        const jogadorComEmail =
            await buscarJogadorPorEmail(
                email
            );

        if (
            jogadorComEmail
        ) {

            return res
                .status(409)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Já existe uma conta com esse e-mail."
                });
        }

        const jogadorComNickname =
            await buscarJogadorPorNickname(
                nickname
            );

        const senhaHash =
            await bcrypt.hash(
                senha,
                10
            );

        let jogador;

        if (
            jogadorComNickname &&
            !jogadorComNickname.email &&
            !jogadorComNickname.senha_hash
        ) {

            await atualizarCredenciaisJogador(
                jogadorComNickname.id_jogador,
                email,
                senhaHash
            );

            jogador =
                await buscarJogadorPorId(
                    jogadorComNickname.id_jogador
                );

        } else if (
            jogadorComNickname
        ) {

            return res
                .status(409)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Esse nickname já está sendo utilizado."
                });

        } else {

            jogador =
                await criarJogadorAutenticado(
                    nickname,
                    email,
                    senhaHash
                );
        }

        req.session.usuario =
            usuarioSeguro(
                jogador
            );

        return res
            .status(201)
            .json({
                sucesso:
                    true,

                mensagem:
                    "Conta criada com sucesso.",

                usuario:
                    req.session.usuario
            });

    } catch (erro) {

        console.error(
            "Erro no cadastro:",
            erro
        );

        return res
            .status(500)
            .json({
                sucesso:
                    false,

                erro:
                    "Não foi possível criar a conta."
            });
    }
}

// ======================================================
// LOGIN
// ======================================================

async function login(
    req,
    res
) {

    try {

        const email =
            String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

        const senha =
            String(
                req.body.senha || ""
            );

        if (
            !email ||
            !senha
        ) {

            return res
                .status(400)
                .json({
                    sucesso:
                        false,

                    erro:
                        "E-mail e senha são obrigatórios."
                });
        }

        const jogador =
            await buscarJogadorPorEmail(
                email
            );

        if (
            !jogador ||
            !jogador.senha_hash
        ) {

            return res
                .status(401)
                .json({
                    sucesso:
                        false,

                    erro:
                        "E-mail ou senha inválidos."
                });
        }

        const senhaCorreta =
            await bcrypt.compare(
                senha,
                jogador.senha_hash
            );

        if (
            !senhaCorreta
        ) {

            return res
                .status(401)
                .json({
                    sucesso:
                        false,

                    erro:
                        "E-mail ou senha inválidos."
                });
        }

        req.session.usuario =
            usuarioSeguro(
                jogador
            );

        return res.json({
            sucesso:
                true,

            mensagem:
                "Login realizado com sucesso.",

            usuario:
                req.session.usuario
        });

    } catch (erro) {

        console.error(
            "Erro no login:",
            erro
        );

        return res
            .status(500)
            .json({
                sucesso:
                    false,

                erro:
                    "Não foi possível realizar o login."
            });
    }
}

// ======================================================
// USUÁRIO LOGADO
// ======================================================

async function usuarioAtual(
    req,
    res
) {

    try {

        const jogador =
            await buscarJogadorPorId(
                req.session.usuario.idJogador
            );

        if (
            !jogador
        ) {

            return res
                .status(404)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Usuário não encontrado."
                });
        }

        req.session.usuario =
            usuarioSeguro(
                jogador
            );

        return res.json({
            sucesso:
                true,

            autenticado:
                true,

            usuario:
                req.session.usuario
        });

    } catch (erro) {

        console.error(
            "Erro ao consultar sessão:",
            erro
        );

        return res
            .status(500)
            .json({
                sucesso:
                    false,

                erro:
                    "Não foi possível consultar a sessão."
            });
    }
}

// ======================================================
// LOGOUT
// ======================================================

function logout(
    req,
    res
) {

    req.session.destroy(
        (erro) => {

            if (
                erro
            ) {

                console.error(
                    "Erro no logout:",
                    erro
                );

                return res
                    .status(500)
                    .json({
                        sucesso:
                            false,

                        erro:
                            "Não foi possível encerrar a sessão."
                    });
            }

            res.clearCookie(
                "connect.sid"
            );

            return res.json({
                sucesso:
                    true,

                mensagem:
                    "Logout realizado com sucesso."
            });
        }
    );
}

module.exports = {
    registrar,
    login,
    usuarioAtual,
    logout
};