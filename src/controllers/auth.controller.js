
const bcrypt = require("bcryptjs");

// Cria o controller de autenticação
function criarAuthController({
    criarJogadorAutenticado,
    buscarJogadorPorEmail,
    buscarJogadorPorId,
    buscarJogadorPorNickname,
    atualizarCredenciaisJogador
}) {

    // Retorna apenas os dados públicos do jogador
    function usuarioSeguro(jogador) {
        return {
            idJogador: jogador.id_jogador,
            nickname: jogador.nickname,
            email: jogador.email,
            vitoriasTotais: jogador.vitorias_totais || 0,
            derrotasTotais: jogador.derrotas_totais || 0
        };
    }

    // Realiza o cadastro de um jogador
    async function cadastrar(req, res) {
        try {
            const nickname = String(
                req.body.nickname || ""
            ).trim();

            const email = String(
                req.body.email || ""
            ).trim().toLowerCase();

            const senha = String(req.body.senha || "");

            // Valida os dados do cadastro
            if (nickname.length < 2) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "O nickname precisa ter pelo menos 2 caracteres."
                });
            }

            if (!email || !email.includes("@")) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Informe um e-mail válido."
                });
            }

            if (senha.length < 6) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "A senha precisa ter pelo menos 6 caracteres."
                });
            }

            // Verifica se o e-mail já está cadastrado
            const jogadorComEmail =
                await buscarJogadorPorEmail(email);

            if (jogadorComEmail) {
                return res.status(409).json({
                    sucesso: false,
                    erro: "Já existe uma conta com esse e-mail."
                });
            }

            // Verifica se o nickname já está em uso
            const jogadorComNickname =
                await buscarJogadorPorNickname(nickname);

            // Criptografa a senha do jogador
            const senhaHash = await bcrypt.hash(senha, 10);

            let jogador;

            // Vincula uma conta a um jogador sem credenciais
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

                jogador = await buscarJogadorPorId(
                    jogadorComNickname.id_jogador
                );

            } else if (jogadorComNickname) {
                return res.status(409).json({
                    sucesso: false,
                    erro: "Esse nickname já está sendo utilizado."
                });

            } else {
                // Cria um novo jogador no banco
                jogador = await criarJogadorAutenticado(
                    nickname,
                    email,
                    senhaHash
                );
            }

            // Salva o usuário na sessão
            req.session.usuario = usuarioSeguro(jogador);

            return res.status(201).json({
                sucesso: true,
                mensagem: "Conta criada com sucesso.",
                usuario: req.session.usuario
            });

        } catch (erro) {
            console.error("Erro no cadastro:", erro);

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível criar a conta."
            });
        }
    }

    // Realiza o login de um jogador
    async function login(req, res) {
        try {
            const email = String(
                req.body.email || ""
            ).trim().toLowerCase();

            const senha = String(req.body.senha || "");

            // Valida os dados do login
            if (!email || !senha) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "E-mail e senha são obrigatórios."
                });
            }

            // Busca o jogador pelo e-mail
            const jogador = await buscarJogadorPorEmail(email);

            if (!jogador || !jogador.senha_hash) {
                return res.status(401).json({
                    sucesso: false,
                    erro: "E-mail ou senha inválidos."
                });
            }

            // Verifica a senha informada
            const senhaCorreta = await bcrypt.compare(
                senha,
                jogador.senha_hash
            );

            if (!senhaCorreta) {
                return res.status(401).json({
                    sucesso: false,
                    erro: "E-mail ou senha inválidos."
                });
            }

            // Salva o usuário na sessão
            req.session.usuario = usuarioSeguro(jogador);

            return res.json({
                sucesso: true,
                mensagem: "Login realizado com sucesso.",
                usuario: req.session.usuario
            });

        } catch (erro) {
            console.error("Erro no login:", erro);

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível realizar o login."
            });
        }
    }

    // Retorna os dados do usuário autenticado
    async function consultarUsuario(req, res) {
        try {
            const jogador = await buscarJogadorPorId(
                req.session.usuario.idJogador
            );

            if (!jogador) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            // Atualiza os dados da sessão
            req.session.usuario = usuarioSeguro(jogador);

            return res.json({
                sucesso: true,
                autenticado: true,
                usuario: req.session.usuario
            });

        } catch (erro) {
            console.error(
                "Erro ao consultar sessão:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível consultar a sessão."
            });
        }
    }

    // Encerra a sessão do jogador
    function logout(req, res) {
        req.session.destroy((erro) => {
            if (erro) {
                console.error("Erro no logout:", erro);

                return res.status(500).json({
                    sucesso: false,
                    erro: "Não foi possível encerrar a sessão."
                });
            }

            // Remove o cookie da sessão
            res.clearCookie("connect.sid");

            return res.json({
                sucesso: true,
                mensagem: "Logout realizado com sucesso."
            });
        });
    }

    // Disponibiliza as funções do controller
    return {
        cadastrar,
        login,
        consultarUsuario,
        logout
    };
}

// Exporta o controller
module.exports = {
    criarAuthController
};
