# 📚 Biblioteca Digital

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=white" />
  <img src="https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white" />
  <img src="https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu&logoColor=white" />
  <img src="https://img.shields.io/badge/Vers%C3%A3o-v5.0-2ea44f" />
</p>

<p align="center">
  Seu acervo, suas leituras e suas metas em um só lugar.
</p>

<p align="center">
  <a href="#sobre-o-projeto">Sobre</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#app-android">Android</a> ·
  <a href="#como-executar">Instalação</a> ·
  <a href="#gerar-o-apk">Gerar APK</a>
</p>

<a id="sobre-o-projeto"></a>
## Sobre o projeto

A **Biblioteca Digital** é uma aplicação web e Android para organizar livros e acompanhar hábitos de leitura. Cada usuário possui seu próprio acervo, com histórico por ano, avaliações, sagas e metas.

O projeto nasceu de uma planilha Excel com registros desde 2022. A evolução para uma aplicação trouxe navegação pelo celular, consultas paginadas e indicadores de leitura, preservando a possibilidade de exportar os dados para uma planilha formatada.

A hospedagem foi pensada para um servidor próprio (*self-hosted*), com Node.js, SQLite e autenticação pelo Firebase.

<a id="funcionalidades"></a>
## Funcionalidades

| Recurso | O que oferece |
|---|---|
| **Dashboard** | Indicadores de leitura, gráficos por mês e categoria e últimas leituras. |
| **Minha Estante** | Busca por título ou autor, filtros e paginação de 50 livros por página. |
| **Sagas e coleções** | Organização por volumes, acompanhamento de progresso e 10 sagas por página. |
| **Registro de leituras** | Datas de início e término, status, páginas, releituras e avaliações com meias estrelas. |
| **Categorias** | Criação, edição e exclusão de categorias e subcategorias. |
| **Metas anuais** | Definição, edição e exclusão de metas para os anos registrados na conta. |
| **Exportação Excel** | Arquivo `.xlsx` de um ano ou de todos os anos, com fórmulas, metas e gráficos editáveis. |
| **Conta e acesso** | Login por e-mail/senha ou Google, recuperação de senha e gerenciamento de perfil. |

A interface se adapta ao computador e ao celular. Livros, sagas e metas são armazenados em um banco SQLite dedicado a cada usuário.

<a id="app-android"></a>
## App Android

<p align="center">
  <a href="https://github.com/vitorrcruzz/biblioteca-digital/releases/latest/download/biblioteca-digital.apk">
    <img src="https://img.shields.io/badge/Baixar_APK-Android-3DDC84?logo=android&logoColor=white&style=for-the-badge" alt="Baixar APK para Android" />
  </a>
</p>

