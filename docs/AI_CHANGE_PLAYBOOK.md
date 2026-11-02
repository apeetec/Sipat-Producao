# Playbook de alterações para humanos e IAs

Este documento transforma a arquitetura em procedimentos de trabalho. Use junto com `AGENTS.md`.

## 1. Mapa de impacto por funcionalidade

| Funcionalidade | Frontend principal | Backend principal | Banco |
|---|---|---|---|
| Login/sessão | `features/auth`, `node-backend-client.ts` | `modules/auth`, middleware auth | users, refresh tokens, access logs |
| Primeiro acesso | `FirstAccessPage`, guards | auth service/controller | users |
| Regulamento | `features/regulations` | auth + admin/public | regulations, acceptances |
| Datas agrupadoras | `admin/event-date-management` | admin schemas/controller/repository | event_dates |
| Sessões | `admin/event-management`, `features/events` | admin + events | event_days e auxiliares |
| Vídeo/presença | `VideoPlayer`, `Attendance*` | events service | participations, progress, attempts |
| Perguntas | `admin/question-management`, quizzes | admin + events submit | questions, options, answers |
| Unidades | `admin/unit-management` | admin repository | units, users |
| Usuários | `admin/user-management`, import/bulk | admin + auth | users, participations |
| Resultados | `admin/results`, exports | events participations | participations/answers |
| Sorteios | `admin/draws`, winners | draws service | draws e snapshots |
| Tema/configuração | settings/customization, theme | admin/public | campaign_settings/links |
| Upload | componentes de mídia | uploads routes | filesystem + URLs nas tabelas |
| Relatório | results/email modal | reports routes | outbox/SMTP + audit |
| Auditoria | admin/audit | audit repository/admin | audit_logs/access_logs |

### 1.1 Mapa dos arquivos transversais

| Arquivo | Responsabilidade | Alterar quando |
|---|---|---|
| `src/app/router/index.tsx` | Rotas e lazy imports | criar/remover página ou guard |
| `src/app/providers/AppProviders.tsx` | Ordem dos providers e tema | adicionar contexto global |
| `src/features/auth/AuthContext.tsx` | Sessão, refresh e usuário atual | mudar autenticação cliente |
| `src/features/auth/guards.tsx` | Redirecionamentos por estado/role | mudar fluxo de acesso |
| `src/types/index.ts` | Tipos de domínio da UI | qualquer alteração de contrato |
| `src/services/repositories/interfaces.ts` | Portas de persistência | adicionar operação de domínio |
| `src/services/repositories/index.ts` | Seleção HTTP versus demo | mudar bootstrap de dados |
| `src/services/repositories/http-adapter.ts` | Mapeamento REST | mudar payload/response |
| `src/services/repositories/local-adapter.ts` | Persistência demo | manter paridade demonstrativa |
| `src/services/api/node-backend-client.ts` | Transporte HTTP, auth e erros | mudar headers/retry/base URL |
| `src/services/api/backend-service.ts` | Fachada de casos de uso | mudar fluxo compartilhado |
| `src/utils/formatters.ts` | Datas e apresentação | mudar timezone/formato |
| `src/utils/theme.ts` | Aplicação de tema dinâmico | adicionar token visual |
| `src/index.css` | Tailwind, tokens e CSS global | estilo global/design system |
| `backend/src/app.ts` | Pipeline Express e montagem | nova família de rotas/middleware |
| `backend/src/config/env.ts` | Parse/validação de ambiente | nova variável |
| `backend/src/database/pool.ts` | Pool, queries e transações | infraestrutura SQL |
| `backend/src/middlewares/auth.ts` | JWT e RBAC | política de autorização |
| `backend/src/middlewares/security.ts` | CORS, limiters, erros, honeypot | hardening HTTP |
| `backend/src/docs/openapi.ts` | Contrato Swagger | qualquer endpoint/schema HTTP |
| `database/schema.sql` | Instalação nova | qualquer alteração persistente |
| `database/migrations/` | Upgrade de instalação existente | qualquer alteração persistente |
| `public/.htaccess` | SPA, MIME, cache e headers Apache | comportamento de hospedagem estática |
| `.github/workflows/deploy-frontend-hostinger.yml` | CI/build do frontend | pipeline/branch/output |

### 1.2 Mapa dos módulos do backend

