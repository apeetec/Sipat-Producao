# AGENTS.md — Guia operacional obrigatório para agentes de IA

Este arquivo é o ponto de entrada para qualquer IA que altere o Portal SIPAT. Ele se aplica a todo o repositório. Antes de editar código, leia também:

1. `docs/AI_PROJECT_GUIDE.md` — arquitetura, domínio, fluxos e invariantes;
2. `docs/API_DATABASE_REFERENCE.md` — API, autenticação, erros e banco de dados;
3. `docs/DEPLOYMENT_GITHUB_HOSTINGER.md` — branches e deploy real;
4. `docs/AI_CHANGE_PLAYBOOK.md` — mapa de impacto, procedimentos e validação.

Se a documentação divergir do código executável, o código, o schema e os testes são a fonte de verdade. Corrija a documentação na mesma alteração.

## Identidade do projeto

- Produto: Portal SIPAT Honda 2026.
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4 + componentes shadcn/Radix locais.
- Backend: Node.js + Express 5 + TypeScript, em `backend/`.
- Banco: MySQL/MariaDB, DDL oficial em `database/schema.sql`.
- Frontend de produção: `https://khalifadeveloper.com.br`.
- API de produção: `https://backendportfolio.khalifadeveloper.com.br`.
- Repositório: `https://github.com/apeetec/Sipat-Producao`.
- Branch de integração e deploy observada: `main`.
- Fuso de negócio: `America/Sao_Paulo`; persistência temporal no banco em UTC.

## Regras que não podem ser quebradas

- Nunca exponha senha, hash, segredo JWT, credencial de banco, código de presença ou gabarito antes da submissão.
- O access token fica em memória no frontend. O refresh token fica em cookie `HttpOnly`; não migrar tokens para `localStorage`.
- Toda autorização administrativa deve ser imposta no backend com `requireAuth` + `requireAdmin`; o guard React não é uma barreira de segurança.
- Um questionário submetido é imutável até um administrador executar o reset explícito.
- Uma participação é única por usuário e sessão (`user_id`, `event_day_id`).
- Um evento/sessão pertence obrigatoriamente a uma categoria de data (`event_date_id`). Várias sessões podem pertencer à mesma data.
- A categoria de data não pode ser excluída enquanto possuir sessões vinculadas.
- Usuário e unidade usam soft delete. Não permitir excluir o próprio usuário autenticado nem o último administrador ativo.
- Unidade com usuário vinculado não pode ser excluída, mesmo se o usuário estiver inativo, enquanto não estiver soft-deleted.
- O sorteio deve permanecer no servidor, transacional, com `GET_LOCK`, aleatoriedade criptográfica e snapshots de elegíveis/vencedores.
- Uploads devem ser validados pelo conteúdo binário, receber nome UUID e permanecer fora do Git.
- `backend/storage/uploads` e `backend/storage/outbox` são dados persistentes; nunca os apague durante deploy.
- URLs públicas de mídia devem ser HTTPS em produção. `PUBLIC_BASE_URL` precisa apontar para a origem HTTPS da API.
- Valores `VITE_*` são incorporados ao bundle e são públicos. Nunca colocar segredo em variável `VITE_*`.
- O frontend possui modo local demonstrativo quando `VITE_API_URL` está vazio. Produção deve sempre compilar com a URL da API.
- Não reintroduzir a biblioteca `xlsx`; a exportação usa `write-excel-file` e neutraliza fórmulas.

## Arquitetura e limites

```text
Browser React
  -> repositories/interfaces.ts
  -> http-adapter.ts / node-backend-client.ts
  -> HTTPS /api
  -> Express routes -> controllers -> services/repositories
  -> mysql2 pool -> MariaDB/MySQL
```

- `src/features/`: páginas e fluxos de interface por domínio.
- `src/components/ui/`: componentes visuais reutilizáveis; componentes shadcn são código local, não pacote remoto em runtime.
- `src/services/repositories/`: contrato de dados e seleção entre HTTP e demonstração local.
- `src/services/api/`: cliente HTTP e fachada de casos de uso.
- `backend/src/modules/`: módulos de autenticação, eventos, administração, sorteios, uploads, relatórios e auditoria.
- `database/`: schema completo e migrações incrementais.

Não faça acesso direto ao banco pelo frontend. Não coloque regra crítica somente em componentes React. Não confunda `EventDate` (categoria/data agrupadora) com `EventDay` (sessão/evento reproduzível e respondível).

