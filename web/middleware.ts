import { NextResponse, type NextRequest } from "next/server";

// Give every browser an anonymous id the first time it visits.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("sidecar_uid")) {
    res.cookies.set("sidecar_uid", crypto.randomUUID(), {
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
