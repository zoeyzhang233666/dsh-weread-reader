export const CSS_VERSION = '2026-11-24-discrete-pages'

/** ChemClaw Paper light palette as fallbacks; prefer live --bt-* when present. */
export const CSS = `
.wrr-root {
  --wrr-bg: var(--bt-main, #faf9f5);
  --wrr-sidebar: var(--bt-sidebar, #f3f0e8);
  --wrr-panel: var(--bt-card, #f6f3eb);
  --wrr-bubble: var(--bt-bubble, #ebe7dc);
  --wrr-ink: var(--bt-ink, #1f1e1b);
  --wrr-muted: var(--bt-ink-2, rgba(31, 30, 27, 0.6));
  --wrr-faint: var(--bt-ink-3, rgba(31, 30, 27, 0.36));
  --wrr-line: var(--bt-line, rgba(31, 30, 27, 0.08));
  --wrr-line-2: var(--bt-line-2, rgba(31, 30, 27, 0.15));
  --wrr-hover: var(--bt-hover, rgba(119, 119, 119, 0.09));
  --wrr-active: var(--bt-active, rgba(119, 119, 119, 0.17));
  --wrr-accent: var(--bt-accent, #d97757);
  --wrr-accent-ink: var(--bt-accent-ink, #ffffff);
  --wrr-font-scale: 1;
  --wrr-page-gap: 0px;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--wrr-bg);
  color: var(--wrr-ink);
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans SC", sans-serif;
}
.wrr-top {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--wrr-line);
  background: var(--wrr-sidebar);
  flex: none;
}
.wrr-tab, .wrr-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--wrr-ink);
  border-radius: 8px;
  padding: 6px 11px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color .12s ease;
}
.wrr-tab:hover, .wrr-btn:hover:not(:disabled) { background: var(--wrr-hover); }
.wrr-tab[data-active="1"] {
  background: var(--wrr-bubble);
  font-weight: 600;
}
.wrr-btn.primary {
  background: var(--wrr-accent);
  color: var(--wrr-accent-ink);
}
.wrr-btn.primary:hover:not(:disabled) {
  filter: brightness(0.97);
  background: var(--wrr-accent);
}
.wrr-btn:disabled { opacity: 0.4; cursor: default; }
.wrr-btn[data-active="1"]:not(.primary) {
  background: color-mix(in srgb, var(--wrr-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--wrr-accent) 35%, transparent);
}
.wrr-btn.compact {
  padding: 4px 9px;
  font-size: 12px;
}
.wrr-spacer { flex: 1; }
.wrr-meta {
  font-size: 12px;
  color: var(--wrr-muted);
}
.wrr-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 20px;
  user-select: text;
  -webkit-user-select: text;
}
.wrr-body[data-mode="reading"] {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.wrr-error {
  margin: 12px 14px 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--wrr-accent) 45%, var(--wrr-line));
  background: color-mix(in srgb, var(--wrr-accent) 10%, var(--wrr-panel));
  color: var(--wrr-ink);
  font-size: 13px;
  flex: none;
}
.wrr-login {
  max-width: 420px;
  margin: 24px auto;
  display: grid;
  gap: 12px;
  text-align: center;
}
.wrr-login h3 { margin: 0; font-size: 18px; }
.wrr-login p { margin: 0; color: var(--wrr-muted); font-size: 13px; line-height: 1.5; }
.wrr-qr { display: grid; gap: 8px; justify-items: center; }
.wrr-qr img {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--wrr-line);
}
.wrr-qr-status, .wrr-qr-placeholder {
  font-size: 13px;
  color: var(--wrr-muted);
}
.wrr-qr-placeholder {
  min-height: 240px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--wrr-line-2);
  border-radius: 12px;
  background: var(--wrr-panel);
}
.wrr-otp { display: flex; gap: 8px; justify-content: center; }
.wrr-otp input {
  width: 120px;
  border: 1px solid var(--wrr-line-2);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--wrr-bg);
  color: inherit;
}
.wrr-login-actions { display: flex; gap: 8px; justify-content: center; }
.wrr-shelf { display: grid; gap: 8px; }
.wrr-reading {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.wrr-reader-chrome {
  flex: none;
  padding: 10px 14px 8px;
}
.wrr-reader-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.wrr-reader-head h2 {
  margin: 0;
  font-size: 15px;
  flex: 1 1 120px;
  font-weight: 600;
}
.wrr-book {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--wrr-line);
  border-radius: 12px;
  background: var(--wrr-panel);
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.wrr-book:hover { background: var(--wrr-hover); }
.wrr-book img, .wrr-book > div:first-child {
  width: 48px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  background: var(--wrr-bubble);
}
.wrr-book strong { display: block; font-size: 14px; }
.wrr-book span { color: var(--wrr-muted); font-size: 12px; }
.wrr-toc {
  display: grid;
  gap: 2px;
  max-height: 180px;
  overflow: auto;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--wrr-line);
  border-radius: 10px;
  background: var(--wrr-panel);
}
.wrr-batch {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--wrr-line);
  border-radius: 10px;
  background: var(--wrr-panel);
}
.wrr-batch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.wrr-batch input[type="text"] {
  flex: 1 1 140px;
  min-width: 0;
  border: 1px solid var(--wrr-line-2);
  border-radius: 8px;
  padding: 7px 10px;
  background: var(--wrr-bg);
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.wrr-toc-item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 6px 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.wrr-toc-item:hover { background: var(--wrr-hover); }
.wrr-toc-item[data-active="1"] {
  background: color-mix(in srgb, var(--wrr-accent) 12%, transparent);
}
.wrr-toc-item[data-picked="1"] {
  box-shadow: inset 3px 0 0 var(--wrr-accent);
}
.wrr-toc-index {
  flex: none;
  width: 2.2em;
  color: var(--wrr-faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.wrr-toc-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.35;
}
.wrr-page-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 18px 22px 24px;
  box-sizing: border-box;
  border-top: 1px solid var(--wrr-line);
  background: var(--wrr-bg);
}
.wrr-page-clip {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  contain: strict;
  cursor: pointer;
  background: var(--wrr-bg);
}
.wrr-page-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  height: 100%;
  will-change: transform;
  transform: translate3d(0, 0, 0);
}
.wrr-page {
  flex: none;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  font-size: calc(16px * var(--wrr-font-scale));
  line-height: 1.85;
  letter-spacing: 0.01em;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}
.wrr-page h3 {
  margin: 0 0 14px;
  padding: 0;
  font-size: 1.05em;
  font-weight: 600;
  color: var(--wrr-muted);
}
.wrr-page p {
  margin: 0 0 1em;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.wrr-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--wrr-faint);
  font-size: 13px;
}
.wrr-toast {
  position: absolute;
  left: 50%;
  bottom: 78px;
  transform: translateX(-50%);
  z-index: 5;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(31, 30, 27, 0.88);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
.wrr-bottom-nav {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--wrr-line);
  background: var(--wrr-sidebar);
  flex: none;
}
.wrr-page-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--wrr-line-2);
  border-radius: 10px;
  background: var(--wrr-panel);
  color: var(--wrr-ink);
  font-size: 18px;
  cursor: pointer;
}
.wrr-page-btn:disabled { opacity: 0.35; cursor: default; }
.wrr-page-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.wrr-page-info strong {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wrr-page-info span { font-size: 11px; color: var(--wrr-muted); }
.wrr-bottom-actions {
  display: flex;
  gap: 6px;
  flex: none;
}
`
