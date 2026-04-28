"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "./AppProvider";
import { FileOutputModal } from "./FileOutputModal";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel() {
  const { chatOpen, setChatOpen, graphData } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [chatOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && chatOpen) {
        setChatOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, setChatOpen]);

  async function handleSubmit() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const err = await response.text();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error: ${err}`,
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
          return updated;
        });
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Connection error: ${error instanceof Error ? error.message : "unknown"}`,
        };
        return updated;
      });
    }

    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (!chatOpen) return null;

  const hasKB = graphData.nodes.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={() => setChatOpen(false)} />

      {/* Panel */}
      <div className="fixed top-0 left-0 h-full w-full max-w-lg z-40 bg-page/95 backdrop-blur-md border-r border-edge shadow-2xl animate-slide-in-left flex flex-col">
        {/* Header */}
        <div className="shrink-0 bg-page/90 backdrop-blur-sm border-b border-edge px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink leading-tight">
              Ask your knowledge base
            </h2>
            <p className="text-sm text-ink-faint mt-1">
              {graphData.nodes.length} topic{graphData.nodes.length !== 1 ? "s" : ""} loaded into context
            </p>
          </div>
          <button
            onClick={() => setChatOpen(false)}
            className="ml-4 text-ink-faint hover:text-ink transition-colors text-xl leading-none shrink-0"
            aria-label="Close chat"
          >
            x
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-ink-faint text-sm">
                {hasKB
                  ? "Ask anything about your saved resources and topics."
                  : "Add some resources first, then come back to ask questions."}
              </p>
              {hasKB && (
                <div className="mt-4 space-y-2">
                  {["What are the main themes in my knowledge base?",
                    "Summarize what I know about the most connected topic.",
                    "What connections exist between my topics?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-edge-subtle hover:border-edge hover:bg-surface-hover text-ink-muted hover:text-ink-secondary transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-ink-on-accent"
                    : "bg-surface border border-edge text-ink-secondary"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                  {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 bg-ink-faint ml-0.5 animate-pulse" />
                  )}
                </div>
                {msg.role === "assistant" && msg.content && !streaming && (
                  <div className="mt-2 pt-2 border-t border-edge-subtle flex gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                      }}
                      className="text-xs text-ink-faint hover:text-ink-muted transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setFileContent(msg.content)}
                      className="text-xs text-ink-faint hover:text-ink-muted transition-colors"
                    >
                      File this
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-edge px-6 py-4">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasKB ? "Ask a question..." : "Add resources first..."}
              disabled={!hasKB || streaming}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-edge bg-input px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-ink-faint transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || streaming || !hasKB}
              className="h-10 px-4 rounded-lg bg-accent hover:bg-accent-hover text-ink-on-accent text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {streaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      <FileOutputModal
        open={fileContent !== null}
        onClose={() => setFileContent(null)}
        content={fileContent || ""}
      />
    </>
  );
}
