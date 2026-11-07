# Documentação canônica do Portal SIPAT

Este diretório reúne documentação técnica, operacional e histórica. Para evitar que uma pessoa ou IA use um documento antigo como fonte de verdade, siga esta ordem:

## Documentos canônicos atuais

| Documento | Finalidade | Quando ler |
|---|---|---|
| [`../AGENTS.md`](../AGENTS.md) | Regras obrigatórias, invariantes e definição de pronto | Antes de qualquer alteração |
| [`AI_PROJECT_GUIDE.md`](AI_PROJECT_GUIDE.md) | Visão completa do produto, arquitetura, domínio, frontend, backend e segurança | Para entender o sistema |
| [`API_DATABASE_REFERENCE.md`](API_DATABASE_REFERENCE.md) | Catálogo de endpoints, autenticação, erros, entidades e tabelas | Ao alterar integrações, API ou persistência |
| [`DEPLOYMENT_GITHUB_HOSTINGER.md`](DEPLOYMENT_GITHUB_HOSTINGER.md) | Fluxo Git/GitHub/Hostinger, branches, release, rollback e diagnóstico | Antes de publicar |
| [`AI_CHANGE_PLAYBOOK.md`](AI_CHANGE_PLAYBOOK.md) | Mapa arquivo→funcionalidade, receitas de mudança e matriz de testes | Durante a implementação |
| [`DATABASE_MODEL.md`](DATABASE_MODEL.md) | Modelo relacional detalhado previamente existente | Para contexto complementar do banco |
| [`LOCAL_TESTING_AND_DEPLOY.md`](LOCAL_TESTING_AND_DEPLOY.md) | Tutorial local com XAMPP e procedimentos de teste | Para preparar o ambiente local |
| [`PERFORMANCE_CAPACITY_RUNBOOK.md`](PERFORMANCE_CAPACITY_RUNBOOK.md) | Rate limits NAT-safe, idempotência, métricas, mídia, teste 100/200/500 e rollback | Antes de dimensionar ou testar carga |

## Fontes executáveis de verdade

Documentação ajuda a navegar, mas estas fontes têm precedência:

1. `database/schema.sql` e `database/migrations/` para persistência;
2. `backend/src/docs/openapi.ts` e a UI `/api/docs` para o contrato HTTP;
3. schemas Zod em `backend/src/modules/**/**.schemas.ts` para validação efetiva;
4. services/repositories do backend para regras transacionais;
5. `src/services/repositories/interfaces.ts` e `src/types/index.ts` para o contrato consumido pela UI;
6. testes para comportamento verificável.

## Documentos históricos ou contextuais

- `AUDITORIA_ARQUITETURA_PRODUCAO.md`: fotografia de uma auditoria anterior. Pode conter itens já corrigidos.
- `BACKEND_NODE_SQL_HOSTINGER.md`: material de planejamento/legado. Não usar seu DDL no lugar de `database/schema.sql`.
- `migration.md`: contexto de migração do protótipo/Firestore. Firestore não é a persistência ativa.
- `security_spec.md`: requisitos e decisões históricas; confirme toda afirmação no backend atual.

## Regra de manutenção

Qualquer alteração que mude comportamento, endpoint, tabela, variável, branch, comando de build ou processo de deploy deve atualizar os documentos canônicos no mesmo commit.
