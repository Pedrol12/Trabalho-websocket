
 // Cria o controller responsável pelas salas
function criarSalasController({
    rooms,
    gerarCodigoSala,
    criarEstruturaSala,
    codigoSalaExiste,
    criarSalaBanco,
    listarSalasBanco,
    listarSalasPublicasBanco,
    listarSalasPrivadasBanco,
    buscarSalaPorCodigoBanco
}) {

    // Cria uma sala privada
    async function criarSalaPrivada(req, res) {
        try {
            let roomCode;
            let codigoJaExiste;

            // Gera um código único para a sala
            do {
                roomCode = gerarCodigoSala();

                codigoJaExiste =
                    rooms.has(roomCode) ||
                    await codigoSalaExiste(roomCode);

            } while (codigoJaExiste);

            const usuario = req.session.usuario;

            // Registra a sala no banco
            const idSala = await criarSalaBanco(
                roomCode,
                usuario.idJogador,
                true
            );

            // Cria a estrutura da sala na memória
            const sala = criarEstruturaSala({
                idSala,
                roomCode,
                privada: true,
                hostId: usuario.idJogador,
                hostName: usuario.nickname
            });

            rooms.set(roomCode, sala);

            console.log(
                `Sala privada ${roomCode} criada via HTTP e salva no SQLite.`
            );

            // Retorna os dados da sala criada
            return res.status(201).json({
                sucesso: true,
                mensagem:
                    "Sala privada criada e persistida com sucesso.",
                sala: {
                    idSala,
                    roomCode,
                    private: true,
                    status: "WAITING",
                    host: {
                        idJogador: usuario.idJogador,
                        nickname: usuario.nickname
                    }
                }
            });

        } catch (erro) {
            console.error(
                "Erro ao criar sala privada via HTTP:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível criar a sala privada."
            });
        }
    }

    // Lista as salas públicas do banco
    async function listarSalasPublicas(req, res) {
        try {
            const salas = await listarSalasPublicasBanco();

            return res.json({
                total: salas.length,
                salas
            });

        } catch (erro) {
            console.error(
                "Erro ao listar salas públicas:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível consultar as salas públicas."
            });
        }
    }

    // Lista todas as salas do banco
    async function listarSalas(req, res) {
        try {
            const salas = await listarSalasBanco();

            return res.json({
                total: salas.length,
                salas
            });

        } catch (erro) {
            console.error("Erro ao listar salas:", erro);

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível consultar as salas."
            });
        }
    }

    // Lista as salas privadas do banco
    async function listarSalasPrivadas(req, res) {
        try {
            const salas = await listarSalasPrivadasBanco();

            return res.json({
                total: salas.length,
                salas
            });

        } catch (erro) {
            console.error(
                "Erro ao listar salas privadas:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível consultar as salas privadas."
            });
        }
    }

    // Busca uma sala pelo código
    async function consultarSala(req, res) {
        try {
            const codigo = String(
                req.params.codigo || ""
            ).trim().toUpperCase();

            const sala = await buscarSalaPorCodigoBanco(
                codigo
            );

            // Verifica se a sala existe
            if (!sala) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Sala não encontrada."
                });
            }

            return res.json({
                sucesso: true,
                sala
            });

        } catch (erro) {
            console.error(
                "Erro ao consultar sala:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível consultar a sala."
            });
        }
    }

    // Disponibiliza as funções do controller
    return {
        criarSalaPrivada,
        listarSalasPublicas,
        listarSalas,
        listarSalasPrivadas,
        consultarSala
    };
}

// Exporta o controller
module.exports = {
    criarSalasController
};
