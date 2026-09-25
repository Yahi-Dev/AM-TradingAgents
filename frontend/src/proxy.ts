import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (antes "middleware" en Next.js < 16): refresca la sesión de Supabase y
 * protege las rutas privadas. Ver src/lib/supabase/proxy.ts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto:
     * - _next/static, _next/image (assets de Next.js)
     * - favicon.ico, icon.svg, robots.txt
     * - archivos estáticos con extensión de imagen/fuente
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
