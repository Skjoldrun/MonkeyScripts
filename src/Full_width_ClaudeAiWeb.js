// ==UserScript==
// @name         Claude.ai – Full Width Layout
// @version      1.0.0
// @description  Dynamically expands claude.ai to use the full available screen width
// @website      https://skjoldrun.github.io/
// @author       Skjoldrun
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @match        https://claude.ai/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ─── Configuration ───────────────────────────────────────────────────────────
  const CONFIG = {
    // Fraction of the available viewport to use (0.9 = 90%)
    widthFraction: 0.90,

    // Sidebar width in pixels (left navigation panel)
    sidebarWidth: 260,

    // Minimum content padding on each side (px) – prevents content from touching edges
    minPadding: 16,

    // Storage key for persisting the toggle state across sessions
    storageKey: 'claudeFullWidth_enabled',

    // How long (ms) to wait for dynamic DOM changes before re-applying styles
    debounceDelay: 150,

    // CSS selector poll interval (ms) – used until the main layout element is found
    pollInterval: 300,

    // Maximum number of polling attempts before giving up
    maxPollAttempts: 60,
  };

  // ─── State ───────────────────────────────────────────────────────────────────
  let enabled = GM_getValue(CONFIG.storageKey, true);
  let toggleButton = null;
  let mutationObserver = null;
  let resizeObserver = null;
  let pollAttempts = 0;

  // ─── CSS injected unconditionally (resets that are safe regardless of state) ─
  GM_addStyle(`
    /* Smooth transition for all layout shifts */
    .full-width-transition,
    .full-width-transition * {
      transition: max-width 0.25s ease, width 0.25s ease, padding 0.25s ease !important;
    }

    /* Toggle button styling */
    #claude-fw-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: rgba(30, 30, 35, 0.85);
      backdrop-filter: blur(8px);
      color: #e0e0e0;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
      user-select: none;
    }
    #claude-fw-toggle:hover {
      transform: scale(1.12);
      background: rgba(50, 50, 60, 0.95);
      border-color: rgba(255,255,255,0.3);
    }
    #claude-fw-toggle.active {
      border-color: #7c6af7;
      color: #a89cf7;
    }
    #claude-fw-toggle[title]:hover::after {
      content: attr(title);
      position: absolute;
      right: 46px;
      bottom: 6px;
      background: rgba(20,20,25,0.92);
      color: #ddd;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
    }
  `);

  // ─── Dynamic style element – injected immediately so styles fire before first paint ──
  // With @run-at document-start, <head> may not exist yet; use a listener to attach early.
  const styleEl = document.createElement('style');
  styleEl.id = 'claude-fw-dynamic-styles';

  function attachStyleEl() {
    if (!styleEl.isConnected) {
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  // Try immediately, then ensure it's attached once <head> is available
  attachStyleEl();
  document.addEventListener('DOMContentLoaded', attachStyleEl, { once: true });

  /**
   * Build CSS rules that expand the conversation/content containers to full width.
   * All selectors are kept as specific as possible to avoid collateral damage.
   */
  function buildFullWidthCSS() {
    const vw = window.innerWidth;
    // Available space = viewport minus the sidebar, then apply the fraction cap
    const available = (vw - CONFIG.sidebarWidth) * CONFIG.widthFraction;
    const contentWidth = Math.max(available - CONFIG.minPadding * 2, 400); // floor at 400px

    return `
      /* ── Main conversation column ─────────────────────────── */
      /* Outer prose wrapper that Claude uses to constrain line length */
      .mx-auto.w-full,
      [class*="prose"]:not(code):not(pre),
      [class*="max-w-"] {
        max-width: ${contentWidth}px !important;
        width: 100% !important;
      }

      /* ── Primary chat content containers ─────────────────── */
      /* The scrollable message list */
      main > div,
      main [data-testid="conversation-turn"],
      main [class*="grid"],
      main [class*="flex"][class*="flex-col"] {
        max-width: ${contentWidth}px !important;
      }

      /* Explicit message bubble / turn wrappers */
      [class*="ContentBlock"],
      [class*="messageWrapper"],
      [class*="message-"],
      [class*="chat-message"],
      [class*="ConversationTurn"],
      [class*="turn-"] {
        max-width: ${contentWidth}px !important;
      }

      /* ── Input / prompt area ──────────────────────────────── */
      /* The sticky footer input box – use the same width cap so it aligns with content */
      footer,
      footer > *,
      [class*="inputArea"],
      [class*="promptInput"],
      [class*="PromptTextArea"],
      fieldset {
        max-width: ${contentWidth}px !important;
        width: 100% !important;
      }

      /* ── Code blocks (preserve horizontal scroll) ─────────── */
      pre, pre code {
        max-width: 100% !important;
        overflow-x: auto !important;
      }

      /* ── Responsive padding clamp ─────────────────────────── */
      main {
        padding-left: ${CONFIG.minPadding}px !important;
        padding-right: ${CONFIG.minPadding}px !important;
      }
    `;
  }

  /** Apply or remove the full-width styles depending on `enabled`. */
  function applyStyles() {
    if (enabled) {
      styleEl.textContent = buildFullWidthCSS();
    } else {
      styleEl.textContent = ''; // Reset – let Claude's own CSS take over
    }
    syncToggleButton();
  }

  // Debounce helper to avoid thrashing during rapid DOM/resize events
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedApply = debounce(applyStyles, CONFIG.debounceDelay);

  // ─── Toggle button ────────────────────────────────────────────────────────────

  function createToggleButton() {
    if (document.getElementById('claude-fw-toggle')) return;

    toggleButton = document.createElement('button');
    toggleButton.id = 'claude-fw-toggle';
    toggleButton.title = enabled ? 'Disable full width' : 'Enable full width';
    toggleButton.innerHTML = '⤢'; // expand icon

    toggleButton.addEventListener('click', () => {
      enabled = !enabled;
      GM_setValue(CONFIG.storageKey, enabled);
      applyStyles();
    });

    document.body.appendChild(toggleButton);
    syncToggleButton();
  }

  function syncToggleButton() {
    if (!toggleButton) return;
    toggleButton.classList.toggle('active', enabled);
    toggleButton.title = enabled ? 'Disable full width' : 'Enable full width';
    toggleButton.innerHTML = enabled ? '⤢' : '⤡';
  }

  // ─── Observers ────────────────────────────────────────────────────────────────

  /** Watch for Claude's SPA navigation and DOM mutations to keep styles applied. */
  function startMutationObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver(debouncedApply);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  }

  /** Re-calculate on window resize so padding/widths stay accurate. */
  function startResizeObserver() {
    if (resizeObserver) return;

    resizeObserver = new ResizeObserver(debouncedApply);
    resizeObserver.observe(document.documentElement);
  }

  // ─── SPA navigation (History API) ────────────────────────────────────────────

  // Claude is a React SPA – intercept pushState/replaceState to reapply after route changes
  function patchHistoryAPI() {
    const wrap = (original) =>
      function (...args) {
        const result = original.apply(this, args);
        // Give the new page a moment to render before re-applying
        setTimeout(debouncedApply, 300);
        return result;
      };

    history.pushState    = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', debouncedApply);
  }

  // ─── Polling until the DOM is ready ──────────────────────────────────────────

  /**
   * Claude loads dynamically. Poll until `main` exists so we know
   * the core layout is rendered before injecting styles.
   */
  function waitForLayout() {
    const check = setInterval(() => {
      pollAttempts++;

      if (document.querySelector('main') || pollAttempts >= CONFIG.maxPollAttempts) {
        clearInterval(check);
        init();
      }
    }, CONFIG.pollInterval);
  }

  // ─── Initialisation ───────────────────────────────────────────────────────────

  function init() {
    applyStyles();
    createToggleButton();
    startMutationObserver();
    startResizeObserver();
    patchHistoryAPI();

    console.info(
      `[claude-full-width] Initialised – full width ${enabled ? 'ON' : 'OFF'}. ` +
      'Use the ⤢ button (bottom-right) to toggle.'
    );
  }

  // Kick off – apply styles immediately so they fire on first paint,
  // then wait for the full layout before attaching observers and the toggle button.
  applyStyles();
  waitForLayout();

})();