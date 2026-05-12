"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";

function formatDate(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ResourceListSlider() {
  const { graphData, selectedResource, selectResource, clearSelection } = useApp();
  const [open, setOpen] = useState(false);

  const resources = useMemo(() => {
    return [...graphData.nodes].sort((a, b) => {
      const aTs = new Date(a.savedAt).getTime();
      const bTs = new Date(b.savedAt).getTime();
      if (Number.isNaN(aTs) && Number.isNaN(bTs)) return a.name.localeCompare(b.name);
      if (Number.isNaN(aTs)) return 1;
      if (Number.isNaN(bTs)) return -1;
      return bTs - aTs;
    });
  }, [graphData.nodes]);

  return (
    <div className="fixed left-3 md:left-9 top-[76px] md:top-[92px] bottom-6 md:bottom-9 z-30 pointer-events-none">
      <div
        className={`absolute left-2 md:left-3 top-0 bottom-0 w-[300px] md:w-[320px] transition-transform duration-250 ease-out ${
          open ? "translate-x-0" : "-translate-x-[120%]"
        }`}
      >
        <div
          className={`h-full rounded-xl border border-edge bg-surface/92 backdrop-blur-md shadow-xl overflow-hidden ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="shrink-0 px-3 py-2.5 border-b border-edge-subtle flex items-center gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-secondary">Resources</p>
                <p className="text-xs text-ink-faint">
                  {resources.length} item{resources.length !== 1 ? "s" : ""}
                </p>
              </div>

              {selectedResource && open && (
                <button
                  onClick={clearSelection}
                  className="ml-auto text-xs px-2.5 py-1 rounded-md border border-edge-subtle bg-surface/70 hover:bg-surface-hover text-ink-muted hover:text-ink-secondary transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {resources.length === 0 && (
                <p className="px-2 py-3 text-sm text-ink-faint">
                  No resources yet.
                </p>
              )}

              {resources.map((resource) => {
                const active = selectedResource?.id === resource.id;
                return (
                  <button
                    key={resource.id}
                    onClick={() => selectResource(resource.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 mb-1.5 border transition-colors ${
                      active
                        ? "bg-surface-hover border-edge text-ink"
                        : "bg-transparent border-transparent hover:bg-surface-hover/70 hover:border-edge-subtle text-ink-secondary"
                    }`}
                    title={resource.name}
                  >
                    <p className="text-sm font-medium truncate">{resource.name}</p>
                    <p className="text-[11px] mt-1 text-ink-faint">
                      {resource.type}
                      {resource.source ? ` • ${resource.source}` : ""}
                      {resource.savedAt ? ` • ${formatDate(resource.savedAt)}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`pointer-events-auto absolute left-2 md:left-3 top-3 h-8 px-3 rounded-md border border-edge-subtle bg-surface/90 hover:bg-surface-hover text-ink-muted hover:text-ink-secondary text-xs font-medium whitespace-nowrap transition-all duration-250 ${
          open ? "translate-x-[308px] md:translate-x-[328px]" : "translate-x-0"
        }`}
        aria-label={open ? "Collapse resources list" : "Expand resources list"}
        title={open ? "Collapse" : "Expand"}
      >
        {open ? "< Resources" : "Resources >"}
      </button>
    </div>
  );
}
