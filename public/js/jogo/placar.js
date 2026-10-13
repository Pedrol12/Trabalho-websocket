
const $ = (id) => document.getElementById(id);

// Atualiza o placar dos jogadores
export function atualizarPlacar(score) {
    if (!Array.isArray(score)) {
        return;
    }

    score.forEach((jogador) => {
        if (jogador.symbol === "X") {
            $("placar-x").textContent = jogador.score;
        }

        if (jogador.symbol === "O") {
            $("placar-o").textContent = jogador.score;
        }
    });
}
