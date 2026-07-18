import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function computeToken(): Promise<string> {
  const username = process.env.AUTH_USERNAME || "";
  const password = process.env.AUTH_PASSWORD || "";
  const data = new TextEncoder().encode(username + ":" + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export async function middleware(request: NextRequest) {
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const session = request.cookies.get("blinks-session")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const expected = await computeToken();
  if (session !== expected) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("blinks-session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|apple-touch-icon\\.png|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
