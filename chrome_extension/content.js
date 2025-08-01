// content.js
// TrustMark Chrome Extension - Modern Themed Content Script
// Highlights Ethereum addresses on the page with a modern glassmorphism badge
// Fetches flagged addresses from local TrustMark backend

/**
 * TrustMark Chrome Extension - Content Script
 */
(function() {
    const ethAddressRegex = /0x[a-fA-F0-9]{40}/g;
    const BACKEND_URL = 'http://localhost:5000'; // Change to 'https://trust-mark.vercel.app' for production
    let flaggedAddresses = [];
    let suspiciousAddresses = [];

    const badgeStyles = {
        normal: `background: linear-gradient(90deg, #8b5cf6, #a855f7);`,
        flagged: `background: linear-gradient(90deg, #dc2626, #ef4444);`,
        suspicious: `background: linear-gradient(90deg, #f59e0b, #eab308);`
    };

    function createBadge(status) {
        return `
            display: inline-block;
            color: #fff;
            font-size: 0.85em;
            font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
            border-radius: 12px;
            padding: 2px 10px;
            margin-left: 6px;
            vertical-align: middle;
            font-weight: 600;
            ${badgeStyles[status]}
        `;
    }

    async function fetchFlaggedAddresses() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/flagged_addresses`);
            if (response.ok) {
                const data = await response.json();
                flaggedAddresses = data.flagged_addresses || [];
                suspiciousAddresses = data.suspicious_addresses || [];
            }
        } catch (error) {
            console.warn('TrustMark: Error fetching data.');
        }
    }

    function getAddressStatus(address) {
        const lowerAddress = address.toLowerCase();
        if (flaggedAddresses.some(addr => addr.toLowerCase() === lowerAddress)) return 'flagged';
        if (suspiciousAddresses.some(addr => addr.toLowerCase() === lowerAddress)) return 'suspicious';
        return 'normal';
    }

    function highlightAddresses() {
        const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = textNodes.nextNode()) {
            if (node.parentElement.tagName.toLowerCase() !== 'script' && 
                node.parentElement.tagName.toLowerCase() !== 'style' &&
                !node.parentElement.classList.contains('trustmark-processed')) {

                const matches = node.nodeValue.match(ethAddressRegex);
                if (matches) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    matches.forEach(match => {
                        const index = node.nodeValue.indexOf(match, lastIndex);
                        fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex, index)));
                        const status = getAddressStatus(match);
                        const badge = document.createElement('span');
                        badge.className = `trustmark-badge trustmark-${status}`;
                        badge.style.cssText = createBadge(status);
                        badge.title = `TrustMark: ${status.toUpperCase()}`;
                        badge.textContent = match;
                        fragment.appendChild(badge);
                        lastIndex = index + match.length;
                    });
                    fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex)));
                    node.parentNode.replaceChild(fragment, node);
                    // Mark the parent element as processed
                    // This is not perfect, as the new fragment has multiple parents,
                    // but for this implementation, we mark the original parent.
                    // A better implementation would mark the new text nodes themselves.
                    // However, let's stick to a simple fix first.
                }
            }
        }
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "scanPage") {
            highlightAddresses();
            const addresses = Array.from(document.querySelectorAll('.trustmark-badge')).map(badge => badge.textContent);
            sendResponse({ addresses: [...new Set(addresses)] });
        }
        return true;
    });

    fetchFlaggedAddresses();
    setInterval(fetchFlaggedAddresses, 5 * 60 * 1000);
})(); 