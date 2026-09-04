/**
 * Utilidades para la integración LTI 1.3 — UDELAS AI Learning Platform como
 * "Tool" (herramienta externa) lanzada desde Moodle (el "Platform").
 *
 * Flujo resumido:
 *  1. Moodle redirige al estudiante a /api/lti/login (login iniciado por el "Platform")
 *  2. Nosotros redirigimos de vuelta a Moodle para autenticar (OIDC)
 *  3. Moodle redirige a /api/lti/launch con un id_token firmado por Moodle
 *  4. Verificamos ese token, identificamos/creamos al usuario, e iniciamos su sesión
 */

import { SignJWT, jwtVerify, importPKCS8, exportJWK, createRemoteJWKSet, decodeJwt } from "jose";
import crypto from "crypto";

const STATE_TTL_SECONDS = 5 * 60; // el "state" expira en 5 minutos

function getStateSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Falta NEXTAUTH_SECRET en las variables de entorno.");
  return new TextEncoder().encode(secret);
}

/** Crea un "state" firmado y con expiración, sin necesidad de guardarlo en la base de datos. */
export async function createLtiState(payload: { nonce: string; targetLinkUri: string }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(getStateSecret());
}

/** Verifica el "state" recibido de vuelta y devuelve su contenido original. */
export async function verifyLtiState(state: string): Promise<{ nonce: string; targetLinkUri: string }> {
  const { payload } = await jwtVerify(state, getStateSecret());
  return payload as { nonce: string; targetLinkUri: string };
}

export function randomNonce(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Verifica el id_token que envía Moodle, usando las llaves públicas que Moodle publica. */
export async function verifyMoodleIdToken(idToken: string) {
  const jwksUrl = clean(process.env.MOODLE_JWKS_URL);
  const issuer = clean(process.env.MOODLE_ISSUER);
  // Se permiten varios Client IDs separados por coma (por si la herramienta
  // quedó registrada más de una vez en Moodle).
  const allowedClientIds = clean(process.env.MOODLE_CLIENT_ID)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!jwksUrl) throw new Error("Falta MOODLE_JWKS_URL en las variables de entorno.");
  if (!issuer) throw new Error("Falta MOODLE_ISSUER en las variables de entorno.");
  if (allowedClientIds.length === 0) throw new Error("Falta MOODLE_CLIENT_ID en las variables de entorno.");

  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer,
      audience: allowedClientIds
    });
    return payload;
  } catch (err: any) {
    // Diagnóstico: registramos (solo en el servidor) qué trae realmente el token,
    // para poder comparar contra lo configurado sin tener que adivinar.
    try {
      const raw = decodeJwt(idToken);
      console.error("LTI diagnóstico → token iss:", raw.iss, "| aud:", JSON.stringify(raw.aud), "| azp:", raw.azp);
      console.error("LTI diagnóstico → esperado iss:", issuer, "| aud permitidos:", JSON.stringify(allowedClientIds));
    } catch {
      console.error("LTI diagnóstico → no se pudo decodificar el id_token recibido.");
    }
    throw err;
  }
}

/** Quita espacios, comillas y saltos de línea que suelen colarse al copiar/pegar variables de entorno. */
function clean(value: string | undefined): string {
  return (value || "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Carga nuestra propia llave privada (para firmar cosas hacia Moodle en el futuro, ej. calificaciones). */
export async function getToolPrivateKey() {
  const pem = process.env.LTI_TOOL_PRIVATE_KEY;
  if (!pem) throw new Error("Falta LTI_TOOL_PRIVATE_KEY en las variables de entorno.");
  return await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
}

/** Expone nuestra llave pública en formato JWKS, para que Moodle pueda verificarnos si es necesario. */
export async function getToolPublicJwks() {
  const key = await getToolPrivateKey();
  const jwk = await exportJWK(key);
  return {
    keys: [{ ...jwk, kid: "udelas-lti-1", alg: "RS256", use: "sig" }]
  };
}

export const LTI_ROLE_INSTRUCTOR =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor";
export const LTI_ROLE_LEARNER =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner";
