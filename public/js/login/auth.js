
 // Realiza o cadastro do usuário
export async function cadastrarUsuario(nickname, email, senha) {
    const resposta = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
            nickname,
            email,
            senha
        })
    });

    return {
        ok: resposta.ok,
        dados: await resposta.json()
    };
}

// Realiza o login do usuário
export async function fazerLogin(email, senha) {
    const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
            email,
            senha
        })
    });

    return {
        ok: resposta.ok,
        dados: await resposta.json()
    };
}

// Encerra a sessão do usuário
export async function fazerLogout() {
    const resposta = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
    });

    return {
        ok: resposta.ok,
        dados: await resposta.json()
    };
}

// Consulta a sessão atual
export async function verificarSessao() {
    const resposta = await fetch("/api/auth/me", {
        credentials: "include"
    });

    return {
        ok: resposta.ok,
        status: resposta.status,
        dados: resposta.ok ? await resposta.json() : null
    };
}