| Módulo | Arquivos/papel |
|---|---|
| `auth` | schemas de credenciais, controller de cookies, service de tokens/senhas e repository de usuário/sessão |
| `admin` | CRUDs administrativos, Zod e SQL de usuários, unidades, datas, eventos, perguntas e settings |
| `events` | visão do participante, presença, progresso, quiz e resultados administrativos |
| `draws` | elegibilidade, lock, execução, snapshots, listagem e anulação |
| `uploads` | multipart, detecção binária, nome seguro e entrega pública |
| `reports` | validação CSV/XLSX, outbox/SMTP e auditoria |
| `public` | settings e regulamento sem autenticação |
| `audit` | gravação central de audit log |

## 2. Receita para adicionar um campo persistente

1. Defina semântica, nulabilidade, default e comportamento em registros antigos.
2. Atualize `database/schema.sql` para instalação nova.
3. Crie nova migration idempotente em `database/migrations/` para instalações existentes.
4. Atualize SQL/mapeamento do repository backend.
5. Atualize schema Zod de entrada.
6. Atualize resposta e OpenAPI.
7. Atualize tipos em `src/types` e interface de repositório.
8. Atualize `http-adapter.ts` e/ou `node-backend-client.ts`.
9. Atualize o modo local se o fluxo precisa continuar demonstrável.
10. Atualize UI, defaults e validação.
11. Adicione teste de registro antigo + novo.
12. Planeje rollout: banco → backend → frontend.

Não torne uma coluna `NOT NULL` antes de preencher os registros antigos.

## 3. Receita para adicionar endpoint

1. Escolha módulo e URL REST consistente.
2. Defina Zod `.strict()` para body/query/params.
3. Aplique auth/admin e limiter apropriados na rota.
4. Controller deve apenas traduzir HTTP.
5. Service/repository implementa regra e transação.
6. Use SQL parametrizado e filtre organização/campanha.
7. Padronize erro com status e code.
8. Adicione rota completa em `openapi.ts`.
9. Adicione método ao contrato frontend e adaptadores.
10. Teste sucesso, validação, auth, autorização, conflito e isolamento de escopo.

## 4. Receita para nova página administrativa

1. Criar feature em `src/features/admin/<domínio>`.
2. Registrar lazy import e rota sob `AdminRoute`.
3. Adicionar item ao sidebar, se aplicável.
4. Usar componentes em `src/components/ui`, priorizando shadcn/Radix existente.
5. Implementar estados loading, vazio, erro e sucesso.
6. Confirmar teclado, labels, foco e contraste.
7. Garantir layout de 320 px até desktop; tabela deve rolar ou mudar de apresentação.
8. Não chamar `fetch` ad hoc se já existe repository/client.
9. Não confiar no guard para autorização.

## 5. Receita para alterar data/hora

- Categoria: trafegar `YYYY-MM-DD` intacto.
- Sessão: UI no fuso São Paulo → ISO com offset → backend/UTC.
- Exibição: UTC/API → São Paulo.
- Testar horário próximo da meia-noite e horário de abertura/fechamento.
- Não derivar categoria por `toISOString().slice(0,10)` sem considerar fuso.

## 6. Receita para uploads

1. Validar necessidade e limite.
2. Atualizar allowlist declarada e assinatura binária juntas.
3. Nunca usar nome original como path final.
4. Retornar URL canônica HTTPS via `PUBLIC_BASE_URL`.
5. Persistir apenas path/URL necessários.
6. Testar arquivo válido, extensão falsa, MIME falso, excesso de tamanho e nome inválido.
7. Confirmar volume persistente no deploy.

## 7. Receita para regras de participação

Qualquer alteração deve preservar:

- unicidade user/sessão;
- janela de disponibilidade;
- uma submissão;
- gravação de answers na mesma transação do status;
- gabarito oculto antes da submissão;
- reset administrativo explícito e auditável;
- elegibilidade do sorteio derivada do estado persistido.

Teste no mínimo: presencial, remoto, abaixo/acima do threshold, payload incompleto, opção de outra pergunta, duplo clique e reset/reenvio.

## 8. Receita para sorteios

Não mova a decisão para o browser. Preserve:

- `GET_LOCK` por campanha;
- transação;
- `crypto.randomInt`/Fisher-Yates;
- snapshot de elegíveis;
- snapshot dos vencedores;
- restrições de unidade e vencedores anteriores;
- anulação em vez de delete.

Ao mudar critério, documentar matematicamente a elegibilidade e criar teste para limites vazios/parciais.

## 9. Compatibilidade entre releases

Frontend e backend podem ficar temporariamente em versões diferentes. Prefira:

- campos novos opcionais antes de obrigatórios;
- endpoints novos sem remover os antigos imediatamente;
- fallback somente para erros de capacidade conhecida, não para qualquer erro;
- migrations aditivas;
- remoção em release posterior após telemetria.

O fallback atual de bulk delete de eventos só aceita 404/405 como sinal de backend antigo; 401, 409, 422 e 500 devem permanecer visíveis.

