import { NextRequest, NextResponse } from "next/server";
import { createLtiState, randomNonce } from "@/lib/lti";

/**
 * Moodle llega aquí primero, como parte del inicio de sesión OIDC de LTI 1.3.
 * El estándar permite que esta primera solicitud llegue como GET (parámetros
 * en la URL) o como POST (formulario) — Moodle en particular usa POST.
 * Nuestro trabajo es reenviar al navegador de vuelta a Moodle para que confirme
 * la identidad del usuario, incluyendo un "state" y un "nonce" que verificaremos
 * más adelante en /api/lti/launch.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleLogin(searchParams);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = new URLSearchParams();
  form.forEach((value, key) => params.set(key, String(value)));
  return handleLogin(params);
}

async function handleLogin(searchParams: URLSearchParams) {

  const iss = searchParams.get("iss");
  const loginHint = searchParams.get("login_hint");
  const targetLinkUri = searchParams.get("target_link_uri");
  const ltiMessageHint = searchParams.get("lti_message_hint");
  const clientId = searchParams.get("client_id") || process.env.MOODLE_CLIENT_ID;

  if (!iss || !loginHint || !targetLinkUri) {
    return NextResponse.json(
      { error: "Faltan parámetros obligatorios del inicio de sesión LTI (iss, login_hint, target_link_uri)." },
      { status: 400 }
    );
  }

  if (iss !== process.env.MOODLE_ISSUER) {
    return NextResponse.json(
      { error: `La plataforma "${iss}" no está autorizada para usar esta herramienta.` },
      { status: 403 }
    );
  }

  const authLoginUrl = process.env.MOODLE_AUTH_LOGIN_URL;
  if (!authLoginUrl) {
    return NextResponse.json(
      { error: "Falta configurar MOODLE_AUTH_LOGIN_URL en el servidor." },
      { status: 500 }
    );
  }

  const nonce = randomNonce();
  const state = await createLtiState({ nonce, targetLinkUri });

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/lti/launch`;

  const params = new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: clientId || "",
    redirect_uri: redirectUri,
    login_hint: loginHint,
    state,
    nonce
  });
  if (ltiMessageHint) params.set("lti_message_hint", ltiMessageHint);

  const lti_deployment_id = searchParams.get("lti_deployment_id");
  if (lti_deployment_id) params.set("lti_deployment_id", lti_deployment_id);

  return NextResponse.redirect(`${authLoginUrl}?${params.toString()}`, 302);
}
