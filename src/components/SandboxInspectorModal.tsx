import React from "react";
import { SandboxPolicyConfig } from "../types";
import { ShieldCheck, AlertCircle, X, Check, Info } from "lucide-react";

interface SandboxInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SandboxPolicyConfig;
  onUpdateConfig: (newConfig: SandboxPolicyConfig) => void;
}

export const SandboxInspectorModal: React.FC<SandboxInspectorModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  const togglePolicy = (key: keyof SandboxPolicyConfig) => {
    onUpdateConfig({
      ...config,
      [key]: !config[key],
    });
  };

  const policies: Array<{
    key: keyof SandboxPolicyConfig;
    token: string;
    label: string;
    description: string;
    criticalForLinks: boolean;
  }> = [
    {
      key: "allowPopups",
      token: "allow-popups",
      label: "Allow Popups (Essential for Links)",
      description:
        "Most search engines like DuckDuckGo render links with target='_blank'. Without this token, clicking any search result link is blocked by the browser.",
      criticalForLinks: true,
    },
    {
      key: "allowPopupsToEscapeSandbox",
      token: "allow-popups-to-escape-sandbox",
      label: "Allow Popups To Escape Sandbox",
      description:
        "Ensures links opened in new tabs or windows are not restricted by this container's sandbox constraints.",
      criticalForLinks: true,
    },
    {
      key: "allowForms",
      token: "allow-forms",
      label: "Allow Form Submissions",
      description:
        "Essential for DuckDuckGo's search bar. Without this, pressing Enter or clicking 'Search' will not submit queries.",
      criticalForLinks: true,
    },
    {
      key: "allowScripts",
      token: "allow-scripts",
      label: "Allow JavaScript Execution",
      description:
        "Allows dynamic search suggestions, rich media, and script-based navigation within DuckDuckGo and web pages.",
      criticalForLinks: false,
    },
    {
      key: "allowSameOrigin",
      token: "allow-same-origin",
      label: "Allow Same-Origin Treatment",
      description:
        "Allows the iframe document to maintain its origin context for cookies, caches, and storage.",
      criticalForLinks: false,
    },
    {
      key: "allowTopNavigationByActivation",
      token: "allow-top-navigation-by-user-activation",
      label: "Top Navigation on User Click",
      description:
        "Enables links targeting the main frame to navigate only when explicitly clicked by the user, preventing unauthorized redirects.",
      criticalForLinks: true,
    },
    {
      key: "allowModals",
      token: "allow-modals",
      label: "Allow Modals & Dialogs",
      description: "Permits window.alert, window.confirm, and print dialogs.",
      criticalForLinks: false,
    },
    {
      key: "allowDownloads",
      token: "allow-downloads",
      label: "Allow File Downloads",
      description: "Permits direct downloading of files linked within the browser frame.",
      criticalForLinks: false,
    },
  ];

  return (
    <div
      id="sandbox-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        id="sandbox-modal-content"
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Iframe Sandbox Policy & Link Inspector
              </h2>
              <p className="text-xs text-slate-400">
                Configure security tokens enabling clickable links and private DuckDuckGo browsing
              </p>
            </div>
          </div>
          <button
            id="btn-close-sandbox-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why links usually break banner */}
        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <strong>Why do links break in sandboxed iframes?</strong> Standard sandboxed iframes block
            new tabs by default. Without <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">allow-popups</code>,
            <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 ml-1">allow-popups-to-escape-sandbox</code>, and
            <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 ml-1">allow-forms</code>, search results
            and external links fail silently. This configuration guarantees full link clickability.
          </p>
        </div>

        {/* Policy list */}
        <div className="p-6 overflow-y-auto space-y-3">
          {policies.map((policy) => {
            const isEnabled = config[policy.key];
            return (
              <div
                key={policy.key}
                id={`policy-item-${policy.token}`}
                onClick={() => togglePolicy(policy.key)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                  isEnabled
                    ? "bg-slate-800/80 border-slate-700 hover:border-slate-600"
                    : "bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {policy.label}
                    </span>
                    <span className="font-mono text-xs text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                      {policy.token}
                    </span>
                    {policy.criticalForLinks && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                        Link Enabler
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {policy.description}
                  </p>
                </div>

                {/* Toggle switch */}
                <div className="shrink-0 pt-0.5">
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                      isEnabled ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                        isEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Active Tokens:{" "}
            <span className="font-mono text-emerald-400">
              {Object.values(config).filter(Boolean).length} / 8 enabled
            </span>
          </div>
          <button
            id="btn-apply-sandbox"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
          >
            Apply & Return to Browser
          </button>
        </div>
      </div>
    </div>
  );
};
