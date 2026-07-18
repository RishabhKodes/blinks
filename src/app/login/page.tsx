"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Invalid credentials");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-edge bg-surface p-6"
      >
        <h1 className="text-center text-xl font-semibold text-ink">Blinks</h1>

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}

        <input
          name="username"
          type="text"
          placeholder="Username"
          required
          autoFocus
          className="w-full rounded border border-edge bg-input px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-muted focus:outline-none"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="w-full rounded border border-edge bg-input px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-muted focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-ink-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
