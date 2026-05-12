"use client";

import { useState, useEffect, useCallback } from "react";
import { AppProvider, useApp } from "@/components/AppProvider";
import { Graph } from "@/components/Graph";
import { SidePanel } from "@/components/SidePanel";
import { AddResourceModal } from "@/components/AddResourceModal";
import { SearchPalette } from "@/components/SearchPalette";
import { ChatPanel } from "@/components/ChatPanel";
import { ArchivedPanel } from "@/components/ArchivedPanel";
import { ResourceListSlider } from "@/components/ResourceListSlider";
import { ToastContainer } from "@/components/Toast";
import Link from "next/link";

function AppContent() {
  const { graphData, theme, toggleTheme, chatOpen, setChatOpen } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Keyboard shortcuts: Ctrl+N (add), Cmd+K (search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && !e.metaKey && e.key === "n") {
        e.preventDefault();
        setModalOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setChatOpen(!chatOpen);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, setChatOpen]);

  const nodeCount = graphData.nodes.length;

  return (
    <main className="flex-1 relative overflow-hidden">
      <Graph />
      <ResourceListSlider />
      <SidePanel />
      <ChatPanel />
      <AddResourceModal open={modalOpen} onClose={closeModal} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ArchivedPanel open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <ToastContainer />

      {/* Top toolbar */}
      <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="md:hidden px-3 py-2 pointer-events-auto">
          <div className="rounded-xl border border-edge-subtle bg-page/70 backdrop-blur-md p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base font-semibold tracking-tight text-ink-secondary">blinks</h1>
                {nodeCount > 0 && (
                  <span className="text-[11px] text-ink-faint tabular-nums truncate">
                    {nodeCount} item{nodeCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label="Toggle chat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label="Search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-ink-on-accent text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <span className="text-base leading-none">+</span>
                  Add
                </button>
                <button
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label="More actions"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h.01M12 12h.01M19 12h.01" />
                  </svg>
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="mt-2 pt-2 border-t border-edge-subtle flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setArchiveOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label="Archive"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>
                <button
                  onClick={toggleTheme}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                  {theme === "dark" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center"
                  aria-label="Settings"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 pointer-events-auto">
            <h1 className="text-base font-semibold tracking-tight text-ink-secondary">blinks</h1>
            {nodeCount > 0 && (
              <span className="text-xs text-ink-faint tabular-nums">
                {nodeCount} resource{nodeCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="h-9 px-3 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary text-sm flex items-center gap-2 backdrop-blur-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <kbd className="text-xs text-ink-faint">{"\u2318"}J</kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 px-3 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary text-sm flex items-center gap-2 backdrop-blur-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <kbd className="text-xs text-ink-faint">{"\u2318"}K</kbd>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-ink-on-accent text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Add
            </button>
            <button
              onClick={() => setArchiveOpen(true)}
              className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center backdrop-blur-md"
              aria-label="Archive"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </button>
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center backdrop-blur-md"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link
              href="/settings"
              className="h-9 w-9 rounded-lg bg-surface/70 hover:bg-surface-hover border border-edge-subtle hover:border-edge transition-all text-ink-muted hover:text-ink-secondary flex items-center justify-center backdrop-blur-md"
              aria-label="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
