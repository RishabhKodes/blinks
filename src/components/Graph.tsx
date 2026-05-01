"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import type {
  ForceGraphMethods,
  ForceGraphProps,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import { useApp } from "./AppProvider";

const LEGACY_NODE_X_OFFSET = 130;
const LEGACY_NODE_Y_OFFSET = 22;

const TYPE_ACCENT: Record<string, string> = {
  article: "#6e7f99",
  tweet: "#4e7f95",
  video: "#927070",
  repo: "#5d8769",
  podcast: "#7a6e95",
  other: "#7a7a7a",
};

interface CanvasNode {
  id: string;
  label: string;
  type: string;
  source: string;
  radius: number;
  lines: string[];
  pinned?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface CanvasLink {
  source: string | CanvasNode;
  target: string | CanvasNode;
}

type ForceGraph2DComponent = ComponentType<
  ForceGraphProps & {
    ref?: Ref<ForceGraphMethods | null>;
  }
>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function radiusForLabel(label: string) {
  const base = 24 + Math.sqrt(Math.max(label.trim().length, 1)) * 3.2;
  return clamp(base, 24, 54);
}

function toDisplayLines(text: string, maxChars = 16, maxLines = 2) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return ["Untitled"];

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  let consumed = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const overflowed = candidate.length > maxChars;

    if (!overflowed) {
      current = candidate;
      consumed += word.length + 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (lines.length === maxLines - 1) break;

    if (word.length > maxChars) {
      lines.push(`${word.slice(0, maxChars - 1)}\u2026`);
      consumed += word.length;
      continue;
    }

    current = word;
    consumed += word.length + 1;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length === 0) {
    lines.push(clean.slice(0, maxChars));
  }

  const unresolved = consumed < clean.length;
  if (unresolved) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex];
    if (last) {
      lines[lastIndex] = last.endsWith("\u2026")
        ? last
        : `${last.slice(0, maxChars - 1)}\u2026`;
    }
  }

  return lines.slice(0, maxLines);
}

function applyPinnedPosition(node: CanvasNode) {
  if (node.pinned && node.x != null && node.y != null) {
    node.fx = node.x;
    node.fy = node.y;
    return;
  }
  node.fx = undefined;
  node.fy = undefined;
}

function separateNodeOverlaps(
  nodes: CanvasNode[],
  padding = 12,
  passes = 8
): boolean {
  if (nodes.length < 2) return false;

  let movedAny = false;

  for (let pass = 0; pass < passes; pass++) {
    let movedThisPass = false;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      if (a.x == null || a.y == null) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        if (b.x == null || b.y == null) continue;

        const minDist = a.radius + b.radius + padding;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist < 0.0001) {
          // Deterministic tiny vector when nodes share exact coordinates.
          const angle = (i * 37 + j * 53 + pass * 11) * 0.157;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        if (dist >= minDist) continue;

        const overlap = minDist - dist;
        const ux = dx / dist;
        const uy = dy / dist;

        let aShare = 0.5;
        let bShare = 0.5;
        if (a.pinned && !b.pinned) {
          aShare = 0.1;
          bShare = 0.9;
        } else if (!a.pinned && b.pinned) {
          aShare = 0.9;
          bShare = 0.1;
        }

        a.x -= ux * overlap * aShare;
        a.y -= uy * overlap * aShare;
        b.x += ux * overlap * bShare;
        b.y += uy * overlap * bShare;

        movedThisPass = true;
        movedAny = true;
      }
    }

    if (!movedThisPass) break;
  }

  if (movedAny) {
    for (const node of nodes) {
      applyPinnedPosition(node);
    }
  }

  return movedAny;
}

