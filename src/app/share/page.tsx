"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";

function extractUrl(params: URLSearchParams): string | null {
  const urlParam = params.get("url");
  if (urlParam) {
    try {
      new URL(urlParam);
      return urlParam;
    } catch {}
  }

  const text = params.get("text") || "";
  const textMatch = text.match(/https?:\/\/[^\s]+/);
  if (textMatch) {
    try {
      new URL(textMatch[0]);
      return textMatch[0];
    } catch {}
  }

  const title = params.get("title") || "";
  const titleMatch = title.match(/https?:\/\/[^\s]+/);
  if (titleMatch) {
    try {
      new URL(titleMatch[0]);
      return titleMatch[0];
    } catch {}
  }

  return null;
}

type Status = "processing" | "success" | "duplicate" | "error";

function ShareHandler() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("processing");
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");

  const ingest = useCallback(async (url: string, sharedTitle: string | null) => {
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          notes: sharedTitle ? `Shared: ${sharedTitle}` : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTitle(data.resource?.title || "Resource");
        setTopics(data.resource?.topics || []);
        setStatus("success");
      } else if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setTitle(data?.resource?.title || "Resource");
        setStatus("duplicate");
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || `Failed (${res.status})`);
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const url = extractUrl(searchParams);
    if (!url) {
      setStatus("error");
      setErrorMsg("No URL found in shared content.");
      return;
    }
    setSharedUrl(url);
    ingest(url, searchParams.get("title"));
  }, [searchParams, ingest]);

  const retry = () => {
    if (sharedUrl) {
      setStatus("processing");
      setErrorMsg("");
      ingest(sharedUrl, searchParams.get("title"));
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-edge rounded-xl p-8 text-center">
        {status === "processing" && (
          <div className="space-y-4">
            <div className="w-10 h-10 border-2 border-ink-muted border-t-ink rounded-full animate-spin mx-auto" />
            <p className="text-ink-secondary text-sm">Saving to Blinks...</p>
            {sharedUrl && (
              <p className="text-ink-faint text-xs truncate">{sharedUrl}</p>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto text-xl">
              &#10003;
            </div>
            <div>
              <p className="font-medium text-lg">{title}</p>
              {topics.length > 0 && (
                <p className="text-ink-muted text-sm mt-1">
                  {topics.join(", ")}
                </p>
              )}
            </div>
            <Link
              href="/"
              className="inline-block mt-2 px-4 py-2 bg-accent text-ink-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Open Blinks
            </Link>
          </div>
        )}

        {status === "duplicate" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto text-xl">
              !
            </div>
            <div>
              <p className="font-medium">Already saved</p>
              <p className="text-ink-muted text-sm mt-1">{title}</p>
            </div>
            <Link
              href="/"
              className="inline-block mt-2 px-4 py-2 bg-accent text-ink-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Open Blinks
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl">
              &#10005;
            </div>
            <p className="text-ink-secondary text-sm">{errorMsg}</p>
            {sharedUrl && (
              <button
                onClick={retry}
                className="px-4 py-2 bg-accent text-ink-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Try again
              </button>
            )}
            <div>
              <Link href="/" className="text-ink-muted text-xs hover:text-ink transition-colors">
                Back to Blinks
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page text-ink flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-edge rounded-xl p-8 text-center">
            <div className="w-10 h-10 border-2 border-ink-muted border-t-ink rounded-full animate-spin mx-auto" />
          </div>
        </div>
      }
    >
      <ShareHandler />
    </Suspense>
  );
}
