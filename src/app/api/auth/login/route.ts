import { NextResponse } from "next/server";

async function computeToken(): Promise<string> {
  const username = process.env.AUTH_USERNAME || "";
  const password = process.env.AUTH_PASSWORD || "";
  const data = new TextEncoder().encode(username + ":" + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as {
    username: string;
    password: string;
  };

  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await computeToken();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("blinks-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
