import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { verifyLtiState, verifyMoodleIdToken, LTI_ROLE_INSTRUCTOR } from "@/lib/lti";
import { Role } from "@prisma/client";

const ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";
const DEPLOYMENT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const idToken = form.get("id_token") as string | null;
    const state = form.get("state") as string | null;

    if (!idToken || !state) {
      return htmlError("Falta el token de inicio de sesión enviado por Moodle.");
    }

    // 1. Verificamos que el "state" sea el mismo que generamos nosotros (protección CSRF)
    const { nonce: expectedNonce, targetLinkUri } = await verifyLtiState(state);

    // 2. Verificamos la firma y validez del token que envía Moodle
    const claims = await verifyMoodleIdToken(idToken);

    if (claims.nonce !== expectedNonce) {
      return htmlError("El token de Moodle no coincide con la solicitud original (nonce inválido).");
    }

    const messageType = claims[MESSAGE_TYPE_CLAIM] as string | undefined;
    if (messageType !== "LtiResourceLinkRequest") {
      return htmlError(`Tipo de mensaje LTI no compatible todavía: ${messageType}`);
    }

    const deploymentId = claims[DEPLOYMENT_CLAIM] as string;
    if (!deploymentId || String(deploymentId).trim() !== (process.env.MOODLE_DEPLOYMENT_ID || "").trim()) {
      return htmlError("Este despliegue de Moodle no está autorizado.");
    }

    const ltiSub = claims.sub as string;
    const email = (claims.email as string | undefined)?.toLowerCase().trim();
    const name = (claims.name as string | undefined) || "Usuario Moodle";
    const roles = (claims[ROLES_CLAIM] as string[] | undefined) || [];
    const isInstructor = roles.includes(LTI_ROLE_INSTRUCTOR);

    if (!ltiSub) {
      return htmlError("Moodle no envió un identificador de usuario válido.");
    }

    // 3. Encontramos o creamos al usuario en nuestra base de datos
    let user = await prisma.user.findFirst({
      where: { ltiLink: { ltiSub, deploymentId } }
    });

    // Si el usuario ya estaba vinculado, refrescamos su nombre y correo con lo
    // que Moodle envíe ahora (por si antes no compartía esos datos).
    if (user) {
      const updates: { name?: string; email?: string; avatarInitials?: string } = {};
      if (claims.name && name !== user.name) {
        updates.name = name;
        const [f, ...r] = name.split(" ");
        updates.avatarInitials = ((f?.[0] || "U") + (r[r.length - 1]?.[0] || "D")).toUpperCase();
      }
      if (email && email !== user.email) {
        const taken = await prisma.user.findUnique({ where: { email } });
        if (!taken) updates.email = email;
      }
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    if (!user && email) {
      // Si ya existe una cuenta con ese correo (ej. creada manualmente), la vinculamos.
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await prisma.ltiUserLink.create({
          data: { userId: existing.id, ltiSub, deploymentId }
        });
        user = existing;
      }
    }

    if (!user) {
      const [first, ...rest] = name.split(" ");
      const initials = (first?.[0] || "U") + (rest[rest.length - 1]?.[0] || "D");
      user = await prisma.user.create({
        data: {
          name,
          email: email || `${ltiSub}@moodle.local`,
          passwordHash: "lti-no-password", // esta cuenta solo entra vía LTI, sin contraseña propia
          role: isInstructor ? Role.PROFESSOR : Role.STUDENT,
          avatarInitials: initials.toUpperCase(),
          ltiLink: { create: { ltiSub, deploymentId } }
        }
      });
    }

    // 3b. Sincronizamos sus cursos/notas desde Moodle (si falla, no bloquea el ingreso)
    try {
      const { syncUser } = await import("@/lib/moodle-sync");
      const r = await syncUser(user.id);
      if (r.errors.length) console.warn("Sincronización Moodle (LTI) con avisos:", r.errors);
    } catch (e) {
      console.warn("No se pudo sincronizar con Moodle al entrar por LTI:", e);
    }

    // 4. Creamos la sesión (igual que si hubiera iniciado sesión con usuario/contraseña)
    const secureCookie = (process.env.NEXTAUTH_URL || "").startsWith("https://");
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarInitials: user.avatarInitials
      },
      secret: process.env.NEXTAUTH_SECRET!
    });

    const destination = safeDestination(targetLinkUri);
    const response = NextResponse.redirect(new URL(destination, process.env.NEXTAUTH_URL), 302);
    response.cookies.set(
      secureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      token,
      {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60
      }
    );
    return response;
  } catch (err: any) {
    console.error("Error en el lanzamiento LTI:", err);
    return htmlError("No se pudo validar la sesión enviada por Moodle. Intenta de nuevo desde el curso.");
  }
}

/** Solo permitimos redirigir dentro de nuestra propia plataforma, nunca a otro sitio. */
function safeDestination(targetLinkUri: string): string {
  try {
    const url = new URL(targetLinkUri);
    // Si Moodle apunta a una ruta técnica de LTI (o a la raíz), llevamos al
    // usuario al Dashboard; en cualquier otro caso respetamos la ruta indicada.
    if (url.pathname.startsWith("/api/") || url.pathname === "/" || url.pathname === "") {
      return "/dashboard";
    }
    return url.pathname + url.search;
  } catch {
    return "/dashboard";
  }
}

/**
 * Si alguien abre esta ruta directamente con GET (por ejemplo, recargando la
 * página), lo llevamos al Dashboard en lugar de mostrar un error 405.
 */
export async function GET() {
  return NextResponse.redirect(new URL("/dashboard", process.env.NEXTAUTH_URL), 302);
}

function htmlError(message: string) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
      <h2>No se pudo iniciar sesión desde Moodle</h2>
      <p>${message}</p>
    </body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
