export interface TabDisguise {
  id: string;
  name: string;
  title: string;
  favicon: string;
  badge: string;
}

export interface SandboxPolicyConfig {
  allowScripts: boolean;
  allowSameOrigin: boolean;
  allowForms: boolean;
  allowPopups: boolean;
  allowPopupsToEscapeSandbox: boolean;
  allowTopNavigationByActivation: boolean;
  allowModals: boolean;
  allowDownloads: boolean;
}

export interface DuckDuckGoSuggestion {
  phrase: string;
}

export interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  displayUrl: string;
  source?: string;
}

export interface BrowsingTab {
  id: string;
  title: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  sandboxTokens: string[];
}
