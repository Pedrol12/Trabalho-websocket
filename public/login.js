const btnAbaLogin =
    document.getElementById(
        "btnAbaLogin"
    );

const btnAbaCadastro =
    document.getElementById(
        "btnAbaCadastro"
    );

const formLogin =
    document.getElementById(
        "formLogin"
    );

const formCadastro =
    document.getElementById(
        "formCadastro"
    );

const areaLogado =
    document.getElementById(
        "areaLogado"
    );

const mensagem =
    document.getElementById(
        "mensagem"
    );

const nomeUsuario =
    document.getElementById(
        "nomeUsuario"
    );

const emailUsuario =
    document.getElementById(
        "emailUsuario"
    );

const btnLogout =
    document.getElementById(
        "btnLogout"
    );

const btnTestarSessao =
    document.getElementById(
        "btnTestarSessao"
    );

// ======================================================
// MENSAGENS
// ======================================================

function mostrarMensagem(
    texto,
    tipo
) {

    mensagem.textContent =
        texto;

    mensagem.className =
        `mensagem ${tipo}`;
}

function esconderMensagem() {

    mensagem.textContent =
        "";

    mensagem.className =
        "mensagem escondido";
}

// ======================================================
// ABAS
// ======================================================

function abrirLogin() {

    esconderMensagem();

    btnAbaLogin
        .classList
        .add("ativa");

    btnAbaCadastro
        .classList
        .remove("ativa");

    formLogin
        .classList
        .remove("escondido");

    formCadastro
        .classList
        .add("escondido");

    areaLogado
        .classList
        .add("escondido");

    document.querySelector(
        ".abas"
    )
        .classList
        .remove("escondido");
}

function abrirCadastro() {

    esconderMensagem();

    btnAbaCadastro
        .classList
        .add("ativa");

    btnAbaLogin
        .classList
        .remove("ativa");

    formCadastro
        .classList
        .remove("escondido");

    formLogin
        .classList
        .add("escondido");

    areaLogado
        .classList
        .add("escondido");

    document.querySelector(
        ".abas"
    )
        .classList
        .remove("escondido");
}

// ======================================================
// ESTADO LOGADO
// ======================================================

function mostrarUsuarioLogado(
    usuario
) {

    esconderMensagem();

    formLogin
        .classList
        .add("escondido");

    formCadastro
        .classList
        .add("escondido");

    document.querySelector(
        ".abas"
    )
        .classList
        .add("escondido");

    areaLogado
        .classList
        .remove("escondido");

    nomeUsuario.textContent =
        usuario.nickname;

    emailUsuario.textContent =
        usuario.email || "";
}

// ======================================================
// CADASTRO
// ======================================================

formCadastro.addEventListener(
    "submit",

    async (event) => {

        event.preventDefault();

        esconderMensagem();

        const nickname =
            document
                .getElementById(
                    "cadastroNickname"
                )
                .value
                .trim();

        const email =
            document
                .getElementById(
                    "cadastroEmail"
                )
                .value
                .trim();

        const senha =
            document
                .getElementById(
                    "cadastroSenha"
                )
                .value;

        const confirmarSenha =
            document
                .getElementById(
                    "cadastroConfirmarSenha"
                )
                .value;

        if (
            senha !==
            confirmarSenha
        ) {

            mostrarMensagem(
                "As senhas não coincidem.",
                "erro"
            );

            return;
        }

        const botao =
            document.getElementById(
                "btnCadastro"
            );

        botao.disabled =
            true;

        botao.textContent =
            "Criando conta...";

        try {

            const resposta =
                await fetch(
                    "/api/auth/register",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials:
                            "include",

                        body:
                            JSON.stringify({
                                nickname,
                                email,
                                senha
                            })
                    }
                );

            const dados =
                await resposta.json();

            if (
                !resposta.ok
            ) {

                mostrarMensagem(
                    dados.erro ||
                    "Não foi possível criar a conta.",
                    "erro"
                );

                return;
            }

             window.location.href = "/lobby.html";
            return;

        } catch (erro) {

            console.error(
                erro
            );

            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );

        } finally {

            botao.disabled =
                false;

            botao.textContent =
                "Criar conta";
        }
    }
);

