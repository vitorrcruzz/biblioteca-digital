# 🖥️ Biblioteca Digital

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=white" />
  <img src="https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-Em%20desenvolvimento-yellow" />
</p>

> **Sistema Pessoal de Gerenciamento de Acervo Literário** > Migração de controle legada em Excel para ecossistema web full-stack, operando em infraestrutura self-hosted com segurança Zero Trust via Tailscale VPN.

---

## 📋 Sobre o projeto

A **Biblioteca Digital** é uma aplicação projetada para centralizar, catalogar e monitorar hábitos de leitura. O sistema substitui o controle manual de planilhas eletrônicas por uma interface rica, fornecendo relatórios analíticos, controle de metas dinâmicas e isolamento lógico de dados, permitindo que múltiplos usuários gerenciem seus acervos de forma totalmente independente.

O core da aplicação roda sob o princípio de infraestrutura caseira (*self-hosting*), utilizando um terminal Tanca reutilizado como servidor Linux. A arquitetura de rede foi estruturada de forma a não expor nenhuma porta de serviço para a internet pública, restringindo o perímetro de acesso a uma rede privada virtual.

### ✨ Funcionalidades

- 📊 **Dashboard Analytics:** Gráficos e indicadores de performance de leitura (páginas lidas, score médio, dias por obra).
- 🎯 **Gestão de Metas:** Monitoramento de objetivos literários anuais com barras de progresso adaptativas.
- 👥 **Multi-tenant Isolado:** Cada conta criada possui e gerencia uma base de dados SQLite dedicada e isolada.
- ⭐ **Avaliação Granular:** Classificação de títulos por estrelas com suporte a frações (meias estrelas).
- 🔄 **Controle de Releituras:** Marcadores específicos para identificar e contabilizar releituras de obras do acervo.
- 📱 **Interface Responsiva:** Frontend Vanilla ES6 limpo e otimizado para dispositivos móveis e desktop.
- 🔐 **Autenticação Avançada:** Login seguro por e-mail/senha ou Provedor Google via Firebase Authentication.

---

## 🖼️ Screenshots

### Dashboard principal

<img width="900" height="650" alt="Dashboard da Biblioteca" src="./public/images/dashboard.jpeg" />

### Alertas de metas e status
| Componente | Comportamento |
|---|---|
| Progress Bar | Renderização dinâmica da meta com base nas páginas/livros concluídos |
| Tag de Releitura | Marcador visual no card do livro indicando leituras recorrentes |
| Filtro de Acervo | Refinamento instantâneo por ano específico, categoria ou status atual |

---

## 🏗️ Arquitetura

```
Dispositivo do Usuário (Navegador / Mobile)
        │
        ▼  Conexão Criptografada (HTTPS/UDP)
  Tailscale VPN Mesh Overlay
        │
        ▼  Encaminhamento Interno
  Nginx Proxy Reverso (Porta 80)
        │
        ▼  Localhost Loopback
  Node.js + Express API (Porta 3000)
   ├── Firebase Admin SDK ──→ Validação JWT
   └── SQLite Driver       ──→ Instância por Usuário
```

---

## 🗂️ Estrutura do projeto

```
biblioteca-digital/
├── package.json                    # Manifesto e dependências do ecossistema
│
├── public/                         # Camada de apresentação (Frontend Estático)
│   ├── index.html                  # View principal (Dashboard & Core)
│   ├── login.html                  # View de autenticação
│   ├── register.html               # View de cadastro de usuários
│   ├── reset.html                  # View de recuperação de senha
│   ├── assets/
│   │   ├── css/
│   │   │   ├── style.css           # Estilos estruturais da aplicação
│   │   │   └── login.css           # Estilos das interfaces de acesso
│   │   └── js/
│   │       ├── script.js           # Orquestração e lógica de renderização
│   │       ├── app-init.js         # Inicialização do cliente Firebase
│   │       ├── firebase-auth.js    # Abstração de chamadas de autenticação
│   │       ├── firebase-config.js  # ⚠️ Configurações do cliente (Ignorado no Git)
│   │       └── [modulos-firebase].js # Controladores específicos de views
│   └── images/                     # Ativos gráficos e capturas de tela
│
├── server/                         # Camada de aplicação (Backend)
│   ├── index.js                    # Ponto de entrada do servidor Express
│   ├── database.js                 # Camada de abstração e isolamento do SQLite
│   ├── auth.js                     # Middleware interceptor de tokens JWT
│   ├── migrate.js                  # Script utilitário de ETL (Migração do Excel)
│   ├── firebase-admin-key.json     # ⚠️ Chave privada do SDK (Ignorado no Git)
│   └── routes/
│       ├── books.js                # API REST: Endpoints de gerenciamento de obras
│       └── goals.js                # API REST: Endpoints de metas literárias
```

