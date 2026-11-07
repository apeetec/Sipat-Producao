# Pacote de produção do backend

O `package.json` deste pacote está na raiz, como exigido pela detecção de aplicações Node.js.

## Hostinger Business/Cloud com aplicação Node.js

- Node.js: 22.x
- instalação: `npm ci`
- build: `npm run build`
- inicialização: `npm start`
- saída: `dist`
- arquivo de entrada: `dist/server.js`

Cadastre no hPanel as variáveis descritas em `.env.production.example`. Não renomeie nem envie esse exemplo como `.env` sem substituir todos os placeholders.

## Hostinger VPS

```bash
npm ci
npm run build
mkdir -p logs storage/uploads storage/outbox
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Use `deploy/nginx-sipat-vps.conf` como base do proxy e mantenha `storage` persistente entre atualizações.

## Banco de dados

Crie o banco no hPanel e importe `database/schema.sql` no phpMyAdmin. Depois configure `DATABASE_*`. Para criar o primeiro administrador, preencha temporariamente `BOOTSTRAP_*` e execute `npm run db:bootstrap`; remova essas variáveis após o primeiro uso.

Ao atualizar uma instalação que já possui eventos, faça backup e importe `database/migrations/20261102_event_dates.sql` antes de reiniciar a aplicação. Esse arquivo cria as categorias de data e vincula automaticamente as sessões existentes.

Em instalações cujo schema ainda não contenha `idempotency_keys`, importe também `database/migrations/20261107_idempotency_keys.sql`. Não recrie o banco e não execute a migration contra outro banco: atualize a mesma base configurada em `DATABASE_NAME`.

O procedimento de capacidade, variáveis de rate limit, métricas, mídia e teste k6 está em `docs/PERFORMANCE_CAPACITY_RUNBOOK.md` no repositório principal.

Nunca publique `.env`, dumps com dados reais, logs, uploads, credenciais ou `node_modules`.
