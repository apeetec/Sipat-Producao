# API REST do Portal SIPAT

Backend Node.js/TypeScript de produção para o frontend React deste repositório. A API usa Express, MySQL/MariaDB, SQL parametrizado e uma separação direta entre rotas, controladores, serviços e repositórios. Essa organização corresponde naturalmente a `routes/controllers/services/models` de um MVC PHP, caso uma migração futura seja necessária.

## Arquitetura

```text
backend/
├── src/
│   ├── config/          # ambiente validado e logs com campos sensíveis ocultos
│   ├── database/        # pool MySQL e transações
│   ├── docs/            # documento OpenAPI usado pelo Swagger UI
│   ├── middlewares/     # JWT/RBAC, rate limit, honeypot e erros seguros
│   ├── modules/
│   │   ├── auth/        # login, refresh rotativo, primeiro acesso e regulamento
│   │   ├── admin/       # usuários, unidades, eventos, perguntas e campanha
│   │   ├── audit/       # trilha imutável de ações e acessos
│   │   ├── draws/       # elegibilidade, sorteio transacional e anulação
│   │   ├── events/      # presença, vídeo, questionário e resultados
│   │   └── public/      # configurações e regulamento sem autenticação
│   ├── shared/          # erros, schemas e utilitários de segurança
│   ├── app.ts           # composição HTTP sem abrir porta (testável)
│   └── server.ts        # inicialização e desligamento gracioso
├── deploy/              # exemplo de proxy Nginx
└── ecosystem.config.cjs # processo PM2
```

O frontend seleciona automaticamente `Http*Repository` quando `VITE_API_URL` está preenchida. Sem essa variável, mantém o adaptador local apenas para demonstração.

## Segurança implementada

- senha com bcrypt (custo configurável entre 10 e 15);
- access token JWT curto e refresh token aleatório, armazenado apenas por hash, rotacionado e revogável;
- cookie de refresh `HttpOnly`, `Secure` em produção e `SameSite=Lax`;
- autorização administrativa no servidor em todas as rotas `/admin`;
- validação Zod com objetos estritos e limites de tamanho;
- SQL parametrizado e nomes de colunas vindos somente de allowlists internas;
- sanitização allowlist do HTML do regulamento;
- Helmet, CORS por origens exatas, limite de corpo e remoção de `X-Powered-By`;
- limites global, de autenticação e de operações sensíveis;
- honeypots para caminhos comuns de scanners, bloqueando o IP por tempo configurável;
- mensagens de erro uniformes sem stack trace em produção e logs com token/cookie/senha ocultos;
- submissão, progresso e sorteio com regras server-side; gabarito e hash de presença não são enviados antes da hora;
- sorteio com trava de concorrência, `crypto.randomInt`, snapshot de elegíveis e anulação auditada.

Para múltiplas instâncias da API, substitua o armazenamento em memória do rate limit/honeypot por Redis. O arquivo PM2 usa uma instância, adequado ao primeiro deploy.

## Instalação local

Para XAMPP no Windows, a forma recomendada está em `../docs/LOCAL_TESTING_AND_DEPLOY.md`: na raiz execute `npm run setup:local` e depois `npm run dev:full`.

Requisitos: Node.js 20.19+, MySQL 8 ou MariaDB 10.5+.

```bash
cd backend
copy .env.example .env
npm ci
```

1. Crie o banco local com `database/create-database.sql` a partir da raiz do repositório.
2. Selecione o banco e importe `database/schema.sql`.
3. Ajuste as credenciais em `backend/.env`.
4. Defina uma senha forte em `BOOTSTRAP_ADMIN_PASSWORD` e execute uma única vez:

```bash
npm run db:bootstrap
npm run dev
```

O bootstrap é idempotente: cria organização, campanha, configurações e o administrador somente se ainda não existirem. Depois, remova as variáveis `BOOTSTRAP_*` do ambiente e altere a senha no primeiro acesso.

Frontend local:

```dotenv
VITE_API_URL="http://localhost:3001"
```

Execute `npm run dev` na raiz em outro terminal. O Swagger fica em `http://localhost:3001/api/docs` e o JSON em `/api/openapi.json`.

## Contratos principais

