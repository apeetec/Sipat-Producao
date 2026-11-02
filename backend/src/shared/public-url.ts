import { env } from "../config/env.js";

/**
 * Reescreve URLs de uploads antigos para a origem HTTPS pública configurada.
 * Isso também corrige registros gravados quando o proxy da hospedagem informou
 * HTTP internamente, embora o navegador estivesse acessando a API por HTTPS.
 */
export function canonicalPublicUrl(value?: string | null): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    const uploadPrefix = `${env.API_PREFIX}/uploads/`;
    if (parsed.pathname.startsWith(uploadPrefix)) {
      if (env.publicBaseUrl)
        return `${env.publicBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      // Produção sempre expõe a API por TLS. Esta salvaguarda também corrige
      // uploads antigos sem depender de uma migração imediata no banco.
      if (env.isProduction && parsed.protocol === "http:") {
        parsed.protocol = "https:";
        return parsed.toString();
      }
    }
  } catch {
    // Valores relativos ou externos continuam inalterados e serão validados
    // nas fronteiras de entrada da API.
  }

  return value;
}
