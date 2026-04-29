"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useApp } from "./AppProvider";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphNodeObj = any;

const TYPE_ACCENT: Record<string, string> = {
  article: "#3b82f6",
  tweet: "#0ea5e9",
  video: "#ef4444",
  repo: "#22c55e",
  podcast: "#a855f7",
  other: "#737373",
};

const NODE_H = 36;
const NODE_PAD_X = 14;
const NODE_CORNER = 10;
const ACCENT_W = 4;

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    bg: root.getPropertyValue("--graph-bg").trim(),
    nodeFill: root.getPropertyValue("--bg-surface").trim(),
    nodeFillHover: root.getPropertyValue("--bg-surface-hover").trim(),
    nodeStroke: root.getPropertyValue("--border-color").trim(),
    nodeStrokeHover: root.getPropertyValue("--fg-muted").trim(),
    label: root.getPropertyValue("--fg").trim(),
    labelMuted: root.getPropertyValue("--fg-secondary").trim(),
    link: root.getPropertyValue("--graph-link").trim(),
  };
}

function truncateLabel(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function Graph() {
  const { graphData, selectResource, clearSelection, selectedResource, theme } = useApp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [colors, setColors] = useState(() => ({
    bg: "#1a1b1e",
    nodeFill: "#242529",
    nodeFillHover: "#2e3035",
    nodeStroke: "#363840",
    nodeStrokeHover: "#8b8f98",
    label: "#e4e4e8",
    labelMuted: "#b0b3ba",
    link: "rgba(160, 165, 175, 0.3)",
  }));

  useEffect(() => {
    const t = setTimeout(() => setColors(getThemeColors()), 50);
    return () => clearTimeout(t);
  }, [theme]);

  useEffect(() => {
    function updateSize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const forceData = useMemo(() => {
    return {
      nodes: graphData.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        source: n.source,
        x: n.x,
        y: n.y,
      })),
      links: graphData.links.map((l) => ({
        source: l.source,
        target: l.target,
      })),
    };
  }, [graphData]);

  useEffect(() => {
    if (forceData.nodes.length > 0 && fgRef.current) {
      fgRef.current.d3Force?.("charge")?.strength(-200)?.distanceMax(400);
      fgRef.current.d3Force?.("link")?.distance(120);
      fgRef.current.d3Force?.("center")?.strength(0.05);

      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit?.(400, 80);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [forceData.nodes.length]);

  const handleNodeClick = useCallback(
    (node: GraphNodeObj) => {
      selectResource(node.id);
    },
    [selectResource]
  );

  const handleNodeDragEnd = useCallback(async (node: GraphNodeObj) => {
    if (node.x == null || node.y == null) return;
    try {
      await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: [{ nodeId: node.id, x: node.x, y: node.y }],
        }),
      });
    } catch {
      // silently fail
    }
  }, []);

  const paintNode = useCallback(
    (node: GraphNodeObj, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;
      const isHovered = hoveredNodeId === node.id;
      const isSelected = selectedResource?.id === node.id;
      const active = isHovered || isSelected;

      const fontSize = Math.max(13 / globalScale, 2);
      ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", sans-serif`;
      const label = truncateLabel(node.name, 32);
      const textW = ctx.measureText(label).width;

      const padX = NODE_PAD_X / globalScale;
      const accentW = ACCENT_W / globalScale;
      const h = NODE_H / globalScale;
      const w = textW + padX * 2 + accentW;
      const r = NODE_CORNER / globalScale;

      const x = cx - w / 2;
      const y = cy - h / 2;

      // Shadow
      if (active) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 12 / globalScale;
        ctx.shadowOffsetY = 2 / globalScale;
        roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = active ? colors.nodeFillHover : colors.nodeFill;
        ctx.fill();
        ctx.restore();
      }

      // Card body
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = active ? colors.nodeFillHover : colors.nodeFill;
      ctx.fill();
      ctx.strokeStyle = active ? colors.nodeStrokeHover : colors.nodeStroke;
      ctx.lineWidth = (active ? 1.8 : 1.2) / globalScale;
      ctx.stroke();

      // Type accent bar (left edge)
      const accent = TYPE_ACCENT[node.type] || TYPE_ACCENT.other;
      const barR = r;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + barR, y);
      ctx.lineTo(x + accentW, y);
      ctx.lineTo(x + accentW, y + h);
      ctx.lineTo(x + barR, y + h);
      ctx.arcTo(x, y + h, x, y + h - barR, barR);
      ctx.lineTo(x, y + barR);
      ctx.arcTo(x, y, x + barR, y, barR);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();

      // Label
      ctx.fillStyle = active ? colors.label : colors.labelMuted;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + accentW + padX * 0.6, cy + 0.5 / globalScale);
    },
    [hoveredNodeId, selectedResource, colors]
  );

  const paintNodeArea = useCallback(
    (node: GraphNodeObj, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const cx = node.x ?? 0;
      const cy = node.y ?? 0;

      const fontSize = Math.max(13 / globalScale, 2);
      ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", sans-serif`;
      const label = truncateLabel(node.name, 32);
      const textW = ctx.measureText(label).width;

      const padX = NODE_PAD_X / globalScale;
      const accentW = ACCENT_W / globalScale;
      const h = NODE_H / globalScale;
      const w = textW + padX * 2 + accentW;
      const r = NODE_CORNER / globalScale;

      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const handleNodeHover = useCallback((node: GraphNodeObj | null) => {
    setHoveredNodeId(node?.id ?? null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const linkColor = useCallback(() => colors.link, [colors]);

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

  if (dimensions.width === 0) return null;

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={forceData}
      width={dimensions.width}
      height={dimensions.height}
      backgroundColor={colors.bg}
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => "replace"}
      nodePointerAreaPaint={paintNodeArea}
      linkColor={linkColor}
      linkWidth={1.2}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      onNodeDragEnd={handleNodeDragEnd}
      onBackgroundClick={handleBackgroundClick}
      enableNodeDrag={true}
      enableZoomInteraction={true}
      enablePanInteraction={true}
      cooldownTicks={100}
      d3AlphaDecay={0.03}
      d3VelocityDecay={0.4}
      d3AlphaMin={0.001}
      minZoom={0.3}
      maxZoom={8}
    />
  );
}
