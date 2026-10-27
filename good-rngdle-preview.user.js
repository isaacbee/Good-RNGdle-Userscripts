// ==UserScript==
// @name         Good RNGdle Number Preview
// @namespace    https://prod.kr/
// @version      1.7.0
// @description  Preview the cards' badges, EP, and rarity before choosing a number.
// @author       isaacbee
// @match        https://prod.kr/dle/2
// @run-at       document-idle
// @icon         https://prod.kr/images/icon/dle.png
// @license      GPL-3.0
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    // Avoid installing duplicate controls if the userscript runs more than once.
    if (window.__goodRngdlePreviewInstalled) return;
    window.__goodRngdlePreviewInstalled = true;

    const style = document.createElement("style");
    style.textContent = `
        #grng-preview {
            margin: 14px auto 20px;
            box-sizing: border-box;
            color: #fff;
            font: inherit;
        }
        #grng-preview[hidden] {
            display: none !important;
        }
        #grng-preview-toggle {
            padding: 8px 14px;
            border: 1px solid #fff;
            border-radius: 6px;
            background: transparent;
            color: #fff;
            cursor: pointer;
            font: inherit;
        }
        #grng-preview-toggle[hidden] {
            display: none !important;
        }
        #grng-preview-toggle:hover {
            filter: brightness(1.2);
        }
        #grng-preview-panel {
            display: flex;
            box-sizing: border-box;
            max-height: 40vh;
            margin-top: 10px;
            overflow: auto;
            text-align: left;
            align-items: stretch;
        }
        #grng-preview-panel[hidden] {
            display: none !important;
        }
        .grng-preview-card {
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            padding: 10px;
            border: 1px solid #fff;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.35);
            color: #fff;
        }
        .grng-preview-card h2 {
            margin: 0 0 6px;
            font: inherit;
            font-weight: bold;
        }
        .grng-preview-card p {
            margin: 4px 0;
        }
        .grng-preview-card ul {
            margin: 4px 0 0;
            padding: 0;
            list-style: none;
        }
        .grng-preview-card li {
            display: inline;
            margin: 1px 2px;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        .grng-preview-card li:not(:last-child)::after {
            content: " |";
            color: #fff;
        }
    `;
    document.head.append(style);

    const previewRoot = document.createElement("section");
    previewRoot.id = "grng-preview";
    previewRoot.setAttribute("aria-label", "Candidate previews");

    const toggle = document.createElement("button");
    toggle.id = "grng-preview-toggle";
    toggle.type = "button";
    toggle.textContent = "Show info";
    toggle.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.id = "grng-preview-panel";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");

    previewRoot.hidden = true;
    toggle.hidden = true;
    let lastCandidates = [];

    // Collapse the details and keep the toggle's label and accessibility state in sync.
    function hidePreviewInfo() {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Show info";
    }

    // Toggle the candidate details without affecting the game's card selection.
    toggle.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        toggle.textContent = panel.hidden ? "Show info" : "Hide info";
    });

    previewRoot.append(toggle, panel);

    // Place the preview toggle beside Change Fate and the details beneath the cards.
    function installPreviewUI() {
        const postroll = document.querySelector("#postroll");
        if (!postroll || previewRoot.isConnected) return Boolean(postroll);
        const rerollButton = document.querySelector("#reroll");
        if (rerollButton) postroll.insertBefore(toggle, rerollButton.nextSibling);
        postroll.append(previewRoot);
        return true;
    }

    if (!installPreviewUI()) {
        // Wait for the game to create its roll UI before installing the preview controls.
        const observer = new MutationObserver(() => {
            if (installPreviewUI()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Match each details card's width, spacing, and horizontal position to its game card.
    function alignPreviewCards(candidates) {
        const inner = document.querySelector("#postroll-inner");
        if (!inner || candidates.length === 0) return;

        const cards = [...inner.querySelectorAll(".card-outer .card")];
        if (cards.length === 0) return;

        const innerRect = inner.getBoundingClientRect();
        const firstRect = cards[0].getBoundingClientRect();
        const lastRect = cards[cards.length - 1].getBoundingClientRect();
        if (innerRect.width === 0 || firstRect.width === 0) return;

        previewRoot.style.width = `${innerRect.width}px`;
        previewRoot.style.transform = "none";
        const previewLeft = previewRoot.getBoundingClientRect().left;
        previewRoot.style.transform = `translateX(${innerRect.left - previewLeft}px)`;
        panel.style.paddingLeft = `${Math.max(0, firstRect.left - innerRect.left)}px`;
        panel.style.paddingRight = `${Math.max(0, innerRect.right - lastRect.right)}px`;
        panel.style.columnGap = "0";

        const previewCards = [...panel.querySelectorAll(".grng-preview-card")];
        cards.forEach((gameCard, index) => {
            const rect = gameCard.getBoundingClientRect();
            const nextRect = cards[index + 1]?.getBoundingClientRect();
            const gap = nextRect ? Math.max(0, nextRect.left - rect.right) : 0;
            const previewCard = previewCards[index];
            if (!previewCard) return;
            previewCard.style.width = `${rect.width}px`;
            previewCard.style.flex = `0 0 ${rect.width}px`;
            previewCard.style.marginRight = `${gap}px`;
            const badgeList = previewCard.querySelector("ul");
            if (badgeList) {
                const fontSize = Math.min(16, Math.max(10, rect.width * 0.070));
                badgeList.style.fontSize = `${fontSize}px`;
            }
        });
    }

    // Build the preview cards from card data and keep the details collapsed initially.
    function renderCandidates(candidates) {
        lastCandidates = candidates;
        panel.replaceChildren();
        hidePreviewInfo();

        candidates.forEach((candidate, index) => {
            const card = document.createElement("article");
            card.className = "grng-preview-card";
            
            const rarityData = typeof RARITY === "undefined" ? {} : RARITY;
            const badgeData = typeof BADGES === "undefined" ? {} : BADGES;

            // Determine the rarity name and color for the card.
            const rarityName = typeof window.getRarity === "function"
                    ? window.getRarity(candidate.ep)
                    : "unknown";
            const rarityColor = rarityData[rarityName]?.color;
            
            // Create the heading element for the card: number with rarity color.
            const heading = document.createElement("h2");
            heading.textContent = `${String(candidate.number ?? "Unknown")}`;
            if (typeof rarityColor === "number") {
                heading.style.color = `#${rarityColor.toString(16).padStart(6, "0")}`;
                heading.style.fontSize = "30px";
            }
            card.append(heading);
            
            // Create the EP section for the card: EP value with rarity color and info about hidden rarity.
            const ep = document.createElement("p");
            const epValue = candidate.ep;
            ep.textContent = `${typeof epValue === "number" && Number.isFinite(epValue)
                ? new Intl.NumberFormat().format(epValue)
                : "∞"} EP${candidate.rarityHidden ? " (hidden)" : ""}`;
            if (typeof rarityColor === "number") {
                ep.style.color = `#${rarityColor.toString(16).padStart(6, "0")}`;
            }
            card.append(ep);

            // Create the badges section for the card: number of badges and a list of badges with their rarity and color.
            const rarityNames = Object.keys(rarityData);
            const badges = Object.keys(candidate.badges ?? {}).map(name => {
                const badgeInfo = badgeData[name];
                const rarity = badgeInfo
                    ? window.getRarity(name)
                    : "ancient";
                const rarityInfo = rarityData[rarity];
                return {
                    name,
                    rarity,
                    rarityIndex: rarityNames.indexOf(rarity),
                    eep: badgeInfo?.eep ?? 0,
                    color: typeof rarityInfo?.color === "number"
                        ? `#${rarityInfo.color.toString(16).padStart(6, "0")}`
                        : "#fff"
                };
            }).sort((a, b) =>
                b.rarityIndex - a.rarityIndex ||
                b.eep - a.eep ||
                a.name.localeCompare(b.name)
            );
            const badgeHeading = document.createElement("p");
            badgeHeading.textContent = `Badges (${badges.length}):`;
            card.append(badgeHeading);

            if (badges.length === 0) {
                const none = document.createElement("p");
                none.textContent = "No badges";
                card.append(none);
            } else {
                const list = document.createElement("ul");
                for (const badge of badges) {
                    const item = document.createElement("li");
                    item.textContent = badge.name;
                    item.style.color = badge.color;
                    list.append(item);
                }
                card.append(list);
            }

            panel.append(card);
        });

        previewRoot.hidden = candidates.length === 0;
        toggle.hidden = candidates.length === 0;
        alignPreviewCards(candidates);
    }

    // Recalculate widths after viewport changes or when the game's cards are recreated.
    window.addEventListener("resize", () => alignPreviewCards(lastCandidates));
    const cardObserver = new MutationObserver(() => alignPreviewCards(lastCandidates));
    const postrollInner = document.querySelector("#postroll-inner");
    if (postrollInner) cardObserver.observe(postrollInner, { childList: true, subtree: true });

    const originalSend = window.send;
    if (typeof originalSend !== "function") {
        console.error("[Good RNGdle Number Preview] Could not find the game's send() function.");
        return;
    }

    let previewTimer;
    let latestRequest = 0;

    // Observe the game's existing roll responses.
    window.send = async function (...args) {
        const action = args[0];
        if (action === "roll" || action === "reroll" || action === "pick") {
            latestRequest += 1;
            clearTimeout(previewTimer);
            previewRoot.hidden = true;
            toggle.hidden = true;
            hidePreviewInfo();
        }
        const requestId = latestRequest;
        const response = await originalSend.apply(this, args);
        if ((action === "roll" || action === "reroll") && Array.isArray(response?.state)) {
            const delay = action === "roll" ? 3000 : 1500;
            
            // Schedule the preview rendering after a delay.
            previewTimer = setTimeout(() => {
                if (requestId === latestRequest) renderCandidates(response.state);
            }, delay);
        }
        return response;
    };
})();