---

## 🔧 Infraestrutura de Hospedagem

| Atributo | Componente | Configuração / Papel |
|---|---|---|
| Hardware | Terminal Tanca | Equipamento reaproveitado para servidor dedicado *on-premises* |
| Sistema Operacional | Ubuntu Server 24.04 LTS | Sistema operacional base do host |
| Proxy Web | Nginx | Terminação de requisições e segurança de borda |
| VPN Overlay | Tailscale | Rede mesh criptografada eliminando port-forwarding no roteador |
| Firewall Host | UFW | Políticas estritas (Bloqueio total, liberado apenas portas de VPN/SSH) |
| Process Manager | PM2 | Monitoramento de runtime, restart automático e persistência pós-reboot |

---

## 🚀 Como executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão 20.x LTS ou superior
- [NPM](https://www.npmjs.com/) integrado ao Node

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/vitorrcruzz/biblioteca-digital.git
cd biblioteca-digital

# 2. Instale as dependências locais
npm install
```

### Configuração de credenciais

Crie o arquivo `public/assets/js/firebase-config.js` com os dados do seu app:
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

Adicione o arquivo contendo a chave privada gerada no Console do Firebase em `server/firebase-admin-key.json`.

```bash
# 3. Inicialize o servidor em ambiente local
npm start

# 4. Acesse a aplicação localmente
http://localhost:3000
```

---

## 🌐 API REST

| Método | Rota | Descrição | Cabeçalho requerido |
|---|---|---|---|
| GET | `/` | Servir frontend estático | Nenhum |
| GET | `/api/books` | Lista obras do usuário autenticado | `Authorization: Bearer <JWT>` |
| POST | `/api/books` | Cadastra um novo título no acervo | `Authorization: Bearer <JWT>` |
| PUT | `/api/books/<id>` | Atualiza metadados ou status do livro | `Authorization: Bearer <JWT>` |
| DELETE | `/api/books/<id>` | Remove permanentemente um livro | `Authorization: Bearer <JWT>` |
| GET | `/api/goals` | Recupera histórico e metas vigentes | `Authorization: Bearer <JWT>` |

---

## 🔐 Modelo de Segurança

- **Zero Exposição Pública:** O serviço Express escuta estritamente no endereço de loopback `127.0.0.1:3000`. O tráfego externo é controlado pelo Nginx e condicionado à validação de chaves criptográficas na interface de rede virtual do Tailscale.
- **Isolamento de Tenant:** O backend extrai o ID único do token verificado via Firebase Admin SDK. O arquivo do banco de dados SQLite correspondente (`server/database/<UID>.db`) é carregado dinamicamente, impedindo vazamento de dados entre usuários.
- **Sanitização de Versionamento:** Credenciais críticas de infraestrutura e tokens privados estão devidamente blindados fora da árvore de commits através do arquivo `.gitignore`.

---

## 📊 Estratégia de Migração de Dados

Para assegurar a manutenção dos registros efetuados na planilha Excel desde o ano de 2022, o script `server/migrate.js` pode ser executado para realizar o pipeline de migração automatizada, convertendo linhas de planilhas formatadas diretamente em instâncias estruturadas na base relacional SQLite.

---

## 🔄 Roadmap de Evolução

- [ ] Script de automação cron para backup periódico e compactação das bases SQLite.
- [ ] Implementação de cluster de alta disponibilidade com failover utilizando um segundo nó de hardware Tanca.

---

## 👨‍💻 Autor

| Nome | GitHub | LinkedIn |
|---|---|---|
| Vitor Cruz | [@vitorrcruzz](https://github.com/vitorrcruzz) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/vitor-cruz-5214b91bb) |

---

<p align="center">
  Desenvolvido com ☕ e focado em engenharia de software self-hosted por Vitor Cruz — 2026
</p>
