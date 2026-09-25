import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loginPathWithNext, sanitizeNextPath } from "@/lib/redirect";
import type { Database } from "@/lib/types";

import { getSupabaseEnv } from "./env";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresca la sesión de Supabase en cada petición y aplica la protección de
 * rutas:
 *  - sin sesión + ruta privada  -> /login?next=<ruta>
 *  - con sesión + /login        -> `next` saneado o /panel
 *
 * La identidad se valida con `auth.getClaims()` (verifica la firma del JWT y
 * refresca el token si hace falta). Nunca se confía en `getSession()`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getSupabaseEnv();
  if (!env) {
    // Sin configuración: /login mostrará "configuración incompleta" y el
    // layout autenticado redirige a /login. No bloqueamos aquí.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  // Cabeceras anti-caché que @supabase/ssr pide añadir cuando escribe cookies.
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        sessionHeaders = { ...sessionHeaders, ...(headers ?? {}) };
        for (const [key, value] of Object.entries(sessionHeaders)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // IMPORTANTE: no ejecutar código entre createServerClient y getClaims().
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub ?? null;
  } catch {
    userId = null;
  }

  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: string) => {
    const url = new URL(target, request.url);
    const redirect = NextResponse.redirect(url);
    // Conserva cookies/cabeceras de sesión que Supabase haya podido refrescar.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    for (const [key, value] of Object.entries(sessionHeaders)) {
      redirect.headers.set(key, value);
    }
    return redirect;
  };

  if (!userId && !isPublicPath(pathname)) {
    return redirectTo(loginPathWithNext(`${pathname}${search}`));
  }

  if (userId && isPublicPath(pathname)) {
    const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    return redirectTo(next);
  }

  return response;
}
