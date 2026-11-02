# Portal SIPAT Honda 2026 — Documentação Técnica & Operacional

> API de produção, Swagger e deploy: `backend/README.md`. Modelo SQL:
> `docs/DATABASE_MODEL.md` e `database/schema.sql`.

> Início rápido com XAMPP, credenciais válidas e publicação: `docs/LOCAL_TESTING_AND_DEPLOY.md`.

Plataforma corporativa full-stack desenvolvida para a **Semana Interna de Prevenção de Acidentes do Trabalho da Honda Automóveis do Brasil**, substituindo a antiga solução monolítica em WordPress por uma arquitetura moderna, segura, auditável e responsiva.

---

## 1. Arquitetura do Sistema & Padrões

O projeto adota o **Padrão de Repositórios** com dois modos explícitos:

1. **Adaptador Local de Alta Fidelidade (Default Out-of-the-Box):**
   - Hashing SHA-256 de presenças via Web Crypto API.
   - Algoritmo de sorteio seguro no servidor (`crypto.getRandomValues`) com snapshot de elegíveis e trava de concorrência.
   - Armazenamento com persistência local reativa e trilha de auditoria completa.
   - Inicialização idempotente dos 5 dias, 33 unidades, perguntas oficiais e contas para homologação imediata.

2. **API Node.js + MySQL/MariaDB (Produção):**
   - A implementação completa está em `backend/` e é selecionada quando `VITE_API_URL` está configurada.
   - Autenticação, RBAC, regras de negócio, CRUDs, sorteios e auditoria são processados no servidor.
   - O schema oficial está em `database/schema.sql`; o Swagger fica em `/api/docs`.
   - Os arquivos Firestore na raiz são artefatos legados e não representam integração ativa.

```text
src/
  app/
    router/            # Rotas autenticadas, públicas e administrativas
    providers/         # AuthProvider e ToastContainer
    guards/            # ProtectedRoute, AdminRoute, FirstAccessRoute
  components/
    ui/                # Button, TextField, PasswordField, Card, Modal, Drawer, Tabs, etc.
    layout/            # AppShell, AuthenticatedHeader, CampaignBanner, AdminShell, AdminSidebar
    feedback/          # ToastContainer, Toast singleton
  features/
    auth/              # Login, Troca Obrigatória de 1º Acesso
    regulations/       # Leitura e Aceite Digital do Regulamento
    home/              # Grade de 5 dias da SIPAT com status em tempo real
    events/            # Sessão do dia, player com anti-cheat, validação presencial
    quizzes/           # Questionários diários, cálculo de 100% e tela de celebração
    winners/           # Galeria pública de contemplados e sorteios oficiais
    admin/             # Painel administrativo completo:
      dashboard/       # KPIs, alertas editoriais e atalhos
      event-date-management/ # Categorias de data da programação
      event-management/      # Sessões vinculadas a uma categoria de data
      question-management/ # Banco de questões, alternativas e gabarito
      unit-management/ # Unidades fabris com prevenção de duplicidades
      user-management/ # Gestão de colaboradores e redefinição de senhas
      user-import/     # Importador em massa com colagem TSV do Excel
      bulk-delete/     # Desativação em massa com proteção de administradores
      results/         # Matriz de respostas com rolagem e exportação Excel/CSV
      draws/           # Sorteador ao vivo com roleta e histórico de anulação
      audit/           # Logs imutáveis de ações e tentativas de login
      settings/        # Parâmetros de campanha, LGPD e regulamento
    tools/
      CsvValidatorPage # Validador CSV standalone
  services/
    repositories/      # Interfaces e adaptador local de homologação
    api/               # Backend Service com contratos estritos
    exports/           # Exportadores CSV (BOM UTF-8, ponto-e-vírgula) e Excel (.xlsx)
  utils/               # Formatadores para America/Sao_Paulo, Parser CSV PapaParse
  seed/                # Carga inicial com as 5 palestras oficiais da Honda
backend/               # API Express/TypeScript em camadas, Swagger, PM2 e deploy
database/              # DDL MySQL/MariaDB normalizado
```

---

## 2. Credenciais de Teste & Homologação

As credenciais da tabela abaixo pertencem somente ao adaptador de demonstração sem API. Para o ambiente integrado Node.js + XAMPP use `admin.local` / `AdminLocal2026` após executar `npm run setup:local`.

| Perfil | Matrícula (Login) | Senha Inicial | Finalidade no Teste |
|---|---|---|---|
| **Administrador Geral** | `admin` | `admin123` | Acesso irrestrito a todas as áreas administrativas, sorteios e relatórios. |
| **Colaborador (1º Acesso)** | `101010` | `01051995` | Demonstração do fluxo obrigatório de criação de nova senha e aceite de regulamento. |
| **Colaborador Apto (100%)** | `202020` | `01051995` | Gabaritou todas as palestras; disponível de imediato no sorteador oficial. |
| **Colaborador Regular** | `303030` | `01051995` | Participação presencial registrada na unidade Sumaré. |

*Dica:* Na tela de login (`/login`), há botões de **Acesso Rápido** que preenchem as credenciais com um clique.

---

## 3. Códigos de Presença para Demonstração Presencial

Durante os testes na tela de cada palestra (`/dias/:slug`), você pode optar por assistir ao vídeo (com liberação aos 99%) ou validar sua presença presencial digitando o código do dia:

- Segunda-feira: `SIPAT01`
- Terça-feira: `SIPAT02`
- Quarta-feira: `SIPAT03`
- Quinta-feira: `SIPAT04`
- Sexta-feira: `SIPAT05`

---

## 4. Scripts e Execução

### Rodar o ambiente de desenvolvimento:
```bash
npm run setup:local
npm run dev:full
```

### Executar a suíte de testes unitários:
```bash
npm run test
```

### Validar tipagem TypeScript e Lint:
```bash
npm run lint
```

### Build de produção:
```bash
npm run build
```

---

## 5. Diferenças Intencionais em Relação ao Legado WordPress

1. **Gabarito Isolado no Backend:** No WordPress legado, o gabarito ficava em meta fields que podiam ser inspecionados nas chamadas de API. No novo sistema, o cliente jamais recebe os campos `isCorrect` antes do envio.
2. **Submissão Única & Imutabilidade:** As respostas não podem ser reenviadas ou alteradas para inflar notas. O ID determinístico `${userId}_${eventDayId}` garante unicidade.
3. **Anti-Cheat no Player de Vídeo:** O cliente não pode forçar 99% sem validação; o progresso é sincronizado de forma controlada.
4. **Sorteador Criptograficamente Seguro:** O sorteio ocorre no servidor com `crypto.getRandomValues` e snapshot dos elegíveis. A animação visual da roleta é apenas uma representação e não decide o resultado.
5. **Auditoria & Soft Delete:** Nenhum dado de negócio é apagado destrutivamente sem trilha de auditoria; sorteios são anulados (`voided`) com justificativa registrada e usuários são desativados de forma reversível.
6. **Conformidade com a LGPD:** As matrículas dos vencedores são parcialmente mascaradas (`10****10`) na galeria pública e os logs de auditoria nunca registram senhas em texto puro.
