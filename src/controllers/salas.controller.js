const {
    codigoSalaExiste,
    criarSalaBanco,
    listarSalasBanco,
    listarSalasPublicasBanco,
    listarSalasPrivadasBanco,
    buscarSalaPorCodigoBanco
} = require("../../database/database");

// ======================================================
// TÓPICO PROFESSOR: CONTROLLER DE SALAS
// ======================================================
//
// Recebe as requisições HTTP relacionadas às salas.
// O estado ativo das salas continua no Map do server.js.
// A persistência continua no SQLite.
//

function criarSalasController({
    rooms,
    gerarCodigoSala,
    criarEstruturaSala
}) {

    // ==================================================
    // POST - CRIAR SALA PRIVADA
    // ==================================================

    async function criarSalaPrivada(
        req,
        res
    ) {

        try {

            let roomCode;
            let codigoJaExiste;

            do {

                roomCode =
                    gerarCodigoSala();

                codigoJaExiste =
                    rooms.has(
                        roomCode
                    ) ||
                    await codigoSalaExiste(
                        roomCode
                    );

            } while (
                codigoJaExiste
            );

            const usuario =
                req.session.usuario;

            // TÓPICO PROFESSOR: PERSISTÊNCIA SQLITE
            const idSala =
                await criarSalaBanco(
                    roomCode,
                    usuario.idJogador,
                    true
                );

            // TÓPICO PROFESSOR: ESTADO EM MEMÓRIA
            const sala =
                criarEstruturaSala({
                    idSala,

                    roomCode,

                    privada:
                        true,

                    hostId:
                        usuario.idJogador,

                    hostName:
                        usuario.nickname
                });

            rooms.set(
                roomCode,
                sala
            );

            console.log(
                `Sala privada ${roomCode} criada via HTTP ` +
                `e salva no SQLite.`
            );

            return res
                .status(201)
                .json({
                    sucesso:
                        true,

                    mensagem:
                        "Sala privada criada e persistida com sucesso.",

                    sala: {
                        idSala,

                        roomCode,

                        private:
                            true,

                        status:
                            "WAITING",

                        host: {
                            idJogador:
                                usuario.idJogador,

                            nickname:
                                usuario.nickname
                        }
                    }
                });

        } catch (erro) {

            console.error(
                "Erro ao criar sala privada via HTTP:",
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Não foi possível criar a sala privada."
                });
        }
    }

    // ==================================================
    // GET - SALAS PÚBLICAS
    // ==================================================

    async function listarSalasPublicas(
        req,
        res
    ) {

        try {

            const salas =
                await listarSalasPublicasBanco();

            return res.json({
                total:
                    salas.length,

                salas
            });

        } catch (erro) {

            console.error(
                "Erro ao listar salas públicas:",
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Não foi possível consultar as salas públicas."
                });
        }
    }

    // ==================================================
    // GET - TODAS AS SALAS
    // ==================================================

    async function listarTodasSalas(
        req,
        res
    ) {

        try {

            const salas =
                await listarSalasBanco();

            return res.json({
                total:
                    salas.length,

                salas
            });

        } catch (erro) {

            console.error(
                "Erro ao listar salas:",
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Não foi possível consultar as salas."
                });
        }
    }

    // ==================================================
    // GET - SALAS PRIVADAS
    // ==================================================

    async function listarSalasPrivadas(
        req,
        res
    ) {

        try {

            const salas =
                await listarSalasPrivadasBanco();

            return res.json({
                total:
                    salas.length,

                salas
            });

        } catch (erro) {

            console.error(
                "Erro ao listar salas privadas:",
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Não foi possível consultar as salas privadas."
                });
        }
    }

    // ==================================================
    // GET - SALA PELO CÓDIGO
    // ==================================================

    async function buscarSalaPorCodigo(
        req,
        res
    ) {

        try {

            const codigo =
                String(
                    req.params.codigo || ""
                )
                    .trim()
                    .toUpperCase();

            const sala =
                await buscarSalaPorCodigoBanco(
                    codigo
                );

            if (
                !sala
            ) {

                return res
                    .status(404)
                    .json({
                        sucesso:
                            false,

                        erro:
                            "Sala não encontrada."
                    });
            }

            return res.json({
                sucesso:
                    true,

                sala
            });

        } catch (erro) {

            console.error(
                "Erro ao consultar sala:",
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso:
                        false,

                    erro:
                        "Não foi possível consultar a sala."
                });
        }
    }

    return {
        criarSalaPrivada,
        listarSalasPublicas,
        listarTodasSalas,
        listarSalasPrivadas,
        buscarSalaPorCodigo
    };
}

module.exports = {
    criarSalasController
};