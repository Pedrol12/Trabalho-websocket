# Trabalho WebSocket — Jogo da Velha Multiplayer

Projeto desenvolvido para o trabalho N2 da faculdade, com o objetivo de implementar um **Jogo da Velha Multiplayer em tempo real**, utilizando WebSocket para comunicação entre os jogadores.

## Tecnologias utilizadas

- **Node.js** — execução do backend.
- **Express** — servidor HTTP e rotas da API.
- **WebSocket (ws)** — comunicação em tempo real.
- **SQLite3** — armazenamento dos dados.
- **HTML, CSS e JavaScript** — interface do jogo.
- **Express Session** — gerenciamento das sessões de autenticação.

## Funcionalidades

- Cadastro e login de jogadores.
- Criação de salas públicas e privadas.
- Entrada em salas por código.
- Botão para copiar o código da sala.
- Partidas multiplayer em tempo real.
- Validação de jogadas e identificação de vitórias e empates.
- Placar dos jogadores.
- Cronômetro de 15 segundos por turno.
- Troca automática de turno quando o tempo acaba.
- Chat entre os jogadores.
- Solicitação de revanche.
- Reconexão após queda de conexão.
- Prazo de 30 segundos para reconectar.
- Vitória por W.O. quando o adversário não retorna.
- Saída voluntária com aviso imediato ao adversário.
- Persistência de dados no SQLite.

## Estrutura do projeto

```text
Trabalho-websocket/
├── database/
│   ├── conexao.js
│   ├── inicializacao.js
│   ├── jogadores.js
│   ├── salas.js
│   ├── partidas.js
│   ├── jogadas.js
│   ├── chat.js
│   └── index.js
│
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── jogo/
│   │   ├── lobby/
│   │   ├── login/
│   │   ├── jogo.js
│   │   └── lobby.js
│   ├── login.css
│   ├── login.js
│   ├── login.html
│   ├── lobby.html
│   └── jogo.html
│
├── src/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   └── websocket/
│
├── server.js
├── package.json
└── README.md
```

## Como executar

### 1. Instalar as dependências

É necessário ter o Node.js instalado.

No terminal, dentro da pasta do projeto:

```bash
npm install
```

### 2. Iniciar o servidor

```bash
node server.js
```

O servidor será iniciado em:

```text
http://localhost:3000
```

### 3. Acessar o jogo

Abra no navegador:

```text
http://localhost:3000/login.html
```

Cadastre uma conta ou faça login para acessar o lobby.

### 4. Iniciar uma partida

1. Entre no lobby.
2. Crie uma sala pública ou privada.
3. Compartilhe o código da sala com outro jogador ou entre em uma sala pública disponível.
4. Aguarde a entrada do segundo jogador.
5. Jogue normalmente, respeitando o cronômetro de cada turno.

Para testar o multiplayer localmente, utilize dois navegadores ou sessões independentes com contas diferentes.

## Comunicação WebSocket

O WebSocket permite que o servidor e os jogadores troquem mensagens em tempo real, sem precisar atualizar a página.

O projeto utiliza eventos para controlar:

- Entrada e gerenciamento das salas.
- Jogadas e atualização do tabuleiro.
- Cronômetro e troca de turnos.
- Mensagens do chat.
- Fim de jogo e revanche.
- Desconexão, reconexão e saída voluntária.

## Banco de dados

O projeto utiliza **SQLite3** para armazenar informações como:

- Jogadores e credenciais de autenticação.
- Salas de jogo.
- Histórico de partidas.
- Jogadas realizadas.
- Mensagens do chat.
- Vitórias e derrotas.

As operações estão divididas em módulos dentro da pasta `database/`.

O arquivo de banco SQLite é ignorado pelo Git por meio do `.gitignore`.

## Organização do código

O projeto foi modular