Baixe o arquivo pela [última release](https://github.com/vitorrcruzz/biblioteca-digital/releases), abra no celular e autorize a instalação pelo navegador ou gerenciador de arquivos, caso o Android solicite.

O aplicativo usa **Capacitor** e carrega o site configurado em `capacitor.config.json`. Na distribuição oficial, ele acessa o servidor de produção e compartilha o login e os dados da versão web. É necessária conexão com a internet.

> Mudanças nas páginas e na API precisam ser disponibilizadas no servidor. Alterações em plugins ou configurações nativas também exigem um novo APK.

## Tecnologias e arquitetura

| Camada | Tecnologias |
|---|---|
| Interface | HTML, CSS e JavaScript |
| API | Node.js e Express |
| Dados | SQLite com better-sqlite3 |
| Autenticação | Firebase Authentication e Firebase Admin |
| Android | Capacitor e Gradle |
| Exportação | ExcelJS e JSZip |

```text
Navegador / aplicativo Android
              │
              ▼
       Node.js + Express
              │
              ├── Firebase Admin → validação da autenticação
              └── SQLite         → dados de cada usuário
```

Na infraestrutura de hospedagem do projeto, um terminal Tanca reaproveitado executa Ubuntu Server, Nginx e PM2. O acesso pode ser privado pela rede Tailscale ou público via Tailscale Funnel. O Express escuta em `127.0.0.1`, atrás do proxy.

## Estrutura do projeto

```text
biblioteca-digital/
├── public/                  # Páginas, estilos, scripts e imagens
├── server/
│   ├── index.js             # Servidor e registro das rotas
│   ├── auth.js              # Autenticação da API
│   ├── database.js          # Bancos SQLite e conexões por usuário
│   ├── library-queries.js   # Paginação e consultas do dashboard
│   ├── excel-export.js     # Planilhas e fórmulas
│   ├── excel-charts.js      # Gráficos do Excel
│   └── routes/              # Livros, sagas, metas, conta e exportação
├── android/                 # Projeto nativo Android
├── build/                   # Integração JavaScript e geração do APK
├── capacitor.config.json    # Configuração do aplicativo
└── package.json             # Dependências e comandos
```

Bancos de dados, chaves privadas e arquivos de teste local ficam fora do versionamento.

<a id="como-executar"></a>
## Como executar

### 1. Preparar o projeto

Use **Node.js 22 ou 24**, npm e um projeto Firebase com Authentication configurado para os provedores desejados.

```bash
git clone https://github.com/vitorrcruzz/biblioteca-digital.git
cd biblioteca-digital
npm ci
```

### 2. Configurar o Firebase

Crie `public/assets/js/firebase-config.js` com a configuração do aplicativo web do seu projeto:

```javascript
window.__firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};
```

Adicione a chave de conta de serviço do Firebase Admin em `server/firebase-admin-key.json`. Essa chave é privada e deve permanecer somente no servidor ou no ambiente local. Ambos os arquivos estão no `.gitignore`.

### 3. Iniciar a aplicação

```bash
npm start
```

Abra **http://localhost:3000**. Para desenvolver com reinicialização automática do servidor, use `npm run dev`.

### Configuração do servidor

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta do servidor HTTP. |
| `ALLOWED_ORIGINS` | Não definida | Origens aceitas pelo CORS, separadas por vírgula. Sem definição, o CORS fica aberto. |

Defina as variáveis no ambiente que inicia o processo. Em uma instalação com PM2, alterações no ambiente podem ser aplicadas com `pm2 restart biblioteca-digital --update-env`, usando o nome atribuído à aplicação.

<a id="gerar-o-apk"></a>
## Gerar o APK

A automação de release está disponível para **Windows com PowerShell e Android Studio**. Instale o Android SDK e mantenha disponíveis os arquivos locais:

- `android/app/google-services.json` — configuração Android do Firebase.
- `android/keystore.properties` e a chave de assinatura referenciada nele.
- `public/assets/js/firebase-config.js` — configuração web do Firebase.

Antes de uma nova versão, ajuste `versionCode` e `versionName` em `android/app/build.gradle`. Confira também o endereço de produção em `capacitor.config.json`.

```bash
npm run build:android
```

O comando executa os testes presentes na máquina, gera a integração JavaScript, sincroniza o Capacitor e compila o release assinado. Depois verifica a assinatura, a versão e o endereço de produção dentro do APK.

Os arquivos para distribuição ficam em:

```text
android/app/build/outputs/apk/release/
├── biblioteca-digital.apk
└── biblioteca-digital.apk.sha256
```

A versão não é incrementada automaticamente. O comando não faz commit, push nem publicação; o APK validado pode ser anexado a uma Release do GitHub.

<details>
<summary><strong>Referência resumida da API</strong></summary>

As rotas abaixo exigem um token Firebase no cabeçalho `Authorization: Bearer <token>`.

| Recurso | Rotas principais |
|---|---|
| Livros | `/api/books` e `/api/books/:id` |
| Dashboard e filtros | `/api/books/dashboard` e `/api/books/metadata` |
| Sagas | `/api/sagas` e `/api/sagas/:id` |
| Categorias | `/api/categories` e `/api/categories/:id` |
| Metas | `/api/goals` e `/api/goals/:year` |
| Conta | `/api/account` |
| Excel | `/api/exports/excel?year=all` ou `?year=2026` |

Para consultar listas paginadas, use `GET /api/books?page=1&pageSize=50` ou `GET /api/sagas?page=1&pageSize=10`. Os endpoints sem parâmetros de paginação mantêm compatibilidade com clientes anteriores.

A exportação inclui todos os registros do período selecionado, com uma aba por ano, independentemente da página exibida na interface.

</details>

## Dados e segurança

A API valida a autenticação antes de acessar os recursos do usuário. O UID autenticado determina qual banco SQLite será utilizado, e os dados locais ficam em `server/data/`.

Chaves de serviço, credenciais de assinatura, bancos e configurações locais são ignorados pelo Git. O APK e seu arquivo de integridade são distribuídos como artefatos da release, separados do código-fonte.

## Versionamento

| Branch | Finalidade |
|---|---|
| `master` | Desenvolvimento e preparação de alterações. |
| `main` | Código destinado à produção. |

## Autor

| Nome | GitHub | LinkedIn |
|---|---|---|
| Vitor Cruz | [@vitorrcruzz](https://github.com/vitorrcruzz) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/vitor-cruz-5214b91bb) |

<p align="center">
  Desenvolvido com ☕ e 📚 por Vitor -2026.
</p>
