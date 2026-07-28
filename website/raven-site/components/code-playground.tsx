"use client";

import Editor from "@monaco-editor/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTheme } from "next-themes";

const DEFAULT_CODE = `import { useState } from "react";
import { useDoorway, Doorway } from "@hookraft/doorway";

export default function Page() {
  const [order, setOrder] = useState(null);
  const [logs, setLogs] = useState([]);

  const log = (msg) =>
    setLogs((prev) => [\`[\${new Date().toLocaleTimeString()}] \${msg}\`, ...prev]);

  const door = useDoorway({
    onEnter: () => {
      log("onEnter fired → calling door.load()");
      door.load();
    },
    onLoading: async () => {
      log("onLoading fired → fetching...");
      await new Promise((r) => setTimeout(r, 1500));
      setOrder({ id: "ORD-001", total: "$99.00" });
      door.succeed();
    },
    onSuccess: () => log("onSuccess fired ✓"),
    onError:   () => log("onError fired ✗"),
    onExit: () => {
      log("onExit fired → clearing data");
      setOrder(null);
    },
  });

  const statusClass = {
    idle:    "bg-neutral-800 text-neutral-400",
    loading: "bg-yellow-900 text-yellow-300",
    success: "bg-green-900 text-green-300",
    error:   "bg-red-900 text-red-300",
  }[door.status] ?? "bg-neutral-800 text-neutral-400";

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-10 font-mono">
      <div className="max-w-sm">

        {/* Header */}
        <div className="mb-8">
          <span className="inline-block text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 mb-3">
            @hookraft/doorway
          </span>
          <h1 className="text-xl font-bold tracking-tight mb-1">Live hook test</h1>
          <p className="text-sm text-neutral-500">Declarative lifecycle hooks for React views</p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-neutral-500">status:</span>
          <span className={\`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest \${statusClass}\`}>
            {door.status}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={door.enter}   className="px-3 py-1.5 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded-lg text-xs hover:bg-indigo-900 transition-colors">door.enter()</button>
          <button onClick={door.exit}    className="px-3 py-1.5 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded-lg text-xs hover:bg-neutral-800 transition-colors">door.exit()</button>
          <button onClick={door.load}    className="px-3 py-1.5 bg-yellow-950 text-yellow-400 border border-yellow-900 rounded-lg text-xs hover:bg-yellow-900 transition-colors">door.load()</button>
          <button onClick={door.succeed} className="px-3 py-1.5 bg-green-950 text-green-400 border border-green-900 rounded-lg text-xs hover:bg-green-900 transition-colors">door.succeed()</button>
          <button onClick={door.fail}    className="px-3 py-1.5 bg-red-950 text-red-400 border border-red-900 rounded-lg text-xs hover:bg-red-900 transition-colors">door.fail()</button>
          <button onClick={door.reset}   className="px-3 py-1.5 bg-neutral-900 text-neutral-500 border border-neutral-800 rounded-lg text-xs hover:bg-neutral-800 transition-colors">door.reset()</button>
        </div>

        {/* Doorway output */}
        <div className="mb-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900">
          <p className="text-neutral-600 text-xs uppercase tracking-widest mb-3">Doorway output</p>
          <Doorway
            when={door.status !== "idle"}
            fallback={<p className="text-neutral-600 text-sm">Nothing here — call door.enter()</p>}
          >
            <div>
              {door.is("loading") && (
                <div className="flex items-center gap-2 text-yellow-300 text-sm">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-700 border-t-yellow-300 animate-spin" />
                  Loading...
                </div>
              )}
              {door.is("success") && order && (
                <div className="space-y-1">
                  <p className="text-green-400 text-sm">✓ Order loaded</p>
                  <p className="text-neutral-400 text-xs">ID: {order.id}</p>
                  <p className="text-neutral-400 text-xs">Total: {order.total}</p>
                </div>
              )}
              {door.is("error") && (
                <p className="text-red-400 text-sm">✗ Something went wrong</p>
              )}
            </div>
          </Doorway>
        </div>

        {/* Lifecycle log */}
        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900">
          <p className="text-neutral-600 text-xs uppercase tracking-widest mb-3">Lifecycle log</p>
          {logs.length === 0 ? (
            <p className="text-neutral-600 text-sm">No events yet</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((l, i) => (
                <li key={i} className={\`text-xs \${i === 0 ? "text-neutral-300" : "text-neutral-600"}\`}>{l}</li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </main>
  );
}`;

