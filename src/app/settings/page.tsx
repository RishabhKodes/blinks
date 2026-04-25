"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  provider: string;
  claudeModel: string;
  openaiModel: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  vaultPath: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-edge border-t-ink-muted rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <Link
            href="/"
            className="text-base text-ink-muted hover:text-ink-secondary transition-colors"
          >
            Back to graph
          </Link>
        </div>

        {/* LLM Provider */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            LLM Provider
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
              <div>
                <p className="text-base font-medium">Current Provider</p>
                <p className="text-sm text-ink-muted mt-0.5">
                  Set via LLM_PROVIDER in .env.local
                </p>
              </div>
              <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                {settings?.provider || "openai"}
              </span>
            </div>

            {settings?.provider === "claude" && (
              <>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">Claude Model</p>
                    <p className="text-sm text-ink-muted mt-0.5">CLAUDE_MODEL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.claudeModel}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">API Key</p>
                    <p className="text-sm text-ink-muted mt-0.5">ANTHROPIC_API_KEY</p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded ${
                      settings.hasAnthropicKey
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {settings.hasAnthropicKey ? "Configured" : "Missing"}
                  </span>
                </div>
              </>
            )}

            {settings?.provider === "openai" && (
              <>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">OpenAI Model</p>
                    <p className="text-sm text-ink-muted mt-0.5">OPENAI_MODEL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.openaiModel}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">API Key</p>
                    <p className="text-sm text-ink-muted mt-0.5">OPENAI_API_KEY</p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded ${
                      settings.hasOpenaiKey
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {settings.hasOpenaiKey ? "Configured" : "Missing"}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Vault Info */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            Vault
          </h2>
          <div className="p-4 bg-surface border border-edge rounded-lg">
            <div>
              <p className="text-base font-medium">Vault Path</p>
              <p className="text-sm text-ink-muted mt-0.5">
                Markdown files are stored here
              </p>
            </div>
            <p className="text-sm font-mono text-ink-muted mt-2 break-all">
              {settings?.vaultPath || "./blinks-vault"}
            </p>
          </div>
        </section>

        {/* Config instructions */}
        <section>
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            Configuration
          </h2>
          <div className="p-4 bg-surface border border-edge rounded-lg text-base text-ink-muted space-y-2">
            <p>
              All settings are configured via environment variables in{" "}
              <code className="text-ink-secondary bg-surface-hover px-1.5 py-0.5 rounded">
                .env.local
              </code>
            </p>
            <p>
              See{" "}
              <code className="text-ink-secondary bg-surface-hover px-1.5 py-0.5 rounded">
                .env.example
              </code>{" "}
              for all available options.
            </p>
            <p>Restart the dev server after changing env variables.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
