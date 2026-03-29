import { StrictMode, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./store/themeStore";

initTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error("App crash:", e, i); }
  render() {
    const { error } = this.state;
    if (error) {
      const e = error as Error;
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#f87171", background: "#09090b", minHeight: "100vh" }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Crash: {e.message}</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#a1a1aa" }}>{e.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
