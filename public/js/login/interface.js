
const $ = (id) => document.getElementById(id);

// Exibe mensagens de sucesso ou erro
export function mostrarMensagem(texto, tipo) {
    const mensagem = $("mensagem");

    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
}

// Esconde as mensagens da tela
export function esconderMensagem() {
    const mensagem = $("mensagem");

    mensagem.textContent = "";
    mensagem.className = "mensagem escondido";
}

// Exibe o formulário de login
export function abrirLogin() {
    esconderMensagem();

    $("btnAbaLogin").classList.add("ativa");
    $("btnAbaCadastro").classList.remove("ativa");

    $("formLogin").classList.remove("escondido");
    $("formCadastro").classList.add("escondido");
    $("areaLogado").classList.add("escondido");

    document.querySelector(".abas")
        .classList.remove("escondido");
}

// Exibe o formulário de cadastro
export function abrirCadastro() {
    esconderMensagem();

    $("btnAbaCadastro").classList.add("ativa");
    $("btnAbaLogin").classList.remove("ativa");

    $("formCadastro").classList.remove("escondido");
    $("formLogin").classList.add("escondido");
    $("areaLogado").classList.add("escondido");

    document.querySelector(".abas")
        .classList.remove("escondido");
}

// Exibe os dados do usuário autenticado
export function mostrarUsuarioLogado(usuario) {
    esconderMensagem();

    $("formLogin").classList.add("escondido");
    $("formCadastro").classList.add("escondido");

    document.querySelector(".abas")
        .classList.add("escondido");

    $("areaLogado").classList.remove("escondido");

    $("nomeUsuario").textContent = usuario.nickname;
    $("emailUsuario").textContent = usuario.email || "";
}