// ======================================================
// LOGIN
// ======================================================

formLogin.addEventListener(
    "submit",

    async (event) => {

        event.preventDefault();

        esconderMensagem();

        const email =
            document
                .getElementById(
                    "loginEmail"
                )
                .value
                .trim();

        const senha =
            document
                .getElementById(
                    "loginSenha"
                )
                .value;

        const botao =
            document.getElementById(
                "btnLogin"
            );

        botao.disabled =
            true;

        botao.textContent =
            "Entrando...";

        try {

            const resposta =
                await fetch(
                    "/api/auth/login",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials:
                            "include",

                        body:
                            JSON.stringify({
                                email,
                                senha
                            })
                    }
                );

            const dados =
                await resposta.json();

            if (
                !resposta.ok
            ) {

                mostrarMensagem(
                    dados.erro ||
                    "Não foi possível realizar o login.",
                    "erro"
                );

                return;
            }

            window.location.href = "/lobby.html";
            return;

        } catch (erro) {

            console.error(
                erro
            );

            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );

        } finally {

            botao.disabled =
                false;

            botao.textContent =
                "Entrar";
        }
    }
);

// ======================================================
// LOGOUT
// ======================================================

btnLogout.addEventListener(
    "click",

    async () => {

        try {

            const resposta =
                await fetch(
                    "/api/auth/logout",
                    {
                        method:
                            "POST",

                        credentials:
                            "include"
                    }
                );

            const dados =
                await resposta.json();

            if (
                !resposta.ok
            ) {

                mostrarMensagem(
                    dados.erro ||
                    "Erro ao sair.",
                    "erro"
                );

                return;
            }

            formLogin.reset();

            formCadastro.reset();

            abrirLogin();

            mostrarMensagem(
                "Logout realizado com sucesso.",
                "sucesso"
            );

        } catch (erro) {

            console.error(
                erro
            );

            mostrarMensagem(
                "Não foi possível conectar ao servidor.",
                "erro"
            );
        }
    }
);

// ======================================================
// TESTAR SESSÃO
// ======================================================

btnTestarSessao.addEventListener(
    "click",

    async () => {

        try {

            const resposta =
                await fetch(
                    "/api/auth/me",
                    {
                        credentials:
                            "include"
                    }
                );

            const dados =
                await resposta.json();

            if (
                !resposta.ok
            ) {

                abrirLogin();

                mostrarMensagem(
                    "Sua sessão não está mais ativa.",
                    "erro"
                );

                return;
            }

            mostrarUsuarioLogado(
                dados.usuario
            );

            mostrarMensagem(
                "Sessão válida.",
                "sucesso"
            );

        } catch (erro) {

            console.error(
                erro
            );

            mostrarMensagem(
                "Não foi possível verificar a sessão.",
                "erro"
            );
        }
    }
);

// ======================================================
// BOTÕES DAS ABAS
// ======================================================

btnAbaLogin.addEventListener(
    "click",
    abrirLogin
);

btnAbaCadastro.addEventListener(
    "click",
    abrirCadastro
);

// ======================================================
// VERIFICA SE JÁ ESTÁ LOGADO
// ======================================================

async function verificarSessaoInicial() {

    try {

        const resposta =
            await fetch(
                "/api/auth/me",
                {
                    credentials:
                        "include"
                }
            );

        if (
            resposta.status ===
            401
        ) {

            abrirLogin();

            return;
        }

        const dados =
            await resposta.json();

                if (
            resposta.ok &&
            dados.autenticado
        ) {

            window.location.href = "/lobby.html";
            return;
        }
        
        abrirLogin();

    } catch (erro) {

        console.error(
            "Erro ao verificar sessão:",
            erro
        );

        abrirLogin();
    }
}

verificarSessaoInicial();