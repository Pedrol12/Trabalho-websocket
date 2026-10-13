
import {
    cadastrarUsuario,
    fazerLogin,
    fazerLogout,
    verificarSessao
} from "./js/login/auth.js";

import {
    mostrarMensagem,
    abrirLogin,
    abrirCadastro,
    mostrarUsuarioLogado,
    esconderMensagem
} from "./js/login/interface.js";

const $ = (id) => document.getElementById(id);

// Alterna as abas
$("btnAbaLogin").addEventListener("click", abrirLogin);
$("btnAbaCadastro").addEventListener("click", abrirCadastro);

// Cadastra um novo usuário
$("formCadastro").addEventListener("submit", async (event) => {
    event.preventDefault();
    esconderMensagem();

    const nickname = $("cadastroNickname").value.trim();
    const email = $("cadastroEmail").value.trim();
    const senha = $("cadastroSenha").value;
    const confirmarSenha = $("cadastroConfirmarSenha").value;

    if (senha !== confirmarSenha) {
        mostrarMensagem("As senhas não coincidem.", "erro");
        return;
    }

    const botao = $("btnCadastro");
    botao.disabled = true;
    botao.textContent = "Criando conta...";

    try {
        const resultado = await cadastrarUsuario(nickname, email, senha);

        if (!resultado.ok) {
            mostrarMensagem(
                resultado.dados.erro || "Não foi possível criar a conta.",
                "erro"
            );
            return;
        }

        window.location.href = "/lobby.html";
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        mostrarMensagem("Não foi possível conectar ao servidor.", "erro");
    } finally {
        botao.disabled = false;
        botao.textContent = "Criar conta";
    }
});

// Realiza o login
$("formLogin").addEventListener("submit", async (event) => {
    event.preventDefault();
    esconderMensagem();

    const email = $("loginEmail").value.trim();
    const senha = $("loginSenha").value;

    const botao = $("btnLogin");
    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        const resultado = await fazerLogin(email, senha);

        if (!resultado.ok) {
            mostrarMensagem(
                resultado.dados.erro || "Não foi possível realizar o login.",
                "erro"
            );
            return;
        }

        window.location.href = "/lobby.html";
    } catch (erro) {
        console.error("Erro no login:", erro);
        mostrarMensagem("Não foi possível conectar ao servidor.", "erro");
    } finally {
        botao.disabled = false;
        botao.textContent = "Entrar";
    }
});

// Encerra a sessão
$("btnLogout").addEventListener("click", async () => {
    try {
        const resultado = await fazerLogout();

        if (!resultado.ok) {
            mostrarMensagem(
                resultado.dados.erro || "Erro ao sair.",
                "erro"
            );
            return;
        }

        $("formLogin").reset();
        $("formCadastro").reset();

        abrirLogin();
        mostrarMensagem("Logout realizado com sucesso.", "sucesso");
    } catch (erro) {
        console.error("Erro no logout:", erro);
        mostrarMensagem("Não foi possível conectar ao servidor.", "erro");
    }
});

// Testa a sessão atual
$("btnTestarSessao").addEventListener("click", async () => {
    try {
        const resultado = await verificarSessao();

        if (!resultado.ok) {
            abrirLogin();
            mostrarMensagem("Sua sessão não está mais ativa.", "erro");
            return;
        }

        mostrarUsuarioLogado(resultado.dados.usuario);
        mostrarMensagem("Sessão válida.", "sucesso");
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        mostrarMensagem("Não foi possível verificar a sessão.", "erro");
    }
});

// Verifica se o usuário já está autenticado
async function verificarSessaoInicial() {
    try {
        const resultado = await verificarSessao();

        if (resultado.status === 401) {
            abrirLogin();
            return;
        }

        if (resultado.ok && resultado.dados.autenticado) {
            window.location.href = "/lobby.html";
            return;
        }

        abrirLogin();
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        abrirLogin();
    }
}

// Inicializa a página
verificarSessaoInicial();
