import http from "k6/http";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const parsedTarget = new URL(baseUrl);
if (
  parsedTarget.protocol !== "http:" &&
  parsedTarget.protocol !== "https:"
) fail("BASE_URL precisa ser uma origem HTTP(S) válida.");
if (
  parsedTarget.hostname === "khalifadeveloper.com.br" ||
  parsedTarget.hostname.endsWith(".khalifadeveloper.com.br")
) fail("Teste de carga bloqueado para os domínios de produção.");

const usersFile = __ENV.USERS_FILE || "./users.example.json";
const users = new SharedArray("load-users", () => JSON.parse(open(usersFile)));
const vus = Number(__ENV.VUS || 100);
const duration = __ENV.DURATION || "5m";

if (users.length < vus)
  fail(`Forneça ao menos ${vus} contas exclusivas em USERS_FILE; recebidas: ${users.length}.`);

export const options = {
  scenarios: {
    participant_journey: {
      executor: "constant-vus",
      vus,
      duration,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    checks: ["rate>0.999"],
  },
};

function jsonHeaders(token, extra = {}) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...extra,
    },
  };
}

export default function () {
  const account = users[(__VU - 1) % users.length];
  const login = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify(account),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, { "login 200": (response) => response.status === 200 });
  if (login.status !== 200) return;

  const token = login.json("token");
  const events = http.get(`${baseUrl}/api/events`, jsonHeaders(token));
  check(events, { "eventos 200": (response) => response.status === 200 });

  const eventId = __ENV.EVENT_ID;
  if (eventId) {
    const detail = http.get(
      `${baseUrl}/api/events/by-id/${eventId}`,
      jsonHeaders(token),
    );
    check(detail, { "sessão 200": (response) => response.status === 200 });

    // Simula o ritmo novo do player. O EVENT_ID deve apontar para uma sessão
    // dedicada, aberta e com dados descartáveis no banco de teste.
    const seconds = 15 + (__ITER % 20) * 15;
    const progress = http.post(
      `${baseUrl}/api/events/${eventId}/video-progress`,
      JSON.stringify({
        currentSeconds: seconds,
        durationSeconds: 3600,
        clientEventId: `k6-${__VU}-${__ITER}`,
      }),
      jsonHeaders(token),
    );
    check(progress, {
      "progresso aceito": (response) => [200, 422].includes(response.status),
      "sem 429 legítimo": (response) => response.status !== 429,
    });
  }

  sleep(15);
}
