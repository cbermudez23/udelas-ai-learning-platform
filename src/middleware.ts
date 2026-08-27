export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cursos/:path*",
    "/calendario/:path*",
    "/calificaciones/:path*",
    "/tutor/:path*",
    "/agentes/:path*",
    "/examenes/:path*",
    "/biblioteca/:path*",
    "/microcredenciales/:path*",
    "/portafolio/:path*",
    "/badges/:path*",
    "/analiticas/:path*"
  ]
};
