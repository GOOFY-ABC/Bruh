import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// API: DuckDuckGo Autocomplete Suggestions
app.get("/api/ddg/suggest", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      return res.json([]);
    }
    const response = await fetch(
      `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (!response.ok) {
      return res.json([]);
    }
    const data = await response.json();
    // data is usually [query, [suggestions...]]
    const suggestions = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    res.json(suggestions);
  } catch (error) {
    console.error("DDG suggest error:", error);
    res.json([]);
  }
});

// API: DuckDuckGo Instant Answer / Deep Search
app.get("/api/ddg/search", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      return res.json({ results: [], abstract: null });
    }
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(
        q
      )}&format=json&no_redirect=1&no_html=1&skip_disambig=0`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (!response.ok) {
      return res.json({ results: [], abstract: null });
    }
    const data = await response.json();

    const results: Array<{ title: string; snippet: string; url: string }> = [];

    // Check RelatedTopics
    if (Array.isArray(data.RelatedTopics)) {
      for (const item of data.RelatedTopics) {
        if (item.Text && item.FirstURL) {
          results.push({
            title: item.Text.split(" - ")[0] || item.Text.slice(0, 40),
            snippet: item.Text,
            url: item.FirstURL,
          });
        } else if (Array.isArray(item.Topics)) {
          for (const subItem of item.Topics) {
            if (subItem.Text && subItem.FirstURL) {
              results.push({
                title: subItem.Text.split(" - ")[0] || subItem.Text.slice(0, 40),
                snippet: subItem.Text,
                url: subItem.FirstURL,
              });
            }
          }
        }
      }
    }

    // Check Results array
    if (Array.isArray(data.Results)) {
      for (const item of data.Results) {
        if (item.FirstURL) {
          results.push({
            title: item.Text || item.FirstURL,
            snippet: item.Text || "",
            url: item.FirstURL,
          });
        }
      }
    }

    res.json({
      heading: data.Heading || q,
      abstract: data.AbstractText || null,
      abstractSource: data.AbstractSource || null,
      abstractURL: data.AbstractURL || null,
      image: data.Image || null,
      results,
    });
  } catch (error) {
    console.error("DDG search error:", error);
    res.status(500).json({ error: "Failed to fetch search results" });
  }
});

// API: Web & Frame Proxy (Strips X-Frame-Options & CSP to enable sandboxed iframe embedding)
app.get("/api/proxy", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    // Validate protocol
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
    } catch {
      return res.status(400).send("Invalid target URL");
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "text/html";

    // Strip frame-blocking headers
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Content-Security-Policy");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

    if (contentType.includes("text/html")) {
      let html = await response.text();
      const origin = parsedUrl.origin;

      // Inject base tag so relative resources load from the source domain
      const baseTag = `<base href="${parsedUrl.href}">`;

      // Helper script to ensure links inside sandboxed iframe are fully clickable and handle navigation
      const clickFixerScript = `
        <script>
          (function() {
            // Ensure all links don't break out or fail in sandboxed iframes
            document.addEventListener('DOMContentLoaded', function() {
              const links = document.querySelectorAll('a');
              links.forEach(function(a) {
                // If link has target="_top" or "_parent", change to "_self" so it stays in frame
                if (a.target === '_top' || a.target === '_parent') {
                  a.target = '_self';
                }
              });
            });

            // Catch dynamically clicked links
            document.addEventListener('click', function(e) {
              const anchor = e.target.closest('a');
              if (anchor && anchor.href) {
                try {
                  const url = new URL(anchor.href, window.location.href);
                  // Notify parent window of navigation if permitted
                  if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: 'CLOAK_FRAME_NAV', url: url.href, title: document.title }, '*');
                  }
                } catch(err) {}
              }
            }, true);
          })();
        </script>
      `;

      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}${clickFixerScript}`);
      } else if (html.includes("<html>")) {
        html = html.replace("<html>", `<html><head>${baseTag}${clickFixerScript}</head>`);
      } else {
        html = `${baseTag}${clickFixerScript}${html}`;
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } else {
      // Non-HTML content (images, styles, json)
      res.setHeader("Content-Type", contentType);
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (error: any) {
    console.error("Proxy error:", error);
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #0f172a; color: #e2e8f0; text-align: center; }
            .card { max-width: 480px; margin: 40px auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background: #1e293b; }
            h2 { color: #f87171; margin-top: 0; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            a { color: #38bdf8; text-decoration: none; word-break: break-all; }
            button { margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Unable to Load Frame</h2>
            <p>Target site could not be rendered inside the sandboxed proxy: <strong>${escapeHtml(
              targetUrl
            )}</strong></p>
            <p>${escapeHtml(error.message || "Connection refused")}</p>
            <button onclick="window.open('${escapeHtml(targetUrl)}', '_blank')">Open Directly</button>
          </div>
        </body>
      </html>
    `);
  }
});

function escapeHtml(str: string) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", cloaking: "active" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DuckDuckGo Cloaked Browser running on port ${PORT}`);
  });
}

startServer();
