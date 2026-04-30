"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
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

const NODE_SIZE = 120;

const TYPE_BORDER: Record<string, string> = {
  article: "border-blue-400/60 dark:border-blue-500/50",
  tweet: "border-sky-400/60 dark:border-sky-500/50",
  video: "border-red-400/60 dark:border-red-500/50",
  repo: "border-green-400/60 dark:border-green-500/50",
  podcast: "border-purple-400/60 dark:border-purple-500/50",
  other: "border-[var(--border-color)]",
};

// -- Dagre layout helper ------------------------------------------------------

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_SIZE, height: NODE_SIZE });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  // Collect positions from dagre
  const positions = nodes.map((node) => {
    const dn = g.node(node.id);
    return { id: node.id, x: dn.x - NODE_SIZE / 2, y: dn.y - NODE_SIZE / 2 };
  });

  // Post-layout: push apart any nodes that are too close
  const minGap = NODE_SIZE + 30;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < minGap && dy < minGap) {
          if (dx < minGap) {
            const push = (minGap - dx) / 2 + 1;
            a.x -= push;
            b.x += push;
          }
          if (dy < minGap) {
            const push = (minGap - dy) / 2 + 1;
            a.y -= push;
            b.y += push;
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

// -- Custom circle node -------------------------------------------------------

function CircleNode({ data, selected }: NodeProps) {
  const borderClass = TYPE_BORDER[data.type as string] || TYPE_BORDER.other;
  const label = data.label as string;

  // Truncate to ~20 chars for circle fit
  const display = label.length > 22 ? label.slice(0, 20) + "\u2026" : label;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
      <div
        className={`
          flex items-center justify-center rounded-full border-2 cursor-pointer
          bg-[var(--bg-surface)] transition-all duration-150
          ${borderClass}
          ${selected
            ? "shadow-lg border-[var(--fg-muted)] scale-105"
            : "hover:shadow-md hover:scale-[1.03]"
          }
        `}
        style={{ width: NODE_SIZE, height: NODE_SIZE }}
      >
        <span
          className={`
            text-[12px] leading-tight font-medium text-center px-3 select-none
            ${selected ? "text-[var(--fg)]" : "text-[var(--fg-secondary)]"}
          `}
          style={{ maxWidth: NODE_SIZE - 20, wordBreak: "break-word" }}
        >
          {display}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
    </>
  );
}

const nodeTypes = { resource: CircleNode };

// -- Inner graph (needs ReactFlowProvider above) ------------------------------

function GraphInner() {
  const { graphData, selectResource, clearSelection, selectedResource } = useApp();
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);

  // Convert app data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    const rfNodes: Node[] = graphData.nodes.map((n) => ({
      id: n.id,
      type: "resource",
      position: { x: 0, y: 0 },
      data: { label: n.name, type: n.type },
      selected: selectedResource?.id === n.id,
      draggable: false,
      connectable: false,
    }));
    const rfEdges: Edge[] = graphData.links.map((l, i) => ({
      id: `e-${i}-${l.source}-${l.target}`,
      source: l.source,
      target: l.target,
      type: "straight",
      style: { stroke: "var(--graph-link)", strokeWidth: 1.2 },
    }));
    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [graphData, selectedResource?.id]);

  // Apply dagre layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync when graph data changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    if (layoutedNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      className="!bg-[var(--bg-page)]"
    />
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
