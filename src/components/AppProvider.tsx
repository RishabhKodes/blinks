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
  resourceCount: number;
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

export interface Resource {
  id: string;
  url: string;
  title: string;
  type: string;
  author: string;
  source: string;
  thumbnail: string;
  summary: string;
  savedAt: string;
  topics: string[];
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedTopic {
  id: string;
  name: string;
  description: string;
  resources: Resource[];
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
  selectedTopic: SelectedTopic | null;
  selectTopic: (topicId: string) => Promise<void>;
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
  const [selectedTopic, setSelectedTopic] = useState<SelectedTopic | null>(null);
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

  const selectTopic = useCallback(async (topicId: string) => {
    try {
      const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTopic({
          id: data.id,
          name: data.name,
          description: data.description || "",
          resources: data.resources || [],
        });
      }
    } catch {
      // silently fail
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTopic(null);
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
        selectedTopic,
        selectTopic,
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
