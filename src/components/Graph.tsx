"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { useApp } from "./AppProvider";

// -- Constants ----------------------------------------------------------------

const NODE_WIDTH = 260;
const NODE_HEIGHT = 44;

const TYPE_ACCENT: Record<string, string> = {
  article: "#3b82f6",
  tweet: "#0ea5e9",
  video: "#ef4444",
  repo: "#22c55e",
  podcast: "#a855f7",
  other: "#737373",
};

// -- Dagre layout helper ------------------------------------------------------

const MIN_GAP_X = NODE_WIDTH + 40;  // minimum horizontal gap (node width + padding)
const MIN_GAP_Y = NODE_HEIGHT + 40; // minimum vertical gap (node height + padding)

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  savedPositions: Map<string, { x: number; y: number }>
) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 120,
    ranksep: 120,
    marginx: 60,
    marginy: 60,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  const positions = nodes.map((node) => {
    const saved = savedPositions.get(node.id);
    const dagreNode = g.node(node.id);
    return {
      id: node.id,
      x: saved ? saved.x : dagreNode.x - NODE_WIDTH / 2,
      y: saved ? saved.y : dagreNode.y - NODE_HEIGHT / 2,
      fromSaved: !!saved,
    };
  });

  // Push apart any nodes that are too close (only adjust non-saved positions)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);

        // Only fix if nodes overlap (both axes within min gap)
        if (dx < MIN_GAP_X && dy < MIN_GAP_Y) {
          // Push apart on whichever axis has more room
          if (dx < MIN_GAP_X) {
            const pushX = (MIN_GAP_X - dx) / 2 + 1;
            if (!a.fromSaved) a.x -= pushX;
            if (!b.fromSaved) b.x += pushX;
            if (a.fromSaved) b.x += pushX * 2;
            if (b.fromSaved) a.x -= pushX * 2;
          }
          if (dy < MIN_GAP_Y) {
            const pushY = (MIN_GAP_Y - dy) / 2 + 1;
            if (!a.fromSaved) a.y -= pushY;
            if (!b.fromSaved) b.y += pushY;
            if (a.fromSaved) b.y += pushY * 2;
            if (b.fromSaved) a.y -= pushY * 2;
          }
        }
      }
    }
  }

  const posMap = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));
  const layoutedNodes = nodes.map((node) => ({
    ...node,
    position: posMap.get(node.id)!,
  }));

  return { nodes: layoutedNodes, edges };
}

// -- Custom node component ----------------------------------------------------

function ResourceNode({ data, selected }: NodeProps) {
  const accent = TYPE_ACCENT[data.type as string] || TYPE_ACCENT.other;
  const label =
    typeof data.label === "string" && data.label.length > 34
      ? data.label.slice(0, 33) + "\u2026"
      : (data.label as string);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
      <div
        className={`
          flex items-center rounded-[10px] border overflow-hidden
          bg-[var(--bg-surface)] text-[var(--fg-secondary)]
          transition-shadow transition-colors duration-150
          ${selected
            ? "border-[var(--fg-muted)] shadow-lg"
            : "border-[var(--border-color)] hover:border-[var(--fg-muted)] hover:shadow-md"
          }
        `}
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      >
        {/* Accent bar */}
        <div
          className="w-1 self-stretch shrink-0"
          style={{ backgroundColor: accent }}
        />
        {/* Label */}
        <span
          className={`
            px-3 text-[13px] font-semibold truncate
            ${selected ? "text-[var(--fg)]" : "text-[var(--fg-secondary)]"}
          `}
        >
          {label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
    </>
  );
}

const nodeTypes = { resource: ResourceNode };

// -- Inner graph (needs ReactFlowProvider above) ------------------------------

function GraphInner() {
  const { graphData, selectResource, clearSelection, selectedResource } = useApp();
  const { fitView } = useReactFlow();
  const initializedRef = useRef(false);
  const prevNodeCountRef = useRef(0);

  // Convert app data to React Flow format
  const { initialNodes, initialEdges, savedPositions } = useMemo(() => {
    const saved = new Map<string, { x: number; y: number }>();
    const rfNodes: Node[] = graphData.nodes.map((n) => {
      if (n.x != null && n.y != null) {
        saved.set(n.id, { x: n.x, y: n.y });
      }
      return {
        id: n.id,
        type: "resource",
        position: { x: 0, y: 0 },
        data: {
          label: n.name,
          type: n.type,
          source: n.source,
        },
        selected: selectedResource?.id === n.id,
      };
    });
    const rfEdges: Edge[] = graphData.links.map((l, i) => ({
      id: `e-${i}-${l.source}-${l.target}`,
      source: l.source,
      target: l.target,
      type: "smoothstep",
      style: { stroke: "var(--graph-link)", strokeWidth: 1 },
    }));
    return { initialNodes: rfNodes, initialEdges: rfEdges, savedPositions: saved };
  }, [graphData, selectedResource?.id]);

  // Apply dagre layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges, savedPositions),
    [initialNodes, initialEdges, savedPositions]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync when graph data changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Fit view on first load only
    if (!initializedRef.current && layoutedNodes.length > 0) {
      initializedRef.current = true;
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    }

    // Fit view when nodes are added (not on delete/archive)
    if (layoutedNodes.length > prevNodeCountRef.current && prevNodeCountRef.current > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
    }
    prevNodeCountRef.current = layoutedNodes.length;
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectResource(node.id);
    },
    [selectResource]
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Save position when user drags a node
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      try {
        await fetch("/api/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positions: [{ nodeId: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) }],
          }),
        });
      } catch {
        // silently fail
      }
    },
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDragStop={onNodeDragStop}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={4}
      proOptions={{ hideAttribution: true }}
      className="!bg-[var(--bg-page)]"
    >
      <Background color="var(--border-subtle)" gap={32} size={1} />
    </ReactFlow>
  );
}

// -- Exported component -------------------------------------------------------

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

  return (
    <div className="w-full h-screen">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  );
}
