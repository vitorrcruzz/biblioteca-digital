# 🖥️ Biblioteca Digital

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=white" />
  <img src="https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu&logoColor=white" />
  <img src="https://img.shields.io/badge/Vers%C3%A3o-v4.0-2ea44f" />
</p>

> **Sistema Pessoal de Gerenciamento de Acervo Literário**
> Migração de controle legada em Excel para ecossistema web full-stack, operando em infraestrutura self-hosted com segurança Zero Trust via Tailscale VPN.

---

## 📋 Sobre o projeto

A **Biblioteca Digital** é uma aplicação projetada para centralizar, catalogar e monitorar hábitos de leitura. O sistema substitui o controle manual de planilhas eletrônicas por uma interface rica, fornecendo relatórios analíticos, controle de metas dinâmicas e isolamento lógico de dados, permitindo que múltiplos usuários gerenciem seus acervos de forma totalmente independente.

O core da aplicação roda sob o princípio de infraestrutura caseira (*self-hosting*), utilizando um terminal Tanca reutilizado como servidor Linux. A arquitetura de rede foi estruturada de forma a não expor nenhuma porta de serviço para a internet pública, restringindo o perímetro de acesso a uma rede privada virtual — com opção de acesso público via Tailscale Funnel.

### ✨ Funcionalidades

- 📊 **Dashboard Analytics:** Gráficos e indicadores de performance de leitura (páginas lidas, score médio, dias por obra).
- 📖 **Minha Estante:** Acervo completo com busca, filtros (ano, categoria, status) e paginação (50 livros por página) — mantém a navegação rápida mesmo com centenas de títulos cadastrados.
- 🗂️ **Sagas/Coleções:** Agrupamento de livros de uma mesma série (ex: *A Torre Negra*) independente do ano ou categoria de cada volume, com numeração de volume, barra de progresso por saga e paginação (10 sagas por página).
- 🏷️ **Categorias e Subcategorias Editáveis:** Criação, renomeação e exclusão de categorias diretamente pela interface, com propagação automática do novo nome para os livros já cadastrados e aviso do impacto antes de excluir.
- 🎯 **Gestão de Metas:** Monitoramento de objetivos literários anuais com barras de progresso adaptativas.
- 👥 **Multi-tenant Isolado:** Cada conta criada possui e gerencia uma base de dados SQLite dedicada e isolada.
- ⭐ **Avaliação Granular:** Classificação de títulos por estrelas com suporte a frações (meias estrelas).
- ✅ **Sincronização Status ↔ Data:** Marcar um livro como "Concluído" preenche a data de término automaticamente, e vice-versa.
- 🔄 **Controle de Releituras:** Marcadores específicos para identificar releituras de obras do acervo.
- 🗓️ **Gerenciamento de Anos:** Criação de anos com metas opcionais e filtros por período.
- 📱 **Navegação Mobile Dedicada:** Topbar fixa, menu hambúrguer deslizante e botão flutuante (FAB) contextual — adiciona livro ou saga dependendo da tela em que o usuário está.
- 🔐 **Autenticação Avançada:** Login seguro por e-mail/senha ou Provedor Google via Firebase Authentication, com confirmação antes de encerrar a sessão.
- 🔑 **Recuperação de Senha:** Redefinição de senha via link enviado ao e-mail cadastrado.
- ⚙️ **Página de Conta:** Gerenciamento de perfil, alteração de nome, e-mail, senha e meta de leitura do ano atual.
- 🌐 **Acesso Público:** Exposição segura via Tailscale Funnel com HTTPS automático sem domínio próprio.

---

## 🏗️ Arquitetura

```
Dispositivo do Usuário (Navegador / Mobile)
        │
        ▼  Conexão Criptografada (HTTPS)
  Tailscale Funnel (Acesso público sem domínio)
        │
        ▼  ou Tailscale VPN (Acesso privado)
  Nginx Proxy Reverso (Porta 80)
        │
        ▼  Localhost Loopback
  Node.js + Express API (Porta 3000 — apenas 127.0.0.1)
   ├── Firebase Admin SDK ──→ Validação JWT
   └── SQLite Driver       ──→ Pool de conexões por usuário
```

