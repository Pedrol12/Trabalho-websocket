
 // Gera um código aleatório de 6 caracteres para a sala
function gerarCodigoSala() {
    const caracteres =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let codigo = "";

    for (let i = 0; i < 6; i++) {
        const indice = Math.floor(
            Math.random() * caracteres.length
        );

        codigo += caracteres[indice];
    }

    return codigo;
}

// Cria a estrutura inicial de uma sala
function criarEstruturaSala({
    idSala,
    roomCode,
    privada,
    hostId = null,
    hostName = null
}) {
    return {
        idSala,
        idPartida: null,
        code: roomCode,
        private: Boolean(privada),
        hostId,
        hostName,
        players: [],
        board: [
            "", "", "",
            "", "", "",
            "", "", ""
        ],
        currentTurn: "X",
        status: "WAITING",
        rematchRequests: new Set(),
        turnTimer: null,
        turnDeadline: null
    };
}

// Converte os dados da sala do banco para a memória
function salaBancoParaMemoria(salaBanco) {
    return criarEstruturaSala({
        idSala: salaBanco.id_sala,
        roomCode: salaBanco.codigo_sala,
        privada: Number(salaBanco.privada) === 1,
        hostId: salaBanco.id_jogador_host,
        hostName: salaBanco.host_nickname || null
    });
}

// Cria o serviço de gerenciamento das salas
function criarServicoSalas({
    rooms,
    listarSalasAguardandoBanco,
    buscarSalaPorCodigoBanco
}) {

    // Recupera as salas privadas salvas no banco
    async function recuperarSalasPrivadasPersistidas() {
        const salas = await listarSalasAguardandoBanco();

        let recuperadas = 0;

        for (const salaBanco of salas) {
            if (Number(salaBanco.privada) !== 1) {
                continue;
            }

            // Adiciona a sala na memória caso ainda não exista
            if (!rooms.has(salaBanco.codigo_sala)) {
                rooms.set(
                    salaBanco.codigo_sala,
                    salaBancoParaMemoria(salaBanco)
                );

                recuperadas++;
            }
        }

        console.log(
            `Salas privadas persistidas recuperadas: ${recuperadas}`
        );
    }

    // Busca a sala na memória ou recupera do banco
    async function buscarOuRecuperarSala(roomCode) {
        let sala = rooms.get(roomCode);

        // Retorna a sala caso já esteja na memória
        if (sala) {
            return sala;
        }

        const salaBanco =
            await buscarSalaPorCodigoBanco(roomCode);

        // Verifica se a sala existe no banco
        if (!salaBanco) {
            return null;
        }

        // Permite recuperar apenas salas aguardando jogadores
        if (salaBanco.status_sala !== "AGUARDANDO") {
            return null;
        }

        // Recupera a sala e adiciona na memória
        sala = salaBancoParaMemoria(salaBanco);

        rooms.set(roomCode, sala);

        return sala;
    }

    // Disponibiliza as funções do serviço
    return {
        recuperarSalasPrivadasPersistidas,
        buscarOuRecuperarSala
    };
}

// Exporta as funções do módulo
module.exports = {
    gerarCodigoSala,
    criarEstruturaSala,
    salaBancoParaMemoria,
    criarServicoSalas
};
