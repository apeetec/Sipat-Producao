# Capacidade, desempenho e operação — Portal SIPAT

**Última revisão:** 2026-11-07
**Escopo:** frontend React, API Node/Express, MySQL/MariaDB, mídia e deploy Hostinger/VPS.

## 1. O que está comprovado e o que ainda depende de ensaio

O código foi preparado para o ensaio de 100, 200 e 500 usuários simultâneos, mas capacidade não pode ser certificada apenas por inspeção. Não estão versionados os vCPU, RAM, limite real de conexões MySQL, IOPS, banda, latência entre API e banco nem limites do plano Hostinger. Portanto:

- as correções de concorrência, idempotência, NAT, telemetria e redução de tráfego são entregues pelo código;
- os objetivos provisórios são disponibilidade >= 99,9%, p95 < 2 s, p99 < 5 s, erro < 0,1% e nenhum `429` para tráfego legítimo, excluindo transferência do vídeo;
- a confirmação de 100/200/500 exige teste em staging autorizado com infraestrutura equivalente;
- é proibido executar `backend/load/participant-journey.k6.js` nos domínios de produção; o script também contém bloqueio explícito para esses domínios.

## 2. Mudanças de P0/P1 implementadas

### 2.1 Rate limiting compatível com NAT corporativo

Há duas camadas:

1. teto volumétrico por IP de no mínimo 5.000 requisições por janela global, usado como contenção de abuso amplo;
2. limites por `usuário autenticado + operação + evento`, aplicados depois de validar o JWT:

| Operação | Padrão | Chave |
|---|---:|---|
| presença | 10/min | usuário + evento |
| progresso de vídeo | 12/min | usuário + evento |
| envio do quiz | 5/min | usuário + evento |

O progresso do vídeo não consome o teto global por IP; continua protegido por autenticação, anti-cheat transacional e limite por usuário/evento. A presença conserva também o limite persistente no banco de 5 tentativas/minuto. Login permanece limitado por IP e ignora sucessos para focar força bruta.

Variáveis: `RATE_LIMIT_*`, `AUTHENTICATED_RATE_LIMIT_WINDOW_MS`, `ATTENDANCE_RATE_LIMIT_MAX`, `VIDEO_PROGRESS_RATE_LIMIT_MAX` e `QUIZ_RATE_LIMIT_MAX`.

`TRUST_PROXY=1` é a configuração esperada quando existe exatamente um proxy confiável da Hostinger/Nginx. Não aumentar sem mapear a cadeia: aceitar cabeçalhos de proxies não confiáveis permite falsificar IP. O teste automatizado confirma que dois usuários sob o mesmo `X-Forwarded-For` possuem contadores independentes.

Limitação: os contadores HTTP estão em memória. Manter uma instância Node no estado atual. Antes de múltiplas instâncias/cluster, mover rate limiting e bloqueios de honeypot para Redis ou outro store compartilhado.

### 2.2 Player e progresso

- intervalo normal alterado de 5 s para 15 s;
- apenas uma chamada pode ficar em voo;
- a conclusão não é reenviada depois de confirmada;
- pausa, fim do vídeo e retorno da rede forçam sincronização;
- `429`, falha de rede e `5xx` usam `Retry-After` ou backoff exponencial, no máximo quatro retries;
- cada evento usa `clientEventId`; o índice único do banco evita duplicação;
- o servidor continua monotônico (`GREATEST`) e valida saltos incompatíveis com tempo transcorrido.

Com 500 espectadores, o ritmo teórico cai de aproximadamente 100 requests/s para 33 requests/s, antes de pausas e conclusão. Isso reduz a carga, mas não substitui o ensaio real.

### 2.3 Quiz idempotente e recuperação

O frontend cria uma `Idempotency-Key` por tentativa lógica e a conserva em falhas de rede, `429` e `5xx`. API e gravação da chave usam a mesma transação:

1. chave + usuário + operação são bloqueados no MySQL;
2. um hash canônico impede reutilizar a chave com outro conteúdo;
3. respostas, participação, auditoria e resposta idempotente são confirmadas juntas;
4. primeira confirmação retorna `201`;
5. retry da mesma chave/payload retorna `200` e `Idempotency-Replayed: true`;
6. uma chave com payload diferente retorna `409 IDEMPOTENCY_KEY_REUSED`.

Clientes antigos sem o header continuam recebendo `200`, preservando compatibilidade. A migration `database/migrations/20261107_idempotency_keys.sql` cria a tabela somente em instalações antigas; o `schema.sql` já a possui.

### 2.4 Leituras e banco

A tela da sessão deixou de fazer uma busca por slug seguida por outra busca por ID: a resposta completa de `GET /api/events/:slug` é reutilizada. Configurações e sessão são carregadas em paralelo.

Índices críticos já existentes:

- participação única: `(user_id, event_day_id)`;
- último progresso: `(participation_id, reported_at)`;
- deduplicação de progresso: `(participation_id, client_event_id)`;
- rate de presença: `(user_id, event_day_id, attempted_at)`;
- resposta única: `(participation_id, question_id)`;
- idempotência: `(user_id, operation, idempotency_key)` e expiração.

Antes de criar novos índices, capturar slow query log e executar `EXPLAIN ANALYZE` no staging com volume representativo. Índices extras elevam custo de escrita. Ajustar `DATABASE_CONNECTION_LIMIT` somente depois de conhecer o `max_connections` do servidor e reservar conexões para phpMyAdmin, rotinas e recuperação. Regra inicial para uma instância: 10; testar 10, 15 e 20 observando espera e CPU do banco.