---

## 🗂️ Estrutura do projeto

```
biblioteca-digital/
├── package.json
│
├── public/                          # Frontend Estático
│   ├── index.html                   # App principal (Dashboard, Minha Estante e Sagas)
│   ├── login.html                   # Tela de login
│   ├── register.html                # Tela de cadastro
│   ├── reset.html                   # Recuperação de senha
│   ├── account.html                 # Página de conta e configurações
│   ├── 404.html                     # Página de rota não encontrada
│   ├── assets/
│   │   ├── css/
│   │   │   ├── style.css            # Estilos da aplicação principal
│   │   │   ├── login.css            # Estilos das telas de autenticação
│   │   │   └── account.css          # Estilos da página de conta
│   │   └── js/
│   │       ├── script.js            # Lógica principal do app (Dashboard/Estante/Sagas)
│   │       ├── account.js           # Lógica da página de conta
│   │       ├── ui-common.js         # Funções compartilhadas (modais, toast, menu mobile, apiRequest)
│   │       ├── app-init.js          # Inicialização Firebase + proteção de rota
│   │       ├── firebase-core.js     # Núcleo único do Firebase (app/auth/provider/login/logout)
│   │       ├── firebase-login.js    # Lógica da tela de login
│   │       ├── firebase-register.js # Lógica da tela de cadastro
│   │       ├── firebase-reset.js    # Lógica de recuperação de senha
│   │       └── firebase-config.js   # ⚠️ Ignorado no Git — credenciais locais
│   └── images/
│
├── server/                          # Backend
│   ├── index.js                     # Servidor Express, CORS, 404 e erro global
│   ├── database.js                  # Pool de conexões SQLite por usuário, schema, migrações
│   ├── auth.js                      # Middleware de validação JWT (Firebase Admin, API modular)
│   ├── migrate.js                   # Script de migração do Excel para SQLite (uso único, histórico)
│   ├── firebase-admin-key.json      # ⚠️ Ignorado no Git — chave privada
│   └── routes/
│       ├── books.js                 # API REST de livros
│       ├── goals.js                 # API REST de metas
│       ├── categories.js            # API REST de categorias e subcategorias
│       ├── sagas.js                 # API REST de sagas/coleções
│       └── accountRoutes.js         # API REST de conta e perfil
```

---

## 🔧 Infraestrutura de Hospedagem

| Atributo | Componente | Papel |
|---|---|---|
| Hardware | Terminal Tanca | Servidor dedicado reaproveitado *on-premises* |
| Sistema Operacional | Ubuntu Server 24.04 LTS | Base do servidor |
| Proxy Web | Nginx | Proxy reverso e segurança de borda |
| Acesso Privado | Tailscale VPN | Rede mesh criptografada sem port-forwarding |
| Acesso Público | Tailscale Funnel | HTTPS automático sem domínio próprio |
| Firewall | UFW | Bloqueio total exceto portas VPN e SSH |
| Process Manager | PM2 | Restart automático e persistência pós-reboot |

---

## 🚀 Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão 20.x LTS ou superior

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/vitorrcruzz/biblioteca-digital.git
cd biblioteca-digital

# 2. Instale as dependências
npm install
```

### Configuração de credenciais

Crie o arquivo `public/assets/js/firebase-config.js` com os dados do seu projeto Firebase:

```javascript
window.__firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};
```

Adicione a chave privada do Firebase Admin em `server/firebase-admin-key.json`.

```bash
# 3. Inicie o servidor
npm start

# 4. Acesse
http://localhost:3000
```

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta em que o servidor escuta |
| `ALLOWED_ORIGINS` | *(vazio = CORS aberto)* | Lista de origens permitidas, separadas por vírgula (ex: `https://seudominio.com,http://localhost:3000`). Sem essa variável, o CORS mantém o comportamento aberto. |

