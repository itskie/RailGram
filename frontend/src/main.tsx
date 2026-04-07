import { StrictMode, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./store/themeStore";
import { initCSRF } from "./lib/api";

initTheme();
initCSRF().catch(err => console.warn("CSRF init warning:", err));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* errors are silent in production */ }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#09090b", color: "#fff", fontFamily: "sans-serif", gap: 16 }}>
          <div style={{ fontSize: 48 }}>🚂</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, margin: 0 }}>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: "8px 20px", background: "#f97316", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            Refresh
          </button>
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