- `/api/auth/*`: login, restauração/refresh, logout, primeiro acesso, senha e aceite.
- `/api/events/*`: dias, contexto do participante, presença, progresso e submissão.
- `/api/winners`: galeria pública com matrícula mascarada conforme configuração.
- `/api/admin/users|units|event-dates|events|questions`: gestão administrativa. `event-dates` mantém as categorias de data e cada evento/sessão referencia uma delas por `eventDateId`.
- `GET /api/admin/units` inclui `userCount`, calculado no banco para usuários ativos e inativos ainda vinculados.
- `POST /api/admin/events/bulk-delete` exclui logicamente de 1 a 500 sessões da campanha autenticada e registra auditoria.
- `/api/admin/participations`: resultados e respostas para relatórios.
- `/api/admin/draws/*`: prévia, execução, histórico e anulação.
- `/api/admin/settings|regulations|audit`: campanha, conteúdo e compliance.
- `/api/admin/uploads`: upload persistente de imagens e vídeos com verificação binária.
- `/api/admin/reports/email`: relatório XLSX/CSV por outbox local ou SMTP em produção.

Os mesmos contratos também são montados em `/api/v1`. `/api` é mantido para compatibilidade direta com o frontend atual.

## Teste e build

```bash
npm run verify
```

O comando valida tipos, executa os testes e gera `dist/`. Para iniciar o artefato: `npm start`.

### Teste integrado com MySQL/MariaDB real

Crie uma base exclusiva para testes, importe `../database/schema.sql`, configure as variaveis `DATABASE_*` e execute o bootstrap. Depois habilite explicitamente o teste integrado:

```powershell
$env:RUN_DB_INTEGRATION='true'
npm run test:integration
```

O cenario valida health/readiness, login e rotacao do refresh token, CRUD administrativo, sanitizacao do regulamento, primeiro acesso, aceite, presenca, questionario, elegibilidade, sorteio publico mascarado, auditoria e persistencia final no banco. Sem `RUN_DB_INTEGRATION=true`, o teste permanece ignorado para nao acessar bancos por acidente.

## Publicação na Hostinger VPS

Hospedagem compartilhada serve o React, mas a API Node precisa de VPS ou de um plano que ofereça processo Node persistente e proxy reverso.

1. Crie banco e usuário no hPanel. Importe `database/schema.sql` no phpMyAdmin.
2. No servidor, mantenha o projeto fora do diretório público, por exemplo `/var/www/sipat/app`.
3. Em `backend`, crie `.env` a partir do exemplo. Use segredos aleatórios diferentes, banco com privilégio apenas de DML, `CORS_ORIGINS=https://khalifadeveloper.com.br` e `PUBLIC_BASE_URL=https://backendportfolio.khalifadeveloper.com.br`. Esta última variável garante URLs HTTPS corretas para imagens e vídeos quando a aplicação está atrás do proxy da Hostinger.
4. Execute `npm ci`, `npm run verify` e `npm run db:bootstrap` apenas no primeiro deploy.
5. Instale PM2 e inicie a API:

```bash
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

6. Gere o frontend com `VITE_API_URL=https://khalifadeveloper.com.br` e publique o conteúdo de `dist/` em `/var/www/sipat/frontend`.
7. Adapte `deploy/nginx-sipat.conf`, habilite o site e valide a configuração antes de recarregar o Nginx.
8. Ative TLS, teste `/api/health/ready`, `/api/docs`, login, envio de questionário e sorteio.
9. Configure rotação dos logs, backup diário do banco e teste de restauração. Nunca publique `.env`, logs ou o diretório `backend/` dentro de `public_html`.

Em atualizações: faça backup, envie o novo código, rode `npm ci && npm run verify`, publique o novo `dist/` do React e execute `pm2 reload sipat-api`. Alterações futuras de schema devem ser entregues como migrações incrementais, nunca editando dados manualmente em produção.

### Migração de Datas da Programação (versão 2026-11-02)

Antes de iniciar esta versão do backend em um banco que já possui eventos, importe pelo phpMyAdmin:

```text
database/migrations/20261102_event_dates.sql
```

A migração cria `event_dates`, gera uma categoria para cada data já existente, associa todos os registros de `event_days` e então ativa a chave estrangeira. Ela não altera vídeos, perguntas, participações ou sorteios. Faça backup do banco antes da importação. Em instalações novas, basta importar `database/schema.sql`, que já contém o modelo atualizado.

Ordem segura de atualização: backup do banco → importar a migração → publicar/reiniciar o backend → publicar o frontend → testar `/api/health/ready`, `/api/admin/event-dates` e a criação de uma sessão.
