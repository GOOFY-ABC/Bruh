import React, { useState } from "react";
import { TabDisguise } from "../types";
import { DEFAULT_DISGUISES } from "../utils/cloak";
import { EyeOff, X, Check, Shield, AlertTriangle, ExternalLink } from "lucide-react";

interface CloakSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisguise: TabDisguise;
  onSelectDisguise: (disguise: TabDisguise) => void;
  panicKey: string;
  onChangePanicKey: (key: string) => void;
  panicUrl: string;
  onChangePanicUrl: (url: string) => void;
  onLaunchCloakedTab: () => void;
}

export const CloakSettingsModal: React.FC<CloakSettingsModalProps> = ({
  isOpen,
  onClose,
  currentDisguise,
  onSelectDisguise,
  panicKey,
  onChangePanicKey,
  panicUrl,
  onChangePanicUrl,
  onLaunchCloakedTab,
}) => {
  const [customTitle, setCustomTitle] = useState("");
  const [customFavicon, setCustomFavicon] = useState("");

  if (!isOpen) return null;

  const handleApplyCustom = () => {
    if (!customTitle.trim()) return;
    onSelectDisguise({
      id: "custom",
      name: "Custom Disguise",
      title: customTitle.trim(),
      favicon: customFavicon.trim() || "https://google.com/favicon.ico",
      badge: "Custom",
    });
  };

  return (
    <div
      id="cloak-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        id="cloak-modal-content"
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                about:blank Cloak & Stealth Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure tab disguises, panic redirects, and stealth launch
              </p>
            </div>
          </div>
          <button
            id="btn-close-cloak-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Launch Banner */}
          <div className="p-4 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-indigo-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-400" />
                Launch Native about:blank Tab
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Opens an independent window where the URL bar displays <code className="text-indigo-300">about:blank</code>, masking browsing history.
              </p>
            </div>
            <button
              id="btn-modal-launch-about-blank"
              onClick={() => {
                onLaunchCloakedTab();
                onClose();
              }}
              className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-900/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Launch Cloak Now
            </button>
          </div>

          {/* Preset Tab Disguises */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
              Tab Title & Favicon Disguises
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEFAULT_DISGUISES.map((disguise) => {
                const isSelected = currentDisguise.id === disguise.id;
                return (
                  <button
                    key={disguise.id}
                    id={`disguise-btn-${disguise.id}`}
                    onClick={() => onSelectDisguise(disguise)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-slate-800 border-indigo-500/80 ring-1 ring-indigo-500/50"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                  >
                    <img
                      src={disguise.favicon}
                      alt={disguise.name}
                      className="w-5 h-5 rounded object-contain shrink-0"
                      onError={(e) => {
                        // Fallback generic icon
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {disguise.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {disguise.title}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Disguise Input */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="text-xs font-medium text-slate-300">
              Custom Decoy Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                id="input-custom-decoy-title"
                type="text"
                placeholder="Custom Tab Title (e.g. Biology Notes)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <input
                id="input-custom-decoy-favicon"
                type="text"
                placeholder="Favicon Image URL (optional)"
                value={customFavicon}
                onChange={(e) => setCustomFavicon(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              id="btn-apply-custom-decoy"
              onClick={handleApplyCustom}
              disabled={!customTitle.trim()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded transition-colors"
            >
              Apply Custom Decoy
            </button>
          </div>

          {/* Panic Key & Redirect */}
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <div className="text-xs font-semibold text-slate-200">
                Emergency Panic Redirect
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Pressing the Panic Key immediately terminates current browsing and replaces the active window with your designated safe decoy.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Panic Key Shortcut
                </label>
                <select
                  id="select-panic-key"
                  value={panicKey}
                  onChange={(e) => onChangePanicKey(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Escape">Escape (Esc)</option>
                  <option value="Backquote">Tilde (` / ~)</option>
                  <option value="F4">F4</option>
                  <option value="F12">F12</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Emergency Decoy URL
                </label>
                <input
                  id="input-panic-url"
                  type="text"
                  value={panicUrl}
                  onChange={(e) => onChangePanicUrl(e.target.value)}
                  placeholder="https://google.com"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
          <button
            id="btn-close-cloak-settings"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
