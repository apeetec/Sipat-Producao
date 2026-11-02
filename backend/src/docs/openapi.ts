const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {},
      },
      required: ["code", "message"],
    },
    requestId: { type: "string" },
  },
  required: ["error"],
};
const security = [{ bearerAuth: [] }];
const json = {
  content: { "application/json": { schema: { type: "object" } } },
};
const ok = { description: "Operação concluída.", ...json };
const created = { description: "Registro criado.", ...json };
const noContent = { description: "Sem conteúdo." };
const commonErrors = {
  "401": { description: "Não autenticado" },
  "403": { description: "Sem permissão" },
  "422": { description: "Dados inválidos" },
  "429": { description: "Limite de requisições excedido" },
};
const operation = (
  summary: string,
  method: "get" | "post" | "put" | "patch" | "delete",
  options: any = {},
) => ({
  [method]: {
    summary,
    tags: [options.tag ?? "API"],
    security: options.public ? undefined : security,
    requestBody: options.body
      ? {
          required: true,
          content: { "application/json": { schema: options.body } },
        }
      : undefined,
    parameters: options.parameters,
    responses: {
      ...(options.created
        ? { "201": created }
        : options.noContent
          ? { "204": noContent }
          : { "200": ok }),
      ...commonErrors,
    },
  },
});
const body = { type: "object", additionalProperties: true };
const selectedUsersBody = {
  type: "object",
  additionalProperties: false,
  required: ["userIds"],
  properties: {
    userIds: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: { type: "string", format: "uuid" },
    },
  },
};
const id = [
  {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  },
];
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Portal SIPAT REST API",
    version: "1.0.0",
    description:
      "API de produção do Portal SIPAT. Rotas compatíveis em /api e versionadas em /api/v1.",
  },
  servers: [
    { url: "/api", description: "Contrato compatível com o frontend" },
    { url: "/api/v1", description: "Contrato versionado" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: error,
      LoginRequest: {
        type: "object",
        additionalProperties: false,
        required: ["employeeNumber", "password"],
        properties: {
          employeeNumber: { type: "string", example: "admin.local" },
          password: { type: "string", format: "password", example: "SuaSenhaSegura2026" },
        },
      },
      UploadResult: {
        type: "object",
        required: ["url", "mimeType", "size", "originalName"],
        properties: {
          url: { type: "string", format: "uri" },
          mimeType: { type: "string", example: "image/png" },
          size: { type: "integer", example: 2048 },
          originalName: { type: "string", example: "logo.png" },
        },
      },
      EventDateInput: {
        type: "object",
        additionalProperties: false,
        required: ["name", "eventDate", "dateLabel"],
        properties: {
          name: { type: "string", example: "Segunda-feira" },
          eventDate: { type: "string", format: "date", example: "2026-11-09" },
          dateLabel: { type: "string", example: "9 de novembro de 2026" },
          description: { type: "string", example: "Primeiro dia da programação" },
          active: { type: "boolean" },
          sortOrder: { type: "integer", minimum: 0 },
        },
      },
      EventDate: {
        allOf: [
          { $ref: "#/components/schemas/EventDateInput" },
          {
            type: "object",
            required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string", format: "uuid" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
    },
  },
  paths: {
    "/health/live": {
      get: { summary: "Liveness", tags: ["Health"], responses: { "200": ok } },
    },
    "/health/ready": {
      get: {
        summary: "Readiness do banco",
        tags: ["Health"],
        responses: { "200": ok, "503": { description: "Banco indisponível" } },
      },
    },
    "/auth/login": operation("Autenticar por matrícula", "post", {
      tag: "Autenticação",
      public: true,
      body: { $ref: "#/components/schemas/LoginRequest" },
    }),
    "/auth/refresh": operation("Rotacionar sessão", "post", {
      tag: "Autenticação",
      public: true,
    }),
    "/auth/logout": operation("Encerrar sessão", "post", {
      tag: "Autenticação",
      public: true,
      noContent: true,
    }),
    "/auth/me": operation("Usuário autenticado", "get", {
      tag: "Autenticação",
    }),
    "/auth/first-access": operation(
      "Definir senha no primeiro acesso",
      "post",
      { tag: "Autenticação", body },
    ),
    "/auth/change-password": operation("Alterar senha", "post", {
      tag: "Autenticação",
      body,
      noContent: true,
    }),
    "/auth/accept-regulation": operation(
      "Aceitar regulamento vigente",
      "post",
      { tag: "Autenticação", body },
    ),
    "/settings": operation("Configuração pública da campanha", "get", {
      tag: "Público",
      public: true,
    }),
    "/regulations/current": operation("Regulamento vigente", "get", {
      tag: "Público",
      public: true,
    }),
    "/events": operation("Listar eventos ativos", "get", {
      tag: "Participante",
    }),
    "/events/{slug}": operation("Detalhes do evento e participação", "get", {
      tag: "Participante",
      parameters: [
        {
          name: "slug",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
    }),
    "/events/by-id/{id}": operation("Detalhes por ID", "get", {
      tag: "Participante",
      parameters: id,
    }),
    "/events/{id}/attendance": operation(
      "Validar presença presencial",
      "post",
      { tag: "Participante", parameters: id, body },
    ),
    "/events/{id}/video-progress": operation(
      "Registrar progresso de vídeo",
      "post",
      { tag: "Participante", parameters: id, body },
    ),
    "/events/{id}/quiz": operation(
      "Submeter questionário uma única vez",
      "post",
      { tag: "Participante", parameters: id, body },
    ),
    "/events/participations/me": operation(
      "Listar participações do usuário autenticado",
      "get",
      { tag: "Participante" },
    ),
    "/winners": operation("Listar sorteios publicados", "get", {
      tag: "Público",
      public: true,
    }),
    "/uploads/{kind}/{filename}": {
      get: {
        summary: "Obter imagem ou vídeo publicado",
        tags: ["Arquivos"],
        parameters: [
          { name: "kind", in: "path", required: true, schema: { type: "string", enum: ["image", "video"] } },
          { name: "filename", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Conteúdo binário" }, "404": { description: "Não encontrado" } },
      },
    },
    "/admin/uploads": {
      post: {
        summary: "Enviar imagem ou vídeo validado",
        description: "Confere MIME, assinatura binária e tamanho antes de publicar.",
        tags: ["Admin — Arquivos"],
        security,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: {
            type: "object", required: ["kind", "file"],
            properties: {
              kind: { type: "string", enum: ["image", "video"] },
              file: { type: "string", format: "binary" },
            },
          } } },
        },
        responses: { "201": { description: "Arquivo publicado", content: { "application/json": { schema: { $ref: "#/components/schemas/UploadResult" } } } }, ...commonErrors },
      },
    },
    "/admin/reports/email": {
      post: {
        summary: "Enviar relatório por e-mail",
        description: "No ambiente local grava um .eml no outbox; em produção usa SMTP.",
        tags: ["Admin — Resultados"],
        security,
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: {
            type: "object", required: ["recipients", "subject", "message", "attachment"],
            properties: {
              recipients: { type: "string", example: "[\"gestao@example.com\"]" },
              subject: { type: "string", maxLength: 200 },
              message: { type: "string", maxLength: 10000 },
              attachment: { type: "string", format: "binary", description: "XLSX ou CSV, até 20 MB" },
            },
          } } },
        },
        responses: { "202": { description: "Relatório aceito" }, ...commonErrors },
      },
    },
    "/admin/users": {
      ...operation("Listar usuários", "get", { tag: "Admin — Usuários" }),
      ...operation("Criar usuário", "post", {
        tag: "Admin — Usuários",
        body,
        created: true,
      }),
    },
    "/admin/users/{id}": {
      ...operation("Consultar usuário", "get", {
        tag: "Admin — Usuários",
        parameters: id,
      }),
      ...operation("Atualizar usuário", "patch", {
        tag: "Admin — Usuários",
        parameters: id,
        body,
      }),
      ...operation("Desativar usuário", "delete", {
        tag: "Admin — Usuários",
        parameters: id,
        noContent: true,
      }),
    },
    "/admin/users/reset-participations": {
      ...operation("Resetar respostas dos usuários selecionados", "post", {
        tag: "Admin — Usuários",
        body: {
          ...selectedUsersBody,
          properties: {
            ...selectedUsersBody.properties,
            eventDayId: {
              type: "string",
              format: "uuid",
              description: "Opcional; sem este campo, reseta todos os eventos da campanha.",
            },
          },
        },
      }),
    },
    "/admin/users/bulk-delete": {
      ...operation("Excluir logicamente os usuários selecionados", "post", {
        tag: "Admin — Usuários",
        body: selectedUsersBody,
      }),
    },
    "/admin/units": {
      ...operation("Listar unidades", "get", { tag: "Admin — Unidades" }),
      ...operation("Criar unidade", "post", {
        tag: "Admin — Unidades",
        body,
        created: true,
      }),
    },
    "/admin/units/{id}": {
      ...operation("Consultar unidade", "get", {
        tag: "Admin — Unidades",
        parameters: id,
      }),
      ...operation("Atualizar unidade", "patch", {
        tag: "Admin — Unidades",
        parameters: id,
        body,
      }),
      ...operation("Arquivar unidade", "delete", {
        tag: "Admin — Unidades",
        parameters: id,
        noContent: true,
      }),
    },
    "/admin/events": {
      ...operation("Listar eventos", "get", { tag: "Admin — Eventos" }),
      ...operation("Criar evento", "post", {
        tag: "Admin — Eventos",
        body,
        created: true,
      }),
    },
    "/admin/event-dates": {
      ...operation("Listar datas/categorias da programação", "get", {
        tag: "Admin — Datas da Programação",
      }),
      ...operation("Criar data/categoria da programação", "post", {
        tag: "Admin — Datas da Programação",
        body: { $ref: "#/components/schemas/EventDateInput" },
        created: true,
      }),
    },
    "/admin/event-dates/{id}": {
      ...operation("Consultar data/categoria", "get", {
        tag: "Admin — Datas da Programação",
        parameters: id,
      }),
      ...operation("Atualizar data/categoria", "patch", {
        tag: "Admin — Datas da Programação",
        parameters: id,
        body: { $ref: "#/components/schemas/EventDateInput" },
      }),
      ...operation("Excluir data sem sessões", "delete", {
        tag: "Admin — Datas da Programação",
        parameters: id,
        noContent: true,
      }),
    },
    "/admin/events/{id}": {
      ...operation("Consultar evento", "get", {
        tag: "Admin — Eventos",
        parameters: id,
      }),
      ...operation("Atualizar evento", "patch", {
        tag: "Admin — Eventos",
        parameters: id,
        body,
      }),
      ...operation("Arquivar evento", "delete", {
        tag: "Admin — Eventos",
        parameters: id,
        noContent: true,
      }),
    },
    "/admin/questions": {
      ...operation("Listar perguntas", "get", { tag: "Admin — Perguntas" }),
      ...operation("Criar pergunta", "post", {
        tag: "Admin — Perguntas",
        body,
        created: true,
      }),
    },
    "/admin/questions/{id}": {
      ...operation("Consultar pergunta", "get", {
        tag: "Admin — Perguntas",
        parameters: id,
      }),
      ...operation("Atualizar pergunta", "patch", {
        tag: "Admin — Perguntas",
        parameters: id,
        body,
      }),
      ...operation("Arquivar pergunta", "delete", {
        tag: "Admin — Perguntas",
        parameters: id,
        noContent: true,
      }),
    },
    "/admin/settings": {
      ...operation("Consultar configurações", "get", {
        tag: "Admin — Campanha",
      }),
      ...operation("Atualizar configurações", "put", {
        tag: "Admin — Campanha",
        body,
      }),
    },
    "/admin/regulations": {
      ...operation("Consultar regulamento", "get", { tag: "Admin — Campanha" }),
      ...operation("Salvar regulamento sanitizado", "put", {
        tag: "Admin — Campanha",
        body,
      }),
    },
    "/admin/participations": operation("Listar resultados e respostas", "get", {
      tag: "Admin — Resultados",
    }),
    "/admin/draws": operation("Listar sorteios", "get", {
      tag: "Admin — Sorteios",
    }),
    "/admin/draws/preview": operation("Pré-visualizar elegíveis", "post", {
      tag: "Admin — Sorteios",
      body,
    }),
    "/admin/draws/execute": operation("Executar sorteio transacional", "post", {
      tag: "Admin — Sorteios",
      body,
      created: true,
    }),
    "/admin/draws/{id}/void": operation("Anular sorteio", "post", {
      tag: "Admin — Sorteios",
      parameters: id,
      body,
    }),
    "/admin/audit": operation("Consultar auditoria", "get", {
      tag: "Admin — Auditoria",
    }),
    "/admin/audit/access-logs": operation("Consultar acessos", "get", {
      tag: "Admin — Auditoria",
    }),
    "/admin/audit/client-events": operation(
      "Registrar importação ou desativação em lote",
      "post",
      { tag: "Admin — Auditoria", body, created: true },
    ),
  },
};