Ao definir ou alterar `ALLOWED_ORIGINS` em produção via PM2, reinicie com:
```bash
pm2 restart biblioteca-digital --update-env
```

---

## 🌐 API REST

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/books` | Lista livros do usuário | ✅ |
| POST | `/api/books` | Cadastra novo livro | ✅ |
| PUT | `/api/books/:id` | Atualiza livro | ✅ |
| DELETE | `/api/books/:id` | Remove livro | ✅ |
| DELETE | `/api/books/year/:year` | Remove todos os livros de um ano | ✅ |
| GET | `/api/goals` | Lista metas | ✅ |
| POST | `/api/goals` | Cria ou atualiza meta | ✅ |
| DELETE | `/api/goals/:year` | Remove meta do ano | ✅ |
| GET | `/api/categories` | Lista categorias e subcategorias | ✅ |
| POST | `/api/categories` | Cria categoria ou subcategoria | ✅ |
| PUT | `/api/categories/:id` | Renomeia categoria/subcategoria (propaga para os livros) | ✅ |
| DELETE | `/api/categories/:id` | Exclui categoria/subcategoria (desvincula dos livros) | ✅ |
| GET | `/api/sagas` | Lista sagas com os livros vinculados | ✅ |
| POST | `/api/sagas` | Cria saga | ✅ |
| PUT | `/api/sagas/:id` | Renomeia saga | ✅ |
| DELETE | `/api/sagas/:id` | Exclui saga (livros permanecem, apenas desvinculados) | ✅ |
| GET | `/api/account` | Dados do usuário | ✅ |
| PUT | `/api/account/name` | Atualiza nome | ✅ |
| PUT | `/api/account/email` | Atualiza email | ✅ |
| PUT | `/api/account/goal` | Define meta do ano atual | ✅ |
| DELETE | `/api/account/books` | Exclui todo o acervo | ✅ |
| DELETE | `/api/account` | Exclui conta | ✅ |

---

## 🔐 Modelo de Segurança

- **Zero Exposição Direta:** O Express escuta em `127.0.0.1:3000`. O tráfego externo passa pelo Nginx e pela VPN Tailscale.
- **Isolamento por Usuário:** O UID extraído do JWT define qual banco SQLite é carregado — nenhum usuário acessa dados de outro. As conexões são reaproveitadas por usuário (pool), em vez de abertas a cada requisição.
- **CORS Configurável:** A lista de origens permitidas é definida via `ALLOWED_ORIGINS`, restringindo quem pode consumir a API a partir do navegador.
- **Tratamento de Erro Unificado:** Qualquer exceção não tratada numa rota responde no mesmo formato JSON (`{ error: "..." }`) usado no resto da API, sem vazar detalhes internos.
- **Credenciais fora do Git:** `firebase-config.js` e `firebase-admin-key.json` estão no `.gitignore` e nunca são versionados.
- **Firewall UFW:** Apenas portas 80 e 22 liberadas via range Tailscale (`100.0.0.0/8`).

---

## 🌿 Workflow de Versionamento

O repositório segue um fluxo de duas branches:

| Branch | Papel |
|---|---|
| `master` | Ambiente de desenvolvimento e testes |
| `main` | Ambiente de produção, refletindo o que roda no servidor |

---

## 📊 Origem dos dados

O sistema foi migrado de uma planilha Excel com registros desde 2022. O script `server/migrate.js` realizou a importação automática de todos os livros para o banco SQLite, preservando títulos, autores, categorias, páginas, datas e avaliações.

---

## 👨‍💻 Autor

| Nome | GitHub | LinkedIn |
|---|---|---|
| Vitor Cruz | [@vitorrcruzz](https://github.com/vitorrcruzz) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/vitor-cruz-5214b91bb) |

---

<p align="center">
  Desenvolvido com ☕ e focado em engenharia de software self-hosted por Vitor Cruz — 2026
</p>