function GraphCanvas() {
  const { graphData, selectResource, clearSelection, selectedResource, theme } = useApp();
  const graphRef = useRef<ForceGraphMethods | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [ForceGraph2DClient, setForceGraph2DClient] = useState<ForceGraph2DComponent | null>(null);
  const initializedRef = useRef(false);
  const prevNodeCountRef = useRef(0);
  const shouldPersistAutoLayoutRef = useRef(false);
  const graphNodesRef = useRef<CanvasNode[]>([]);

  const selectedNodeId = selectedResource?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    void import("react-force-graph-2d")
      .then((mod) => {
        if (cancelled) return;
        setForceGraph2DClient(() => mod.default as ForceGraph2DComponent);
      })
      .catch(() => {
        // silently fail
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const syncSize = () => {
      setViewport({
        width: Math.max(1, Math.floor(element.clientWidth)),
        height: Math.max(1, Math.floor(element.clientHeight)),
      });
    };

    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const graphCanvasData = useMemo(() => {
    const count = Math.max(1, graphData.nodes.length);

    const nodes: CanvasNode[] = graphData.nodes.map((node, index) => {
      const angle = (index / count) * Math.PI * 2;
      const ring = 170 + Math.floor(index / 12) * 150;
      const seededX = Math.cos(angle) * ring;
      const seededY = Math.sin(angle) * ring;
      const hasSaved = node.x != null && node.y != null;

      const x = hasSaved ? node.x! + LEGACY_NODE_X_OFFSET : seededX;
      const y = hasSaved ? node.y! + LEGACY_NODE_Y_OFFSET : seededY;

      return {
        id: node.id,
        label: node.name,
        type: node.type,
        source: node.source,
        radius: radiusForLabel(node.name),
        lines: toDisplayLines(node.name),
        pinned: hasSaved,
        x,
        y,
      };
    });

    separateNodeOverlaps(nodes, 14, 10);

    for (const node of nodes) {
      applyPinnedPosition(node);
    }

    const links: CanvasLink[] = graphData.links.map((link) => ({
      source: link.source,
      target: link.target,
    }));

    return { nodes, links };
  }, [graphData]);

  const hasUnpositionedNodes = useMemo(
    () => graphData.nodes.some((node) => node.x == null || node.y == null),
    [graphData.nodes]
  );

  useEffect(() => {
    graphNodesRef.current = graphCanvasData.nodes;
  }, [graphCanvasData.nodes]);

  const fitGraphOverview = useCallback((durationMs: number, paddingPx: number) => {
    const graph = graphRef.current;
    if (!graph) return false;

    graph.zoomToFit(durationMs, paddingPx);

    // Slightly zoom out after fitting to keep more context visible on first load.
    const currentZoom = graph.zoom();
    if (Number.isFinite(currentZoom) && currentZoom > 0) {
      const targetZoom = Math.max(0.05, currentZoom * 0.9);
      graph.zoom(targetZoom, Math.max(100, Math.floor(durationMs * 0.6)));
    }

    return true;
  }, []);

  const palette = useMemo(
    () =>
      theme === "dark"
        ? {
            nodeFill: "#23262b",
            nodeStroke: "#8a9099",
            nodeText: "#dfe4ed",
            selectedFill: "#2a3038",
            selectedStroke: "#c9d2de",
            selectedText: "#edf2f8",
            selectedGlow: "rgba(143, 160, 184, 0.3)",
            link: "rgba(145, 151, 162, 0.38)",
            linkSelected: "rgba(226, 231, 241, 0.65)",
          }
        : {
            nodeFill: "#f4f5f6",
            nodeStroke: "#595d63",
            nodeText: "#2a2d31",
            selectedFill: "#e9edf4",
            selectedStroke: "#3a4558",
            selectedText: "#1f2835",
            selectedGlow: "rgba(74, 93, 123, 0.2)",
            link: "rgba(72, 77, 84, 0.35)",
            linkSelected: "rgba(34, 40, 48, 0.62)",
          },
    [theme]
  );

  const saveNodePositions = useCallback(
    async (positions: Array<{ nodeId: string; x: number; y: number }>) => {
      const payload = positions
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => ({
          nodeId: p.nodeId,
          x: Math.round(p.x - LEGACY_NODE_X_OFFSET),
          y: Math.round(p.y - LEGACY_NODE_Y_OFFSET),
        }));

      if (payload.length === 0) return;

      try {
        await fetch("/api/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions: payload }),
        });
      } catch {
        // silently fail
      }
    },
    []
  );

  useEffect(() => {
    shouldPersistAutoLayoutRef.current = hasUnpositionedNodes;
  }, [hasUnpositionedNodes]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const linkForce = graph.d3Force("link") as {
      distance?: (distance: number | ((link: LinkObject) => number)) => unknown;
      strength?: (strength: number) => unknown;
    } | undefined;

    linkForce?.distance?.((link: LinkObject) => {
      const source = (typeof link.source === "object" ? link.source : null) as CanvasNode | null;
      const target = (typeof link.target === "object" ? link.target : null) as CanvasNode | null;
      const a = source?.radius ?? 30;
      const b = target?.radius ?? 30;
      return a + b + 90;
    });
    linkForce?.strength?.(0.15);

    const chargeForce = graph.d3Force("charge") as {
      strength?: (strength: number | ((node: NodeObject) => number)) => unknown;
    } | undefined;

    chargeForce?.strength?.((node: NodeObject) => {
      const radius = ((node as CanvasNode).radius ?? 30) + 1;
      return -Math.max(220, radius * 16);
    });

    graph.d3ReheatSimulation();
  }, [graphCanvasData]);

  useEffect(() => {
    const nodeCount = graphCanvasData.nodes.length;
    const hasViewport = viewport.width > 0 && viewport.height > 0;
    const isReady = Boolean(ForceGraph2DClient && hasViewport && nodeCount > 0);

    if (!isReady) {
      prevNodeCountRef.current = nodeCount;
      return;
    }

    const isFirstOverview = !initializedRef.current;
    const grew = nodeCount > prevNodeCountRef.current;

    prevNodeCountRef.current = nodeCount;

    if (!isFirstOverview && !grew) return;

    const timers = [
      window.setTimeout(() => {
        if (fitGraphOverview(isFirstOverview ? 0 : 260, 150)) {
          initializedRef.current = true;
        }
      }, 80),
      window.setTimeout(() => {
        fitGraphOverview(220, 170);
      }, 420),
      window.setTimeout(() => {
        fitGraphOverview(260, 185);
      }, 900),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    ForceGraph2DClient,
    fitGraphOverview,
    graphCanvasData.nodes.length,
    viewport.height,
    viewport.width,
  ]);

  const onNodeClick = useCallback(
    (node: NodeObject) => {
      const data = node as CanvasNode;
      selectResource(data.id);
      if (data.x != null && data.y != null) {
        graphRef.current?.centerAt(data.x, data.y, 260);
      }
    },
    [selectResource]
  );

  const onNodeDragEnd = useCallback(
    (node: NodeObject) => {
      const data = node as CanvasNode;
      if (data.x == null || data.y == null) return;

      data.pinned = true;
      data.fx = data.x;
      data.fy = data.y;

      const allNodes = graphNodesRef.current;
      const moved = separateNodeOverlaps(allNodes, 14, 6);

      if (moved) {
        const correctedPositions = allNodes
          .filter((n) => n.x != null && n.y != null)
          .map((n) => ({ nodeId: n.id, x: n.x as number, y: n.y as number }));
        void saveNodePositions(correctedPositions);
        return;
      }

      void saveNodePositions([{ nodeId: data.id, x: data.x, y: data.y }]);
    },
    [saveNodePositions]
  );

  const onEngineTick = useCallback(() => {
    const nodes = graphNodesRef.current;
    if (nodes.length < 2) return;
    separateNodeOverlaps(nodes, 10, 1);
  }, []);

  const onEngineStop = useCallback(() => {
    const nodes = graphNodesRef.current;

    if (!shouldPersistAutoLayoutRef.current) return;

    shouldPersistAutoLayoutRef.current = false;

    const currentPositions = nodes
      .filter((node) => node.x != null && node.y != null)
      .map((node) => ({
        nodeId: node.id,
        x: node.x as number,
        y: node.y as number,
      }));

    void saveNodePositions(currentPositions);
  }, [saveNodePositions]);

  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const data = node as CanvasNode;
      const x = data.x ?? 0;
      const y = data.y ?? 0;
      const selected = selectedNodeId === data.id;

      const accent = TYPE_ACCENT[data.type] || TYPE_ACCENT.other;
      const radius = data.radius;
      const strokeWidth = selected ? 2.3 : 1.4;

      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, 0, 2 * Math.PI, false);
        ctx.fillStyle = `${accent}22`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = selected ? palette.selectedFill : palette.nodeFill;
      ctx.shadowColor = selected ? palette.selectedGlow : "transparent";
      ctx.shadowBlur = selected ? 18 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.lineWidth = strokeWidth / globalScale;
      ctx.strokeStyle = selected ? palette.selectedStroke : palette.nodeStroke;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, radius - 1, -Math.PI / 2, Math.PI / 2, false);
      ctx.strokeStyle = accent;
      ctx.lineWidth = (selected ? 2 : 1.2) / globalScale;
      ctx.stroke();

      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, 2 * Math.PI, false);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6 / globalScale;
        ctx.stroke();
      }

      const fontSize = Math.max(9, 12 / globalScale);
      const lineHeight = fontSize * 1.22;
      const lines = data.lines;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = selected ? palette.selectedText : palette.nodeText;
      ctx.font = `${fontSize}px "Comic Sans MS", "Chalkboard SE", "Segoe Print", sans-serif`;

      const startY = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, x, startY + index * lineHeight);
      });
    },
    [palette, selectedNodeId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
      const data = node as CanvasNode;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(data.x ?? 0, data.y ?? 0, data.radius + 6, 0, 2 * Math.PI, false);
      ctx.fill();
    },
    []
  );

  const linkColor = useCallback(
    (link: LinkObject) => {
      if (!selectedNodeId) return palette.link;
      const source = (typeof link.source === "object" ? link.source : null) as CanvasNode | null;
      const target = (typeof link.target === "object" ? link.target : null) as CanvasNode | null;
      const connected = source?.id === selectedNodeId || target?.id === selectedNodeId;
      return connected ? palette.linkSelected : palette.link;
    },
    [palette, selectedNodeId]
  );

  const linkWidth = useCallback(
    (link: LinkObject) => {
      if (!selectedNodeId) return 1;
      const source = (typeof link.source === "object" ? link.source : null) as CanvasNode | null;
      const target = (typeof link.target === "object" ? link.target : null) as CanvasNode | null;
      const connected = source?.id === selectedNodeId || target?.id === selectedNodeId;
      return connected ? 1.8 : 1;
    },
    [selectedNodeId]
  );

  return (
    <div className="h-screen w-full p-3 pt-16 md:p-6 md:pt-20">
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden rounded-2xl border border-edge bg-page"
      >
        {ForceGraph2DClient && viewport.width > 0 && viewport.height > 0 && (
          <ForceGraph2DClient
            ref={graphRef}
            graphData={graphCanvasData}
            width={viewport.width}
            height={viewport.height}
            backgroundColor="transparent"
            nodeLabel={(node: NodeObject) => (node as CanvasNode).label}
            nodeVal={(node: NodeObject) => {
              const radius = (node as CanvasNode).radius;
              return (radius * radius) / 70;
            }}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={linkWidth}
            minZoom={0.05}
            maxZoom={3.5}
            warmupTicks={80}
            cooldownTicks={200}
            d3AlphaDecay={0.085}
            d3VelocityDecay={0.54}
            showPointerCursor={(obj) => Boolean(obj && "id" in obj)}
            onNodeClick={onNodeClick}
            onNodeDragEnd={onNodeDragEnd}
            onBackgroundClick={clearSelection}
            onEngineTick={onEngineTick}
            onEngineStop={onEngineStop}
          />
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-edge-subtle bg-surface/80 px-2.5 py-1.5 text-[11px] text-ink-faint backdrop-blur-sm">
          Drag nodes to pin. Drag canvas to pan. Scroll to zoom.
        </div>
      </div>
    </div>
  );
}

export function Graph() {
  const { graphData } = useApp();

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md -mt-24">
          <div className="relative mx-auto w-40 h-40 mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-ink-faint/40" />
            <div className="absolute inset-5 rounded-full border-2 border-ink-muted/30" />
            <div className="absolute inset-10 rounded-full border border-ink-muted/25" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-ink-muted/50" />
            </div>
          </div>
          <h2 className="text-2xl font-medium text-ink-secondary">
            Your graph is empty
          </h2>
          <p className="mt-3 text-ink-muted text-base leading-relaxed">
            Save a tweet, article, or video to start building your knowledge graph.
          </p>
          <p className="mt-4 text-ink-faint text-sm">
            <kbd className="px-2 py-1 bg-surface border border-edge rounded text-ink-muted text-xs">Ctrl+N</kbd>
            {" "}to add your first resource
          </p>
        </div>
      </div>
    );
  }

  return <GraphCanvas />;
}
