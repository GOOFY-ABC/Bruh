import { TabDisguise, SandboxPolicyConfig } from "../types";

export const DEFAULT_DISGUISES: TabDisguise[] = [
  {
    id: "classroom",
    name: "Google Classroom",
    title: "Home - Google Classroom",
    favicon: "https://ssl.gstatic.com/classroom/favicon.png",
    badge: "Classroom",
  },
  {
    id: "drive",
    name: "Google Drive",
    title: "My Drive - Google Drive",
    favicon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png",
    badge: "Drive",
  },
  {
    id: "desmos",
    name: "Desmos Calculator",
    title: "Desmos | Graphing Calculator",
    favicon: "https://www.desmos.com/favicon.ico",
    badge: "Math",
  },
  {
    id: "canvas",
    name: "Canvas LMS",
    title: "Canvas: Dashboard",
    favicon: "https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico",
    badge: "Canvas",
  },
  {
    id: "aboutblank",
    name: "about:blank (Default)",
    title: "about:blank",
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='7' fill='%2364748b'/></svg>",
    badge: "Stealth",
  },
];

export const DEFAULT_SANDBOX_CONFIG: SandboxPolicyConfig = {
  allowScripts: true,
  allowSameOrigin: true,
  allowForms: true, // Needed for DuckDuckGo search queries
  allowPopups: true, // CRITICAL: Makes search result links clickable without silent aborts
  allowPopupsToEscapeSandbox: true, // CRITICAL: Allows links with target="_blank" to render properly
  allowTopNavigationByActivation: true,
  allowModals: true,
  allowDownloads: true,
};

export function buildSandboxString(config: SandboxPolicyConfig): string {
  const tokens: string[] = [];
  if (config.allowScripts) tokens.push("allow-scripts");
  if (config.allowSameOrigin) tokens.push("allow-same-origin");
  if (config.allowForms) tokens.push("allow-forms");
  if (config.allowPopups) tokens.push("allow-popups");
  if (config.allowPopupsToEscapeSandbox) tokens.push("allow-popups-to-escape-sandbox");
  if (config.allowTopNavigationByActivation) tokens.push("allow-top-navigation-by-user-activation");
  if (config.allowModals) tokens.push("allow-modals");
  if (config.allowDownloads) tokens.push("allow-downloads");
  return tokens.join(" ");
}

/**
 * Executes true about:blank cloaking in a new browser window.
 * The client browser's address bar displays 'about:blank',
 * while embedding the application or target URL inside a full-bleed sandboxed iframe.
 */
export function launchAboutBlankWindow(
  targetUrl: string,
  disguise: TabDisguise = DEFAULT_DISGUISES[0],
  sandboxConfig: SandboxPolicyConfig = DEFAULT_SANDBOX_CONFIG
): boolean {
  try {
    const win = window.open("about:blank", "_blank");
    if (!win || win.closed) {
      return false;
    }

    // Set tab disguise (Title & Favicon)
    win.document.title = disguise.title;

    if (disguise.favicon) {
      let iconLink = win.document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!iconLink) {
        iconLink = win.document.createElement("link");
        iconLink.type = "image/x-icon";
        iconLink.rel = "shortcut icon";
        win.document.getElementsByTagName("head")[0]?.appendChild(iconLink);
      }
      iconLink.href = disguise.favicon;
    }

    // Prepare container styling to remove borders and padding
    win.document.body.style.margin = "0";
    win.document.body.style.padding = "0";
    win.document.body.style.height = "100vh";
    win.document.body.style.overflow = "hidden";
    win.document.body.style.background = "#0f172a";

    // Create the sandboxed iframe
    const iframe = win.document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.bottom = "0";
    iframe.style.right = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.overflow = "hidden";
    iframe.style.zIndex = "999999";

    // Set sandbox tokens
    const sandboxStr = buildSandboxString(sandboxConfig);
    iframe.setAttribute("sandbox", sandboxStr);

    // Resolve URL: if relative or our own site, pass full origin URL
    let finalUrl = targetUrl;
    if (targetUrl.startsWith("/")) {
      finalUrl = window.location.origin + targetUrl;
    }

    iframe.src = finalUrl;
    win.document.body.appendChild(iframe);

    return true;
  } catch (err) {
    console.error("Failed to launch about:blank cloak:", err);
    return false;
  }
}

/**
 * Panic trigger to immediately replace page with safe decoy
 */
export function triggerPanic(redirectUrl = "https://google.com") {
  window.location.replace(redirectUrl);
}
