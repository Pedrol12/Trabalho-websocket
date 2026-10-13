
 // Cria o serviço de gerenciamento das salas públicas
function criarServicoSalasPublicas({
    rooms,
    wss,
    enviar
}) {

    // Retorna as salas públicas disponíveis
    function obterSalasPublicas() {
        return Array.from(rooms.values())
            .filter((sala) => {
                return (
                    sala.private === false &&
                    sala.status === "WAITING" &&
                    sala.players.length < 2
                );
            })
            .map((sala) => ({
                roomCode: sala.code,
                hostName:
                    sala.players[0]?.name ||
                    sala.hostName ||
                    null,
                playersCount: sala.players.length,
                maxPlayers: 2,
                status: sala.status
            }));
    }

    // Envia a lista de salas públicas para um jogador
    function enviarListaSalasPublicas(ws) {
        enviar(ws, {
            type: "ROOM_LIST_UPDATE",
            rooms: obterSalasPublicas()
        });
    }

    // Envia a lista atualizada para todos os clientes
    function broadcastListaSalasPublicas() {
        const dados = {
            type: "ROOM_LIST_UPDATE",
            rooms: obterSalasPublicas()
        };

        for (const cliente of wss.clients) {
            enviar(cliente, dados);
        }
    }

    // Disponibiliza as funções do serviço
    return {
        obterSalasPublicas,
        enviarListaSalasPublicas,
        broadcastListaSalasPublicas
    };
}

// Exporta o módulo
module.exports = {
    criarServicoSalasPublicas
};
