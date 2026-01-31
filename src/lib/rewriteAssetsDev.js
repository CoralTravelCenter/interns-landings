export async function setupLocalCdnAssetRewrite({
                                                  root, // HTMLElement
                                                  cdnBase = "http://localhost:3001",
                                                  enabled = true,
                                                } = {}) {
  if (!enabled || !root) return;

  const isAbs = (u) =>
    /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");
  const isProtocolRelative = (u) => u.startsWith("//");
  const isRootRel = (u) => u.startsWith("/") && !isProtocolRelative(u);

  const toCdn = (u) => (isRootRel(u) ? cdnBase.replace(/\/$/, "") + u : u);

  const rewriteSrcset = (srcset) => {
    if (!srcset || typeof srcset !== "string") return srcset;
    return srcset
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((item) => {
        const [url, ...rest] = item.split(/\s+/);
        const nextUrl = toCdn(url);
        return [nextUrl, ...rest].join(" ");
      })
      .join(", ");
  };

  const rewriteEl = (el) => {
    if (!el || el.nodeType !== 1) return;

    if (el.hasAttribute?.("src")) {
      const src = el.getAttribute("src");
      if (src && !isAbs(src) && isRootRel(src)) el.setAttribute("src", toCdn(src));
    }

    if (el.hasAttribute?.("srcset")) {
      const srcset = el.getAttribute("srcset");
      const next = rewriteSrcset(srcset);
      if (next !== srcset) el.setAttribute("srcset", next);
    }

    // inline style url("/...")
    const style = el.getAttribute?.("style");
    if (style && style.includes("url(")) {
      const nextStyle = style.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (m, q, p) => {
        return `url(${q}${toCdn(p)}${q})`;
      });
      if (nextStyle !== style) el.setAttribute("style", nextStyle);
    }
  };

  const rewriteTree = (node) => {
    rewriteEl(node);
    node?.querySelectorAll?.("[src],[srcset],[style]").forEach(rewriteEl);
  };

  // 1) только внутри root
  rewriteTree(root);

  // 2) и наблюдаем только root
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") {
        rewriteEl(m.target);
      } else if (m.type === "childList") {
        m.addedNodes.forEach((n) => rewriteTree(n));
      }
    }
  });

  mo.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "style"],
  });

  return () => mo.disconnect();
}