## 10. Matriz de validação por tipo de mudança

| Mudança | Typecheck/build | Unitário | Integração MySQL | Manual local | Produção smoke |
|---|---:|---:|---:|---:|---:|
| Texto/estilo isolado | obrigatório | conforme risco | não | responsivo | página |
| Componente/formulário | obrigatório | obrigatório | se contrato | fluxo | fluxo |
| Endpoint | backend + frontend | obrigatório | recomendado/obrigatório se SQL | Swagger + cliente | health + rota |
| Schema/migration | ambos | obrigatório | obrigatório | fluxo completo | integridade |
| Auth/security | ambos | obrigatório | obrigatório | cookies/CORS | login/refresh/logout |
| Upload | ambos | obrigatório | conforme metadados | arquivo real | HTTPS/persistência |
| Deploy/config | builds | workflow | não | preview | domínio/rota profunda |

## 11. Testes canônicos

```bash
# Todo o repositório
npm run verify:all

# Frontend isolado
npm run typecheck
npm test
npm run build

# Backend isolado
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build

# Banco real descartável
npm --prefix backend run test:integration
```

O teste de integração deve criar banco temporário e removê-lo. Confira variáveis antes de executar; nunca use credenciais com alvo de produção.

## 12. Diagnóstico por sintoma

### `401` em `/auth/refresh`

- pode significar cookie ausente/expirado/revogado;
- verificar marker de sessão no frontend, `credentials: include`, domínio/path/SameSite/Secure;
- uma chamada isolada sem sessão não indica quebra da API;
- não mascarar loop infinito de refresh.

### CORS sem `Access-Control-Allow-Origin`

- verificar `CORS_ORIGINS` exato;
- verificar se o Node iniciou ou se proxy respondeu antes dele;
- verificar OPTIONS e redirects;
- confirmar que erro de boot não está produzindo página Hostinger.

### `422` ao criar pergunta/evento

- comparar payload com Zod/OpenAPI;
- observar `.strict()` e campos desconhecidos;
- pergunta pontuada precisa ser single choice com exatamente uma correta;
- evento precisa de `eventDateId` ativo e janela válida.

### `409` ao criar evento

- verificar slug único por campanha;
- verificar unicidade/estado e mensagem/código da API;
- não converter todo 409 em retry cego.

### Usuários da unidade aparecem como zero

- backend novo retorna `userCount` por subquery;
- frontend tem fallback por lista de usuários para rollout antigo;
- conferir vínculos `users.unit_id` e soft delete;
- confirmar que o backend publicado contém a versão esperada.

### Mixed content em mídia

- `PUBLIC_BASE_URL` deve ser HTTPS;
- dados antigos podem conter URL HTTP e precisam de normalização controlada;
- conferir `canonicalPublicUrl` e proxy headers.

### Alteração não aparece localmente após `npm run build`

- `npm run build` apenas gera `dist`; ele não atualiza o servidor dev já aberto de outro diretório;
- para desenvolvimento use `npm run dev`;
- para testar build use `npm run preview` e a porta exibida;
- confirme cwd e limpe cache.

### Produção não atualizou

- conferir commit em `origin/main`;
- conferir deploy do hPanel e Actions;
- identificar se Hostinger usa `main` ou `hostinger-frontend`;
- verificar hash do asset carregado;
- limpar cache apenas depois de confirmar artefato.

## 13. Revisão de segurança antes de entregar

- [ ] nenhuma credencial em código, docs, log ou commit;
- [ ] endpoint sensível tem auth/RBAC/limiter;
- [ ] entrada Zod strict e limites de tamanho;
- [ ] SQL parametrizado e escopo de organização/campanha;
- [ ] saída não contém hash, token, gabarito ou PII desnecessária;
- [ ] erro de produção não contém stack/SQL;
- [ ] arquivo validado por conteúdo;
- [ ] audit log para ação administrativa relevante;
- [ ] cookie e CORS testados por HTTPS;
- [ ] dependências auditadas;
- [ ] fórmula de CSV/XLSX neutralizada.

## 14. Checklist para uma IA concluir uma tarefa

1. Declare quais fatos foram confirmados no código e quais são inferências externas.
2. Liste arquivos alterados e impacto de cada um.
3. Não sobrescreva mudanças não relacionadas.
4. Execute verificações proporcionais ao risco.
5. Informe testes passados e não executados.
6. Se fez deploy, informe camada, branch/commit e smoke test.
7. Se não fez deploy do backend, diga explicitamente; push no frontend não basta.
8. Atualize este playbook quando surgir um novo padrão recorrente.
