# 🖥️ Biblioteca Digital

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=white" />
  <img src="https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-Em%20desenvolvimento-yellow" />
</p>

> **Sistema Pessoal de Gerenciamento de Acervo Literário**
> Migração de controle legada em Excel para ecossistema web full-stack, operando em infraestrutura self-hosted com segurança Zero Trust via Tailscale VPN.

---

## 📋 Sobre o projeto

A **Biblioteca Digital** é uma aplicação projetada para centralizar, catalogar e monitorar hábitos de leitura. O sistema substitui o controle manual de planilhas eletrônicas por uma interface rica, fornecendo relatórios analíticos, controle de metas dinâmicas e isolamento lógico de dados, permitindo que múltiplos usuários gerenciem seus acervos de forma totalmente independente.

O core da aplicação roda sob o princípio de infraestrutura caseira (*self-hosting*), utilizando um terminal Tanca reutilizado como servidor Linux. A arquitetura de rede foi estruturada de forma a não expor nenhuma porta de serviço para a internet pública, restringindo o perímetro de acesso a uma rede privada virtual — com opção de acesso público via Tailscale Funnel.

### ✨ Funcionalidades

- 📊 **Dashboard Analytics:** Gráficos e indicadores de performance de leitura (páginas lidas, score médio, dias por obra).
- 🎯 **Gestão de Metas:** Monitoramento de objetivos literários anuais com barras de progresso adaptativas.
- 👥 **Multi-tenant Isolado:** Cada conta criada possui e gerencia uma base de dados SQLite dedicada e isolada.
- ⭐ **Avaliação Granular:** Classificação de títulos por estrelas com suporte a frações (meias estrelas).
- 🔄 **Controle de Releituras:** Marcadores específicos para identificar releituras de obras do acervo.
- 🗂️ **Gerenciamento de Anos:** Criação de anos com metas opcionais e filtros por período.
- 📱 **Interface Responsiva:** Frontend Vanilla ES6 otimizado para dispositivos móveis e desktop.
- 🔐 **Autenticação Avançada:** Login seguro por e-mail/senha ou Provedor Google via Firebase Authentication.
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
   └── SQLite Driver       ──→ Instância por Usuário
```

---

## 🗂️ Estrutura do projeto

```
biblioteca-digital/
├── package.json
│
├── public/                         # Frontend Estático
│   ├── index.html                  # App principal (Dashboard & Acervo)
│   ├── login.html                  # Tela de login
│   ├── register.html               # Tela de cadastro
│   ├── reset.html                  # Recuperação de senha
│   ├── account.html                # Página de conta e configurações
│   ├── assets/
│   │   ├── css/
│   │   │   ├── style.css           # Estilos da aplicação
│   │   │   ├── login.css           # Estilos das telas de autenticação
│   │   │   └── account.css        # Estilos da página de conta
│   │   └── js/
│   │       ├── script.js           # Lógica principal do app
│   │       ├── app-init.js         # Inicialização Firebase + proteção de rota
│   │       ├── account.js          # Lógica da página de conta
│   │       ├── firebase-auth.js    # Config e funções base do Firebase
│   │       ├── firebase-app.js     # Firebase para o app principal
│   │       ├── firebase-login.js   # Lógica da tela de login
│   │       ├── firebase-register.js# Lógica da tela de cadastro
│   │       ├── firebase-reset.js   # Lógica de recuperação de senha
│   │       └── firebase-config.js  # ⚠️ Ignorado no Git — credenciais locais
│   └── images/
│
├── server/                         # Backend
│   ├── index.js                    # Servidor Express
│   ├── database.js                 # Banco isolado por usuário (SQLite)
│   ├── auth.js                     # Middleware de validação JWT
│   ├── migrate.js                  # Script de migração do Excel para SQLite
│   ├── firebase-admin-key.json     # ⚠️ Ignorado no Git — chave privada
│   └── routes/
│       ├── books.js                # API REST de livros
│       ├── goals.js                # API REST de metas
│       └── account.js              # API REST de conta e perfil
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

---

## 🌐 API REST

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/books` | Lista livros do usuário | ✅ |
| POST | `/api/books` | Cadastra novo livro | ✅ |
| PUT | `/api/books/:id` | Atualiza livro | ✅ |
| DELETE | `/api/books/:id` | Remove livro | ✅ |
| GET | `/api/goals` | Lista metas | ✅ |
| POST | `/api/goals` | Cria ou atualiza meta | ✅ |
| DELETE | `/api/goals/:year` | Remove meta do ano | ✅ |
| GET | `/api/account` | Dados do usuário | ✅ |
| PUT | `/api/account/name` | Atualiza nome | ✅ |
| PUT | `/api/account/email` | Atualiza email | ✅ |
| PUT | `/api/account/goal` | Define meta do ano atual | ✅ |
| DELETE | `/api/account/books` | Exclui todo o acervo | ✅ |
| DELETE | `/api/account` | Exclui conta | ✅ |

---

## 🔐 Modelo de Segurança

- **Zero Exposição Direta:** O Express escuta em `127.0.0.1:3000`. O tráfego externo passa pelo Nginx e pela VPN Tailscale.
- **Isolamento por Usuário:** O UID extraído do JWT define qual banco SQLite é carregado — nenhum usuário acessa dados de outro.
- **Credenciais fora do Git:** `firebase-config.js` e `firebase-admin-key.json` estão no `.gitignore` e nunca são versionados.
- **Firewall UFW:** Apenas portas 80 e 22 liberadas via range Tailscale (`100.0.0.0/8`).

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