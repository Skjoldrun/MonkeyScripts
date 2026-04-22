// ==UserScript==
// @name         ChatGPT – Full Width Layout
// @version      1.0.0
// @description  Dynamically expands chat.openai.com to use the full available screen width
// @author       Skjoldrun
// @website      https://skjoldrun.github.io/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/* global GM_addStyle, GM_getValue, GM_setValue */

console.info("%c'ChatGPT – Full Width Layout' userscript is connected", 'color: #8ff; background: #000');

(function () {
	// ─── Configuration ───────────────────────────────────────────────────────────
	// Storage key for persisting the toggle state across sessions
	const storageKey = 'chatgptFullWidth_enabled';

	// ─── State ───────────────────────────────────────────────────────────────────
	let enabled = GM_getValue(storageKey, true);
	let toggleButton = null;
	let mutationObserver = null;

	// ─── Selectors ───────────────────────────────────────────────────────────────
	const SELECTORS = {
		PROMPT_INPUT: `div#prompt-textarea.ProseMirror`,
		SIDEBAR: `#stage-slideover-sidebar[style*="sidebar-width"]`,
		CHAT_MESSAGE: `[data-turn]`,
	};

	// ─── Prevent ChatGPT bug with PageUp/PageDown in textarea ────────────────────
	document.addEventListener('keydown', function (e) {
		if (
			(e.key === 'PageUp' || e.key === 'PageDown') &&
			e.target.matches(SELECTORS.PROMPT_INPUT)
		) {
			e.preventDefault();
		}
	});

	// ─── Static styles (toggle button) ───────────────────────────────────────────
	GM_addStyle(`
		/* Toggle button styling */
		#chatgpt-fw-toggle {
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
		#chatgpt-fw-toggle:hover {
			transform: scale(1.12);
			background: rgba(50, 50, 60, 0.95);
			border-color: rgba(255,255,255,0.3);
		}
		#chatgpt-fw-toggle.active {
			border-color: #19c37d;
			color: #19c37d;
		}
		#chatgpt-fw-toggle[title]:hover::after {
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

	// ─── Dynamic style element ────────────────────────────────────────────────────
	// Injected into <head> so we can update or clear it on toggle
	const styleEl = document.createElement('style');
	styleEl.id = 'chatgpt-fw-dynamic-styles';
	(document.head || document.documentElement).appendChild(styleEl);

	// ─── Settings ─────────────────────────────────────────────────────────────────
	const accentForDark = `#f39c12`;

	const defaultSettings = {
		/* CHAT ELEMENTS */

		chatWidth: {
			enabled: true,
			maxWidth: `90%`,
		},

    userInputWidth: {
			enabled: true,
			maxWidth: `70%`,
    },

    projectScreenWidth: {
			enabled: true,
			maxWidth: `70vw`,
    },

		textAreaHeight: {
			enabled: true,
			maxHeight: '50dvh',
		},

		codeBlockFont: {
			enabled: true,
			fontFamily: `Consolas`,
		},

		codeBlockBackground: {
			enabled: true,
			bgColorDark: `#181818`,
			// bgColorLight: `#252525`,
		},

		codeBlockLineBreaks: { enabled: true },
		inlineCodeColor: { enabled: true },
		codeBlocksInUserMessages: { enabled: true },

		userMessageVisibility: {
			enabled: true,
			backgroundDark: `linear-gradient(135deg, #34437a, #2b2f54)`,
			backgroundLight: `#c1d6f6`,
		},

		botAvatarVisibility: { enabled: true },

		botThinkingHeadings: {
			enabled: true,
			colorDark: `#66ceff`,
			colorLight: `#0047c2`,
		},

    responseVariantsVisibility: { enabled: true },

    tableMargins: { enabled: true },

		/* TOP BAR */

		topBarTransparency: { enabled: true },

		projectChatNameVisibility: { enabled: true },

		gptVersionVisibility: {
			enabled: true,
			color: accentForDark,
		},

		/* SIDEBAR */

		sidebarWidth: {
			enabled: true,
			sidebarWidth: `330px`,
		},
		sidebarHeadingsVisibility: {
			enabled: true,
			color: accentForDark,
		},
		multilineHistoryTitles: {
			enabled: true,
		},

		/* MISC (chatGPT) */

		// modal in Personalisation > Memory height
		saneModalHeight: {
			enabled: true,
		},

    projectChatsSubtitles: {
      enabled: true,
    },

    projectChatsListWidth: {
      enabled: true,
    },

    projectChatsPaddings: {
      enabled: true,
    },

    /* CODEX */
    inTaskTextAreaSize: {
      enabled: true,
    },
	};

	// ─── CSS construction ─────────────────────────────────────────────────────────
	const constructFeaturesCss = () => {
		const cssByFeature = {
			/* ── CHAT ELEMENTS ───────────────────────────────────────────────────────── */

			/* Main chat section width */
			chatWidth: `
				@container (min-width: 768px) {
					${SELECTORS.CHAT_MESSAGE} > div > .\\[--thread-content-max-width\\:40rem\\] {
						max-width: ${defaultSettings.chatWidth.maxWidth} !important;
					}

					/* Deep Research containers */
					${SELECTORS.CHAT_MESSAGE} > div > .\\[--thread-content-max-width\\:40rem\\] .p-4.sm\\:p-8,
					${SELECTORS.CHAT_MESSAGE} > div > .\\[--thread-content-max-width\\:40rem\\] .p-4.sm\\:p-8 > .\\[--thread-content-max-width\\:40rem\\] {
						max-width: 100%;
					}
				}
			`,

			userInputWidth: `
				@container (min-width: 768px) {
          #thread-bottom-container .\\[--thread-content-max-width\\:40rem\\] {
            max-width: ${defaultSettings.userInputWidth.maxWidth} !important;
          }
				}
			`,

			projectScreenWidth: `
				@container (min-width: 850px) {
          .px-\\(--thread-content-margin\\).h-full > .mx-auto.flex.max-w-\\(--thread-content-max-width\\).flex-1.text-base.flex-col {
            max-width: ${defaultSettings.projectScreenWidth.maxWidth} !important;
          }
				}
			`,

			textAreaHeight: `
				@media (min-width: 768px) {
					.max-h-\\[25dvh\\].overflow-auto {
						max-height: ${defaultSettings.textAreaHeight.maxHeight};
					}
				}
			`,

			/* Code blocks font */
			codeBlockFont: `
				code, pre {
					font-family: ${defaultSettings.codeBlockFont.fontFamily}, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace !important;
				}
			`,

			/* Code blocks background color */
			codeBlockBackground: `
				/* DARK */
				html.dark pre > div.rounded-md {
					background-color: ${defaultSettings.codeBlockBackground.bgColorDark};
				}
			`,

			// Break lines in code blocks (both chatGPT and user messages)
			codeBlockLineBreaks: `
				@media (min-width: 768px) {
					pre .cm-content,
					pre.overflow-x-auto > code {
						white-space: pre-wrap !important;
						overflow-wrap: anywhere !important;
						min-width: unset !important;
					}
				}
			`,

      inlineCodeColor: `
        html.dark [data-message-author-role="user"] div > code,
				html.dark .prose code:not(:where(pre code)) {
	        color: #eab38a;
	        background: #272727;
	        border: 1px solid rgba(94, 93, 89, 0.25);
        }
        html.dark .prose a>code:not(:where(pre code)) {
	        color: inherit;
        }
      `,

			/* Code blocks inside user messages */
			codeBlocksInUserMessages: `
				/* inline code */
				[data-message-author-role="user"] div > code {
					font-size: 14px;
					background: #00000030 !important;
					border-radius: .25rem;
					padding: 1px 5px;
					border: 1px solid #00000026 !important;
				}

				/* multiline code blocks */
				[data-message-author-role="user"] pre {
					background: #00000030;
					padding: 2px 7px;
					border-radius: 11px;
				}

				/* multiline code blocks FONT SIZE */
				[data-message-author-role="user"] pre > code {
					font-size: 14px;
				}
			`,

			/* Make our messages more visible. */
			userMessageVisibility: `
				/* DARK */
				html.dark [data-message-author-role="user"].text-message > .w-full > .user-message-bubble-color {
					background: ${defaultSettings.userMessageVisibility.backgroundDark};
				}

				/* LIGHT */
				html.light [data-message-author-role="user"].text-message > .w-full > .user-message-bubble-color {
					background: ${defaultSettings.userMessageVisibility.backgroundLight};
				}
			`,

			/* Make bot message start more visible by increasing visibility of its avatar. */
			botAvatarVisibility: `
				/* DARK */
				html.dark .gizmo-bot-avatar > div {
					background: linear-gradient(45deg, #3F51B5, #00BCD4);
				}
				html.dark .gizmo-bot-avatar {
					outline: none;
				}

				/* LIGHT */
				html.light .gizmo-bot-avatar > div {
					background: #252525;
					color: #ffffff;
				}
			`,

			botThinkingHeadings: `
			  html.dark ${SELECTORS.CHAT_MESSAGE} p strong.font-semibold.text-token-text-primary {
			  	color: ${defaultSettings.botThinkingHeadings.colorDark};
			  }
		  	html.light ${SELECTORS.CHAT_MESSAGE} p strong.font-semibold.text-token-text-primary {
		  		color: ${defaultSettings.botThinkingHeadings.colorLight};
		  	}
			`,


			responseVariantsVisibility: `
			  ${SELECTORS.CHAT_MESSAGE} div.has-data-\\[state\\=open\\]\\:opacity-100:has(button[aria-label="Previous response"]) {
			  	opacity: 1 !important;
			  }
        button[aria-label="Previous response"] + div.tabular-nums {
          background: #f39c12;
	        border-radius: 6px;
	        color: #181818;
	        padding: 0 5px;
        }
			`,

      tableMargins: `
        ${SELECTORS.CHAT_MESSAGE} [class*="_tableContainer"] {
	        width: 100%;
	        max-width: 100%;
	        margin: 0;
	        scrollbar-width: auto;
          pointer-events: auto;
        }
        ${SELECTORS.CHAT_MESSAGE} [class*="_tableContainer"] > [class*="_tableWrapper"] {
	        margin: 0;
        }
      `,

			/* ── TOP BAR ─────────────────────────────────────────────────────────────── */

			/* Make top bar transparent as it consumes vertical space for no reason */
			topBarTransparency: `
				#page-header {
					background: transparent !important;
	        width: 100%;
	        box-shadow: none;
				}

				/* Background for top bar element that shows the current GPT version */
				/* DARK */
				html.dark #page-header button:not(:hover) {
					background-color: #2121218a;
					border-radius: 8px;
					backdrop-filter: blur(2px);
				}
				/* LIGHT */
				html.light #page-header button:not(:hover) {
					background-color: #ffffffb0;
					border-radius: 8px;
					backdrop-filter: blur(2px);
				}
			`,

			/* Project chat name visibility */
			projectChatNameVisibility: `
				/* DARK */
				html.dark main .sticky.top-0 .flex.items-center.gap-0.overflow-hidden button > div.truncate {
					color: #e9cc9e;
				}
				/* LIGHT */
				html.light main .sticky.top-0 .flex.items-center.gap-0.overflow-hidden button > div.truncate {
					color: #000;
				}
			`,

			/* GPT version visibility */
			gptVersionVisibility: `
				/* DARK */
				html.dark .sticky.top-0 [type="button"] > div > span.text-token-text-tertiary {
					color: ${defaultSettings.gptVersionVisibility.color};
				}
				/* LIGHT */
				html.light .sticky.top-0 [type="button"] > div > span.text-token-text-tertiary {
					color: #000;
				}
			`,

			/* ── SIDEBAR ─────────────────────────────────────────────────────────────── */

			/* Sidebar width */
			sidebarWidth: `
				@media not all and (max-width: 768px) {
					${SELECTORS.SIDEBAR},
					${SELECTORS.SIDEBAR} .w-\\(--sidebar-width\\) {
						width: ${defaultSettings.sidebarWidth.sidebarWidth} !important;
					}
				}
			`,

			/* History periods headings (like "Today", "Yesterday") visibility */
			sidebarHeadingsVisibility: `
				/* DARK */
				html.dark ${SELECTORS.SIDEBAR} h3 {
					color: ${defaultSettings.sidebarHeadingsVisibility.color};
				}

				/* LIGHT */
				html.light ${SELECTORS.SIDEBAR} h3 {
					font-weight: 700;
				}
			`,

			multilineHistoryTitles: `
				${SELECTORS.SIDEBAR} #history a[draggable="true"] .truncate {
					overflow: visible;
					white-space: normal;
				}
				${SELECTORS.SIDEBAR} #history a[draggable="true"] > div.text-token-text-tertiary.flex.items-center.self-stretch {
          position: absolute;
	        right: 5px;
	        top: 50%;
	        translate: 0 -50%;
				}
			`,

			/* ── MISC ────────────────────────────────────────────────────────────────── */
			saneModalHeight: `
				div[role="dialog"] .h-\\[24rem\\] {
					height: 75vh;
				}
			`,

      projectChatsSubtitles: `
        html.dark li.hover\\:bg-token-bg-tertiary a .text-token-text-secondary.truncate.text-sm {
	        color: #999999;
        }
      `,

      projectChatsListWidth: `
        .text-base.overflow-y-auto.my-auto.mx-auto:has(li.hover\\:bg-token-bg-tertiary) {
          width: 100%;
        }
      `,

      projectChatsPaddings: `
        li.hover\\:bg-token-bg-tertiary .group.relative.flex.flex-col.gap-1.p-4 {
	        padding-block: 8px;
        }
      `,

      inTaskTextAreaSize: `
        ._prosemirror-parent_kfgfu_2 {
          max-height: 50vh !important;
        }
      `,
		};

    const cssBase = `
      #stage-sidebar-tiny-bar {
        cursor: pointer;
      }
    `;

    let cssStyles = cssBase;

		// Combine feature CSS blocks into a single CSS string if enabled in the current settings
		for (let key in cssByFeature) {
			if (Object.prototype.hasOwnProperty.call(cssByFeature, key)) {
				if (typeof defaultSettings[key] !== 'undefined' && defaultSettings[key].enabled) {
					cssStyles += cssByFeature[key] + '\n';
				}
			}
		}

		cssStyles = cssStyles.replaceAll('\t', ' ');
		return cssStyles;
	};

	// ─── Apply / remove styles ────────────────────────────────────────────────────
	/** Apply or remove the full-width styles depending on `enabled`. */
	const applyStyles = () => {
		if (enabled) {
			styleEl.textContent = constructFeaturesCss();
		} else {
			styleEl.textContent = '';
		}
		syncToggleButton();
	};

	// ─── Toggle button ────────────────────────────────────────────────────────────
	function createToggleButton() {
		if (document.getElementById('chatgpt-fw-toggle')) return;

		toggleButton = document.createElement('button');
		toggleButton.id = 'chatgpt-fw-toggle';
		toggleButton.title = enabled ? 'Disable full width' : 'Enable full width';
		toggleButton.innerHTML = '⤢';

		toggleButton.addEventListener('click', () => {
			enabled = !enabled;
			GM_setValue(storageKey, enabled);
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

	// ─── Observer ─────────────────────────────────────────────────────────────────
	/** Watch for SPA navigation so the toggle button is re-attached after route changes. */
	function startMutationObserver() {
		if (mutationObserver) return;

		mutationObserver = new MutationObserver(() => {
			if (!document.getElementById('chatgpt-fw-toggle')) {
				createToggleButton();
			}
		});
		mutationObserver.observe(document.body, { childList: true, subtree: false });
	}

	// ─── SPA navigation (History API) ────────────────────────────────────────────
	// ChatGPT is a React SPA – intercept pushState/replaceState to re-attach the button after route changes
	function patchHistoryAPI() {
		const wrap = (original) =>
			function (...args) {
				const result = original.apply(this, args);
				setTimeout(createToggleButton, 300);
				return result;
			};
		history.pushState    = wrap(history.pushState);
		history.replaceState = wrap(history.replaceState);
		window.addEventListener('popstate', createToggleButton);
	}

	// ─── Initialisation ───────────────────────────────────────────────────────────
	function init() {
		applyStyles();
		createToggleButton();
		startMutationObserver();
		patchHistoryAPI();
		console.info(
			`[chatgpt-full-width] Initialised – full width ${enabled ? 'ON' : 'OFF'}. ` +
			'Use the ⤢ button (bottom-right) to toggle.'
		);
	}

	init();
})();
