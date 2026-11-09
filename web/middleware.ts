import { NextResponse, type NextRequest } from "next/server";

// Give every browser an anonymous id the first time it visits.
export function middleware(req: NextRequest) {
  if (req.cookies.get("sidecar_uid")) return NextResponse.next();

  // First visit: make the id, set it on the response, and also pass it on with the
  // request, so the very first page render already sees it (not just later requests).
  const uid = crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("cookie", [headers.get("cookie"), `sidecar_uid=${uid}`].filter(Boolean).join("; "));
  const res = NextResponse.next({ request: { headers } });
  {
    res.cookies.set("sidecar_uid", uid, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/|healthz|readyz|api/healthz|api/readyz|icon.svg).*)"] };