## Procedimento obrigatório de mudança

1. Verifique `git status` e preserve alterações do usuário.
2. Localize o contrato em `src/services/repositories/interfaces.ts`, `src/types/index.ts`, schemas Zod do backend e `backend/src/docs/openapi.ts`.
3. Para mudança persistente, altere nesta ordem conceitual: migration/schema -> backend -> OpenAPI -> adaptador HTTP -> tipos/contratos -> UI -> testes -> documentação.
4. Mantenha compatibilidade de rollout quando frontend e backend puderem ser publicados em momentos diferentes.
5. Execute `npm run verify:all` antes de enviar para `main`.
6. Para mudança de banco, teste também `npm --prefix backend run test:integration` contra banco descartável, quando MariaDB estiver disponível.
7. Após deploy, valide health checks, CORS, login, rota alterada e ausência de mixed content.

## Comandos canônicos

```bash
npm ci
npm --prefix backend ci
npm run setup:local
npm run dev:full
npm run verify:all
npm --prefix backend run test:integration
npm run build
npm --prefix backend run build
```

- Frontend local: `http://localhost:3000`.
- Backend local: `http://127.0.0.1:3001`.
- Swagger local: `http://127.0.0.1:3001/api/docs`.
- Readiness: `/api/health/ready`; liveness: `/api/health/live`.

## Branches e deploy

- `main`: código-fonte integrado e branch que, pelo comportamento observado, aciona o deploy atual da Hostinger.
- `hostinger-frontend`: branch de artefatos `dist` gerada pelo workflow GitHub Actions; não editar manualmente. Durante a auditoria de 2026-11-02 ela esteve temporariamente defasada, mas depois alcançou o build de `main`, confirmando que a automação está operacional.
- `feature/event-date-categories`: branch histórica já integrada; não é branch de produção.

O workflow `.github/workflows/deploy-frontend-hostinger.yml` testa e compila `main`, depois publica `dist` em `hostinger-frontend`. A automação da branch de artefato foi confirmada, mas o repositório não revela se o hPanel serve essa branch ou se recompila `main` diretamente. Antes de mudar o deploy, confirme no hPanel qual branch está conectada. Não trate configuração externa do painel como se estivesse versionada.

O backend não possui deploy automático comprovado no repositório. Seu processo documentado é pacote Node/ZIP ou aplicação Node da Hostinger, seguido de build/restart. Alterar apenas `main` não garante atualização da API.

## Segurança e dados sensíveis

- Nunca commitar `.env`, dumps, logs, uploads, arquivos `.eml`, tokens ou credenciais.
- Use apenas `.env.example` e `backend/.env.example` com placeholders.
- Não reproduza credenciais vistas em conversas, terminal ou painel.
- Não faça testes destrutivos no banco de produção. Integração deve usar banco temporário `sipat_it_*`.
- Antes de migration em produção: backup, ensaio em cópia, importação, health check e plano de rollback.
- Não altere CORS para `*` quando `credentials: true`; liste origens exatas sem barra final.

## Convenções de implementação

- TypeScript estrito e ESM.
- Backend usa imports com extensão `.js`, mesmo nos arquivos `.ts`, por causa de `NodeNext`.
- Payloads externos são validados por Zod com objetos `.strict()`.
- SQL sempre parametrizado com `?`; nunca interpolar dados recebidos.
- Datas de formulário usam `YYYY-MM-DD`; data/hora da UI é convertida entre São Paulo e ISO explicitamente.
- IDs persistentes são UUID em `CHAR(36)`.
- Exclusão de negócio é soft delete com `deleted_at`, salvo tabelas auxiliares explicitamente descartáveis.
- Componentes React e arquivos existentes misturam nomes PascalCase e nomes shadcn minúsculos. Em Windows isso pode mascarar colisões de caixa; respeite o import exato e valide em build Linux.
- Tabelas administrativas devem continuar responsivas, com rolagem horizontal ou apresentação móvel equivalente.

## Definição de pronto

Uma mudança está pronta somente quando:

- contrato frontend/backend continua consistente;
- schema e migration estão alinhados;
- OpenAPI descreve a rota alterada;
- erros esperados possuem status e código estáveis;
- testes relevantes e builds passam;
- nenhum segredo ou artefato gerado entrou no Git;
- documentação canônica foi atualizada;
- o deploy correto foi executado para cada camada afetada;
- smoke test pós-deploy confirmou o comportamento em HTTPS.
