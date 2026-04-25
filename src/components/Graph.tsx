"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useApp } from "./AppProvider";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphNodeObj = any;

const NODE_RADIUS = 28;

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    bg: root.getPropertyValue("--graph-bg").trim(),
    nodeFill: root.getPropertyValue("--graph-node-fill").trim(),
    nodeFillHover: root.getPropertyValue("--graph-node-fill-hover").trim(),
    nodeStroke: root.getPropertyValue("--graph-node-stroke").trim(),
    nodeStrokeHover: root.getPropertyValue("--graph-node-stroke-hover").trim(),
    nodeGlow: root.getPropertyValue("--graph-node-glow").trim(),
    label: root.getPropertyValue("--graph-label").trim(),
    labelHover: root.getPropertyValue("--graph-label-hover").trim(),
    link: root.getPropertyValue("--graph-link").trim(),
  };
}

export function Graph() {
  const { graphData, selectTopic, clearSelection, theme } = useApp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [colors, setColors] = useState(() => ({
    bg: "#0a0a0a",
    nodeFill: "rgba(255, 255, 255, 0.04)",
    nodeFillHover: "rgba(255, 255, 255, 0.1)",
    nodeStroke: "rgba(255, 255, 255, 0.6)",
    nodeStrokeHover: "rgba(255, 255, 255, 0.95)",
    nodeGlow: "rgba(255, 255, 255, 0.06)",
    label: "rgba(255, 255, 255, 0.85)",
    labelHover: "rgba(255, 255, 255, 1)",
    link: "rgba(140, 140, 140, 0.4)",
  }));

  useEffect(() => {
    // Small delay to let CSS variables apply after theme toggle
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
      // Tighten force layout so nodes cluster closer
      fgRef.current.d3Force?.("charge")?.strength(-120)?.distanceMax(300);
      fgRef.current.d3Force?.("link")?.distance(80);
      fgRef.current.d3Force?.("center")?.strength(0.05);

      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit?.(400, 60);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [forceData.nodes.length]);

  // Click: open topic side panel
  const handleNodeClick = useCallback(
    (node: GraphNodeObj) => {
      selectTopic(node.id);
    },
    [selectTopic]
  );

  const handleNodeDragEnd = useCallback(async (node: GraphNodeObj) => {
    if (node.x == null || node.y == null) return;
    try {
      await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: [{ topicId: node.id, x: node.x, y: node.y }],
        }),
      });
    } catch {
      // silently fail
    }
  }, []);

  // Truncate long titles for the bubble label
  function truncateLabel(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "\u2026";
  }

  const paintNode = useCallback(
    (node: GraphNodeObj, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isHovered = hoveredNodeId === node.id;
      const r = NODE_RADIUS / globalScale;

      // Glow on hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = colors.nodeGlow;
        ctx.fill();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? colors.nodeFillHover : colors.nodeFill;
      ctx.fill();
      ctx.strokeStyle = isHovered ? colors.nodeStrokeHover : colors.nodeStroke;
      ctx.lineWidth = (isHovered ? 2.5 : 1.8) / globalScale;
      ctx.stroke();

      // Label below circle
      const fontSize = Math.max(14 / globalScale, 2);
      ctx.font = `500 ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHovered ? colors.labelHover : colors.label;
      ctx.fillText(truncateLabel(node.name, 24), x, y + r + 4 / globalScale);
    },
    [hoveredNodeId, colors]
  );

  const paintNodeArea = useCallback(
    (node: GraphNodeObj, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = NODE_RADIUS / globalScale;
      ctx.beginPath();
      ctx.arc(x, y, r + 2 / globalScale, 0, 2 * Math.PI);
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
          {/* Decorative circles */}
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
      linkWidth={1.5}
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
