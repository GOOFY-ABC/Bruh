import React, { useState, useEffect, useRef } from "react";
import {
  TabDisguise,
  SandboxPolicyConfig,
  DuckDuckGoSuggestion,
  SearchResultItem,
} from "../types";
import {
  buildSandboxString,
  launchAboutBlankWindow,
  triggerPanic,
  DEFAULT_DISGUISES,
  DEFAULT_SANDBOX_CONFIG,
} from "../utils/cloak";
import { SandboxInspectorModal } from "./SandboxInspectorModal";
import { CloakSettingsModal } from "./CloakSettingsModal";
import {
  Search,
  Shield,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  ExternalLink,
  Lock,
  EyeOff,
  Sliders,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Globe,
  Info,
  Maximize2,
} from "lucide-react";

export const SandboxedBrowser: React.FC = () => {
  // Navigation & URL State
  const [currentQuery, setCurrentQuery] = useState("");
  const [activeUrl, setActiveUrl] = useState<string>("duckduckgo://home");
  const [displayOmniboxText, setDisplayOmniboxText] = useState("about:blank");
  const [showRealUrlInOmnibox, setShowRealUrlInOmnibox] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>(["duckduckgo://home"]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Search Results & Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchAnswer, setSearchAnswer] = useState<{
    heading: string;
    abstract: string | null;
    source: string | null;
    url: string | null;
  } | null>(null);

  // Sandboxed Iframe State
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Modals & Cloak Configuration
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);
  const [isCloakModalOpen, setIsCloakModalOpen] = useState(false);
  const [currentDisguise, setCurrentDisguise] = useState<TabDisguise>(DEFAULT_DISGUISES[0]);
  const [sandboxConfig, setSandboxConfig] = useState<SandboxPolicyConfig>(DEFAULT_SANDBOX_CONFIG);
  const [panicKey, setPanicKey] = useState("Escape");
  const [panicUrl, setPanicUrl] = useState("https://google.com");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle Panic Key global listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === panicKey || (panicKey === "Escape" && e.key === "Escape")) {
        triggerPanic(panicUrl);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panicKey, panicUrl]);

  // Handle messages from the proxy script inside iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "CLOAK_FRAME_NAV" && e.data.url) {
        // Link was clicked inside the sandboxed iframe
        setDisplayOmniboxText("about:blank");
        showToast(`Navigated link: ${e.data.title || "Web page"}`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Sync tab disguise with main document (title & favicon)
  useEffect(() => {
    if (currentDisguise) {
      document.title = currentDisguise.title;
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (favicon && currentDisguise.favicon) {
        favicon.href = currentDisguise.favicon;
      }
    }
  }, [currentDisguise]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Fetch DuckDuckGo autocomplete suggestions
  useEffect(() => {
    if (!currentQuery.trim() || currentQuery.startsWith("http://") || currentQuery.startsWith("https://")) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ddg/suggest?q=${encodeURIComponent(currentQuery.trim())}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            setSuggestions(list.map((item: any) => (typeof item === "string" ? item : item.phrase || "")));
          }
        }
      } catch (err) {
        // Silent fail
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [currentQuery]);

  // Execute DuckDuckGo search or direct URL navigation
  const handleNavigate = async (target: string) => {
    setShowSuggestions(false);
    const trimmed = target.trim();
    if (!trimmed) return;

    // Check if input is a direct URL or domain
    const isUrl =
      /^(https?:\/\/|www\.)/i.test(trimmed) ||
      (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed) && !trimmed.includes(" "));

    if (isUrl) {
      const fullUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      loadUrlInSandboxedFrame(fullUrl);
    } else {
      // Execute DuckDuckGo search
      await performDuckDuckGoSearch(trimmed);
    }
  };

  const performDuckDuckGoSearch = async (query: string) => {
    setIsLoadingSearch(true);
    setIframeSrc(null); // Switch to search result view
    setActiveUrl(`duckduckgo://search?q=${encodeURIComponent(query)}`);
    pushHistory(`duckduckgo://search?q=${encodeURIComponent(query)}`);

    try {
      const res = await fetch(`/api/ddg/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchAnswer(
          data.abstract
            ? {
                heading: data.heading || query,
                abstract: data.abstract,
                source: data.abstractSource,
                url: data.abstractURL,
              }
            : null
        );
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Search error:", err);
      showToast("Unable to reach search engine API.");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const loadUrlInSandboxedFrame = (targetUrl: string) => {
    setIsIframeLoading(true);
    // Route through privacy proxy to strip X-Frame-Options & enable link clickability
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    setIframeSrc(proxyUrl);
    setActiveUrl(targetUrl);
    pushHistory(targetUrl);
  };

  const pushHistory = (url: string) => {
    const updated = historyStack.slice(0, historyIndex + 1);
    updated.push(url);
    setHistoryStack(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = historyStack[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      restoreUrl(prevUrl);
    }
  };

  const handleForward = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextUrl = historyStack[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      restoreUrl(nextUrl);
    }
  };

  const restoreUrl = (url: string) => {
    setActiveUrl(url);
    if (url === "duckduckgo://home") {
      setIframeSrc(null);
      setSearchResults([]);
      setSearchAnswer(null);
    } else if (url.startsWith("duckduckgo://search?q=")) {
      const q = decodeURIComponent(url.replace("duckduckgo://search?q=", ""));
      performDuckDuckGoSearch(q);
    } else {
      setIframeSrc(`/api/proxy?url=${encodeURIComponent(url)}`);
    }
  };

  const handleReload = () => {
    if (iframeSrc && iframeRef.current) {
      setIsIframeLoading(true);
      iframeRef.current.src = iframeSrc;
    } else if (activeUrl.startsWith("duckduckgo://search")) {
      const q = decodeURIComponent(activeUrl.replace("duckduckgo://search?q=", ""));
      performDuckDuckGoSearch(q);
    }
  };

  const handleHome = () => {
    setIframeSrc(null);
    setActiveUrl("duckduckgo://home");
    pushHistory("duckduckgo://home");
    setCurrentQuery("");
    setSearchResults([]);
    setSearchAnswer(null);
  };

  const handleLaunchNativeCloak = () => {
    // If currently browsing a site, launch that site inside the about:blank window; otherwise DuckDuckGo
    let target = window.location.origin;
    if (activeUrl && activeUrl !== "duckduckgo://home") {
      if (activeUrl.startsWith("http")) {
        target = `${window.location.origin}/api/proxy?url=${encodeURIComponent(activeUrl)}`;
      }
    }

    const success = launchAboutBlankWindow(target, currentDisguise, sandboxConfig);
    if (success) {
      showToast("Launched true about:blank window disguised as " + currentDisguise.name);
    } else {
      showToast("Pop-up was blocked by browser. Please enable popups for this site.");
    }
  };

  const sandboxString = buildSandboxString(sandboxConfig);

  return (
    <div
      id="cloaked-browser-container"
      className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden"
    >
      {/* Top Browser Chrome / Window Header */}
      <header
        id="browser-chrome-header"
        className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs gap-3 shrink-0"
      >
        {/* Tab disguise badge & simulated tab */}
        <div className="flex items-center gap-2 max-w-[240px] truncate">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 rounded-t-lg border-t border-x border-slate-700 font-medium text-slate-200">
            <img
              src={currentDisguise.favicon}
              alt=""
              className="w-3.5 h-3.5 rounded object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="truncate max-w-[140px]">{currentDisguise.title}</span>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-1 py-0.2 rounded border border-indigo-800/40">
              {currentDisguise.badge}
            </span>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Launch true about:blank window */}
          <button
            id="btn-launch-aboutblank-tab"
            onClick={handleLaunchNativeCloak}
            title="Launch true about:blank window (Browser address bar will show about:blank)"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors shadow-sm cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Launch about:blank Window</span>
            <span className="sm:hidden">about:blank</span>
          </button>

          {/* Sandbox & Link Inspector */}
          <button
            id="btn-open-sandbox-inspector"
            onClick={() => setIsSandboxModalOpen(true)}
            title="Configure iframe sandbox tokens to ensure link clickability"
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sandbox & Links</span>
          </button>

          {/* Tab Disguise & Cloak Settings */}
          <button
            id="btn-open-cloak-settings"
            onClick={() => setIsCloakModalOpen(true)}
            title="Tab title/favicon disguises and panic keys"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Panic Button */}
          <button
            id="btn-panic-redirect"
            onClick={() => triggerPanic(panicUrl)}
            title={`Panic button! Press ${panicKey} to immediately exit to Google`}
            className="flex items-center gap-1 px-2 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/70 text-rose-300 rounded transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Panic [{panicKey}]</span>
          </button>
        </div>
      </header>

      {/* Browser Navigation Bar (Omnibox, Back, Forward, Reload) */}
      <div
        id="browser-nav-bar"
        className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800 shrink-0 relative z-20"
      >
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            id="btn-nav-back"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            id="btn-nav-forward"
            onClick={handleForward}
            disabled={historyIndex >= historyStack.length - 1}
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            id="btn-nav-reload"
            onClick={handleReload}
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Reload"
          >
            <RotateCw className={`w-4 h-4 ${isIframeLoading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
          <button
            id="btn-nav-home"
            onClick={handleHome}
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="DuckDuckGo Home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox / Search & URL Input */}
        <div className="flex-1 relative">
          <div className="flex items-center w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            {/* Cloak / Security Indicator */}
            <div
              className="flex items-center gap-1 text-emerald-400 mr-2 pr-2 border-r border-slate-800 cursor-pointer"
              title="DuckDuckGo Private Connection & Sandboxed Isolation"
              onClick={() => setShowRealUrlInOmnibox(!showRealUrlInOmnibox)}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] text-slate-300 font-semibold tracking-tight">
                {showRealUrlInOmnibox && activeUrl !== "duckduckgo://home"
                  ? activeUrl
                  : "about:blank"}
              </span>
            </div>

            {/* Input field */}
            <input
              id="omnibox-input"
              type="text"
              value={currentQuery}
              onChange={(e) => {
                setCurrentQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNavigate(currentQuery);
                }
              }}
              placeholder="Search DuckDuckGo or enter web address..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
            />

            <button
              id="btn-omnibox-search"
              onClick={() => handleNavigate(currentQuery)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Execute Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              id="suggestions-dropdown"
              className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-30"
            >
              <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>DuckDuckGo Privacy Suggestions</span>
                <span className="text-emerald-400 font-normal lowercase">no tracking</span>
              </div>
              {suggestions.slice(0, 7).map((s, idx) => (
                <div
                  key={idx}
                  id={`suggestion-item-${idx}`}
                  onClick={() => {
                    setCurrentQuery(s);
                    handleNavigate(s);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Link Clickability Status Pill */}
        <div
          id="link-safety-status-pill"
          onClick={() => setIsSandboxModalOpen(true)}
          className="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 border border-slate-700/60 rounded text-[11px] text-slate-300 cursor-pointer hover:bg-slate-800 transition-colors"
          title="Click to view iframe sandbox link permissions"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Links Clickable</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1 py-0.5 rounded">
            allow-popups
          </span>
        </div>
      </div>

      {/* Main Browser View Area */}
      <main id="browser-viewport" className="flex-1 w-full relative bg-slate-950 overflow-hidden">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            id="browser-toast-notification"
            className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-slate-800 border border-slate-700 text-slate-100 text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in"
          >
            <Info className="w-4 h-4 text-indigo-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* VIEW 1: Embedded Sandboxed Iframe (When browsing a specific URL) */}
        {iframeSrc ? (
          <div className="w-full h-full flex flex-col">
            {/* Sandboxed frame status bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-slate-900/90 border-b border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Shield className="w-3 h-3" /> Sandboxed Frame:
                </span>
                <span className="text-slate-300 font-mono truncate">{activeUrl}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline text-slate-500 font-mono text-[10px]">
                  sandbox="{sandboxString.slice(0, 32)}..."
                </span>
                <button
                  onClick={handleLaunchNativeCloak}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                  title="Pop out this page into an about:blank tab"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                  Popout
                </button>
              </div>
            </div>

            {/* The sandboxed iframe */}
            <div className="flex-1 w-full relative bg-white">
              {isIframeLoading && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                  <RotateCw className="w-6 h-6 text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-300">
                    Loading sandboxed content & verifying clickable links...
                  </span>
                </div>
              )}
              <iframe
                id="sandboxed-content-iframe"
                ref={iframeRef}
                src={iframeSrc}
                sandbox={sandboxString}
                title="DuckDuckGo Sandboxed View"
                className="w-full h-full border-none"
                onLoad={() => setIsIframeLoading(false)}
              />
            </div>
          </div>
        ) : activeUrl.startsWith("duckduckgo://search") ? (
          /* VIEW 2: DuckDuckGo Search Results View */
          <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
            {/* Search Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Compass className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">DuckDuckGo Private Search</h2>
                  <p className="text-[11px] text-slate-400">
                    Tracker-free search results with sandbox link click security
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Open full DuckDuckGo HTML search inside the sandboxed frame
                  const q = decodeURIComponent(activeUrl.replace("duckduckgo://search?q=", ""));
                  loadUrlInSandboxedFrame(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                Load Official DDG in Frame
              </button>
            </div>

            {isLoadingSearch ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <RotateCw className="w-7 h-7 text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-400">
                  Fetching encrypted DuckDuckGo search results...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Instant Answer Box */}
                {searchAnswer && searchAnswer.abstract && (
                  <div
                    id="ddg-instant-answer-box"
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
                        Instant Answer
                      </span>
                      {searchAnswer.source && (
                        <span className="text-[11px] text-slate-400">
                          Source: {searchAnswer.source}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-medium text-slate-100">{searchAnswer.heading}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {searchAnswer.abstract}
                    </p>
                    {searchAnswer.url && (
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          onClick={() => loadUrlInSandboxedFrame(searchAnswer.url!)}
                          className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Browse in Sandboxed Frame
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          onClick={() =>
                            launchAboutBlankWindow(searchAnswer.url!, currentDisguise, sandboxConfig)
                          }
                          className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Open in about:blank Window
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Web Results List */}
                <div className="space-y-3">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        id={`search-result-item-${idx}`}
                        className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-1.5"
                      >
                        {/* Title as clickable link */}
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => loadUrlInSandboxedFrame(result.url)}
                            className="text-left text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors"
                          >
                            {result.title}
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Clickable in frame */}
                            <button
                              onClick={() => loadUrlInSandboxedFrame(result.url)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded border border-slate-700 cursor-pointer"
                              title="Render inside the sandboxed iframe"
                            >
                              Frame
                            </button>
                            {/* Clickable in about:blank cloak */}
                            <button
                              onClick={() =>
                                launchAboutBlankWindow(result.url, currentDisguise, sandboxConfig)
                              }
                              className="px-2 py-0.5 bg-indigo-950/80 hover:bg-indigo-900 text-[11px] text-indigo-300 rounded border border-indigo-800/50 cursor-pointer"
                              title="Launch link directly in about:blank cloaked tab"
                            >
                              about:blank
                            </button>
                          </div>
                        </div>

                        {/* URL snippet */}
                        <div className="text-[11px] font-mono text-emerald-400/80 truncate">
                          {result.url}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {result.snippet}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 space-y-3">
                      <p className="text-sm text-slate-400">
                        No direct API results found for this query.
                      </p>
                      <button
                        onClick={() => {
                          const q = decodeURIComponent(
                            activeUrl.replace("duckduckgo://search?q=", "")
                          );
                          loadUrlInSandboxedFrame(
                            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
                          );
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Search on DuckDuckGo Web Engine
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* VIEW 3: DuckDuckGo Home / Private Portal */
          <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center p-6 max-w-2xl mx-auto text-center space-y-6">
            {/* DuckDuckGo Mascot / Identity */}
            <div className="space-y-3">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
                <svg
                  className="w-12 h-12"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" r="45" fill="#DE5833" />
                  <circle cx="50" cy="48" r="36" fill="#FFF" />
                  <ellipse cx="50" cy="52" rx="28" ry="24" fill="#3D85C6" />
                  <ellipse cx="50" cy="48" rx="22" ry="18" fill="#FFF" />
                  <circle cx="43" cy="45" r="4" fill="#222" />
                  <circle cx="57" cy="45" r="4" fill="#222" />
                  <polygon points="50,50 42,56 58,56" fill="#F4B400" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                DuckDuckGo Private Browser
              </h1>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Sandboxed iframe architecture with <code className="text-indigo-400">about:blank</code> tab
                cloaking and full link clickability policy enforcement.
              </p>
            </div>

            {/* Large Search Box */}
            <div className="w-full max-w-lg space-y-2">
              <div className="flex items-center w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
                <Search className="w-4 h-4 text-slate-400 mr-3" />
                <input
                  id="home-search-input"
                  type="text"
                  value={currentQuery}
                  onChange={(e) => setCurrentQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNavigate(currentQuery);
                    }
                  }}
                  placeholder="Search without being tracked or enter a URL..."
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <button
                  id="btn-home-search-submit"
                  onClick={() => handleNavigate(currentQuery)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>

              {/* Sample Queries */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {[
                  "about:blank cloaking",
                  "iframe sandbox policies",
                  "DuckDuckGo privacy features",
                  "Web isolation",
                ].map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setCurrentQuery(term);
                      handleNavigate(term);
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Architecture Highlights: about:blank & Sandboxed Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-2">
              {/* Feature 1 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400">
                  <EyeOff className="w-4 h-4" />
                  <h3 className="text-xs font-semibold text-slate-200">about:blank Cloak Engine</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Opens an isolated window displaying <code className="text-indigo-300">about:blank</code> in the
                  browser address bar, masking your browsing destination from local history and screen monitoring.
                </p>
                <button
                  onClick={handleLaunchNativeCloak}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  Launch Cloaked Tab <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Feature 2 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Shield className="w-4 h-4" />
                  <h3 className="text-xs font-semibold text-slate-200">Clickable Sandboxed Links</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Solves the common issue where sandboxed iframes block link clicks by applying
                  <code className="text-emerald-300 mx-1">allow-popups</code>,
                  <code className="text-emerald-300 mx-1">allow-popups-to-escape-sandbox</code>, and
                  <code className="text-emerald-300 ml-1">allow-forms</code>.
                </p>
                <button
                  onClick={() => setIsSandboxModalOpen(true)}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  Inspect Sandbox Policy <Sliders className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer
        id="browser-status-bar"
        className="flex items-center justify-between px-3 py-1 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 shrink-0 select-none"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Discreet Session Active
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-300">
            Address Bar Cloak: {displayOmniboxText}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            Disguise: <strong className="text-slate-200">{currentDisguise.name}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => triggerPanic(panicUrl)}
            className="text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
            title="Emergency Panic"
          >
            Panic Exit ({panicKey})
          </button>
        </div>
      </footer>

      {/* Modals */}
      <SandboxInspectorModal
        isOpen={isSandboxModalOpen}
        onClose={() => setIsSandboxModalOpen(false)}
        config={sandboxConfig}
        onUpdateConfig={setSandboxConfig}
      />

      <CloakSettingsModal
        isOpen={isCloakModalOpen}
        onClose={() => setIsCloakModalOpen(false)}
        currentDisguise={currentDisguise}
        onSelectDisguise={setCurrentDisguise}
        panicKey={panicKey}
        onChangePanicKey={setPanicKey}
        panicUrl={panicUrl}
        onChangePanicUrl={setPanicUrl}
        onLaunchCloakedTab={handleLaunchNativeCloak}
      />
    </div>
  );
};
