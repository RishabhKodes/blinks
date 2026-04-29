"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface GraphNode {
  id: string;
  name: string;
  url: string;
  type: string;
  source: string;
  thumbnail: string;
  summary: string;
  savedAt: string;
  author: string;
  topics: string[];
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SelectedResource {
  id: string;
  name: string;
  url: string;
  type: string;
  source: string;
  author: string;
  thumbnail: string;
  summary: string;
  savedAt: string;
  topics: string[];
}

export type ToastType = "success" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export type Theme = "light" | "dark";

interface AppContextValue {
  graphData: GraphData;
  selectedResource: SelectedResource | null;
  selectResource: (resourceId: string) => void;
  clearSelection: () => void;
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  refreshGraph: () => Promise<void>;
  theme: Theme;
  toggleTheme: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [selectedResource, setSelectedResource] = useState<SelectedResource | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("blinks-theme") as Theme | null;
    const initial = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("blinks-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const refreshGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph");
      if (res.ok) {
        const data: GraphData = await res.json();
        setGraphData(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  const selectResource = useCallback((resourceId: string) => {
    const node = graphData.nodes.find((n) => n.id === resourceId);
    if (node) {
      setSelectedResource({
        id: node.id,
        name: node.name,
        url: node.url,
        type: node.type,
        source: node.source,
        author: node.author,
        thumbnail: node.thumbnail,
        summary: node.summary,
        savedAt: node.savedAt,
        topics: node.topics,
      });
    }
  }, [graphData]);

  const clearSelection = useCallback(() => {
    setSelectedResource(null);
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    refreshGraph();
  }, [refreshGraph]);

  return (
    <AppContext.Provider
      value={{
        graphData,
        selectedResource,
        selectResource,
        clearSelection,
        toasts,
        addToast,
        removeToast,
        refreshGraph,
        theme,
        toggleTheme,
        chatOpen,
        setChatOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