// Wraps user code in a self-contained HTML page that runs in the iframe
function buildPreviewHTML(code: string, theme: string = "dark"): string {
  const cleaned = code
    .replace(/^import\s+.*?\s+from\s+['"]react['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+.*?\s+from\s+['"]react-dom['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+.*?\s+from\s+['"]@hookraft\/doorway['"]\s*;?\s*$/gm, "")
    .replace(/^export\s+default\s+function\s+(\w+)/m, "function $1")
    .replace(/^export\s+default\s+/m, "const __App = ");

  const namedFn = code.match(/^export\s+default\s+function\s+(\w+)/m)?.[1];
  const mountTarget = namedFn ?? "__App";

  return `<!DOCTYPE html>
<html lang="en" class="${theme === 'light' ? '' : 'dark'}">
<head>
  <meta charset="UTF-8" />
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.23.3/babel.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${theme === "light" ? "#ffffff" : "#09090b"}; color: ${theme === "light" ? "#0a0a0a" : "#fafafa"}; }
    #error {
      display: none; padding: 16px; color: #f87171;
      font-family: monospace; font-size: 12px; white-space: pre-wrap;
      background: #1c0a0a; border-left: 3px solid #f87171; margin: 16px; border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error"></div>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      var el = document.getElementById('error');
      el.style.display = 'block';
      el.textContent = (err ? err.toString() : msg) + (line ? '\\nLine: ' + line : '');
      document.getElementById('root').innerHTML = '';
    };
  <\/script>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;

    // ── @hookraft/doorway shim ─────────────────────────────────────────
    function useDoorway(handlers) {
      const [status, setStatus] = React.useState("idle");
      const handlersRef = React.useRef(handlers);
      React.useEffect(() => { handlersRef.current = handlers; });

      const load = React.useCallback(async () => {
        setStatus("loading");
        try { await handlersRef.current.onLoading?.(); }
        catch { setStatus("error"); handlersRef.current.onError?.(); }
      }, []);

      const succeed = React.useCallback(() => { setStatus("success"); handlersRef.current.onSuccess?.(); }, []);
      const fail    = React.useCallback(() => { setStatus("error");   handlersRef.current.onError?.();   }, []);
      const reset   = React.useCallback(() => { setStatus("idle");                                        }, []);
      const exit    = React.useCallback(() => { setStatus("idle");    handlersRef.current.onExit?.();    }, []);
      const enter   = React.useCallback(() => {                       handlersRef.current.onEnter?.();   }, []);
      const is      = React.useCallback((s) => status === s, [status]);

      return { status, load, succeed, fail, reset, exit, enter, is };
    }

    function Doorway({ when, children, fallback = null }) {
      return when ? React.createElement(React.Fragment, null, children)
                  : React.createElement(React.Fragment, null, fallback);
    }
    // ──────────────────────────────────────────────────────────────────

    ${cleaned}

    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(${mountTarget}));
    } catch(e) {
      var el = document.getElementById('error');
      el.style.display = 'block';
      el.textContent = e.toString();
    }
  <\/script>
</body>
</html>`;
}

type Tab = "editor" | "preview";

export function CodePlayground() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [previewHTML, setPreviewHTML] = useState(() => buildPreviewHTML(DEFAULT_CODE, "dark"));
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [isRunning, setIsRunning] = useState(false);
  const { resolvedTheme } = useTheme();
  const monacoRef = useRef<any>(null);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(resolvedTheme === "light" ? "light" : "vs-dark");
    }
    setPreviewHTML(buildPreviewHTML(code, resolvedTheme ?? "dark"));
  }, [resolvedTheme]);

  const runCode = useCallback(() => {
    setIsRunning(true);
    setPreviewHTML(buildPreviewHTML(code, resolvedTheme ?? "dark"));
    setActiveTab("preview");
    setTimeout(() => setIsRunning(false), 600);
  }, [code]);

  return (
    <section className="w-full px-4">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl">

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">App.tsx</span>
            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md dark:bg-white bg-neutral-800 dark:hover:bg-gray-100 disabled:opacity-60 text-white dark:text-black text-xs font-semibold transition-all"
            >
              {isRunning ? (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              Run
            </button>
          </div>

          {/* Mobile tab toggle */}
          <div className="flex md:hidden border-b border-neutral-200 dark:border-neutral-800">
            {(["editor", "preview"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs  uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? "dark:text-white text-black border-b border-gray-400 bg-gray-white dark:bg-neutral-900"
                    : "text-neutral-500 bg-gray-100 dark:bg-black hover:text-neutral-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Editor + Preview */}
          <div className="flex h-[500px]">
            <div className={`w-full md:w-1/2 h-full ${activeTab === "preview" ? "hidden md:block" : "block"}`}>
              <Editor
                height="100%"
                language="typescript"
                theme={resolvedTheme === "light" ? "light" : "vs-dark"}
                value={code}
                onChange={(val) => setCode(val ?? "")}
                onMount={(_editor, monaco) => {
                  monacoRef.current = monaco;
                }}
                beforeMount={(monaco) => {
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: false,
                  });
                  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    jsx: monaco.languages.typescript.JsxEmit.React,
                    allowNonTsExtensions: true,
                    allowJs: true,
                  });
                }}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  tabSize: 2,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "gutter",
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  formatOnPaste: true,
                }}
              />
            </div>
            <div className="hidden md:block w-px bg-neutral-200 dark:bg-neutral-800" />
            <div className={`w-full md:w-1/2 h-full bg-white dark:bg-neutral-950 ${activeTab === "editor" ? "hidden md:block" : "block"}`}>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">Preview</span>
              </div>
              <iframe
                key={previewHTML}
                srcDoc={previewHTML}
                sandbox="allow-scripts"
                className="w-full h-[calc(100%-37px)] border-0"
                title="Live Preview"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}