### 2.5 Mídia fora do processo Node

O endpoint atual mantém `Range/206`, cache imutável, `Accept-Ranges` e política cross-origin. `MEDIA_PUBLIC_BASE_URL` permite gerar URLs de uma origem/CDN que publique exatamente `/api/uploads/*`; não basta preencher a variável sem sincronizar ou montar o storage.

Para VPS, `backend/deploy/nginx-sipat-vps.conf` entrega mídia diretamente do volume persistente `/var/www/sipat/shared/storage/uploads`, evitando que o Node transporte vídeo. O caminho deve ser adaptado. Em Hostinger gerenciada, pode-se manter o endpoint atual até configurar object storage/CDN.

Nunca substituir ou apagar `storage/uploads` num deploy. Backup e restauração desse volume fazem parte do plano de continuidade.

## 3. Observabilidade

`GET /api/admin/metrics` exige JWT de administrador e informa, por processo:

- requests totais/ativos;
- total de `429` e `5xx`;
- p50/p95/p99 HTTP em uma janela móvel de 5.000 amostras;
- RSS e heap;
- p95/p99 de atraso do event loop;
- operações DB ativas, erros, espera por conexão e latências p95/p99;
- limite configurado do pool.

As métricas reiniciam junto com o processo e não agregam múltiplas instâncias. Para retenção/alerta, coletar externamente em Prometheus/Grafana, Better Stack, Datadog ou serviço equivalente. A Hostinger/Nginx deve complementar com CPU, RAM, disco, IOPS, banda, conexões e códigos HTTP.

Alertas iniciais sugeridos:

- disponibilidade de `/api/health/ready` < 99,9% em 5 min;
- p95 > 2 s ou p99 > 5 s por 5 min;
- `5xx` > 0,1%;
- `429` em jornada legítima > 0;
- espera DB p95 > 100 ms ou operações ativas sustentadas próximas do pool;
- event loop p99 > 200 ms;
- memória > 80% ou reinício por memória;
- disco/volume de uploads > 80%;
- banda próxima ao teto do plano.

## 4. Ensaio autorizado de 100/200/500

### Pré-condições

- staging isolado, explicitamente autorizado e semelhante à produção;
- clone anonimizado ou dados sintéticos, nunca banco real de produção;
- uma conta exclusiva por VU em arquivo não versionado;
- sessão de teste aberta e descartável;
- backup e janela de execução aprovada;
- monitoração de API, banco, proxy, disco e banda ativa;
- `k6` instalado fora do servidor alvo.

### Execução

```bash
cd backend/load
VUS=100 DURATION=10m BASE_URL=https://staging.exemplo.com USERS_FILE=./users.private.json EVENT_ID=<uuid> k6 run participant-journey.k6.js
VUS=200 DURATION=10m BASE_URL=https://staging.exemplo.com USERS_FILE=./users.private.json EVENT_ID=<uuid> k6 run participant-journey.k6.js
VUS=500 DURATION=15m BASE_URL=https://staging.exemplo.com USERS_FILE=./users.private.json EVENT_ID=<uuid> k6 run participant-journey.k6.js
```

Executar cada patamar separadamente, com estabilização e revisão entre eles. O gerador usa uma única origem de rede, reproduzindo NAT compartilhado. O `422` de anti-cheat é aceito no script porque contas podem retomar progresso de uma execução anterior; para medição limpa, resetar as participações entre rodadas.

### Critérios de aprovação

- nenhum envio confirmado perdido ou duplicado;
- nenhum `429` no fluxo legítimo;
- `http_req_failed < 0,1%`;
- p95 < 2 s e p99 < 5 s para API, excluindo bytes de vídeo;
- health sem indisponibilidade;
- pool sem espera sustentada;
- CPU/RAM/IO/banda abaixo de saturação;
- resultado repetível por pelo menos duas rodadas.

Se falhar, manter o maior patamar aprovado como capacidade operacional e registrar o gargalo antes de alterar pool, índices ou instâncias.

## 5. Release Hostinger e rollback

### Ordem segura

1. backup do banco e do volume de uploads;
2. aplicar `20261107_idempotency_keys.sql` apenas se a tabela não existir;
3. publicar backend, instalar com `npm ci`, executar `npm run build` e reiniciar;
4. validar ready, login, sessão, progresso, quiz repetido com a mesma chave e métricas;
5. integrar/push em `main`; o workflow gera e publica o frontend em `hostinger-frontend`;
6. smoke test HTTPS/CORS em janela anônima;
7. observar métricas e logs por pelo menos 30 minutos.

Frontend novo é compatível com backend anterior: o header já era permitido por CORS e respostas `200` continuam aceitas. A proteção idempotente, métricas e limites por usuário só ficam ativos após publicar/reiniciar o backend.

### Rollback

- frontend: redeploy do artefato/commit anterior em `hostinger-frontend` ou reversão do commit em `main`;
- backend: restaurar a release anterior e reiniciar o processo;
- não remover a tabela `idempotency_keys` no rollback: ela é compatível e pode conter confirmação de envios;
- não restaurar banco por cima de respostas novas sem decisão formal, pois isso causaria perda de participação;
- preservar uploads; nunca incluí-los no ZIP de substituição.

## 6. Próximos passos para escala horizontal

Antes de mais de uma instância Node: Redis para rate limit/honeypot, agregação externa de métricas, storage compartilhado/object storage, sessões totalmente stateless, orçamento de conexões por instância e balanceador com health check. A idempotência e as regras críticas já estão no MySQL e permanecem válidas em múltiplas instâncias.
