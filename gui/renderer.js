/**
 * LocatorLabs Desktop
 *
 * Copyright (c) 2025 Naveen AutomationLabs
 * Licensed under the MIT License
 *
 * https://www.locator-labs.com
 *
 * Renderer script - UI logic and element inspection
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const urlInput = document.getElementById('urlInput');
  const goBtn = document.getElementById('goBtn');
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const devToolsBtn = document.getElementById('devToolsBtn');
  const themeToggle = document.getElementById('themeToggle');
  const inspectBtn = document.getElementById('inspectBtn');
  const locatorsList = document.getElementById('locatorsList');
  const elementTag = document.getElementById('elementTag');
  const elementDetails = document.getElementById('elementDetails');
  const playwrightFrameInfo = document.getElementById('playwrightFrameInfo');
  const frameSwitchInfo = document.getElementById('frameSwitchInfo');
  const shadowDOMInfo = document.getElementById('shadowDOMInfo');
  const svgInfo = document.getElementById('svgInfo');
  const frameworkBtns = document.querySelectorAll('.framework-btn');
  const toolCheckboxes = document.querySelectorAll('.tool-checkbox');
  const toolSelectionHint = document.getElementById('toolSelectionHint');
  const langBtns = document.querySelectorAll('.lang-btn');

  // Track selected frameworks for "Show Code For" (all selected by default)
  let selectedFrameworks = ['playwright', 'selenium', 'cypress'];
  const testLocatorInput = document.getElementById('testLocatorInput');
  const testLocatorBtn = document.getElementById('testLocatorBtn');
  const testLocatorResetBtn = document.getElementById('testLocatorResetBtn');
  const testLocatorResult = document.getElementById('testLocatorResult');
  const autocompleteDropdown = document.getElementById('autocompleteDropdown');
  const sidebarPanel = document.getElementById('sidebarPanel');
  const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');

  // Tab DOM Elements
  const tabsContainer = document.getElementById('tabsContainer');
  const webviewContainer = document.getElementById('webviewContainer');
  const newTabBtn = document.getElementById('newTabBtn');

  // Tab State
  let tabCounter = 1;
  let activeTabId = 'tab-1';
  let tabs = {
    'tab-1': {
      id: 'tab-1',
      url: 'https://www.locator-labs.com',
      title: 'New Tab'
    }
  };

  // Active webview reference (will be updated when switching tabs)
  let webview = document.getElementById('webview-tab-1');

  // State
  let isInspecting = false;
  let currentTheme = 'light';
  let currentElementData = null; // Store selected element for re-generation
  let autocompleteSelectedIndex = -1;

  // Page Object Cart State
  let pageObjectCart = []; // Array of { id, elementType, locatorType, locatorCode, elementInfo }

  // PO Mode State
  let isPOModeEnabled = false;
  const PO_SETTINGS_KEY = 'locatorLabsPOSettings';

  // Default PO Mode preferences for each framework
  const defaultPOPreferences = {
    playwright: {
      locators: ['getByRole', 'getByLabel', 'getByTestId', 'getByPlaceholder', 'getByText', 'ID', 'CSS', 'XPath'],
      enabled: {
        getByRole: true,
        getByLabel: true,
        getByTestId: true,
        getByPlaceholder: true,
        getByText: true,
        ID: true,
        CSS: false,
        XPath: false
      }
    },
    selenium: {
      locators: ['ID', 'Name', 'LinkText', 'CSS', 'XPath', 'ClassName'],
      enabled: {
        ID: true,
        Name: true,
        LinkText: true,
        CSS: true,
        XPath: false,
        ClassName: false
      }
    },
    cypress: {
      locators: ['data-testid', 'ID', 'contains', 'CSS', 'XPath'],
      enabled: {
        'data-testid': true,
        ID: true,
        contains: true,
        CSS: true,
        XPath: false
      }
    }
  };

  let poModePreferences = loadPOPreferences();

  // Initialize
  init();

  function init() {
    setupTabEvents();
    setupWebviewEvents();
    setupNavigationEvents();
    setupThemeToggle();
    setupInspectMode();
    setupTestLocator();
    setupFrameworkToggle();
    setupLanguageToggle();
    setupAutocomplete();
    setupSidebarResize();
    setupPageObjectModal();
    setupPOMode();
  }

  // =====================
  // TAB MANAGEMENT
  // =====================
  function setupTabEvents() {
    // New tab button
    newTabBtn.addEventListener('click', () => createNewTab());

    // Listen for target="_blank" links from main process
    if (window.electronAPI && window.electronAPI.onOpenUrlInNewTab) {
      window.electronAPI.onOpenUrlInNewTab((url) => {
        createNewTab(url);
      });
    }

    // Tab click and close handlers (delegated)
    tabsContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;

      const tabId = tab.dataset.tabId;

      // Close button clicked
      if (e.target.closest('.tab-close')) {
        closeTab(tabId);
        e.stopPropagation();
        return;
      }

      // Tab clicked - switch to it
      switchToTab(tabId);
    });
  }

  function createNewTab(url = 'about:blank') {
    tabCounter++;
    const tabId = `tab-${tabCounter}`;

    // Create tab data
    tabs[tabId] = {
      id: tabId,
      url: url,
      title: 'New Tab'
    };

    // Create tab element
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tabId;
    tabElement.innerHTML = `
      <span class="tab-title">New Tab</span>
      <button class="tab-close" title="Close tab">×</button>
    `;
    tabsContainer.appendChild(tabElement);

    // Create webview element
    const webviewElement = document.createElement('webview');
    webviewElement.id = `webview-${tabId}`;
    webviewElement.className = 'tab-webview';
    webviewElement.setAttribute('allowpopups', '');
    webviewElement.src = url;
    webviewContainer.appendChild(webviewElement);

    // Setup events for new webview
    setupWebviewEventsForTab(webviewElement, tabId);

    // Switch to new tab
    switchToTab(tabId);

    return tabId;
  }

  function switchToTab(tabId) {
    if (!tabs[tabId]) return;

    // Update active tab state
    activeTabId = tabId;

    // Update tab UI
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tabId === tabId);
    });

    // Update webview visibility
    document.querySelectorAll('.tab-webview').forEach(wv => {
      wv.classList.toggle('active', wv.id === `webview-${tabId}`);
    });

    // Update webview reference
    webview = document.getElementById(`webview-${tabId}`);

    // Update URL bar
    urlInput.value = tabs[tabId].url;

    // Update navigation buttons
    updateNavButtons();

    // Stop inspecting mode when switching tabs
    if (isInspecting) {
      toggleInspectMode();
    }

    // Stop PO Mode when switching tabs
    if (isPOModeEnabled) {
      togglePOMode();
    }

    // Clear current element data
    currentElementData = null;
    clearElementInfo();
  }

  function closeTab(tabId) {
    const tabKeys = Object.keys(tabs);

    // Don't close if it's the last tab
    if (tabKeys.length <= 1) {
      showToast('Cannot close the last tab', 'error');
      return;
    }

    // Find the tab to switch to
    const tabIndex = tabKeys.indexOf(tabId);
    let newActiveTabId;
    if (tabId === activeTabId) {
      // Switch to adjacent tab
      newActiveTabId = tabKeys[tabIndex === 0 ? 1 : tabIndex - 1];
    }

    // Remove tab element
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) tabElement.remove();

    // Remove webview element
    const webviewElement = document.getElementById(`webview-${tabId}`);
    if (webviewElement) webviewElement.remove();

    // Remove from state
    delete tabs[tabId];

    // Switch to new tab if needed
    if (newActiveTabId) {
      switchToTab(newActiveTabId);
    }
  }

  function updateTabTitle(tabId, title) {
    if (!tabs[tabId]) return;

    tabs[tabId].title = title || 'New Tab';

    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
    if (tabElement) {
      tabElement.textContent = title || 'New Tab';
      tabElement.title = title || 'New Tab';
    }
  }

  function updateTabUrl(tabId, url) {
    if (!tabs[tabId]) return;
    tabs[tabId].url = url;

    // Update URL bar if this is the active tab
    if (tabId === activeTabId) {
      urlInput.value = url;
    }
  }

  function clearElementInfo() {
    elementTag.textContent = 'No element selected';
    elementDetails.innerHTML = '';
    frameSwitchInfo.innerHTML = '';
    frameSwitchInfo.style.display = 'none';
    shadowDOMInfo.innerHTML = '';
    shadowDOMInfo.style.display = 'none';
    svgInfo.innerHTML = '';
    svgInfo.style.display = 'none';
    locatorsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">👆</span>
        <p>Click "Start Inspecting" and select an element in the browser</p>
      </div>
    `;
  }

  function setupWebviewEventsForTab(wv, tabId) {
    wv.addEventListener('dom-ready', () => {
      console.log(`Webview ${tabId} DOM ready`);
      if (tabId === activeTabId) {
        updateNavButtons();
      }
    });

    wv.addEventListener('did-navigate', (e) => {
      updateTabUrl(tabId, e.url);
      if (tabId === activeTabId) {
        updateNavButtons();
      }
    });

    wv.addEventListener('did-navigate-in-page', (e) => {
      updateTabUrl(tabId, e.url);
      if (tabId === activeTabId) {
        updateNavButtons();
      }
    });

    wv.addEventListener('page-title-updated', (e) => {
      updateTabTitle(tabId, e.title);
    });

    wv.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3 && tabId === activeTabId) {
        showToast(`Failed to load: ${e.errorDescription}`, 'error');
      }
    });

    // Listen for messages from injected script
    wv.addEventListener('ipc-message', (event) => {
      if (event.channel === 'element-selected' && tabId === activeTabId) {
        handleElementSelected(event.args[0]);
      }
    });

    // Console messages from webview (for debugging)
    wv.addEventListener('console-message', (e) => {
      // Handle regular inspect mode messages
      if (e.message.startsWith('LOCATORLABS:') && tabId === activeTabId) {
        try {
          const data = JSON.parse(e.message.replace('LOCATORLABS:', ''));
          handleElementSelected(data);
        } catch (err) {
          console.error('Failed to parse element data:', err);
        }
      }
      // Handle PO Mode element selection
      if (e.message.startsWith('LOCATORLABS_PO:') && tabId === activeTabId) {
        try {
          const data = JSON.parse(e.message.replace('LOCATORLABS_PO:', ''));
          handlePOModeElementSelected(data);
        } catch (err) {
          console.error('Failed to parse PO mode element data:', err);
        }
      }
      // Handle PO Mode exit (ESC key)
      if (e.message === 'LOCATORLABS_PO_EXIT' && tabId === activeTabId) {
        if (isPOModeEnabled) {
          togglePOMode();
        }
      }
    });
  }

  // =====================
  // WEBVIEW EVENTS
  // =====================
  function setupWebviewEvents() {
    // Setup events for the initial tab using the shared function
    setupWebviewEventsForTab(webview, 'tab-1');
  }

  // =====================
  // NAVIGATION
  // =====================
  const urlSuggestions = document.getElementById('urlSuggestions');
  let suggestionSelectedIndex = -1;
  const URL_HISTORY_KEY = 'locatorLabsUrlHistory';
  const MAX_URL_HISTORY = 5;

  function setupNavigationEvents() {
    goBtn.addEventListener('click', navigateToUrl);
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateToUrl();
      }
    });
    backBtn.addEventListener('click', () => webview.goBack());
    forwardBtn.addEventListener('click', () => webview.goForward());
    refreshBtn.addEventListener('click', () => webview.reload());
    devToolsBtn.addEventListener('click', () => {
      webview.openDevTools();
    });

    // URL Suggestions Events
    setupUrlSuggestions();
  }

  function setupUrlSuggestions() {
    // Show suggestions on focus
    urlInput.addEventListener('focus', () => {
      showUrlSuggestions();
    });

    // Filter suggestions on input
    urlInput.addEventListener('input', () => {
      showUrlSuggestions();
    });

    // Handle keyboard navigation
    urlInput.addEventListener('keydown', (e) => {
      const items = urlSuggestions.querySelectorAll('.url-suggestion-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestionSelectedIndex = Math.min(suggestionSelectedIndex + 1, items.length - 1);
        updateSuggestionSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestionSelectedIndex = Math.max(suggestionSelectedIndex - 1, -1);
        updateSuggestionSelection(items);
      } else if (e.key === 'Enter' && suggestionSelectedIndex >= 0) {
        e.preventDefault();
        const selectedItem = items[suggestionSelectedIndex];
        if (selectedItem) {
          urlInput.value = selectedItem.dataset.url;
          hideUrlSuggestions();
          navigateToUrl();
        }
      } else if (e.key === 'Escape') {
        hideUrlSuggestions();
      }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!urlInput.contains(e.target) && !urlSuggestions.contains(e.target)) {
        hideUrlSuggestions();
      }
    });
  }

  function updateSuggestionSelection(items) {
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === suggestionSelectedIndex);
    });
    // Update input value to show selected URL
    if (suggestionSelectedIndex >= 0 && items[suggestionSelectedIndex]) {
      urlInput.value = items[suggestionSelectedIndex].dataset.url;
    }
  }

  function showUrlSuggestions() {
    const history = getUrlHistory();
    const filter = urlInput.value.trim().toLowerCase();

    // Filter history based on current input
    const filtered = filter
      ? history.filter(url => url.toLowerCase().includes(filter))
      : history;

    if (filtered.length === 0) {
      urlSuggestions.innerHTML = '';
      urlSuggestions.classList.remove('active');
      return;
    }

    // Render suggestions
    urlSuggestions.innerHTML = filtered.map((url, index) => `
      <div class="url-suggestion-item" data-url="${url}" data-index="${index}">
        <span class="url-suggestion-icon">🕐</span>
        <span class="url-suggestion-text">${url}</span>
        <button class="url-suggestion-delete" data-url="${url}" title="Remove from history">✕</button>
      </div>
    `).join('');

    // Add click handlers
    urlSuggestions.querySelectorAll('.url-suggestion-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('url-suggestion-delete')) {
          urlInput.value = item.dataset.url;
          hideUrlSuggestions();
          navigateToUrl();
        }
      });
    });

    // Add delete handlers
    urlSuggestions.querySelectorAll('.url-suggestion-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeUrlFromHistory(btn.dataset.url);
        showUrlSuggestions(); // Refresh the list
      });
    });

    suggestionSelectedIndex = -1;
    urlSuggestions.classList.add('active');
  }

  function hideUrlSuggestions() {
    urlSuggestions.classList.remove('active');
    suggestionSelectedIndex = -1;
  }

  function getUrlHistory() {
    try {
      const history = localStorage.getItem(URL_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      return [];
    }
  }

  function addUrlToHistory(url) {
    if (!url) return;

    let history = getUrlHistory();

    // Remove if already exists (to move it to top)
    history = history.filter(u => u !== url);

    // Add to beginning
    history.unshift(url);

    // Keep only last N URLs
    history = history.slice(0, MAX_URL_HISTORY);

    try {
      localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save URL history:', e);
    }
  }

  function removeUrlFromHistory(url) {
    let history = getUrlHistory();
    history = history.filter(u => u !== url);
    try {
      localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to update URL history:', e);
    }
  }

  function navigateToUrl() {
    let url = urlInput.value.trim();
    if (!url) return;

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Save to history
    addUrlToHistory(url);

    // Hide suggestions
    hideUrlSuggestions();

    webview.src = url;
  }

  function updateNavButtons() {
    backBtn.disabled = !webview.canGoBack();
    forwardBtn.disabled = !webview.canGoForward();
  }

  // =====================
  // THEME TOGGLE
  // =====================
  function setupThemeToggle() {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
      themeToggle.querySelector('.theme-icon').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    });
  }

  // =====================
  // INSPECT MODE
  // =====================
  function setupInspectMode() {
    inspectBtn.addEventListener('click', toggleInspectMode);
  }

  function toggleInspectMode() {
    // If PO Mode is active, disable it first
    if (isPOModeEnabled) {
      togglePOMode();
    }

    isInspecting = !isInspecting;

    if (isInspecting) {
      inspectBtn.classList.add('active');
      inspectBtn.innerHTML = '<span class="inspect-icon">🎯</span><span>Inspecting... (Click element)</span>';
      injectInspectorScript();
    } else {
      inspectBtn.classList.remove('active');
      inspectBtn.innerHTML = '<span class="inspect-icon">🎯</span><span>Start Inspecting</span>';
      removeInspectorScript();
    }
  }

  function injectInspectorScript() {
    const script = `
      (function() {
        // Remove existing if any
        if (window.__locatorLabsInjected) return;
        window.__locatorLabsInjected = true;
        window.__llActive = true; // Flag to control if inspector is active

        let hoveredElement = null;
        let highlightOverlay = null;

        // Create highlight overlay
        highlightOverlay = document.createElement('div');
        highlightOverlay.id = '__locatorlabs_highlight';
        highlightOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 999999; border: 2px solid #6366f1; background: rgba(99, 102, 241, 0.1); transition: all 0.1s ease;';
        document.body.appendChild(highlightOverlay);

        // Function to get selector for shadow host element
        function getShadowHostSelector(host) {
          if (host.id) return '#' + host.id;
          if (host.className && typeof host.className === 'string') {
            const firstClass = host.className.split(' ').filter(c => c && !c.includes(':'))[0];
            if (firstClass) return host.tagName.toLowerCase() + '.' + firstClass;
          }
          // Fallback to tag name with possible index
          const parent = host.parentElement || host.getRootNode().host;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === host.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(host) + 1;
              return host.tagName.toLowerCase() + ':nth-of-type(' + index + ')';
            }
          }
          return host.tagName.toLowerCase();
        }

        // Function to get shadow DOM path for an element
        function getShadowPath(el) {
          const path = [];
          let current = el;

          while (current) {
            const root = current.getRootNode();
            if (root instanceof ShadowRoot) {
              const host = root.host;
              path.unshift({
                hostTagName: host.tagName.toLowerCase(),
                hostId: host.id || null,
                hostClass: (typeof host.className === 'string') ? host.className : null,
                selector: getShadowHostSelector(host),
                mode: root.mode // 'open' or 'closed'
              });
              current = host;
            } else {
              break;
            }
          }

          return path;
        }

        // Function to get JS path for Selenium shadow DOM access
        // Uses single quotes inside so it works with outer double quotes in execute_script
        function getJSPathForElement(el, shadowPath) {
          if (!shadowPath || shadowPath.length === 0) return null;

          let jsPath = 'document';
          for (const shadow of shadowPath) {
            // Use single quotes for selectors to avoid conflicts with execute_script's double quotes
            jsPath += ".querySelector('" + shadow.selector.replace(/'/g, "\\\\'") + "').shadowRoot";
          }
          // Add final element selector
          let elSelector = el.tagName.toLowerCase();
          if (el.id) {
            elSelector = '#' + el.id;
          } else if (el.className && typeof el.className === 'string') {
            const firstClass = el.className.split(' ').filter(c => c && !c.includes(':'))[0];
            if (firstClass) elSelector = el.tagName.toLowerCase() + '.' + firstClass;
          }
          jsPath += ".querySelector('" + elSelector.replace(/'/g, "\\\\'") + "')";
          return jsPath;
        }

        // Function to get frame selector for an iframe element
        function getFrameSelector(iframe) {
          if (iframe.id) return '#' + iframe.id;
          if (iframe.name) return '[name="' + iframe.name + '"]';
          if (iframe.src) {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('about:')) return '[src="' + src + '"]';
          }
          // Fallback to index
          const iframes = Array.from(iframe.parentElement.querySelectorAll('iframe, frame'));
          const index = iframes.indexOf(iframe);
          return 'iframe:nth-of-type(' + (index + 1) + ')';
        }

        // Function to get the frame path from top to current frame
        function getFramePath(win) {
          const path = [];
          let currentWin = win;

          while (currentWin !== window.top) {
            try {
              const parentWin = currentWin.parent;
              const iframes = parentWin.document.querySelectorAll('iframe, frame');
              for (let iframe of iframes) {
                try {
                  if (iframe.contentWindow === currentWin) {
                    path.unshift({
                      selector: getFrameSelector(iframe),
                      tagName: iframe.tagName.toLowerCase(),
                      id: iframe.id || null,
                      name: iframe.name || null,
                      src: iframe.getAttribute('src') || null
                    });
                    break;
                  }
                } catch(e) {}
              }
              currentWin = parentWin;
            } catch(e) {
              break; // Cross-origin, can't access parent
            }
          }
          return path;
        }

        // Inject inspector into an iframe
        function injectIntoFrame(iframe) {
          try {
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!frameDoc || frameDoc.__locatorLabsInjected) return;

            frameDoc.__locatorLabsInjected = true;
            const frameWin = iframe.contentWindow;

            // Create highlight overlay for this frame
            let frameOverlay = frameDoc.createElement('div');
            frameOverlay.id = '__locatorlabs_highlight';
            frameOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 999999; border: 2px solid #6366f1; background: rgba(99, 102, 241, 0.1); transition: all 0.1s ease;';
            frameDoc.body.appendChild(frameOverlay);

            // Mouse move handler for frame - store reference for removal
            frameDoc.__llMouseMove = function(e) {
              if (!window.top.__llActive) return; // Check if inspector is still active
              // Use composedPath to get actual element inside shadow DOM
              const path = e.composedPath();
              const target = path[0] || e.target;
              const rect = target.getBoundingClientRect();
              frameOverlay.style.left = rect.left + 'px';
              frameOverlay.style.top = rect.top + 'px';
              frameOverlay.style.width = rect.width + 'px';
              frameOverlay.style.height = rect.height + 'px';
              frameOverlay.style.display = 'block';

              // Hide main document overlay
              highlightOverlay.style.display = 'none';
            };

            // Click blocker - prevents checkbox/radio from toggling after mousedown captures state
            frameDoc.__llClickBlocker = function(e) {
              if (!window.top.__llActive) return;
              e.preventDefault();
              e.stopPropagation();
              return false;
            };

            // Mousedown handler for frame - captures element state BEFORE any toggle
            frameDoc.__llClick = function(e) {
              if (!window.top.__llActive) return; // Check if inspector is still active
              e.preventDefault();
              e.stopPropagation();

              // Use composedPath to get actual element inside shadow DOM
              const path = e.composedPath();
              const el = path[0] || e.target;
              const framePath = getFramePath(frameWin);
              const shadowPath = getShadowPath(el);
              const jsPath = getJSPathForElement(el, shadowPath);

              // Check if element is SVG or inside SVG
              const isSVGElement = el instanceof SVGElement || el.namespaceURI === 'http://www.w3.org/2000/svg';
              const svgParent = el.closest ? el.closest('svg') : null;
              const isInsideSVG = isSVGElement || (svgParent !== null);

              // Get className and filter out __locatorlabs classes (highlight classes)
              let rawClassName = (typeof el.className === 'string') ? el.className : (el.className?.baseVal || null);
              let cleanClassName = null;
              if (rawClassName) {
                cleanClassName = rawClassName.split(' ').filter(c => !c.startsWith('__locatorlabs')).join(' ').trim() || null;
              }

              // Find closest parent element with ID (for chained locators)
              let parentId = null;
              let parent = el.parentElement;
              while (parent && parent !== frameDoc.body) {
                if (parent.id) {
                  parentId = parent.id;
                  break;
                }
                parent = parent.parentElement;
              }

              // Get associated label text for form inputs
              // This follows the same algorithm Playwright uses to compute accessible name
              let labelText = null;
              // Helper to normalize whitespace (replace multiple spaces/tabs/newlines/nbsp with single space)
              const normalizeWhitespace = (str) => {
                if (!str) return null;
                // Replace nbsp and zero-width space with regular space, then collapse multiple spaces
                return str.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').replace(/  +/g, ' ').trim();
              };

              if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                // Method 1: Label with for attribute (most common pattern)
                if (el.id) {
                  const labelEl = frameDoc.querySelector('label[for="' + el.id + '"]');
                  if (labelEl) {
                    labelText = normalizeWhitespace(labelEl.textContent);
                  }
                }
                // Method 2: Parent label element (label wrapping input)
                if (!labelText) {
                  const parentLabel = el.closest('label');
                  if (parentLabel) {
                    // Get text excluding the input element itself
                    const clone = parentLabel.cloneNode(true);
                    const inputs = clone.querySelectorAll('input, select, textarea');
                    inputs.forEach(inp => inp.remove());
                    labelText = normalizeWhitespace(clone.textContent);
                  }
                }
                // Method 3: Adjacent <label> siblings for radio/checkbox
                // ONLY accept actual <label> elements - not text nodes or SPAN/DIV
                // Playwright only recognizes proper label associations for accessible name
                if (!labelText && (el.type === 'radio' || el.type === 'checkbox')) {
                  // Check next sibling for <label> element only
                  let sibling = el.nextSibling;
                  while (sibling && !labelText) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                      labelText = normalizeWhitespace(sibling.textContent);
                    }
                    sibling = sibling.nextSibling;
                  }
                  // Check previous sibling for <label> element only
                  if (!labelText) {
                    sibling = el.previousSibling;
                    while (sibling && !labelText) {
                      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                        labelText = normalizeWhitespace(sibling.textContent);
                      }
                      sibling = sibling.previousSibling;
                    }
                  }
                }
                // Method 4: aria-labelledby attribute
                if (!labelText && el.getAttribute('aria-labelledby')) {
                  const labelledById = el.getAttribute('aria-labelledby');
                  const labelledByEl = frameDoc.getElementById(labelledById);
                  if (labelledByEl) {
                    labelText = normalizeWhitespace(labelledByEl.textContent);
                  }
                }
              }

              const data = {
                tagName: el.tagName,
                id: el.id || null,
                name: el.getAttribute('name') || null,
                className: cleanClassName,
                type: el.getAttribute('type') || null,
                placeholder: el.getAttribute('placeholder') || null,
                // Use textContent (raw text) not innerText (which includes CSS text-transform effects)
                // This matches how Playwright computes accessible names
                text: el.textContent ? el.textContent.trim().substring(0, 100) : null,
                ariaLabel: el.getAttribute('aria-label') || null,
                labelText: labelText, // Associated label text for form inputs
                dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || null,
                role: el.getAttribute('role') || null,
                href: el.getAttribute('href') || null,
                src: el.getAttribute('src') || null,
                title: el.getAttribute('title') || null,
                value: el.value || null,
                checked: el.checked === true, // Ensure boolean for checkbox/radio elements
                attributes: {
                  type: el.getAttribute('type'),
                  name: el.getAttribute('name'),
                  alt: el.getAttribute('alt'),
                  for: el.getAttribute('for'),
                  d: el.getAttribute('d'), // SVG path data
                  fill: el.getAttribute('fill'), // SVG fill
                  viewBox: el.getAttribute('viewBox') // SVG viewBox
                },
                framePath: framePath,
                shadowPath: shadowPath, // Shadow DOM path
                jsPath: jsPath, // JS path for Selenium shadow DOM access
                isSVG: isInsideSVG, // SVG element flag
                svgTagName: isSVGElement ? el.tagName.toLowerCase() : null, // Original SVG tag name (lowercase)
                parentId: parentId // Parent element ID for chained locators
              };

              console.log('LOCATORLABS:' + JSON.stringify(data));
            };

            frameDoc.addEventListener('mousemove', frameDoc.__llMouseMove, true);
            // Use mousedown instead of click to capture checkbox/radio state BEFORE it toggles
            frameDoc.addEventListener('mousedown', frameDoc.__llClick, true);
            // Block click event to prevent checkbox/radio from toggling
            frameDoc.addEventListener('click', frameDoc.__llClickBlocker, true);

            // Recursively inject into nested iframes
            const nestedFrames = frameDoc.querySelectorAll('iframe, frame');
            nestedFrames.forEach(f => injectIntoFrame(f));

            console.log('LocatorLabs Inspector injected into frame');
          } catch(e) {
            // Cross-origin iframe, can't access
            console.log('LocatorLabs: Cannot access cross-origin frame');
          }
        }

        // Mouse move handler for main document
        window.__llMouseMove = function(e) {
          if (!window.__llActive) return;
          // Use composedPath to get actual element inside shadow DOM
          const path = e.composedPath();
          hoveredElement = path[0] || e.target;
          const rect = hoveredElement.getBoundingClientRect();
          highlightOverlay.style.left = rect.left + 'px';
          highlightOverlay.style.top = rect.top + 'px';
          highlightOverlay.style.width = rect.width + 'px';
          highlightOverlay.style.height = rect.height + 'px';
          highlightOverlay.style.display = 'block';
        };

        // Click blocker - prevents checkbox/radio from toggling after mousedown captures state
        window.__llClickBlocker = function(e) {
          if (!window.__llActive) return;
          e.preventDefault();
          e.stopPropagation();
          return false;
        };

        // Mousedown handler for main document - captures element state BEFORE any toggle
        window.__llClick = function(e) {
          if (!window.__llActive) return;
          e.preventDefault();
          e.stopPropagation();

          // Use composedPath to get actual element inside shadow DOM
          const path = e.composedPath();
          const el = path[0] || e.target;
          const shadowPath = getShadowPath(el);
          const jsPath = getJSPathForElement(el, shadowPath);

          // Check if element is SVG or inside SVG
          const isSVGElement = el instanceof SVGElement || el.namespaceURI === 'http://www.w3.org/2000/svg';
          const svgParent = el.closest ? el.closest('svg') : null;
          const isInsideSVG = isSVGElement || (svgParent !== null);

          // Get className and filter out __locatorlabs classes (highlight classes)
          let rawClassName = (typeof el.className === 'string') ? el.className : (el.className?.baseVal || null);
          let cleanClassName = null;
          if (rawClassName) {
            cleanClassName = rawClassName.split(' ').filter(c => !c.startsWith('__locatorlabs')).join(' ').trim() || null;
          }

          // Find closest parent element with ID (for chained locators)
          let parentId = null;
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (parent.id) {
              parentId = parent.id;
              break;
            }
            parent = parent.parentElement;
          }

          // Get associated label text for form inputs
          // This follows the same algorithm Playwright uses to compute accessible name
          let labelText = null;
          // Helper to normalize whitespace (replace multiple spaces/tabs/newlines/nbsp with single space)
          const normalizeWS = (str) => {
            if (!str) return null;
            // Replace nbsp and zero-width space with regular space, then collapse multiple spaces
            return str.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').replace(/  +/g, ' ').trim();
          };

          if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            // Method 1: Label with for attribute (most common pattern)
            if (el.id) {
              const labelEl = document.querySelector('label[for="' + el.id + '"]');
              if (labelEl) {
                labelText = normalizeWS(labelEl.textContent);
              }
            }
            // Method 2: Parent label element (label wrapping input)
            if (!labelText) {
              const parentLabel = el.closest('label');
              if (parentLabel) {
                // Get text excluding the input element itself
                const clone = parentLabel.cloneNode(true);
                const inputs = clone.querySelectorAll('input, select, textarea');
                inputs.forEach(inp => inp.remove());
                labelText = normalizeWS(clone.textContent);
              }
            }
            // Method 3: Adjacent <label> siblings for radio/checkbox
            // ONLY accept actual <label> elements - not text nodes or SPAN/DIV
            // Playwright only recognizes proper label associations for accessible name
            if (!labelText && (el.type === 'radio' || el.type === 'checkbox')) {
              // Check next sibling for <label> element only
              let sibling = el.nextSibling;
              while (sibling && !labelText) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                  labelText = normalizeWS(sibling.textContent);
                }
                sibling = sibling.nextSibling;
              }
              // Check previous sibling for <label> element only
              if (!labelText) {
                sibling = el.previousSibling;
                while (sibling && !labelText) {
                  if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                    labelText = normalizeWS(sibling.textContent);
                  }
                  sibling = sibling.previousSibling;
                }
              }
            }
            // Method 4: aria-labelledby attribute
            if (!labelText && el.getAttribute('aria-labelledby')) {
              const labelledById = el.getAttribute('aria-labelledby');
              const labelledByEl = document.getElementById(labelledById);
              if (labelledByEl) {
                labelText = normalizeWS(labelledByEl.textContent);
              }
            }
          }

          const data = {
            tagName: el.tagName,
            id: el.id || null,
            name: el.getAttribute('name') || null,
            className: cleanClassName,
            type: el.getAttribute('type') || null,
            placeholder: el.getAttribute('placeholder') || null,
            // Use textContent (raw text) not innerText (which includes CSS text-transform effects)
            text: el.textContent ? el.textContent.trim().substring(0, 100) : null,
            ariaLabel: el.getAttribute('aria-label') || null,
            labelText: labelText, // Associated label text for form inputs
            dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || null,
            role: el.getAttribute('role') || null,
            href: el.getAttribute('href') || null,
            src: el.getAttribute('src') || null,
            title: el.getAttribute('title') || null,
            value: el.value || null,
            checked: el.checked === true, // Ensure boolean for checkbox/radio elements
            attributes: {
              type: el.getAttribute('type'),
              name: el.getAttribute('name'),
              alt: el.getAttribute('alt'),
              for: el.getAttribute('for'),
              d: el.getAttribute('d'), // SVG path data
              fill: el.getAttribute('fill'), // SVG fill
              viewBox: el.getAttribute('viewBox') // SVG viewBox
            },
            framePath: [], // Empty for main document
            shadowPath: shadowPath, // Shadow DOM path
            jsPath: jsPath, // JS path for Selenium shadow DOM access
            isSVG: isInsideSVG, // SVG element flag
            svgTagName: isSVGElement ? el.tagName.toLowerCase() : null, // Original SVG tag name (lowercase)
            parentId: parentId // Parent element ID for chained locators
          };

          // Send data via console (captured by console-message event)
          console.log('LOCATORLABS:' + JSON.stringify(data));
        };

        document.addEventListener('mousemove', window.__llMouseMove, true);
        // Use mousedown instead of click to capture checkbox/radio state BEFORE it toggles
        document.addEventListener('mousedown', window.__llClick, true);
        // Block click event to prevent checkbox/radio from toggling
        document.addEventListener('click', window.__llClickBlocker, true);

        // Inject into all iframes
        const iframes = document.querySelectorAll('iframe, frame');
        iframes.forEach(iframe => {
          // Wait for iframe to load if needed
          if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            injectIntoFrame(iframe);
          } else {
            iframe.addEventListener('load', () => injectIntoFrame(iframe));
          }
        });

        // Watch for dynamically added iframes
        const observer = new MutationObserver(mutations => {
          if (!window.__llActive) return;
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.tagName === 'IFRAME' || node.tagName === 'FRAME') {
                if (node.contentDocument && node.contentDocument.readyState === 'complete') {
                  injectIntoFrame(node);
                } else {
                  node.addEventListener('load', () => injectIntoFrame(node));
                }
              }
            });
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.__llObserver = observer;

        console.log('LocatorLabs Inspector injected');
      })();
    `;

    webview.executeJavaScript(script);
  }

  function removeInspectorScript() {
    const script = `
      (function() {
        // Disable inspector first (this stops all handlers immediately)
        window.__llActive = false;

        // Clean up from iframes recursively
        function cleanupFrame(doc) {
          try {
            if (!doc) return;

            // Remove event listeners if references exist
            if (doc.__llMouseMove) {
              doc.removeEventListener('mousemove', doc.__llMouseMove, true);
              doc.__llMouseMove = null;
            }
            if (doc.__llClick) {
              doc.removeEventListener('mousedown', doc.__llClick, true);
              doc.__llClick = null;
            }
            if (doc.__llClickBlocker) {
              doc.removeEventListener('click', doc.__llClickBlocker, true);
              doc.__llClickBlocker = null;
            }

            // Remove overlay
            const overlay = doc.getElementById('__locatorlabs_highlight');
            if (overlay) overlay.remove();
            doc.__locatorLabsInjected = false;

            // Clean nested iframes
            const iframes = doc.querySelectorAll('iframe, frame');
            iframes.forEach(iframe => {
              try {
                cleanupFrame(iframe.contentDocument);
              } catch(e) {}
            });
          } catch(e) {}
        }

        if (window.__locatorLabsInjected) {
          document.removeEventListener('mousemove', window.__llMouseMove, true);
          document.removeEventListener('mousedown', window.__llClick, true);
          document.removeEventListener('click', window.__llClickBlocker, true);

          // Stop mutation observer
          if (window.__llObserver) {
            window.__llObserver.disconnect();
            window.__llObserver = null;
          }

          // Clean up main document and all iframes
          cleanupFrame(document);
          window.__locatorLabsInjected = false;
          console.log('LocatorLabs Inspector removed');
        }
      })();
    `;
    webview.executeJavaScript(script);
  }

  // =====================
  // TEST LOCATOR
  // =====================

  // Navigation state for multiple elements
  let elementNavigation = {
    currentIndex: 0,
    totalCount: 0,
    locatorScript: null,
    hasFrameLocator: false
  };

  function setupTestLocator() {
    testLocatorBtn.addEventListener('click', runTestLocator);
    testLocatorInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // If multiple elements already found, navigate to next; otherwise run test
        if (elementNavigation.totalCount > 1 && elementNavigation.locatorScript) {
          navigateToNextElement();
        } else {
          runTestLocator();
        }
      }
    });
    testLocatorResetBtn.addEventListener('click', resetTestLocator);

    // Navigation button handlers (delegated)
    testLocatorResult.addEventListener('click', (e) => {
      if (e.target.classList.contains('nav-prev')) {
        navigateToPrevElement();
      } else if (e.target.classList.contains('nav-next')) {
        navigateToNextElement();
      }
    });
  }

  function navigateToPrevElement() {
    if (elementNavigation.totalCount <= 1) return;
    // Circular navigation: go to last if at first
    elementNavigation.currentIndex = elementNavigation.currentIndex === 0
      ? elementNavigation.totalCount - 1
      : elementNavigation.currentIndex - 1;
    highlightElementAtIndex(elementNavigation.currentIndex);
  }

  function navigateToNextElement() {
    if (elementNavigation.totalCount <= 1) return;
    // Circular navigation: go to first if at last
    elementNavigation.currentIndex = (elementNavigation.currentIndex + 1) % elementNavigation.totalCount;
    highlightElementAtIndex(elementNavigation.currentIndex);
  }

  function highlightElementAtIndex(index) {
    if (!elementNavigation.locatorScript) return;

    let scriptBody;
    if (elementNavigation.hasFrameLocator) {
      // Frame locator - use script directly
      scriptBody = `
          ${elementNavigation.locatorScript}
      `;
    } else {
      // Regular locator - wrap in findInDocument for recursive iframe search
      scriptBody = `
          // Function to find elements in a specific document
          function findInDocument(targetDoc) {
            ${elementNavigation.locatorScript}
            return elements;
          }

          // Search in main document first
          let elements = findInDocument(document);

          // If not found, search recursively in iframes
          if (elements.length === 0) {
            function searchIframes(doc) {
              const iframes = doc.querySelectorAll('iframe, frame');
              for (const iframe of iframes) {
                try {
                  if (iframe.contentDocument) {
                    const found = findInDocument(iframe.contentDocument);
                    if (found.length > 0) {
                      elements = found;
                      return true;
                    }
                    if (searchIframes(iframe.contentDocument)) return true;
                  }
                } catch(e) {}
              }
              return false;
            }
            searchIframes(document);
          }
      `;
    }

    const script = `
      (function() {
        try {
          ${scriptBody}

          if (elements.length > 0) {
            // Remove highlight from all elements first (including iframes)
            function dimAllHighlights(doc) {
              try {
                doc.querySelectorAll('.__locatorlabs_test_highlight').forEach(el => {
                  el.style.outline = '2px dashed #dc2626';
                  el.style.outlineOffset = '2px';
                });
                doc.querySelectorAll('iframe, frame').forEach(iframe => {
                  try {
                    if (iframe.contentDocument) dimAllHighlights(iframe.contentDocument);
                  } catch(e) {}
                });
              } catch(e) {}
            }
            dimAllHighlights(document);

            // Highlight current element with solid border
            const currentEl = elements[${index}];
            if (currentEl) {
              currentEl.style.outline = '4px solid #dc2626';
              currentEl.style.outlineOffset = '2px';
              currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          return { success: true };
        } catch(e) {
          return { success: false, error: e.message };
        }
      })();
    `;

    webview.executeJavaScript(script).then(() => {
      updateNavigationDisplay();
    });
  }

  function updateNavigationDisplay() {
    const current = elementNavigation.currentIndex + 1;
    const total = elementNavigation.totalCount;
    testLocatorResult.innerHTML = `
      <span class="result-icon">✓</span>
      <span class="result-text">${current} of ${total} elements</span>
      <span class="nav-buttons">
        <button class="nav-prev" title="Previous (circular)">◀</button>
        <button class="nav-next" title="Next (circular)">▶</button>
      </span>
    `;
  }

  function resetTestLocator() {
    // Clear the input field
    testLocatorInput.value = '';

    // Reset navigation state
    elementNavigation.currentIndex = 0;
    elementNavigation.totalCount = 0;
    elementNavigation.locatorScript = null;
    elementNavigation.hasFrameLocator = false;

    // Hide the result
    testLocatorResult.className = 'test-locator-result';
    testLocatorResult.innerHTML = '';

    // Remove all highlights from the webview (including iframes and shadow DOM)
    const script = `
      (function() {
        function clearHighlights(root) {
          try {
            root.querySelectorAll('.__locatorlabs_highlight_temp').forEach(el => {
              el.style.outline = '';
              el.style.outlineOffset = '';
              el.classList.remove('__locatorlabs_highlight_temp');
            });
            root.querySelectorAll('.__locatorlabs_test_highlight').forEach(el => {
              el.style.outline = el.__llOriginalOutline || '';
              el.style.outlineOffset = el.__llOriginalOutlineOffset || '';
              el.classList.remove('__locatorlabs_test_highlight');
            });
            // Clear in iframes
            root.querySelectorAll('iframe, frame').forEach(iframe => {
              try {
                if (iframe.contentDocument) clearHighlights(iframe.contentDocument);
              } catch(e) {}
            });
            // Clear in shadow DOMs
            root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                clearHighlights(el.shadowRoot);
              }
            });
          } catch(e) {}
        }
        clearHighlights(document);
        return { success: true };
      })();
    `;
    webview.executeJavaScript(script);
  }

  function runTestLocator() {
    const locatorInput = testLocatorInput.value.trim();
    console.log('runTestLocator called with:', locatorInput);
    if (!locatorInput) {
      showTestResult(false, 'Please enter a locator');
      return;
    }

    // Reset navigation state at start of each test to prevent stale data
    elementNavigation.currentIndex = 0;
    elementNavigation.totalCount = 0;
    elementNavigation.locatorScript = null;
    elementNavigation.hasFrameLocator = false;

    // Check if there's an action to execute
    const actionInfo = parseAction(locatorInput);
    console.log('parseAction result:', JSON.stringify(actionInfo));

    // Parse the locator and generate the appropriate script
    const parseResult = parseLocatorToScript(actionInfo.locator);

    // Check for syntax errors
    if (parseResult.error) {
      showTestResult(false, parseResult.error);
      return;
    }

    const locatorScript = parseResult.script;
    const hasFrameLocator = parseResult.hasFrameLocator || false;

    // Generate action script if action is present
    const actionScript = actionInfo.action ? generateActionScript(actionInfo.action, actionInfo.actionValue, actionInfo.actionArg) : '';

    // Generate selector script if selector is present (first, last, nth)
    // This applies BOTH when selector is in the middle (e.g., .nth(0).textContent())
    // AND when selector is at the end as an action (e.g., .nth(0))
    let selectorScript = '';

    // Check if there's a selector in the middle of the chain
    if (actionInfo.selector) {
      switch (actionInfo.selector) {
        case 'first':
          selectorScript = `elements = elements.length > 0 ? [elements[0]] : [];`;
          break;
        case 'last':
          selectorScript = `elements = elements.length > 0 ? [elements[elements.length - 1]] : [];`;
          break;
        case 'nth':
          const idx = parseInt(actionInfo.selectorValue) || 0;
          selectorScript = `elements = elements.length > ${idx} ? [elements[${idx}]] : [];`;
          break;
      }
    }
    // Also apply selector when first/last/nth is used as the final action
    else if (actionInfo.action === 'first' || actionInfo.action === 'last' || actionInfo.action === 'nth') {
      switch (actionInfo.action) {
        case 'first':
          selectorScript = `elements = elements.length > 0 ? [elements[0]] : [];`;
          break;
        case 'last':
          selectorScript = `elements = elements.length > 0 ? [elements[elements.length - 1]] : [];`;
          break;
        case 'nth':
          const idx = parseInt(actionInfo.actionValue) || 0;
          selectorScript = `elements = elements.length > ${idx} ? [elements[${idx}]] : [];`;
          break;
      }
    }

    // For frame locators, don't wrap in findInDocument - the script already handles frame navigation
    // For regular locators, replace 'document.' with 'targetDoc.' to support iframe searching
    let scriptBody;

    if (hasFrameLocator) {
      // Frame locator script already handles the specific frame path
      // Just run it directly without the recursive iframe search
      scriptBody = `
          ${locatorScript}
      `;
    } else {
      // Regular locator - wrap in findInDocument for recursive iframe search
      const iframeAwareLocatorScript = locatorScript.replace(/\bdocument\./g, 'targetDoc.');
      scriptBody = `
          // Function to find elements in a specific document
          function findInDocument(targetDoc) {
            ${iframeAwareLocatorScript}
            return elements;
          }

          // Search in main document first
          let elements = findInDocument(document);

          // If not found, search recursively in iframes
          if (elements.length === 0) {
            function searchIframes(doc) {
              const iframes = doc.querySelectorAll('iframe, frame');
              for (const iframe of iframes) {
                try {
                  if (iframe.contentDocument) {
                    const found = findInDocument(iframe.contentDocument);
                    if (found.length > 0) {
                      elements = found;
                      return true;
                    }
                    if (searchIframes(iframe.contentDocument)) return true;
                  }
                } catch(e) {}
              }
              return false;
            }
            searchIframes(document);
          }
      `;
    }

    const script = `
      (function() {
        try {
          // Remove previous highlights from all documents (including iframes and shadow DOM)
          function clearHighlights(root) {
            try {
              root.querySelectorAll('.__locatorlabs_highlight_temp').forEach(el => {
                el.style.outline = '';
                el.style.outlineOffset = '';
                el.classList.remove('__locatorlabs_highlight_temp');
              });
              root.querySelectorAll('.__locatorlabs_test_highlight').forEach(el => {
                el.style.outline = el.__llOriginalOutline || '';
                el.style.outlineOffset = el.__llOriginalOutlineOffset || '';
                el.classList.remove('__locatorlabs_test_highlight');
              });
              // Clear in iframes
              root.querySelectorAll('iframe, frame').forEach(iframe => {
                try {
                  if (iframe.contentDocument) clearHighlights(iframe.contentDocument);
                } catch(e) {}
              });
              // Clear in shadow DOMs
              root.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) {
                  clearHighlights(el.shadowRoot);
                }
              });
            } catch(e) {}
          }
          clearHighlights(document);

          ${scriptBody}

          // Apply selector (first, last, nth) if present
          ${selectorScript}

          if (elements.length > 0) {
            // Highlight all matching elements
            elements.forEach((el) => {
              el.__llOriginalOutline = el.style.outline;
              el.__llOriginalOutlineOffset = el.style.outlineOffset;
              el.style.outline = '4px solid #dc2626';
              el.style.outlineOffset = '2px';
              el.classList.add('__locatorlabs_test_highlight');
            });

            // Scroll to first element
            elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Execute action if present
            ${actionScript ? `
              const element = elements[0];
              ${actionScript}
            ` : ''}
          }

          return {
            success: true,
            count: elements.length,
            ${actionScript ? 'actionResult: actionResult,' : ''}
            hasAction: ${actionScript ? 'true' : 'false'},
            frameError: typeof frameError !== 'undefined' ? frameError : null,
            debugInfo: typeof debugInfo !== 'undefined' ? debugInfo : null
          };
        } catch(e) {
          return { success: false, error: e.message };
        }
      })();
    `;

    webview.executeJavaScript(script).then(result => {
      console.log('Script result:', JSON.stringify(result));
      if (result.success) {
        if (result.count === 0) {
          elementNavigation.totalCount = 0;
          elementNavigation.locatorScript = null;
          if (result.frameError) {
            showTestResult(false, result.frameError);
          } else if (result.debugInfo && result.debugInfo.framesNavigated > 0) {
            // Frames were navigated successfully but element not found
            const frameList = result.debugInfo.frameIds.join(' → ');
            showTestResult(false, `No elements in frames: ${frameList}`);
          } else {
            showTestResult(false, 'No elements found');
          }
        } else if (result.hasAction && result.actionResult !== undefined) {
          // Show action result (no navigation for actions)
          elementNavigation.totalCount = 0;
          elementNavigation.locatorScript = null;
          const displayResult = formatActionResult(actionInfo.action, result.actionResult);

          // Warn if multiple elements found - like Playwright's strict mode
          if (result.count > 1) {
            // For count(), first(), last(), nth() - no warning needed as they handle multiple elements
            const multiElementActions = ['count', 'first', 'last', 'nth'];
            if (multiElementActions.includes(actionInfo.action)) {
              showTestResult(true, displayResult);
            } else {
              // Show warning about strict mode violation
              showTestResult(false, `⚠️ Strict mode: ${result.count} elements found. Use .first(), .nth(n), or make locator more specific.\nResult on first: ${displayResult}`);
            }
          } else {
            showTestResult(true, displayResult);
          }
        } else if (result.count === 1) {
          elementNavigation.totalCount = 1;
          elementNavigation.locatorScript = null;
          elementNavigation.hasFrameLocator = false;
          showTestResult(true, '1 element found');
        } else {
          // Multiple elements - enable navigation
          elementNavigation.currentIndex = 0;
          elementNavigation.totalCount = result.count;
          elementNavigation.locatorScript = hasFrameLocator ? locatorScript : (locatorScript.replace(/\bdocument\./g, 'targetDoc.'));
          elementNavigation.hasFrameLocator = hasFrameLocator;
          showTestResultWithNavigation(result.count);
        }
      } else {
        elementNavigation.totalCount = 0;
        elementNavigation.locatorScript = null;
        showTestResult(false, `Invalid selector: ${result.error}`);
      }
    }).catch(err => {
      elementNavigation.totalCount = 0;
      elementNavigation.locatorScript = null;
      showTestResult(false, `Execution error: ${err.message}`);
    });
  }

  function showTestResultWithNavigation(count) {
    testLocatorResult.className = 'test-locator-result visible success';
    testLocatorResult.innerHTML = `
      <span class="result-icon">✓</span>
      <span class="result-text">1 of ${count} elements</span>
      <span class="nav-buttons">
        <button class="nav-prev" title="Previous (circular)">◀</button>
        <button class="nav-next" title="Next (circular)">▶</button>
      </span>
    `;
  }

  // Parse action from the full locator string
  function parseAction(input) {
    // Playwright actions: .click(), .fill('text'), .textContent(), etc.
    // Selenium actions: .click(), .sendKeys("text"), .getText(), etc.
    // Cypress actions: .click(), .type('text'), .should('be.visible'), etc.

    // First, extract any element selector (first, last, nth) from the locator
    // These can appear BEFORE the final action: .nth(0).textContent()
    let selector = null;
    let selectorValue = null;
    let workingInput = input;

    // Check for selector modifiers in the locator (not at the very end if there's an action after)
    const selectorPatterns = [
      { pattern: /\.nth\s*\(\s*(\d+)\s*\)/, selector: 'nth', hasValue: true },
      { pattern: /\.first\s*\(\s*\)/, selector: 'first' },
      { pattern: /\.last\s*\(\s*\)/, selector: 'last' }
    ];

    for (const { pattern, selector: sel, hasValue } of selectorPatterns) {
      const match = workingInput.match(pattern);
      if (match) {
        // Check if this is in the middle (followed by another method) or at the end
        const afterMatch = workingInput.slice(match.index + match[0].length);
        if (afterMatch.match(/^\s*\./)) {
          // Selector is in the middle - extract it and continue parsing
          selector = sel;
          selectorValue = hasValue ? match[1] : null;
          workingInput = workingInput.slice(0, match.index) + afterMatch;
          break;
        }
      }
    }

    // Pattern to match action at the end
    const actionPatterns = [
      // Actions with values - use non-greedy (.*?) to avoid capturing closing quote
      { pattern: /\.(fill|sendKeys|send_keys)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'fill', hasValue: true },
      { pattern: /\.(type)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'fill', hasValue: true }, // Cypress type()
      { pattern: /\.(selectOption|select_option|select)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'selectOption', hasValue: true },
      { pattern: /\.(getAttribute|get_attribute)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'getAttribute', hasValue: true },
      { pattern: /\.(getCssValue|value_of_css_property)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'getCssValue', hasValue: true },
      // Cypress invoke() with method and optional argument - capture both
      { pattern: /\.invoke\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"]\s*)?\)\s*$/, action: 'invoke', hasValue: true, isInvoke: true },
      // Cypress should() assertions - capture assertion and optional value
      { pattern: /\.should\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"]\s*)?\)\s*$/, action: 'should', hasValue: true, isShould: true },
      // Cypress trigger() - trigger events
      { pattern: /\.trigger\s*\(\s*['"]([^'"]+)['"]\s*\)\s*$/, action: 'trigger', hasValue: true },
      // Playwright press() for keyboard
      { pattern: /\.(press|pressSequentially)\s*\(\s*['"](.*?)['"]\s*\)\s*$/, action: 'press', hasValue: true },
      // Playwright setChecked()
      { pattern: /\.(setChecked|set_checked)\s*\(\s*(true|false)\s*\)\s*$/, action: 'setChecked', hasValue: true },
      // Playwright waitFor with state
      { pattern: /\.(waitFor|wait_for)\s*\(\s*\{\s*state\s*:\s*['"](.*?)['"]\s*\}\s*\)\s*$/, action: 'waitFor', hasValue: true },
      // Playwright nth(), first(), last() - only when at the END (no action after)
      { pattern: /\.nth\s*\(\s*(\d+)\s*\)\s*$/, action: 'nth', hasValue: true },
      // Actions without values
      { pattern: /\.click\s*\(\s*\)\s*$/, action: 'click' },
      { pattern: /\.dblclick\s*\(\s*\)\s*$/, action: 'dblclick' }, // Cypress dblclick
      { pattern: /\.rightclick\s*\(\s*\)\s*$/, action: 'rightclick' }, // Cypress rightclick
      { pattern: /\.(textContent|getText|text)\s*\(?\s*\)?\s*$/, action: 'getText' },
      { pattern: /\.(innerText|inner_text)\s*\(\s*\)\s*$/, action: 'innerText' },
      { pattern: /\.(innerHTML|inner_html)\s*\(\s*\)\s*$/, action: 'innerHTML' },
      { pattern: /\.(inputValue|input_value)\s*\(\s*\)\s*$/, action: 'inputValue' },
      { pattern: /\.(isVisible|is_visible|isDisplayed|is_displayed)\s*\(\s*\)\s*$/, action: 'isVisible' },
      { pattern: /\.(isHidden|is_hidden)\s*\(\s*\)\s*$/, action: 'isHidden' },
      { pattern: /\.(isEnabled|is_enabled)\s*\(\s*\)\s*$/, action: 'isEnabled' },
      { pattern: /\.(isDisabled|is_disabled)\s*\(\s*\)\s*$/, action: 'isDisabled' },
      { pattern: /\.(isEditable|is_editable)\s*\(\s*\)\s*$/, action: 'isEditable' },
      { pattern: /\.(isChecked|is_checked|isSelected|is_selected)\s*\(\s*\)\s*$/, action: 'isChecked' },
      { pattern: /\.check\s*\(\s*\)\s*$/, action: 'check' },
      { pattern: /\.uncheck\s*\(\s*\)\s*$/, action: 'uncheck' },
      { pattern: /\.(hover|mouseover)\s*\(\s*\)\s*$/, action: 'hover' },
      { pattern: /\.focus\s*\(\s*\)\s*$/, action: 'focus' },
      { pattern: /\.blur\s*\(\s*\)\s*$/, action: 'blur' },
      { pattern: /\.clear\s*\(\s*\)\s*$/, action: 'clear' },
      { pattern: /\.submit\s*\(\s*\)\s*$/, action: 'submit' },
      { pattern: /\.(getTagName|tag_name)\s*\(?\s*\)?\s*$/, action: 'getTagName' },
      { pattern: /\.count\s*\(\s*\)\s*$/, action: 'count' },
      { pattern: /\.(scrollIntoViewIfNeeded|scroll_into_view_if_needed)\s*\(\s*\)\s*$/, action: 'scrollIntoViewIfNeeded' },
      { pattern: /\.scrollIntoView\s*\(\s*[^)]*\)\s*$/, action: 'scroll' }, // Cypress scrollIntoView
      { pattern: /\.scrollTo\s*\(\s*[^)]*\)\s*$/, action: 'scroll' }, // Cypress scrollTo
      { pattern: /\.(boundingBox|bounding_box)\s*\(\s*\)\s*$/, action: 'boundingBox' },
      { pattern: /\.(selectText|select_text)\s*\(\s*\)\s*$/, action: 'selectText' },
      { pattern: /\.highlight\s*\(\s*\)\s*$/, action: 'highlight' },
      { pattern: /\.first\s*\(\s*\)\s*$/, action: 'first' },
      { pattern: /\.last\s*\(\s*\)\s*$/, action: 'last' },
      { pattern: /\.screenshot\s*\(\s*\)\s*$/, action: 'screenshot' }
    ];

    for (const { pattern, action, hasValue, isInvoke, isShould } of actionPatterns) {
      const match = workingInput.match(pattern);
      if (match) {
        // Remove the action part from input to get the locator
        const locator = workingInput.replace(pattern, '');

        // For invoke/should, we need both the method and optional argument
        if (isInvoke || isShould) {
          return {
            locator,
            action,
            actionValue: match[1], // method name or assertion
            actionArg: match[2] || null, // optional argument
            selector,
            selectorValue
          };
        }

        return {
          locator,
          action,
          actionValue: hasValue ? (match[2] || match[1]) : null,
          selector,
          selectorValue
        };
      }
    }

    // No action found
    return { locator: workingInput, action: null, actionValue: null, selector, selectorValue };
  }

  // Generate JavaScript to execute the action
  function generateActionScript(action, value, arg) {
    const escapedValue = value ? value.replace(/'/g, "\\'").replace(/"/g, '\\"') : '';
    const escapedArg = arg ? arg.replace(/'/g, "\\'").replace(/"/g, '\\"') : '';

    switch (action) {
      case 'click':
        return `element.click(); var actionResult = 'Clicked';`;
      case 'dblclick':
        return `
          element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          var actionResult = 'Double Clicked';
        `;
      case 'rightclick':
        return `
          element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
          var actionResult = 'Right Clicked';
        `;
      case 'fill':
        return `
          element.value = '${escapedValue}';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          var actionResult = 'Filled with: ${escapedValue}';
        `;
      case 'getText':
        return `var actionResult = element.textContent || element.innerText || '';`;
      case 'innerText':
        return `var actionResult = element.innerText || '';`;
      case 'inputValue':
        return `var actionResult = element.value || '';`;
      case 'getAttribute':
        // Special handling for 'class' attribute - filter out __locatorlabs classes
        if (escapedValue === 'class') {
          return `
            var rawClass = element.getAttribute('class') || '';
            var actionResult = rawClass.split(' ').filter(c => !c.startsWith('__locatorlabs')).join(' ').trim();
          `;
        }
        return `var actionResult = element.getAttribute('${escapedValue}') || '';`;
      case 'isVisible':
        return `
          var rect = element.getBoundingClientRect();
          var style = window.getComputedStyle(element);
          var actionResult = rect.width > 0 && rect.height > 0 &&
                             style.visibility !== 'hidden' &&
                             style.display !== 'none';
        `;
      case 'isEnabled':
        return `var actionResult = !element.disabled;`;
      case 'isChecked':
        return `var actionResult = element.checked || element.getAttribute('aria-checked') === 'true';`;
      case 'check':
        return `
          if (!element.checked) element.click();
          var actionResult = 'Checked';
        `;
      case 'uncheck':
        return `
          if (element.checked) element.click();
          var actionResult = 'Unchecked';
        `;
      case 'hover':
        return `
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          var actionResult = 'Hovered';
        `;
      case 'focus':
        return `element.focus(); var actionResult = 'Focused';`;
      case 'blur':
        return `element.blur(); var actionResult = 'Blurred';`;
      case 'clear':
        return `
          element.value = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          var actionResult = 'Cleared';
        `;
      case 'submit':
        return `
          var form = element.closest('form');
          if (form) form.submit();
          var actionResult = 'Submitted';
        `;
      case 'getTagName':
        return `var actionResult = element.tagName.toLowerCase();`;
      case 'selectOption':
        return `
          var actionResult = 'Error: Element is not a SELECT';
          if (element.tagName === 'SELECT') {
            var options = element.options;
            var optionFound = false;
            for (var i = 0; i < options.length; i++) {
              if (options[i].value === '${escapedValue}' || options[i].text === '${escapedValue}') {
                element.selectedIndex = i;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                optionFound = true;
                break;
              }
            }
            if (optionFound) {
              actionResult = 'Selected: ${escapedValue}';
            } else {
              // List available options to help user
              var availableOptions = Array.from(options).map(function(o) { return o.text || o.value; }).slice(0, 5);
              var optionsHint = availableOptions.length > 0 ? ' Available: ' + availableOptions.join(', ') + (options.length > 5 ? '...' : '') : '';
              actionResult = 'Error: Option "${escapedValue}" not found.' + optionsHint;
            }
          }
        `;
      case 'getCssValue':
        return `var actionResult = window.getComputedStyle(element).getPropertyValue('${escapedValue}') || '';`;
      case 'count':
        return `var actionResult = elements.length;`;
      case 'scroll':
        return `
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var actionResult = 'Scrolled into view';
        `;
      case 'scrollIntoViewIfNeeded':
        return `
          if (element.scrollIntoViewIfNeeded) {
            element.scrollIntoViewIfNeeded(true);
          } else {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          var actionResult = 'Scrolled into view if needed';
        `;
      case 'isHidden':
        return `
          var rect = element.getBoundingClientRect();
          var style = window.getComputedStyle(element);
          var actionResult = rect.width === 0 || rect.height === 0 ||
                             style.visibility === 'hidden' ||
                             style.display === 'none';
        `;
      case 'isDisabled':
        return `var actionResult = element.disabled === true;`;
      case 'isEditable':
        return `
          var actionResult = !element.disabled && !element.readOnly &&
                             (element.isContentEditable ||
                              element.tagName === 'INPUT' ||
                              element.tagName === 'TEXTAREA' ||
                              element.tagName === 'SELECT');
        `;
      case 'innerHTML':
        return `var actionResult = element.innerHTML || '';`;
      case 'boundingBox':
        return `
          var rect = element.getBoundingClientRect();
          var actionResult = JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        `;
      case 'selectText':
        return `
          if (element.select) {
            element.select();
            var actionResult = 'Text selected';
          } else if (window.getSelection) {
            var range = document.createRange();
            range.selectNodeContents(element);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            var actionResult = 'Text selected';
          } else {
            var actionResult = 'Text selection not supported';
          }
        `;
      case 'highlight':
        return `
          var originalOutline = element.style.outline;
          var originalBackground = element.style.backgroundColor;
          element.style.outline = '2px solid red';
          element.style.backgroundColor = 'rgba(255,255,0,0.3)';
          setTimeout(function() {
            element.style.outline = originalOutline;
            element.style.backgroundColor = originalBackground;
          }, 2000);
          var actionResult = 'Highlighted for 2 seconds';
        `;
      case 'press':
        return `
          var keyCode = { 'Enter': 13, 'Tab': 9, 'Escape': 27, 'Backspace': 8, 'Delete': 46, 'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39, 'Space': 32 };
          var key = '${escapedValue}';
          var code = keyCode[key] || key.charCodeAt(0);
          element.dispatchEvent(new KeyboardEvent('keydown', { key: key, code: key, keyCode: code, which: code, bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: key, code: key, keyCode: code, which: code, bubbles: true }));
          if (key.length === 1 && element.value !== undefined) {
            element.value += key;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
          var actionResult = 'Pressed: ${escapedValue}';
        `;
      case 'setChecked':
        return `
          var shouldBeChecked = ${escapedValue} === 'true' || ${escapedValue} === true;
          if (element.checked !== shouldBeChecked) {
            element.click();
          }
          var actionResult = 'Set checked: ' + shouldBeChecked;
        `;
      case 'waitFor':
        return `
          var state = '${escapedValue}';
          var rect = element.getBoundingClientRect();
          var style = window.getComputedStyle(element);
          var isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          var isHidden = !isVisible;
          var isAttached = document.body.contains(element);
          switch(state) {
            case 'visible': var actionResult = 'Visible: ' + isVisible; break;
            case 'hidden': var actionResult = 'Hidden: ' + isHidden; break;
            case 'attached': var actionResult = 'Attached: ' + isAttached; break;
            case 'detached': var actionResult = 'Detached: ' + !isAttached; break;
            default: var actionResult = 'State check for: ' + state;
          }
        `;
      case 'nth':
        // selectorScript already narrowed elements to the nth element
        // Just report success/failure based on whether element exists
        return `
          var actionResult = elements.length > 0 ? 'Selected element at index ${escapedValue}' : 'Error: Index ${escapedValue} out of range';
        `;
      case 'first':
        // selectorScript already narrowed elements to first element
        return `
          var actionResult = elements.length > 0 ? 'Selected first element' : 'Error: No elements found';
        `;
      case 'last':
        // selectorScript already narrowed elements to last element
        return `
          var actionResult = elements.length > 0 ? 'Selected last element' : 'Error: No elements found';
        `;
      case 'screenshot':
        return `var actionResult = 'Screenshot not available in test mode (use Playwright to capture)';`;
      case 'trigger':
        return `
          element.dispatchEvent(new Event('${escapedValue}', { bubbles: true }));
          var actionResult = 'Triggered: ${escapedValue}';
        `;
      // Cypress invoke() - call jQuery-like methods on element
      case 'invoke':
        // Handle common invoke methods
        switch (escapedValue) {
          case 'val':
            if (escapedArg) {
              return `
                element.value = '${escapedArg}';
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                var actionResult = 'Set value: ${escapedArg}';
              `;
            }
            return `var actionResult = element.value || '';`;
          case 'text':
            return `var actionResult = element.textContent || element.innerText || '';`;
          case 'html':
            return `var actionResult = element.innerHTML || '';`;
          case 'attr':
            if (escapedArg === 'class') {
              return `
                var rawClass = element.getAttribute('class') || '';
                var actionResult = rawClass.split(' ').filter(c => !c.startsWith('__locatorlabs')).join(' ').trim();
              `;
            }
            return `var actionResult = element.getAttribute('${escapedArg}') || '';`;
          case 'prop':
            return `var actionResult = element['${escapedArg}'];`;
          case 'css':
            return `var actionResult = window.getComputedStyle(element).getPropertyValue('${escapedArg}') || '';`;
          case 'show':
            return `element.style.display = ''; var actionResult = 'Shown';`;
          case 'hide':
            return `element.style.display = 'none'; var actionResult = 'Hidden';`;
          case 'width':
            return `var actionResult = element.offsetWidth;`;
          case 'height':
            return `var actionResult = element.offsetHeight;`;
          case 'scrollTop':
            return `var actionResult = element.scrollTop;`;
          case 'scrollLeft':
            return `var actionResult = element.scrollLeft;`;
          case 'focus':
            return `element.focus(); var actionResult = 'Focused';`;
          case 'blur':
            return `element.blur(); var actionResult = 'Blurred';`;
          case 'select':
            return `element.select(); var actionResult = 'Selected';`;
          case 'removeAttr':
            return `element.removeAttribute('${escapedArg}'); var actionResult = 'Removed attr: ${escapedArg}';`;
          case 'addClass':
            return `element.classList.add('${escapedArg}'); var actionResult = 'Added class: ${escapedArg}';`;
          case 'removeClass':
            return `element.classList.remove('${escapedArg}'); var actionResult = 'Removed class: ${escapedArg}';`;
          case 'toggleClass':
            return `element.classList.toggle('${escapedArg}'); var actionResult = 'Toggled class: ${escapedArg}';`;
          case 'hasClass':
            return `var actionResult = element.classList.contains('${escapedArg}');`;
          default:
            return `var actionResult = 'invoke(${escapedValue}): Method executed';`;
        }
      // Cypress should() assertions
      case 'should':
        switch (escapedValue) {
          case 'be.visible':
            return `
              var rect = element.getBoundingClientRect();
              var style = window.getComputedStyle(element);
              var isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
              var actionResult = isVisible ? 'Visible: true' : 'Visible: false';
            `;
          case 'not.be.visible':
          case 'be.hidden':
            return `
              var rect = element.getBoundingClientRect();
              var style = window.getComputedStyle(element);
              var isHidden = rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none';
              var actionResult = isHidden ? 'Hidden: true' : 'Hidden: false';
            `;
          case 'exist':
            return `var actionResult = 'Exists: true';`;
          case 'not.exist':
            return `var actionResult = 'Exists: ' + (element ? 'true (unexpected)' : 'false');`;
          case 'be.enabled':
            return `var actionResult = 'Enabled: ' + !element.disabled;`;
          case 'be.disabled':
            return `var actionResult = 'Disabled: ' + element.disabled;`;
          case 'be.checked':
            return `var actionResult = 'Checked: ' + (element.checked || element.getAttribute('aria-checked') === 'true');`;
          case 'not.be.checked':
            return `var actionResult = 'Not Checked: ' + !(element.checked || element.getAttribute('aria-checked') === 'true');`;
          case 'be.selected':
            return `var actionResult = 'Selected: ' + element.selected;`;
          case 'be.focused':
          case 'have.focus':
            return `var actionResult = 'Focused: ' + (document.activeElement === element);`;
          case 'be.empty':
            return `var actionResult = 'Empty: ' + (element.value === '' || element.textContent.trim() === '');`;
          case 'have.text':
            return `var actionResult = 'Text: ' + (element.textContent || element.innerText || '');`;
          case 'have.value':
            return `var actionResult = 'Value: ' + (element.value || '');`;
          case 'have.attr':
            if (escapedArg === 'class') {
              return `
                var rawClass = element.getAttribute('class') || '';
                var actionResult = 'Attr class: ' + rawClass.split(' ').filter(c => !c.startsWith('__locatorlabs')).join(' ').trim();
              `;
            }
            return `var actionResult = 'Attr ${escapedArg}: ' + (element.getAttribute('${escapedArg}') || '');`;
          case 'have.class':
            return `var actionResult = 'Has class ${escapedArg}: ' + element.classList.contains('${escapedArg}');`;
          case 'have.css':
            return `var actionResult = 'CSS ${escapedArg}: ' + window.getComputedStyle(element).getPropertyValue('${escapedArg}');`;
          case 'have.id':
            return `var actionResult = 'ID: ' + element.id;`;
          case 'have.prop':
            return `var actionResult = 'Prop ${escapedArg}: ' + element['${escapedArg}'];`;
          case 'contain':
          case 'include.text':
            return `var actionResult = 'Contains "${escapedArg}": ' + (element.textContent || '').includes('${escapedArg}');`;
          case 'have.length':
            return `var actionResult = 'Length: ' + elements.length;`;
          default:
            return `var actionResult = 'Assertion: ${escapedValue}' + (${escapedArg ? "' = ' + '${escapedArg}'" : "''"}); `;
        }
      default:
        return `var actionResult = 'Unknown action: ${action}';`;
    }
  }

  // Format action result for display
  function formatActionResult(action, result) {
    switch (action) {
      case 'getText':
      case 'innerText':
      case 'inputValue':
        return `textContent() → "${result}"`;
      case 'innerHTML':
        return `innerHTML() → "${result}"`;
      case 'getAttribute':
        return `getAttribute() → "${result}"`;
      case 'isVisible':
        return `isVisible() → ${result}`;
      case 'isHidden':
        return `isHidden() → ${result}`;
      case 'isEnabled':
        return `isEnabled() → ${result}`;
      case 'isDisabled':
        return `isDisabled() → ${result}`;
      case 'isEditable':
        return `isEditable() → ${result}`;
      case 'isChecked':
        return `isChecked() → ${result}`;
      case 'getTagName':
        return `tagName() → "${result}"`;
      case 'getCssValue':
        return `getCssValue() → "${result}"`;
      case 'count':
        return `count() → ${result}`;
      case 'boundingBox':
        return `boundingBox() → ${result}`;
      case 'click':
      case 'fill':
      case 'clear':
      case 'check':
      case 'uncheck':
      case 'hover':
      case 'focus':
      case 'blur':
      case 'submit':
      case 'dblclick':
      case 'rightclick':
      case 'scroll':
      case 'scrollIntoViewIfNeeded':
      case 'selectText':
      case 'highlight':
      case 'press':
      case 'setChecked':
      case 'trigger':
        return `${result} ✓`;
      case 'first':
      case 'last':
      case 'nth':
      case 'waitFor':
        if (result.startsWith('Error:')) {
          return `${result} ✗`;
        }
        return `${result} ✓`;
      case 'selectOption':
        // selectOption returns error message if option not found
        if (result.startsWith('Error:')) {
          return `${result} ✗`;
        }
        return `${result} ✓`;
      case 'screenshot':
        return `${result}`;
      default:
        return `Result: ${result}`;
    }
  }

  // Parse Playwright/Selenium locator syntax and generate DOM query script
  function parseLocatorToScript(locator) {
    // Clean up the locator - remove await, page., driver. prefixes
    let cleaned = locator
      .replace(/^await\s+/, '')
      .replace(/^page\./, '')
      .replace(/^driver\./, '')
      .trim();

    // Check for common syntax errors
    const syntaxErrors = validateLocatorSyntax(locator, cleaned);
    if (syntaxErrors) {
      return { error: syntaxErrors };
    }

    // ==================
    // PLAYWRIGHT FRAME LOCATORS (supports nested frames)
    // ==================

    // Check for incomplete frameLocator (no element locator after it)
    const incompleteFramePattern = /^frame_?[lL]ocator\s*\(\s*(["'])(.+?)\1\s*\)\s*$/;
    if (incompleteFramePattern.test(cleaned)) {
      return { error: 'Incomplete locator: frameLocator needs an element locator after it (e.g., .locator(), .getByRole())' };
    }

    // Extract all frame selectors from nested frameLocator/frame_locator calls
    const frameSelectors = [];
    let remainingLocator = cleaned;
    let framePattern = /^frame_?[lL]ocator\s*\(\s*(["'])(.+?)\1\s*\)\./;
    let frameMatch;

    while ((frameMatch = remainingLocator.match(framePattern))) {
      frameSelectors.push(escapeForScript(frameMatch[2]));
      remainingLocator = remainingLocator.slice(frameMatch[0].length);
    }

    if (frameSelectors.length > 0) {
      // Parse the element locator part (after all frame locators)
      const elementResult = parseLocatorToScript(remainingLocator);
      if (elementResult.error) {
        return elementResult;
      }

      // Generate script that finds the element through nested iframes
      // Replace document references with currentDoc and remove const/let from elements declaration
      // to assign to outer elements variable instead of re-declaring
      const elementScript = elementResult.script
        .replace(/\bdocument\b/g, 'currentDoc')  // Replace all 'document' references
        .replace(/\b(const|let)\s+elements\s*=/g, 'elements =');

      // Build the frame selectors array for the script
      const frameSelectorsList = frameSelectors.map(sel => {
        // Extract ID from selector like 'iframe#pact2' or '#pact2'
        const idMatch = sel.match(/#([^.[\]#]+)/);
        const frameId = idMatch ? idMatch[1] : '';

        // Extract name from selector like '[name="frameName"]'
        const nameMatch = sel.match(/\[name=["']?([^"'\]]+)["']?\]/);
        const frameName = nameMatch ? nameMatch[1] : '';

        // Build selector variations to try
        const selectors = [sel];  // Original selector first

        // If selector has tag#id format, also try just #id
        if (sel.match(/^(iframe|frame)#/i)) {
          selectors.push('#' + frameId);
        }

        // Add ID-based selectors
        if (frameId) {
          selectors.push('iframe#' + frameId);
          selectors.push('frame#' + frameId);
          selectors.push('[id="' + frameId + '"]');
        }

        // Add name-based selectors
        if (frameName) {
          selectors.push('iframe[name="' + frameName + '"]');
          selectors.push('frame[name="' + frameName + '"]');
          selectors.push('[name="' + frameName + '"]');
        }

        // Remove duplicates
        const uniqueSelectors = [...new Set(selectors)];

        return `{ selectors: [${uniqueSelectors.map(s => `'${s}'`).join(', ')}] }`;
      }).join(',\n          ');

      return { script: `
        let elements = [];
        let frameError = null;
        let debugInfo = { framesNavigated: 0, frameIds: [], elementScriptRan: false };
        const frameChain = [
          ${frameSelectorsList}
        ];

        console.log('[TestLocator] Starting frame navigation, chain:', frameChain.length, 'frames');

        let currentDoc = document;
        let frameFound = true;

        // Navigate through nested iframes
        for (let i = 0; i < frameChain.length; i++) {
          const frameInfo = frameChain[i];
          let iframe = null;
          let foundSelector = null;

          console.log('[TestLocator] Looking for frame', i+1, 'selectors:', frameInfo.selectors.slice(0,3));

          for (const sel of frameInfo.selectors) {
            try {
              iframe = currentDoc.querySelector(sel);
              if (iframe) {
                foundSelector = sel;
                console.log('[TestLocator] Found frame:', sel, iframe.id || iframe.name);
                break;
              }
            } catch(e) {
              console.log('[TestLocator] Selector error:', sel, e.message);
            }
          }

          if (!iframe) {
            frameFound = false;
            frameError = 'Frame ' + (i+1) + ' not found. Tried: ' + frameInfo.selectors.slice(0,3).join(', ');
            console.log('[TestLocator] FAILED:', frameError);
            break;
          }

          if (!iframe.contentDocument) {
            frameFound = false;
            frameError = 'Frame ' + (i+1) + ' (' + foundSelector + ') blocked: cross-origin or not loaded';
            console.log('[TestLocator] BLOCKED:', frameError);
            break;
          }

          console.log('[TestLocator] Switched to frame:', iframe.id || iframe.name);
          debugInfo.framesNavigated++;
          debugInfo.frameIds.push(iframe.id || iframe.name || foundSelector);
          currentDoc = iframe.contentDocument;
        }

        if (frameFound) {
          debugInfo.elementScriptRan = true;
          console.log('[TestLocator] Running element script in frame');
          console.log('[TestLocator] currentDoc:', currentDoc.location ? currentDoc.location.href : 'no location');
          console.log('[TestLocator] All buttons:', currentDoc.querySelectorAll('button').length);
          console.log('[TestLocator] All inputs:', currentDoc.querySelectorAll('input').length);
          console.log('[TestLocator] Labels:', Array.from(currentDoc.querySelectorAll('label')).map(l => ({ for: l.getAttribute('for'), text: l.textContent.trim() })));
          console.log('[TestLocator] Inputs:', Array.from(currentDoc.querySelectorAll('input')).map(i => ({ id: i.id, ariaLabel: i.getAttribute('aria-label'), placeholder: i.placeholder })));
          ${elementScript}
          console.log('[TestLocator] Found', elements.length, 'elements');
        } else {
          console.log('[TestLocator] Frame navigation failed');
        }
      `, hasFrameLocator: true };
    }

    // ==================
    // PLAYWRIGHT LOCATORS
    // ==================

    // getByRole('role', { name: 'text', level: N, checked: true/false, exact: true }) or getByRole('role') - JavaScript/TypeScript
    // Handles: getByRole('heading'), getByRole('radio', { name: 'Yes', checked: true }), etc.
    let match = cleaned.match(/getByRole\s*\(\s*['"](\w+)['"]\s*(?:,\s*\{([^}]*)\})?\s*\)/i);
    if (match) {
      const role = match[1];
      const options = match[2] || '';
      const nameMatch = options.match(/name\s*:\s*['"]([^'"]+)['"]/);
      const levelMatch = options.match(/level\s*:\s*(\d+)/);
      const checkedMatch = options.match(/checked\s*:\s*(true|false)/i);
      const exactMatch = options.match(/exact\s*:\s*(true|false)/i);
      const checked = checkedMatch ? checkedMatch[1].toLowerCase() === 'true' : undefined;
      const exact = exactMatch ? exactMatch[1].toLowerCase() === 'true' : false;
      return { script: generateGetByRoleScript(role, nameMatch ? nameMatch[1] : null, levelMatch ? parseInt(levelMatch[1]) : null, checked, exact) };
    }

    // getByRole(AriaRole.HEADING, new Page.GetByRoleOptions()...) - Java syntax
    match = cleaned.match(/getByRole\s*\(\s*AriaRole\.(\w+)\s*(?:,\s*new\s+Page\.GetByRoleOptions\(\)(.+?))?\s*\)/i);
    if (match) {
      const role = match[1].toLowerCase();
      const options = match[2] || '';
      const nameMatch = options.match(/\.setName\s*\(\s*["']([^"']+)["']\s*\)/);
      const levelMatch = options.match(/\.setLevel\s*\(\s*(\d+)\s*\)/);
      const checkedMatch = options.match(/\.setChecked\s*\(\s*(true|false)\s*\)/i);
      const exactMatch = options.match(/\.setExact\s*\(\s*(true|false)\s*\)/i);
      const checked = checkedMatch ? checkedMatch[1].toLowerCase() === 'true' : undefined;
      const exact = exactMatch ? exactMatch[1].toLowerCase() === 'true' : false;
      return { script: generateGetByRoleScript(role, nameMatch ? nameMatch[1] : null, levelMatch ? parseInt(levelMatch[1]) : null, checked, exact) };
    }

    // get_by_role("role", name="text", level=N, checked=True/False, exact=True) - Python syntax
    match = cleaned.match(/get_by_role\s*\(\s*["'](\w+)["']\s*(?:,\s*(.+))?\s*\)/i);
    if (match) {
      const role = match[1];
      const options = match[2] || '';
      const nameMatch = options.match(/name\s*=\s*["']([^"']+)["']/);
      const levelMatch = options.match(/level\s*=\s*(\d+)/);
      const checkedMatch = options.match(/checked\s*=\s*(True|False)/i);
      const exactMatch = options.match(/exact\s*=\s*(True|False)/i);
      const checked = checkedMatch ? checkedMatch[1].toLowerCase() === 'true' : undefined;
      const exact = exactMatch ? exactMatch[1].toLowerCase() === 'true' : false;
      return { script: generateGetByRoleScript(role, nameMatch ? nameMatch[1] : null, levelMatch ? parseInt(levelMatch[1]) : null, checked, exact) };
    }

    // getByLabel('text') or getByLabel('text', { exact: true }) or get_by_label("text") or get_by_label("text", exact=True)
    match = cleaned.match(/get_?[bB]y_?[lL]abel\s*\(\s*['"](.+?)['"]\s*(?:,\s*(?:\{\s*exact\s*:\s*(true|false)\s*\}|exact\s*=\s*(True|False)))?\s*\)/i);
    if (match) {
      const label = escapeForScript(match[1]);
      const isExact = (match[2] && match[2].toLowerCase() === 'true') || (match[3] && match[3].toLowerCase() === 'true');
      if (isExact) {
        return { script: `
          const normalizeWS = (s) => s ? s.trim().replace(/[\\s\\u00A0\\u200B]+/g, ' ') : '';
          const elements = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
            // Method 1: Label with for attribute
            if (el.id) {
              const labelEl = document.querySelector('label[for="' + el.id + '"]');
              if (labelEl && normalizeWS(labelEl.textContent) === '${label}') return true;
            }
            // Method 2: Parent label element
            const parentLabel = el.closest('label');
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true);
              clone.querySelectorAll('input, select, textarea').forEach(inp => inp.remove());
              if (normalizeWS(clone.textContent) === '${label}') return true;
            }
            // Method 3: Adjacent <label> sibling for checkbox/radio ONLY
            // Playwright only recognizes proper <label> elements
            if (el.type === 'checkbox' || el.type === 'radio') {
              let sibling = el.nextSibling;
              while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                  if (normalizeWS(sibling.textContent) === '${label}') return true;
                }
                sibling = sibling.nextSibling;
              }
              sibling = el.previousSibling;
              while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                  if (normalizeWS(sibling.textContent) === '${label}') return true;
                }
                sibling = sibling.previousSibling;
              }
            }
            // Method 4: aria-label
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && normalizeWS(ariaLabel) === '${label}') return true;
            // Method 5: aria-labelledby
            const labelledById = el.getAttribute('aria-labelledby');
            if (labelledById) {
              const labelledByEl = document.getElementById(labelledById);
              if (labelledByEl && normalizeWS(labelledByEl.textContent) === '${label}') return true;
            }
            return false;
          });
        ` };
      }
      return { script: `
        const normalizeWS = (s) => s ? s.trim().replace(/[\\s\\u00A0\\u200B]+/g, ' ') : '';
        const elements = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
          // Method 1: Label with for attribute
          if (el.id) {
            const labelEl = document.querySelector('label[for="' + el.id + '"]');
            if (labelEl && normalizeWS(labelEl.textContent).includes('${label}')) return true;
          }
          // Method 2: Parent label element
          const parentLabel = el.closest('label');
          if (parentLabel) {
            const clone = parentLabel.cloneNode(true);
            clone.querySelectorAll('input, select, textarea').forEach(inp => inp.remove());
            if (normalizeWS(clone.textContent).includes('${label}')) return true;
          }
          // Method 3: Adjacent <label> sibling for checkbox/radio ONLY
          // Playwright only recognizes proper <label> elements
          if (el.type === 'checkbox' || el.type === 'radio') {
            let sibling = el.nextSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                if (normalizeWS(sibling.textContent).includes('${label}')) return true;
              }
              sibling = sibling.nextSibling;
            }
            sibling = el.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                if (normalizeWS(sibling.textContent).includes('${label}')) return true;
              }
              sibling = sibling.previousSibling;
            }
          }
          // Method 4: aria-label
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel && normalizeWS(ariaLabel).includes('${label}')) return true;
          // Method 5: aria-labelledby
          const labelledById = el.getAttribute('aria-labelledby');
          if (labelledById) {
            const labelledByEl = document.getElementById(labelledById);
            if (labelledByEl && normalizeWS(labelledByEl.textContent).includes('${label}')) return true;
          }
          return false;
        });
      ` };
    }

    // getByPlaceholder('text') or getByPlaceholder('text', { exact: true }) or get_by_placeholder("text") or get_by_placeholder("text", exact=True)
    match = cleaned.match(/get_?[bB]y_?[pP]laceholder\s*\(\s*['"](.+?)['"]\s*(?:,\s*(?:\{\s*exact\s*:\s*(true|false)\s*\}|exact\s*=\s*(True|False)))?\s*\)/i);
    if (match) {
      const placeholder = escapeForScript(match[1]);
      const isExact = (match[2] && match[2].toLowerCase() === 'true') || (match[3] && match[3].toLowerCase() === 'true');
      if (isExact) {
        return { script: `const elements = Array.from(document.querySelectorAll('[placeholder]')).filter(el => el.getAttribute('placeholder').trim() === '${placeholder}');` };
      }
      return { script: `const elements = Array.from(document.querySelectorAll('[placeholder*="${placeholder}"]'));` };
    }

    // getByText('text', { exact: true }) or get_by_text("text", exact=True) - JS/Python
    match = cleaned.match(/get_?[bB]y_?[tT]ext\s*\(\s*['"](.+?)['"]\s*(?:,\s*(?:\{\s*exact\s*:\s*true\s*\}|exact\s*=\s*True))?\s*\)/i);
    if (match) {
      const text = escapeForScript(match[1]);
      // Check if exact matching is specified
      const isExact = /exact\s*[=:]\s*(?:true|True)/i.test(cleaned);
      if (isExact) {
        return { script: `
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const directText = Array.from(el.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent.trim())
              .join('');
            return directText === '${text}' || el.textContent.trim() === '${text}';
          });
        ` };
      }
      return { script: `
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          return el.childNodes.length > 0 &&
                 Array.from(el.childNodes).some(node =>
                   node.nodeType === Node.TEXT_NODE && node.textContent.includes('${text}')
                 );
        });
      ` };
    }

    // getByText("text", new Page.GetByTextOptions().setExact(true)) - Java syntax
    match = cleaned.match(/getByText\s*\(\s*["'](.+?)["']\s*(?:,\s*new\s+Page\.GetByTextOptions\(\)(.+?))?\s*\)/i);
    if (match) {
      const text = escapeForScript(match[1]);
      const options = match[2] || '';
      const isExact = /\.setExact\s*\(\s*true\s*\)/i.test(options);
      if (isExact) {
        return { script: `
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const directText = Array.from(el.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent.trim())
              .join('');
            return directText === '${text}' || el.textContent.trim() === '${text}';
          });
        ` };
      }
      return { script: `
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          return el.childNodes.length > 0 &&
                 Array.from(el.childNodes).some(node =>
                   node.nodeType === Node.TEXT_NODE && node.textContent.includes('${text}')
                 );
        });
      ` };
    }

    // getByTestId('id') or get_by_test_id("id")
    match = cleaned.match(/get_?[bB]y_?[tT]est_?[iI]d\s*\(\s*['"](.+?)['"]\s*\)/);
    if (match) {
      const testId = escapeForScript(match[1]);
      return { script: `const elements = Array.from(document.querySelectorAll('[data-testid="${testId}"], [data-test-id="${testId}"]'));` };
    }

    // getByAltText('text') or getByAltText('text', { exact: true }) or get_by_alt_text("text") or get_by_alt_text("text", exact=True)
    match = cleaned.match(/get_?[bB]y_?[aA]lt_?[tT]ext\s*\(\s*['"](.+?)['"]\s*(?:,\s*(?:\{\s*exact\s*:\s*(true|false)\s*\}|exact\s*=\s*(True|False)))?\s*\)/i);
    if (match) {
      const altText = escapeForScript(match[1]);
      const isExact = (match[2] && match[2].toLowerCase() === 'true') || (match[3] && match[3].toLowerCase() === 'true');
      if (isExact) {
        return { script: `const elements = Array.from(document.querySelectorAll('[alt]')).filter(el => el.getAttribute('alt').trim() === '${altText}');` };
      }
      return { script: `const elements = Array.from(document.querySelectorAll('[alt*="${altText}"]'));` };
    }

    // getByTitle('text') or getByTitle('text', { exact: true }) or get_by_title("text") or get_by_title("text", exact=True)
    match = cleaned.match(/get_?[bB]y_?[tT]itle\s*\(\s*['"](.+?)['"]\s*(?:,\s*(?:\{\s*exact\s*:\s*(true|false)\s*\}|exact\s*=\s*(True|False)))?\s*\)/i);
    if (match) {
      const title = escapeForScript(match[1]);
      const isExact = (match[2] && match[2].toLowerCase() === 'true') || (match[3] && match[3].toLowerCase() === 'true');
      if (isExact) {
        return { script: `const elements = Array.from(document.querySelectorAll('[title]')).filter(el => el.getAttribute('title').trim() === '${title}');` };
      }
      return { script: `const elements = Array.from(document.querySelectorAll('[title*="${title}"]'));` };
    }

    // Chained locators: locator('#parent').getByRole('heading', { name: 'text' })
    match = cleaned.match(/locator\s*\(\s*(["'])([^"']+)\1\s*\)\s*\.\s*(getBy\w+|get_by_\w+)\s*\((.+)\)/i);
    if (match) {
      const parentSelector = escapeForScript(match[2]);
      const method = match[3];
      const args = match[4];

      // Parse the chained method
      let childScript = '';
      if (/getByRole|get_by_role/i.test(method)) {
        // Support JS/Python: 'heading' and Java: AriaRole.HEADING
        const roleMatch = args.match(/['"](\w+)['"]/) || args.match(/AriaRole\.(\w+)/i);
        // Support JS: { name: 'text' }, Python: name="text", Java: .setName("text")
        const nameMatch = args.match(/name\s*[=:]\s*['"]([^'"]+)['"]/) || args.match(/\.setName\s*\(\s*["']([^"']+)["']\s*\)/);
        // Support JS: { level: 1 }, Python: level=1, Java: .setLevel(1)
        const levelMatch = args.match(/level\s*[=:]\s*(\d+)/) || args.match(/\.setLevel\s*\(\s*(\d+)\s*\)/);
        if (roleMatch) {
          const role = roleMatch[1].toLowerCase(); // Convert to lowercase for Java AriaRole.HEADING
          const name = nameMatch ? nameMatch[1] : null;
          const level = levelMatch ? parseInt(levelMatch[1]) : null;

          // Build child filter
          let selector;
          if (role === 'heading' && level) {
            selector = `h${level}, [role="heading"][aria-level="${level}"]`;
          } else {
            const roleToSelector = {
              'button': 'button, input[type="button"], input[type="submit"], [role="button"]',
              'textbox': 'input[type="text"], input[type="email"], input[type="password"], input[type="search"], input:not([type]), textarea, [role="textbox"]',
              'link': 'a[href], [role="link"]',
              'heading': 'h1, h2, h3, h4, h5, h6, [role="heading"]',
              'checkbox': 'input[type="checkbox"], [role="checkbox"]',
              'radio': 'input[type="radio"], [role="radio"]',
              'combobox': 'select, [role="combobox"]'
            };
            selector = roleToSelector[role] || `[role="${role}"]`;
          }
          const escapedName = name ? escapeForScript(name) : null;
          if (escapedName) {
            childScript = `
              const parent = document.querySelector('${parentSelector}');
              const elements = parent ? Array.from(parent.querySelectorAll('${selector}')).filter(el => {
                const accessibleName = el.getAttribute('aria-label') || el.textContent.trim() || '';
                return accessibleName.toLowerCase().includes('${escapedName}'.toLowerCase());
              }) : [];
            `;
          } else {
            childScript = `
              const parent = document.querySelector('${parentSelector}');
              const elements = parent ? Array.from(parent.querySelectorAll('${selector}')) : [];
            `;
          }
          return { script: childScript };
        }
      } else if (/getByText|get_by_text/i.test(method)) {
        const textMatch = args.match(/['"]([^'"]+)['"]/);
        if (textMatch) {
          const text = escapeForScript(textMatch[1]);
          childScript = `
            const parent = document.querySelector('${parentSelector}');
            const elements = parent ? Array.from(parent.querySelectorAll('*')).filter(el => {
              return el.textContent.trim() === '${text}' || el.textContent.includes('${text}');
            }) : [];
          `;
          return { script: childScript };
        }
      } else if (/getByLabel|get_by_label/i.test(method)) {
        const labelMatch = args.match(/['"]([^'"]+)['"]/);
        if (labelMatch) {
          const label = escapeForScript(labelMatch[1]);
          childScript = `
            const parent = document.querySelector('${parentSelector}');
            const elements = parent ? Array.from(parent.querySelectorAll('input, select, textarea')).filter(el => {
              const id = el.id;
              if (id) {
                const labelEl = parent.querySelector('label[for="' + id + '"]') || document.querySelector('label[for="' + id + '"]');
                if (labelEl && labelEl.textContent.toLowerCase().includes('${label}'.toLowerCase())) return true;
              }
              const ariaLabel = el.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.toLowerCase().includes('${label}'.toLowerCase())) return true;
              const placeholder = el.getAttribute('placeholder');
              if (placeholder && placeholder.toLowerCase().includes('${label}'.toLowerCase())) return true;
              return false;
            }) : [];
          `;
          return { script: childScript };
        }
      }
    }

    // locator('css') or locator("css") - handles :has-text() and xpath=
    match = cleaned.match(/locator\s*\(\s*(["'`])(.+)\1\s*\)/);
    if (match) {
      const selector = match[2];

      // Handle XPath (starts with // or xpath=)
      if (selector.startsWith('xpath=') || selector.startsWith('//')) {
        const xpath = selector.replace('xpath=', '');
        return { script: generateXPathScript(xpath) };
      }

      // Handle :has-text() pseudo-selector (Playwright-specific)
      const hasTextMatch = selector.match(/^([^:]+):has-text\(["'](.+?)["']\)$/);
      if (hasTextMatch) {
        const tagSelector = escapeForScript(hasTextMatch[1]);
        const text = escapeForScript(hasTextMatch[2]);
        return { script: `
          const elements = Array.from(document.querySelectorAll('${tagSelector}')).filter(el => {
            return el.textContent.includes('${text}');
          });
        ` };
      }

      // Handle :text() pseudo-selector (Playwright-specific)
      const textMatch = selector.match(/^([^:]+):text\(["'](.+?)["']\)$/);
      if (textMatch) {
        const tagSelector = escapeForScript(textMatch[1]);
        const text = escapeForScript(textMatch[2]);
        return { script: `
          const elements = Array.from(document.querySelectorAll('${tagSelector}')).filter(el => {
            return el.textContent.trim() === '${text}';
          });
        ` };
      }

      // Standard CSS selector
      const escapedSelector = escapeForScript(selector);
      return { script: `const elements = Array.from(document.querySelectorAll('${escapedSelector}'));` };
    }

    // ==================
    // SELENIUM LOCATORS
    // ==================

    // findElement(By.id("value")) or find_element(By.ID, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:id|ID)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const id = escapeForScript(match[1]);
      return { script: `const elements = Array.from(document.querySelectorAll('#${id}'));` };
    }

    // findElement(By.name("value")) or find_element(By.NAME, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:name|NAME)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const name = escapeForScript(match[1]);
      return { script: `const elements = Array.from(document.querySelectorAll('[name="${name}"]'));` };
    }

    // findElement(By.cssSelector("value")) or find_element(By.CSS_SELECTOR, "value")
    // Use backreference to handle complex selectors with quotes
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:cssSelector|CSS_SELECTOR)\s*(?:\(|,)\s*(["'])(.+)\1\s*\)?\s*\)/);
    if (match) {
      const selector = escapeForScript(match[2]);
      return { script: `const elements = Array.from(document.querySelectorAll('${selector}'));` };
    }

    // findElement(By.xpath("value")) or find_element(By.XPATH, "value")
    // Use backreference to handle escaped quotes inside XPath - matches opening quote and same closing quote
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:xpath|XPATH)\s*(?:\(|,)\s*(["'])(.+)\1\s*\)?\s*\)/);
    if (match) {
      // match[1] is the quote character, match[2] is the xpath content
      // Use generateXPathScript for proper quote handling in XPath
      return { script: generateXPathScript(match[2]) };
    }

    // findElement(By.className("value")) or find_element(By.CLASS_NAME, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:className|CLASS_NAME)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const className = escapeForScript(match[1]);
      return { script: `const elements = Array.from(document.querySelectorAll('.${className}'));` };
    }

    // findElement(By.tagName("value")) or find_element(By.TAG_NAME, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:tagName|TAG_NAME)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const tagName = escapeForScript(match[1]);
      return { script: `const elements = Array.from(document.querySelectorAll('${tagName}'));` };
    }

    // findElement(By.linkText("value")) or find_element(By.LINK_TEXT, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:linkText|LINK_TEXT)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const linkText = escapeForScript(match[1]);
      return { script: `
        const elements = Array.from(document.querySelectorAll('a')).filter(el =>
          el.textContent.trim() === '${linkText}'
        );
      ` };
    }

    // findElement(By.partialLinkText("value")) or find_element(By.PARTIAL_LINK_TEXT, "value")
    match = cleaned.match(/find_?[eE]lement\s*\(\s*By\.(?:partialLinkText|PARTIAL_LINK_TEXT)\s*(?:\(|,)\s*["'](.+?)["']\s*\)?\s*\)/);
    if (match) {
      const partialLinkText = escapeForScript(match[1]);
      return { script: `
        const elements = Array.from(document.querySelectorAll('a')).filter(el =>
          el.textContent.includes('${partialLinkText}')
        );
      ` };
    }

    // ==================
    // CYPRESS LOCATORS
    // ==================

    // cy.get('selector', { includeShadowDom: true }) - CSS selector with shadow DOM support
    match = cleaned.match(/^cy\.get\s*\(\s*(['"])(.+)\1\s*,\s*\{\s*includeShadowDom\s*:\s*true\s*\}\s*\)$/);
    if (match) {
      const selector = escapeForScript(match[2]);
      return { script: `
        // Search in regular DOM and shadow DOMs
        function queryShadowDom(root, selector) {
          let results = Array.from(root.querySelectorAll(selector));
          root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
              results = results.concat(queryShadowDom(el.shadowRoot, selector));
            }
          });
          return results;
        }
        const elements = queryShadowDom(document, '${selector}');
      ` };
    }

    // cy.get('selector') - CSS selector (use backreference for matching quotes)
    match = cleaned.match(/^cy\.get\s*\(\s*(['"])(.+)\1\s*(?:,\s*\{[^}]*\})?\s*\)$/);
    if (match) {
      const selector = escapeForScript(match[2]);
      return { script: `const elements = Array.from(document.querySelectorAll('${selector}'));` };
    }

    // cy.contains('selector', 'text', { includeShadowDom: true }) - with shadow DOM
    match = cleaned.match(/^cy\.contains\s*\(\s*(['"])(.+?)\1\s*,\s*(['"])(.+)\3\s*,\s*\{\s*includeShadowDom\s*:\s*true\s*\}\s*\)$/);
    if (match) {
      const selector = escapeForScript(match[2]);
      const text = escapeForScript(match[4]);
      return { script: `
        function queryShadowDomAll(root, selector) {
          let results = Array.from(root.querySelectorAll(selector));
          root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
              results = results.concat(queryShadowDomAll(el.shadowRoot, selector));
            }
          });
          return results;
        }
        const allMatches = queryShadowDomAll(document, '${selector}').filter(el =>
          el.textContent.includes('${text}')
        );
        const elements = allMatches.filter(el =>
          !allMatches.some(other => other !== el && el.contains(other))
        );
      ` };
    }

    // cy.contains('selector', 'text') - two argument form (check first, more specific)
    // Cypress checks: textContent, value (for inputs), title, aria-label, alt, placeholder
    // Returns all unique deepest matching elements
    match = cleaned.match(/^cy\.contains\s*\(\s*(['"])(.+?)\1\s*,\s*(['"])(.+)\3\s*(?:,\s*\{[^}]*\})?\s*\)$/);
    if (match) {
      const selector = escapeForScript(match[2]);
      const text = escapeForScript(match[4]);
      return { script: `
        const allMatches = Array.from(document.querySelectorAll('${selector}')).filter(el => {
          // Check textContent
          if (el.textContent.includes('${text}')) return true;
          // Check value attribute (for inputs)
          if (el.value && el.value.includes('${text}')) return true;
          // Check title attribute
          if (el.getAttribute('title')?.includes('${text}')) return true;
          // Check aria-label attribute
          if (el.getAttribute('aria-label')?.includes('${text}')) return true;
          // Check alt attribute (for images)
          if (el.getAttribute('alt')?.includes('${text}')) return true;
          // Check placeholder attribute
          if (el.getAttribute('placeholder')?.includes('${text}')) return true;
          return false;
        });
        // Filter to keep only deepest elements (no children in the match list)
        const elements = allMatches.filter(el =>
          !allMatches.some(other => other !== el && el.contains(other))
        );
      ` };
    }

    // cy.contains('text', { includeShadowDom: true }) - with shadow DOM
    match = cleaned.match(/^cy\.contains\s*\(\s*(['"])(.+)\1\s*,\s*\{\s*includeShadowDom\s*:\s*true\s*\}\s*\)$/);
    if (match) {
      const text = escapeForScript(match[2]);
      return { script: `
        function searchShadowDomText(root, text, results, seen) {
          root.querySelectorAll('*').forEach(el => {
            if (seen.has(el)) return;
            const hasDirectText = Array.from(el.childNodes).some(node =>
              node.nodeType === Node.TEXT_NODE && node.textContent.includes(text)
            );
            if (hasDirectText) {
              results.push(el);
              seen.add(el);
            }
            if (el.shadowRoot) {
              searchShadowDomText(el.shadowRoot, text, results, seen);
            }
          });
        }
        const allMatches = [];
        const seenElements = new Set();
        searchShadowDomText(document, '${text}', allMatches, seenElements);
        const elements = allMatches.filter(el =>
          !allMatches.some(other => other !== el && el.contains(other))
        );
      ` };
    }

    // cy.contains('text') - single argument form
    // Cypress checks: textContent, value (for inputs), title, aria-label, alt, placeholder
    // Returns all unique deepest elements containing the text
    match = cleaned.match(/^cy\.contains\s*\(\s*(['"])(.+)\1\s*(?:,\s*\{[^}]*\})?\s*\)$/);
    if (match) {
      const text = escapeForScript(match[2]);
      return { script: `
        const allMatches = [];
        const seenElements = new Set();
        document.querySelectorAll('*').forEach(el => {
          if (seenElements.has(el)) return;
          // Check direct text content
          const hasDirectText = Array.from(el.childNodes).some(node =>
            node.nodeType === Node.TEXT_NODE && node.textContent.includes('${text}')
          );
          // Check value attribute (for inputs)
          const hasValue = el.value && el.value.includes('${text}');
          // Check title attribute
          const hasTitle = el.getAttribute('title')?.includes('${text}');
          // Check aria-label attribute
          const hasAriaLabel = el.getAttribute('aria-label')?.includes('${text}');
          // Check alt attribute (for images)
          const hasAlt = el.getAttribute('alt')?.includes('${text}');
          // Check placeholder attribute
          const hasPlaceholder = el.getAttribute('placeholder')?.includes('${text}');

          if (hasDirectText || hasValue || hasTitle || hasAriaLabel || hasAlt || hasPlaceholder) {
            allMatches.push(el);
            seenElements.add(el);
          }
        });
        // Filter to keep only deepest elements (no children in the match list)
        const elements = allMatches.filter(el =>
          !allMatches.some(other => other !== el && el.contains(other))
        );
      ` };
    }

    // cy.xpath('xpath') - requires cypress-xpath plugin
    // Use backreference to match closing quote, greedy match for XPath with embedded quotes
    match = cleaned.match(/^cy\.xpath\s*\(\s*(['"])(.+)\1\s*\)$/);
    if (match) {
      // Use generateXPathScript for proper quote handling in XPath
      return { script: generateXPathScript(match[2]) };
    }

    // cy.iframe('selector').find('childSelector') - cypress-iframe plugin
    match = cleaned.match(/^cy\.iframe\s*\(\s*(['"])(.+?)\1\s*\)\.find\s*\(\s*(['"])(.+)\3\s*\)$/);
    if (match) {
      const iframeSelector = escapeForScript(match[2]);
      const childSelector = escapeForScript(match[4]);
      return { script: `
        const iframe = document.querySelector('${iframeSelector}');
        let elements = [];
        if (iframe && iframe.contentDocument) {
          elements = Array.from(iframe.contentDocument.querySelectorAll('${childSelector}'));
        }
      `, hasFrameLocator: true };
    }

    // cy.iframe('selector') - cypress-iframe plugin (returns iframe body content)
    match = cleaned.match(/^cy\.iframe\s*\(\s*(['"])(.+)\1\s*\)$/);
    if (match) {
      const iframeSelector = escapeForScript(match[2]);
      return { script: `
        const iframe = document.querySelector('${iframeSelector}');
        let elements = [];
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
          elements = [iframe.contentDocument.body];
        }
      `, hasFrameLocator: true };
    }

    // cy.frameLoaded('selector') - cypress-iframe plugin (returns iframe element)
    match = cleaned.match(/^cy\.frameLoaded\s*\(\s*(['"])(.+)\1\s*\)$/);
    if (match) {
      const iframeSelector = escapeForScript(match[2]);
      return { script: `
        const elements = Array.from(document.querySelectorAll('${iframeSelector}')).filter(el =>
          el.tagName === 'IFRAME' || el.tagName === 'FRAME'
        );
      ` };
    }

    // cy.get().find() - chained selectors
    match = cleaned.match(/^cy\.get\s*\(\s*(['"])(.+?)\1\s*(?:,\s*\{[^}]*\})?\s*\)\.find\s*\(\s*(['"])(.+)\3\s*\)$/);
    if (match) {
      const parentSelector = escapeForScript(match[2]);
      const childSelector = escapeForScript(match[4]);
      return { script: `
        const parent = document.querySelector('${parentSelector}');
        const elements = parent ? Array.from(parent.querySelectorAll('${childSelector}')) : [];
      ` };
    }

    // cy.get().contains() - chained contains
    match = cleaned.match(/^cy\.get\s*\(\s*(['"])(.+?)\1\s*(?:,\s*\{[^}]*\})?\s*\)\.contains\s*\(\s*(['"])(.+)\3\s*\)$/);
    if (match) {
      const selector = escapeForScript(match[2]);
      const text = escapeForScript(match[4]);
      return { script: `
        const elements = Array.from(document.querySelectorAll('${selector}')).filter(el =>
          el.textContent.includes('${text}')
        );
      ` };
    }

    // ==================
    // RAW XPATH (starts with // or / or contains XPath axes)
    // ==================
    // XPath axes: ancestor, ancestor-or-self, attribute, child, descendant, descendant-or-self,
    // following, following-sibling, namespace, parent, preceding, preceding-sibling, self
    const xpathAxesPattern = /^(ancestor|ancestor-or-self|attribute|child|descendant|descendant-or-self|following|following-sibling|namespace|parent|preceding|preceding-sibling|self)::/i;
    const isXPath = locator.startsWith('//') ||
                    (locator.startsWith('/') && !locator.startsWith('/*')) ||
                    locator.startsWith('(//') ||
                    xpathAxesPattern.test(locator) ||
                    locator.includes('::') ||  // Contains any axis separator
                    locator.match(/^\.\//);     // Relative XPath starting with ./

    if (isXPath) {
      // Use generateXPathScript for proper quote handling in XPath
      return { script: generateXPathScript(locator) };
    }

    // ==================
    // FALLBACK: CSS SELECTOR
    // ==================
    const escapedSelector = escapeForScript(locator);
    return { script: `const elements = Array.from(document.querySelectorAll('${escapedSelector}'));` };
  }

  // Validate locator syntax and return error message if invalid
  function validateLocatorSyntax(original, cleaned) {
    // Check for empty locator
    if (!cleaned || cleaned.length === 0) {
      return 'Empty locator. Enter a valid locator syntax.';
    }

    // Check for incomplete Playwright syntax
    if (original.includes('page.') && !cleaned.includes('(')) {
      return 'Incomplete Playwright syntax. Expected: page.getByRole(...), page.locator(...), etc.';
    }

    // Check for incomplete Selenium syntax
    if (original.includes('driver.') && !cleaned.includes('(')) {
      return 'Incomplete Selenium syntax. Expected: driver.findElement(By...), etc.';
    }

    // Check for incomplete Cypress syntax
    if (original.includes('cy.') && !cleaned.includes('(')) {
      return 'Incomplete Cypress syntax. Expected: cy.get(...), cy.contains(...), etc.';
    }

    // Check for missing quotes in method calls (but allow Java AriaRole enum)
    // Java uses: getByRole(AriaRole.BUTTON, ...) instead of getByRole('button', ...)
    if (cleaned.match(/getBy\w+\s*\(\s*[^'"A]/i) && !cleaned.match(/AriaRole\./)) {
      return 'Missing quotes in Playwright locator. Use: getByRole(\'button\') or getByRole("button")';
    }

    // Check for missing value in Selenium By methods
    if (cleaned.match(/By\.\w+\s*\(\s*\)/)) {
      return 'Missing value in Selenium locator. Use: By.id("value"), By.name("value"), etc.';
    }

    // Check for unmatched parentheses
    const openParens = (cleaned.match(/\(/g) || []).length;
    const closeParens = (cleaned.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return `Unmatched parentheses. Found ${openParens} opening and ${closeParens} closing.`;
    }

    // Check for unmatched quotes
    const singleQuotes = (cleaned.match(/'/g) || []).length;
    const doubleQuotes = (cleaned.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      return 'Unmatched single quotes in locator.';
    }
    if (doubleQuotes % 2 !== 0) {
      return 'Unmatched double quotes in locator.';
    }

    // Check for common typos in Playwright methods
    if (cleaned.match(/getbyrole|getByrol|getbylabel|getbytext/i) && !cleaned.match(/getByRole|getByLabel|getByText|get_by_/i)) {
      return 'Possible typo in Playwright method. Check capitalization: getByRole, getByText, getByLabel, etc.';
    }

    // Check for invalid Selenium By type
    if (cleaned.match(/By\.(?!id|ID|name|NAME|className|CLASS_NAME|cssSelector|CSS_SELECTOR|xpath|XPATH|tagName|TAG_NAME|linkText|LINK_TEXT|partialLinkText|PARTIAL_LINK_TEXT)\w+/)) {
      const invalidBy = cleaned.match(/By\.(\w+)/);
      return `Invalid Selenium locator type: By.${invalidBy[1]}. Valid types: id, name, className, cssSelector, xpath, tagName, linkText`;
    }

    return null; // No errors
  }

  function generateGetByRoleScript(role, name, level, checked, exact = false) {
    const roleToSelector = {
      'button': 'button, input[type="button"], input[type="submit"], [role="button"]',
      'textbox': 'input[type="text"], input[type="email"], input[type="password"], input[type="search"], input:not([type]), textarea, [role="textbox"]',
      'checkbox': 'input[type="checkbox"], [role="checkbox"]',
      'radio': 'input[type="radio"], [role="radio"]',
      'combobox': 'select, [role="combobox"]',
      'link': 'a[href], [role="link"]',
      'heading': 'h1, h2, h3, h4, h5, h6, [role="heading"]',
      'img': 'img, [role="img"]',
      'list': 'ul, ol, [role="list"]',
      'listitem': 'li, [role="listitem"]',
      'navigation': 'nav, [role="navigation"]',
      'main': 'main, [role="main"]',
      'banner': 'header, [role="banner"]',
      'contentinfo': 'footer, [role="contentinfo"]',
      'searchbox': 'input[type="search"], [role="searchbox"]',
      'table': 'table, [role="table"]',
      'row': 'tr, [role="row"]',
      'cell': 'td, [role="cell"]',
      'form': 'form, [role="form"]',
      'dialog': 'dialog, [role="dialog"]',
      'menu': '[role="menu"]',
      'menuitem': '[role="menuitem"]',
      'tab': '[role="tab"]',
      'tabpanel': '[role="tabpanel"]',
      'option': 'option, [role="option"]'
    };

    // For headings with level, use specific heading tag
    let selector;
    if (role === 'heading' && level && level >= 1 && level <= 6) {
      selector = `h${level}, [role="heading"][aria-level="${level}"]`;
    } else {
      selector = roleToSelector[role] || '[role="' + role + '"]';
    }

    const escapedName = name ? escapeForScript(name) : null;
    const isCheckable = role === 'checkbox' || role === 'radio';

    // Build filter conditions
    let filterConditions = [];
    if (escapedName) {
      // Use exact matching if exact is true, otherwise use includes (partial match)
      // Note: We normalize whitespace (replace multiple spaces/tabs/newlines with single space)
      // to match how the locator was generated
      if (exact) {
        filterConditions.push(`
          // Get accessible name - check various sources
          // Helper to normalize whitespace like the locator generator does (including nbsp)
          const normalizeWS = (s) => s ? s.trim().replace(/[\\s\\u00A0\\u200B]+/g, ' ') : '';
          let accessibleName = el.getAttribute('aria-label') || '';
          // For images, check alt attribute
          if (!accessibleName) accessibleName = el.getAttribute('alt') || '';
          // For form elements, check associated label (Method 1: label with for attribute)
          if (!accessibleName && el.id) {
            const labelEl = document.querySelector('label[for="' + el.id + '"]');
            if (labelEl) accessibleName = labelEl.textContent;
          }
          // Method 2: Parent label element (label wrapping input)
          if (!accessibleName) {
            const parentLabel = el.closest('label');
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true);
              const inputs = clone.querySelectorAll('input, select, textarea');
              inputs.forEach(inp => inp.remove());
              accessibleName = clone.textContent;
            }
          }
          // Method 3: Adjacent <label> siblings for checkbox/radio ONLY
          // Playwright only recognizes proper <label> elements, not text nodes or SPAN
          if (!accessibleName && (el.type === 'checkbox' || el.type === 'radio')) {
            let sibling = el.nextSibling;
            while (sibling && !accessibleName) {
              if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                accessibleName = sibling.textContent;
              }
              sibling = sibling.nextSibling;
            }
            if (!accessibleName) {
              sibling = el.previousSibling;
              while (sibling && !accessibleName) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                  accessibleName = sibling.textContent;
                }
                sibling = sibling.previousSibling;
              }
            }
          }
          // Method 4: aria-labelledby
          if (!accessibleName && el.getAttribute('aria-labelledby')) {
            const labelledById = el.getAttribute('aria-labelledby');
            const labelledByEl = document.getElementById(labelledById);
            if (labelledByEl) accessibleName = labelledByEl.textContent;
          }
          // Method 5: For input buttons (submit/button/reset), use value attribute
          // Playwright uses value as accessible name for these input types
          if (!accessibleName && el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) {
            accessibleName = el.value || el.getAttribute('value') || '';
          }
          // Check placeholder (for textbox/combobox)
          if (!accessibleName) accessibleName = el.getAttribute('placeholder') || '';
          // Check textContent (for buttons, links)
          if (!accessibleName) accessibleName = el.textContent;
          // Check title
          if (!accessibleName) accessibleName = el.getAttribute('title') || '';
          if (normalizeWS(accessibleName) !== '${escapedName}') return false;`);
      } else {
        filterConditions.push(`
          // Get accessible name - check various sources
          // Helper to normalize whitespace for consistent matching (including nbsp)
          const normalizeWS = (s) => s ? s.trim().replace(/[\\s\\u00A0\\u200B]+/g, ' ') : '';
          let accessibleName = el.getAttribute('aria-label') || '';
          // For images, check alt attribute
          if (!accessibleName) accessibleName = el.getAttribute('alt') || '';
          // For form elements, check associated label (Method 1: label with for attribute)
          if (!accessibleName && el.id) {
            const labelEl = document.querySelector('label[for="' + el.id + '"]');
            if (labelEl) accessibleName = labelEl.textContent;
          }
          // Method 2: Parent label element (label wrapping input)
          if (!accessibleName) {
            const parentLabel = el.closest('label');
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true);
              const inputs = clone.querySelectorAll('input, select, textarea');
              inputs.forEach(inp => inp.remove());
              accessibleName = clone.textContent;
            }
          }
          // Method 3: Adjacent <label> siblings for checkbox/radio ONLY
          // Playwright only recognizes proper <label> elements, not text nodes or SPAN
          if (!accessibleName && (el.type === 'checkbox' || el.type === 'radio')) {
            let sibling = el.nextSibling;
            while (sibling && !accessibleName) {
              if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                accessibleName = sibling.textContent;
              }
              sibling = sibling.nextSibling;
            }
            if (!accessibleName) {
              sibling = el.previousSibling;
              while (sibling && !accessibleName) {
                if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'LABEL') {
                  accessibleName = sibling.textContent;
                }
                sibling = sibling.previousSibling;
              }
            }
          }
          // Method 4: aria-labelledby
          if (!accessibleName && el.getAttribute('aria-labelledby')) {
            const labelledById = el.getAttribute('aria-labelledby');
            const labelledByEl = document.getElementById(labelledById);
            if (labelledByEl) accessibleName = labelledByEl.textContent;
          }
          // Method 5: For input buttons (submit/button/reset), use value attribute
          // Playwright uses value as accessible name for these input types
          if (!accessibleName && el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) {
            accessibleName = el.value || el.getAttribute('value') || '';
          }
          // Check placeholder (for textbox/combobox)
          if (!accessibleName) accessibleName = el.getAttribute('placeholder') || '';
          // Check textContent (for buttons, links)
          if (!accessibleName) accessibleName = el.textContent;
          // Check title
          if (!accessibleName) accessibleName = el.getAttribute('title') || '';
          if (!normalizeWS(accessibleName).toLowerCase().includes('${escapedName}'.toLowerCase())) return false;`);
      }
    }
    if (isCheckable && checked !== undefined) {
      filterConditions.push(`
          if (el.checked !== ${checked}) return false;`);
    }

    if (filterConditions.length > 0) {
      return `
        const elements = Array.from(document.querySelectorAll('${selector}')).filter(el => {
          ${filterConditions.join('')}
          return true;
        });
      `;
    }
    return `const elements = Array.from(document.querySelectorAll('${selector}'));`;
  }

  function escapeForScript(str) {
    // First, unescape any already-escaped quotes from user input (e.g., \' or \")
    let cleaned = str
      .replace(/\\'/g, "'")   // \' -> '
      .replace(/\\"/g, '"');  // \" -> "

    // Then escape for JavaScript string injection
    return cleaned
      .replace(/\\/g, '\\\\')  // \ -> \\
      .replace(/'/g, "\\'")    // ' -> \'
      .replace(/"/g, '\\"');   // " -> \"
  }

  // Special escape function for XPath expressions
  // XPath uses quotes differently than JavaScript - we need to choose the right quote type
  // and handle cases where XPath contains both single and double quotes
  function escapeXPathForScript(xpath) {
    // First, unescape any already-escaped quotes from user input
    let cleaned = xpath
      .replace(/\\'/g, "'")   // \' -> '
      .replace(/\\"/g, '"');  // \" -> "

    const hasSingleQuotes = cleaned.includes("'");
    const hasDoubleQuotes = cleaned.includes('"');

    if (!hasSingleQuotes) {
      // No single quotes - use single quotes for JS string, escape backslashes only
      return {
        xpath: cleaned.replace(/\\/g, '\\\\'),
        quote: "'"
      };
    } else if (!hasDoubleQuotes) {
      // Has single quotes but no double quotes - use double quotes for JS string
      return {
        xpath: cleaned.replace(/\\/g, '\\\\'),
        quote: '"'
      };
    } else {
      // Has both single and double quotes - use XPath concat() function
      // Split on single quotes and join with concat
      const parts = cleaned.split("'");
      const concatExpr = parts.map((part, i) => {
        if (i === 0) return part ? `"${part}"` : '';
        return `"'","${part}"`;
      }).filter(p => p).join(',');
      return {
        xpath: `concat(${concatExpr})`,
        quote: "'",
        isConcat: true
      };
    }
  }

  // Generate XPath evaluation script with proper quoting
  function generateXPathScript(xpath) {
    const escaped = escapeXPathForScript(xpath);
    if (escaped.isConcat) {
      // For concat expressions, we build the XPath dynamically
      return `
        const result = document.evaluate(${escaped.quote}${escaped.xpath}${escaped.quote}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const elements = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          elements.push(result.snapshotItem(i));
        }
      `;
    }
    return `
      const result = document.evaluate(${escaped.quote}${escaped.xpath}${escaped.quote}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const elements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i));
      }
    `;
  }

  function showTestResult(success, message) {
    testLocatorResult.className = 'test-locator-result visible ' + (success ? 'success' : 'error');
    testLocatorResult.innerHTML = `
      <span class="result-icon">${success ? '✓' : '✗'}</span>
      <span class="result-text">${message}</span>
    `;
  }

  // =====================
  // AUTOCOMPLETE
  // =====================
  const PLAYWRIGHT_SUGGESTIONS = [
    { method: "getByRole('", desc: "Find by ARIA role", template: "page.getByRole('button', { name: '' })" },
    { method: "getByText('", desc: "Find by text content", template: "page.getByText('')" },
    { method: "getByLabel('", desc: "Find by label text", template: "page.getByLabel('')" },
    { method: "getByPlaceholder('", desc: "Find by placeholder", template: "page.getByPlaceholder('')" },
    { method: "getByTestId('", desc: "Find by test ID", template: "page.getByTestId('')" },
    { method: "getByAltText('", desc: "Find by alt text", template: "page.getByAltText('')" },
    { method: "getByTitle('", desc: "Find by title attribute", template: "page.getByTitle('')" },
    { method: "locator('", desc: "Find by CSS selector", template: "page.locator('')" },
    { method: "frameLocator('", desc: "Find iframe by selector", template: "page.frameLocator('')" }
  ];

  const PLAYWRIGHT_PYTHON_SUGGESTIONS = [
    { method: "get_by_role(\"", desc: "Find by ARIA role", template: "page.get_by_role(\"button\", name=\"\")" },
    { method: "get_by_text(\"", desc: "Find by text content", template: "page.get_by_text(\"\")" },
    { method: "get_by_label(\"", desc: "Find by label text", template: "page.get_by_label(\"\")" },
    { method: "get_by_placeholder(\"", desc: "Find by placeholder", template: "page.get_by_placeholder(\"\")" },
    { method: "get_by_test_id(\"", desc: "Find by test ID", template: "page.get_by_test_id(\"\")" },
    { method: "get_by_alt_text(\"", desc: "Find by alt text", template: "page.get_by_alt_text(\"\")" },
    { method: "get_by_title(\"", desc: "Find by title attribute", template: "page.get_by_title(\"\")" },
    { method: "locator(\"", desc: "Find by CSS selector", template: "page.locator(\"\")" },
    { method: "frame_locator(\"", desc: "Find iframe by selector", template: "page.frame_locator(\"\")" }
  ];

  const SELENIUM_JAVA_SUGGESTIONS = [
    { method: "findElement(By.id(\"", desc: "Find by ID", template: "driver.findElement(By.id(\"\"))" },
    { method: "findElement(By.name(\"", desc: "Find by name", template: "driver.findElement(By.name(\"\"))" },
    { method: "findElement(By.className(\"", desc: "Find by class name", template: "driver.findElement(By.className(\"\"))" },
    { method: "findElement(By.cssSelector(\"", desc: "Find by CSS selector", template: "driver.findElement(By.cssSelector(\"\"))" },
    { method: "findElement(By.xpath(\"", desc: "Find by XPath", template: "driver.findElement(By.xpath(\"\"))" },
    { method: "findElement(By.linkText(\"", desc: "Find by link text", template: "driver.findElement(By.linkText(\"\"))" },
    { method: "findElement(By.tagName(\"", desc: "Find by tag name", template: "driver.findElement(By.tagName(\"\"))" }
  ];

  const SELENIUM_PYTHON_SUGGESTIONS = [
    { method: "find_element(By.ID, \"", desc: "Find by ID", template: "driver.find_element(By.ID, \"\")" },
    { method: "find_element(By.NAME, \"", desc: "Find by name", template: "driver.find_element(By.NAME, \"\")" },
    { method: "find_element(By.CLASS_NAME, \"", desc: "Find by class name", template: "driver.find_element(By.CLASS_NAME, \"\")" },
    { method: "find_element(By.CSS_SELECTOR, \"", desc: "Find by CSS selector", template: "driver.find_element(By.CSS_SELECTOR, \"\")" },
    { method: "find_element(By.XPATH, \"", desc: "Find by XPath", template: "driver.find_element(By.XPATH, \"\")" },
    { method: "find_element(By.LINK_TEXT, \"", desc: "Find by link text", template: "driver.find_element(By.LINK_TEXT, \"\")" },
    { method: "find_element(By.TAG_NAME, \"", desc: "Find by tag name", template: "driver.find_element(By.TAG_NAME, \"\")" }
  ];

  // Suggestions after frameLocator('...').  - can chain another frameLocator or use locator methods
  const PLAYWRIGHT_FRAME_LOCATOR_SUGGESTIONS = [
    { method: "getByRole('", desc: "Find by ARIA role", template: "getByRole('button', { name: '' })" },
    { method: "getByText('", desc: "Find by text content", template: "getByText('')" },
    { method: "getByLabel('", desc: "Find by label text", template: "getByLabel('')" },
    { method: "getByPlaceholder('", desc: "Find by placeholder", template: "getByPlaceholder('')" },
    { method: "getByTestId('", desc: "Find by test ID", template: "getByTestId('')" },
    { method: "locator('", desc: "Find by CSS selector", template: "locator('')" },
    { method: "frameLocator('", desc: "Find nested iframe", template: "frameLocator('')" }
  ];

  const PLAYWRIGHT_FRAME_LOCATOR_PYTHON_SUGGESTIONS = [
    { method: "get_by_role(\"", desc: "Find by ARIA role", template: "get_by_role(\"button\", name=\"\")" },
    { method: "get_by_text(\"", desc: "Find by text content", template: "get_by_text(\"\")" },
    { method: "get_by_label(\"", desc: "Find by label text", template: "get_by_label(\"\")" },
    { method: "get_by_placeholder(\"", desc: "Find by placeholder", template: "get_by_placeholder(\"\")" },
    { method: "get_by_test_id(\"", desc: "Find by test ID", template: "get_by_test_id(\"\")" },
    { method: "locator(\"", desc: "Find by CSS selector", template: "locator(\"\")" },
    { method: "frame_locator(\"", desc: "Find nested iframe", template: "frame_locator(\"\")" }
  ];

  // Action suggestions for Playwright
  const PLAYWRIGHT_ACTION_SUGGESTIONS = [
    { method: "click()", desc: "Click element", action: "click" },
    { method: "dblclick()", desc: "Double click element", action: "dblclick" },
    { method: "fill('')", desc: "Fill input with text", action: "fill", hasValue: true },
    { method: "press('')", desc: "Press keyboard key", action: "press", hasValue: true },
    { method: "textContent()", desc: "Get text content", action: "textContent" },
    { method: "innerText()", desc: "Get inner text", action: "innerText" },
    { method: "innerHTML()", desc: "Get inner HTML", action: "innerHTML" },
    { method: "inputValue()", desc: "Get input value", action: "inputValue" },
    { method: "getAttribute('')", desc: "Get attribute value", action: "getAttribute", hasValue: true },
    { method: "isVisible()", desc: "Check if visible", action: "isVisible" },
    { method: "isHidden()", desc: "Check if hidden", action: "isHidden" },
    { method: "isEnabled()", desc: "Check if enabled", action: "isEnabled" },
    { method: "isDisabled()", desc: "Check if disabled", action: "isDisabled" },
    { method: "isEditable()", desc: "Check if editable", action: "isEditable" },
    { method: "isChecked()", desc: "Check if checked", action: "isChecked" },
    { method: "check()", desc: "Check checkbox", action: "check" },
    { method: "uncheck()", desc: "Uncheck checkbox", action: "uncheck" },
    { method: "setChecked(true)", desc: "Set checkbox state", action: "setChecked", hasValue: true },
    { method: "hover()", desc: "Hover over element", action: "hover" },
    { method: "focus()", desc: "Focus element", action: "focus" },
    { method: "blur()", desc: "Blur element", action: "blur" },
    { method: "clear()", desc: "Clear input", action: "clear" },
    { method: "selectOption('')", desc: "Select dropdown option", action: "selectOption", hasValue: true },
    { method: "selectText()", desc: "Select all text in element", action: "selectText" },
    { method: "scrollIntoViewIfNeeded()", desc: "Scroll into view if needed", action: "scrollIntoViewIfNeeded" },
    { method: "boundingBox()", desc: "Get element bounding box", action: "boundingBox" },
    { method: "highlight()", desc: "Highlight element briefly", action: "highlight" },
    { method: "count()", desc: "Count matching elements", action: "count" },
    { method: "first()", desc: "Get first matching element", action: "first" },
    { method: "last()", desc: "Get last matching element", action: "last" },
    { method: "nth(0)", desc: "Get nth element (0-indexed)", action: "nth", hasValue: true },
    { method: "waitFor({ state: 'visible' })", desc: "Wait for element state", action: "waitFor", hasValue: true }
  ];

  // Action suggestions for Selenium
  const SELENIUM_ACTION_SUGGESTIONS = [
    { method: "click()", desc: "Click element", action: "click" },
    { method: "sendKeys(\"\")", desc: "Type text into element", action: "sendKeys", hasValue: true },
    { method: "getText()", desc: "Get text content", action: "getText" },
    { method: "getAttribute(\"\")", desc: "Get attribute value", action: "getAttribute", hasValue: true },
    { method: "isDisplayed()", desc: "Check if displayed", action: "isDisplayed" },
    { method: "isEnabled()", desc: "Check if enabled", action: "isEnabled" },
    { method: "isSelected()", desc: "Check if selected", action: "isSelected" },
    { method: "clear()", desc: "Clear input field", action: "clear" },
    { method: "submit()", desc: "Submit form", action: "submit" },
    { method: "getTagName()", desc: "Get tag name", action: "getTagName" },
    { method: "getCssValue(\"\")", desc: "Get CSS property value", action: "getCssValue", hasValue: true }
  ];

  // Python versions of actions
  const SELENIUM_PYTHON_ACTION_SUGGESTIONS = [
    { method: "click()", desc: "Click element", action: "click" },
    { method: "send_keys(\"\")", desc: "Type text into element", action: "sendKeys", hasValue: true },
    { method: "text", desc: "Get text content", action: "getText", isProperty: true },
    { method: "get_attribute(\"\")", desc: "Get attribute value", action: "getAttribute", hasValue: true },
    { method: "is_displayed()", desc: "Check if displayed", action: "isDisplayed" },
    { method: "is_enabled()", desc: "Check if enabled", action: "isEnabled" },
    { method: "is_selected()", desc: "Check if selected", action: "isSelected" },
    { method: "clear()", desc: "Clear input field", action: "clear" },
    { method: "submit()", desc: "Submit form", action: "submit" },
    { method: "tag_name", desc: "Get tag name", action: "getTagName", isProperty: true },
    { method: "value_of_css_property(\"\")", desc: "Get CSS property value", action: "getCssValue", hasValue: true }
  ];

  // Cypress locator suggestions
  const CYPRESS_SUGGESTIONS = [
    { method: "get('", desc: "Find by CSS selector", template: "cy.get('')" },
    { method: "contains('", desc: "Find by text content", template: "cy.contains('')" },
    { method: "get('[data-testid=\"", desc: "Find by test ID", template: "cy.get('[data-testid=\"\"]')" },
    { method: "get('#", desc: "Find by ID", template: "cy.get('#')" },
    { method: "get('[name=\"", desc: "Find by name attribute", template: "cy.get('[name=\"\"]')" },
    { method: "get('[placeholder=\"", desc: "Find by placeholder", template: "cy.get('[placeholder=\"\"]')" },
    { method: "get('[aria-label=\"", desc: "Find by aria-label", template: "cy.get('[aria-label=\"\"]')" },
    { method: "xpath('", desc: "Find by XPath (requires plugin)", template: "cy.xpath('')" },
    { method: "contains('button', '", desc: "Find button by text", template: "cy.contains('button', '')" },
    { method: "contains('a', '", desc: "Find link by text", template: "cy.contains('a', '')" }
  ];

  // Cypress action suggestions
  const CYPRESS_ACTION_SUGGESTIONS = [
    { method: "click()", desc: "Click element", action: "click" },
    { method: "type('')", desc: "Type text into element", action: "type", hasValue: true },
    { method: "clear()", desc: "Clear input field", action: "clear" },
    { method: "check()", desc: "Check checkbox/radio", action: "check" },
    { method: "uncheck()", desc: "Uncheck checkbox", action: "uncheck" },
    { method: "select('')", desc: "Select dropdown option", action: "select", hasValue: true },
    { method: "invoke('text')", desc: "Get text content", action: "text" },
    { method: "invoke('val')", desc: "Get input value", action: "val" },
    { method: "invoke('attr', '')", desc: "Get attribute value", action: "attr", hasValue: true },
    { method: "should('be.visible')", desc: "Assert visible", action: "visible" },
    { method: "should('be.enabled')", desc: "Assert enabled", action: "enabled" },
    { method: "should('be.checked')", desc: "Assert checked", action: "checked" },
    { method: "should('have.text', '')", desc: "Assert text content", action: "haveText", hasValue: true },
    { method: "should('have.value', '')", desc: "Assert value", action: "haveValue", hasValue: true },
    { method: "should('exist')", desc: "Assert element exists", action: "exist" },
    { method: "should('have.length', )", desc: "Assert element count", action: "haveLength", hasValue: true },
    { method: "trigger('mouseover')", desc: "Hover over element", action: "hover" },
    { method: "focus()", desc: "Focus element", action: "focus" },
    { method: "blur()", desc: "Blur element", action: "blur" },
    { method: "scrollIntoView()", desc: "Scroll into view", action: "scroll" },
    { method: "dblclick()", desc: "Double-click element", action: "dblclick" },
    { method: "rightclick()", desc: "Right-click element", action: "rightclick" },
    { method: "submit()", desc: "Submit form", action: "submit" }
  ];

  function setupAutocomplete() {
    testLocatorInput.addEventListener('input', handleAutocompleteInput);
    testLocatorInput.addEventListener('keydown', handleAutocompleteKeydown);
    testLocatorInput.addEventListener('blur', () => {
      // Delay hiding to allow click on item
      setTimeout(() => hideAutocomplete(), 150);
    });
    testLocatorInput.addEventListener('focus', handleAutocompleteInput);

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!testLocatorInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        hideAutocomplete();
      }
    });
  }

  function handleAutocompleteInput() {
    const value = testLocatorInput.value;
    const framework = LocatorGenerator.framework;
    const language = LocatorGenerator.language;

    let suggestions = [];
    let showSuggestions = false;
    let isActionSuggestion = false;

    // Check if user has a complete locator and typed a dot for actions
    const actionContext = detectActionContext(value, framework, language);
    if (actionContext.showActions) {
      showSuggestions = true;
      isActionSuggestion = true;
      suggestions = actionContext.suggestions;

      // Filter by partial match if user started typing action
      if (actionContext.partialAction) {
        suggestions = suggestions.filter(s =>
          s.method.toLowerCase().startsWith(actionContext.partialAction.toLowerCase())
        );
      }
    }
    // Check if user typed "page." for Playwright
    else if (framework === 'playwright' && value.endsWith('page.')) {
      showSuggestions = true;
      suggestions = language === 'python' ? PLAYWRIGHT_PYTHON_SUGGESTIONS : PLAYWRIGHT_SUGGESTIONS;
    }
    // Check if user has frameLocator('...').  - show locator methods for inside the frame
    // Use .+ instead of [^)]+ to handle nested parentheses
    else if (framework === 'playwright' && /frame_?[lL]ocator\s*\(.+\)\s*\.\s*$/.test(value)) {
      showSuggestions = true;
      suggestions = language === 'python' ? PLAYWRIGHT_FRAME_LOCATOR_PYTHON_SUGGESTIONS : PLAYWRIGHT_FRAME_LOCATOR_SUGGESTIONS;
    }
    // Check for partial method match after frameLocator('...').
    else if (framework === 'playwright' && /frame_?[lL]ocator\s*\(.+\)\s*\.\s*\w+$/.test(value)) {
      const afterLastDot = value.split('.').pop();
      if (afterLastDot && !afterLastDot.includes('(')) {
        const baseSuggestions = language === 'python' ? PLAYWRIGHT_FRAME_LOCATOR_PYTHON_SUGGESTIONS : PLAYWRIGHT_FRAME_LOCATOR_SUGGESTIONS;
        suggestions = baseSuggestions.filter(s =>
          s.method.toLowerCase().startsWith(afterLastDot.toLowerCase())
        );
        showSuggestions = suggestions.length > 0;
      }
    }
    // Check if user typed "driver." for Selenium
    else if (framework === 'selenium' && value.endsWith('driver.')) {
      showSuggestions = true;
      suggestions = language === 'python' ? SELENIUM_PYTHON_SUGGESTIONS : SELENIUM_JAVA_SUGGESTIONS;
    }
    // Check if user typed "cy." for Cypress
    else if (framework === 'cypress' && value.endsWith('cy.')) {
      showSuggestions = true;
      suggestions = CYPRESS_SUGGESTIONS;
    }
    // Check for partial method match after "page." or "driver." or "cy."
    else if (framework === 'playwright' && value.includes('page.')) {
      const afterDot = value.split('page.').pop();
      if (afterDot && !afterDot.includes('(')) {
        const baseSuggestions = language === 'python' ? PLAYWRIGHT_PYTHON_SUGGESTIONS : PLAYWRIGHT_SUGGESTIONS;
        suggestions = baseSuggestions.filter(s =>
          s.method.toLowerCase().startsWith(afterDot.toLowerCase())
        );
        showSuggestions = suggestions.length > 0;
      }
    }
    else if (framework === 'selenium' && value.includes('driver.')) {
      const afterDot = value.split('driver.').pop();
      if (afterDot && !afterDot.includes('(')) {
        const baseSuggestions = language === 'python' ? SELENIUM_PYTHON_SUGGESTIONS : SELENIUM_JAVA_SUGGESTIONS;
        suggestions = baseSuggestions.filter(s =>
          s.method.toLowerCase().startsWith(afterDot.toLowerCase())
        );
        showSuggestions = suggestions.length > 0;
      }
    }
    else if (framework === 'cypress' && value.includes('cy.')) {
      const afterDot = value.split('cy.').pop();
      if (afterDot && !afterDot.includes('(')) {
        suggestions = CYPRESS_SUGGESTIONS.filter(s =>
          s.method.toLowerCase().startsWith(afterDot.toLowerCase())
        );
        showSuggestions = suggestions.length > 0;
      }
    }

    if (showSuggestions && suggestions.length > 0) {
      renderAutocomplete(suggestions, isActionSuggestion, value);
    } else {
      hideAutocomplete();
    }
  }

  function detectActionContext(value, framework, language) {
    // Playwright action detection: after closing ) of locator method
    // e.g., page.getByRole('button').  or  page.locator('#id').
    // Also handles frameLocator chains: page.frameLocator('...').locator('...').
    if (framework === 'playwright') {
      // Check if we have a complete locator ending with ).
      // Match any chain that ends with a locator method (not frameLocator)
      // Use .* instead of [^)]* to handle nested parentheses like xpath contains(text(),'...')
      const playwrightLocatorPattern = /\.(getBy\w+|locator|get_by_\w+)\s*\(.*\)\s*\.$/;
      const playwrightPartialPattern = /\.(getBy\w+|locator|get_by_\w+)\s*\(.*\)\s*\.(\w*)$/;

      // Must start with page. and end with a locator method (not frameLocator)
      if (value.startsWith('page.') && playwrightLocatorPattern.test(value)) {
        return {
          showActions: true,
          suggestions: PLAYWRIGHT_ACTION_SUGGESTIONS,
          partialAction: null
        };
      }

      const partialMatch = value.match(playwrightPartialPattern);
      if (value.startsWith('page.') && partialMatch && partialMatch[2]) {
        return {
          showActions: true,
          suggestions: PLAYWRIGHT_ACTION_SUGGESTIONS,
          partialAction: partialMatch[2]
        };
      }
    }

    // Selenium action detection: after closing ) of findElement
    // e.g., driver.findElement(By.id("test")).  or  driver.find_element(By.ID, "test").
    // Use .* instead of [^)]+ to handle nested parentheses in By.xxx("value")
    if (framework === 'selenium') {
      const seleniumLocatorPattern = /driver\.(findElement|find_element)\s*\(.*\)\s*\.$/;
      const seleniumPartialPattern = /driver\.(findElement|find_element)\s*\(.*\)\s*\.(\w*)$/;

      const actionSuggestions = language === 'python' ?
        SELENIUM_PYTHON_ACTION_SUGGESTIONS : SELENIUM_ACTION_SUGGESTIONS;

      if (seleniumLocatorPattern.test(value)) {
        return {
          showActions: true,
          suggestions: actionSuggestions,
          partialAction: null
        };
      }

      const partialMatch = value.match(seleniumPartialPattern);
      if (partialMatch && partialMatch[2]) {
        return {
          showActions: true,
          suggestions: actionSuggestions,
          partialAction: partialMatch[2]
        };
      }
    }

    // Cypress action detection: after closing ) of cy.get or cy.contains
    // e.g., cy.get('#id').  or  cy.contains('text').
    // Use .* instead of [^)]* to handle nested parentheses
    if (framework === 'cypress') {
      const cypressLocatorPattern = /cy\.(get|contains|xpath)\s*\(.*\)\s*\.$/;
      const cypressPartialPattern = /cy\.(get|contains|xpath)\s*\(.*\)\s*\.(\w*)$/;

      if (cypressLocatorPattern.test(value)) {
        return {
          showActions: true,
          suggestions: CYPRESS_ACTION_SUGGESTIONS,
          partialAction: null
        };
      }

      const partialMatch = value.match(cypressPartialPattern);
      if (partialMatch && partialMatch[2]) {
        return {
          showActions: true,
          suggestions: CYPRESS_ACTION_SUGGESTIONS,
          partialAction: partialMatch[2]
        };
      }
    }

    return { showActions: false, suggestions: [], partialAction: null };
  }

  function renderAutocomplete(suggestions, isActionSuggestion = false, currentValue = '') {
    autocompleteSelectedIndex = -1;
    const framework = LocatorGenerator.framework;
    const prefixMap = { 'playwright': 'Playwright', 'selenium': 'Selenium', 'cypress': 'Cypress' };
    const prefix = prefixMap[framework] || 'Framework';
    const categoryLabel = isActionSuggestion ? `${prefix} Actions` : `${prefix} Methods`;

    let html = `<div class="autocomplete-category">${categoryLabel}</div>`;
    html += suggestions.map((s, i) => {
      const dataAttr = isActionSuggestion ?
        `data-action="${escapeAttr(s.method)}" data-has-value="${s.hasValue || false}"` :
        `data-template="${escapeAttr(s.template)}"`;
      return `
        <div class="autocomplete-item" data-index="${i}" ${dataAttr}>
          <span class="autocomplete-method">${escapeHtml(s.method)}</span>
          <span class="autocomplete-desc">${escapeHtml(s.desc)}</span>
        </div>
      `;
    }).join('');

    autocompleteDropdown.innerHTML = html;
    autocompleteDropdown.classList.add('visible');

    // Add click handlers
    autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (item.dataset.action) {
          selectActionItem(item.dataset.action, item.dataset.hasValue === 'true');
        } else {
          selectAutocompleteItem(item.dataset.template);
        }
      });
    });
  }

  function hideAutocomplete() {
    autocompleteDropdown.classList.remove('visible');
    autocompleteSelectedIndex = -1;
  }

  function handleAutocompleteKeydown(e) {
    if (!autocompleteDropdown.classList.contains('visible')) return;

    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, items.length - 1);
        updateAutocompleteSelection(items);
        break;
      case 'ArrowUp':
        e.preventDefault();
        autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, 0);
        updateAutocompleteSelection(items);
        break;
      case 'Enter':
        if (autocompleteSelectedIndex >= 0) {
          e.preventDefault();
          const selectedItem = items[autocompleteSelectedIndex];
          if (selectedItem.dataset.action) {
            selectActionItem(selectedItem.dataset.action, selectedItem.dataset.hasValue === 'true');
          } else {
            selectAutocompleteItem(selectedItem.dataset.template);
          }
        }
        break;
      case 'Escape':
        hideAutocomplete();
        break;
      case 'Tab':
        if (autocompleteSelectedIndex >= 0) {
          e.preventDefault();
          const selectedItem = items[autocompleteSelectedIndex];
          if (selectedItem.dataset.action) {
            selectActionItem(selectedItem.dataset.action, selectedItem.dataset.hasValue === 'true');
          } else {
            selectAutocompleteItem(selectedItem.dataset.template);
          }
        } else if (items.length > 0) {
          e.preventDefault();
          const firstItem = items[0];
          if (firstItem.dataset.action) {
            selectActionItem(firstItem.dataset.action, firstItem.dataset.hasValue === 'true');
          } else {
            selectAutocompleteItem(firstItem.dataset.template);
          }
        }
        break;
    }
  }

  function updateAutocompleteSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === autocompleteSelectedIndex);
    });
    // Scroll into view if needed
    if (autocompleteSelectedIndex >= 0) {
      items[autocompleteSelectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function selectAutocompleteItem(template) {
    testLocatorInput.value = template;
    hideAutocomplete();

    // Position cursor inside the quotes
    const quotePos = template.lastIndexOf('""') || template.lastIndexOf("''");
    if (quotePos !== -1) {
      testLocatorInput.setSelectionRange(quotePos + 1, quotePos + 1);
    }
    testLocatorInput.focus();
  }

  function selectActionItem(action, hasValue) {
    let currentValue = testLocatorInput.value;

    // Remove any partial action already typed
    const dotIndex = currentValue.lastIndexOf('.');
    if (dotIndex !== -1) {
      currentValue = currentValue.substring(0, dotIndex + 1);
    }

    // Append the action
    const newValue = currentValue + action;
    testLocatorInput.value = newValue;
    hideAutocomplete();

    // If action has a value parameter, position cursor inside quotes
    if (hasValue) {
      const quotePos = newValue.lastIndexOf("'") !== -1 ? newValue.lastIndexOf("'") : newValue.lastIndexOf('"');
      if (quotePos !== -1) {
        testLocatorInput.setSelectionRange(quotePos, quotePos);
      }
    }
    testLocatorInput.focus();
  }

  // =====================
  // SIDEBAR RESIZE
  // =====================
  function setupSidebarResize() {
    let isResizing = false;
    let startX, startWidth;

    function stopResizing() {
      if (isResizing) {
        isResizing = false;
        sidebarPanel.classList.remove('resizing');
        sidebarResizeHandle.classList.remove('active');
        document.body.classList.remove('resizing-sidebar');
      }
    }

    function onMouseMove(e) {
      if (!isResizing) return;

      // Check if mouse button is still pressed
      if (e.buttons === 0) {
        stopResizing();
        return;
      }

      const diff = e.clientX - startX;
      // Min 200px, max 95% of window width for more space
      const maxWidth = window.innerWidth * 0.95;
      const newWidth = Math.min(Math.max(startWidth + diff, 200), maxWidth);
      sidebarPanel.style.width = newWidth + 'px';
    }

    sidebarResizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      isResizing = true;
      startX = e.clientX;
      startWidth = sidebarPanel.offsetWidth;
      sidebarPanel.classList.add('resizing');
      sidebarResizeHandle.classList.add('active');
      document.body.classList.add('resizing-sidebar');
      e.preventDefault();
      e.stopPropagation();
    });

    // Use capture phase to ensure we get the events
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', stopResizing, true);

    // Also listen on window for when mouse leaves and comes back
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('blur', stopResizing);
  }

  // =====================
  // ELEMENT SELECTION
  // =====================
  function handleElementSelected(elementData) {
    console.log('Element selected:', elementData);

    // Clear any previous highlights from all documents (including iframes and shadow DOM)
    const clearScript = `
      (function() {
        function clearHighlights(root) {
          try {
            root.querySelectorAll('.__locatorlabs_highlight_temp').forEach(e => {
              e.style.outline = '';
              e.style.outlineOffset = '';
              e.classList.remove('__locatorlabs_highlight_temp');
            });
            root.querySelectorAll('.__locatorlabs_test_highlight').forEach(e => {
              e.style.outline = e.__llOriginalOutline || '';
              e.style.outlineOffset = e.__llOriginalOutlineOffset || '';
              e.classList.remove('__locatorlabs_test_highlight');
            });
            // Clear in iframes
            root.querySelectorAll('iframe, frame').forEach(iframe => {
              try {
                if (iframe.contentDocument) clearHighlights(iframe.contentDocument);
              } catch(e) {}
            });
            // Clear in shadow DOMs
            root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                clearHighlights(el.shadowRoot);
              }
            });
          } catch(e) {}
        }
        clearHighlights(document);
      })();
    `;
    webview.executeJavaScript(clearScript).catch(() => {});

    // Stop inspecting after selection
    if (isInspecting) {
      toggleInspectMode();
    }

    // Store element data for re-generation on language/framework change
    currentElementData = elementData;

    // Update element info
    updateElementInfo(elementData);

    // Generate and display locators
    regenerateLocators();

    showToast('Element captured! Locators generated.', 'success');
  }

  // Regenerate locators for current element with current settings
  function regenerateLocators() {
    if (!currentElementData) return;

    const locators = LocatorGenerator.generateLocators(currentElementData);
    displayLocators(locators);

    // Update Playwright frame info banner
    updatePlaywrightFrameInfo();

    // Update frame switch info for Selenium/Cypress
    updateFrameSwitchInfo();

    // Update shadow DOM info
    updateShadowDOMInfo();

    // Update SVG info
    updateSVGInfo();
  }

  function updatePlaywrightFrameInfo() {
    const frameDisplay = LocatorGenerator.getPlaywrightFrameDisplay();

    if (frameDisplay) {
      playwrightFrameInfo.innerHTML = `
        <div class="playwright-frame-container">
          <div class="playwright-frame-header">
            <span class="playwright-frame-icon">🔍</span>
            <span class="playwright-frame-title">${frameDisplay.title}</span>
          </div>
          <div class="playwright-frame-message">${frameDisplay.message}</div>
          <div class="playwright-frame-auto-handling">
            <span class="check-icon">✅</span>
            <span>Playwright Auto-Handling</span>
          </div>
          <div class="playwright-frame-message">${frameDisplay.autoHandling}</div>
          <div class="playwright-frame-note">
            <span class="note-icon">⚠️</span>
            <span>Note: ${frameDisplay.note}</span>
          </div>
        </div>
      `;
      playwrightFrameInfo.style.display = 'block';
    } else {
      playwrightFrameInfo.innerHTML = '';
      playwrightFrameInfo.style.display = 'none';
    }
  }

  function updateFrameSwitchInfo() {
    const frameSwitchCommands = LocatorGenerator.getFrameSwitchDisplay();

    if (frameSwitchCommands) {
      let titleLabel;
      if (LocatorGenerator.framework === 'cypress') {
        titleLabel = 'iFrame Plugin Required (Cypress)';
      } else {
        const langLabel = LocatorGenerator.language === 'python' ? 'Python' : 'Java';
        titleLabel = `Switch to Frame First (${langLabel})`;
      }
      frameSwitchInfo.innerHTML = `
        <div class="frame-switch-container">
          <div class="frame-switch-header">
            <span class="frame-switch-icon">⚠️</span>
            <span class="frame-switch-title">${titleLabel}</span>
          </div>
          <pre class="frame-switch-code"><code>${escapeHtml(frameSwitchCommands.trim())}</code></pre>
        </div>
      `;
      frameSwitchInfo.style.display = 'block';
    } else {
      frameSwitchInfo.innerHTML = '';
      frameSwitchInfo.style.display = 'none';
    }
  }

  function updateShadowDOMInfo() {
    const shadowDOMDisplay = LocatorGenerator.getShadowDOMDisplay();

    if (shadowDOMDisplay) {
      const icon = shadowDOMDisplay.type === 'info' ? '🔮' : '⚠️';
      let html = `
        <div class="shadow-dom-container ${shadowDOMDisplay.type}">
          <div class="shadow-dom-header">
            <span class="shadow-dom-icon">${icon}</span>
            <span class="shadow-dom-title">${shadowDOMDisplay.title}</span>
          </div>
          <div class="shadow-dom-message">${shadowDOMDisplay.message}</div>
          <div class="shadow-dom-path"><strong>Shadow Host Path:</strong> ${shadowDOMDisplay.hostPath}</div>
      `;

      // For Selenium, show the full executable code
      if (shadowDOMDisplay.fullCode && LocatorGenerator.framework === 'selenium') {
        html += `<pre class="shadow-dom-code"><code>${escapeHtml(shadowDOMDisplay.fullCode)}</code></pre>`;
      }

      // For Cypress, show the example
      if (shadowDOMDisplay.example && LocatorGenerator.framework === 'cypress') {
        html += `<div class="shadow-dom-example"><strong>Example:</strong> <code>${escapeHtml(shadowDOMDisplay.example)}</code></div>`;
      }

      html += '</div>';
      shadowDOMInfo.innerHTML = html;
      shadowDOMInfo.style.display = 'block';
    } else {
      shadowDOMInfo.innerHTML = '';
      shadowDOMInfo.style.display = 'none';
    }
  }

  function updateSVGInfo() {
    const svgDisplay = LocatorGenerator.getSVGDisplay();

    if (svgDisplay) {
      const icon = svgDisplay.type === 'info' ? '🎨' : '⚠️';
      let html = `
        <div class="svg-info-container ${svgDisplay.type}">
          <div class="svg-info-header">
            <span class="svg-info-icon">${icon}</span>
            <span class="svg-info-title">${svgDisplay.title}</span>
          </div>
          <div class="svg-info-message">${svgDisplay.message}</div>
      `;

      // For Selenium or Cypress, show the example
      if (svgDisplay.example && (LocatorGenerator.framework === 'selenium' || LocatorGenerator.framework === 'cypress')) {
        html += `<div class="svg-info-example"><strong>Example:</strong> <code>${escapeHtml(svgDisplay.example)}</code></div>`;
      }

      html += '</div>';
      svgInfo.innerHTML = html;
      svgInfo.style.display = 'block';
    } else {
      svgInfo.innerHTML = '';
      svgInfo.style.display = 'none';
    }
  }

  function updateElementInfo(elementData) {
    const tag = elementData.tagName.toLowerCase();
    let tagDisplay = `<${tag}`;

    if (elementData.id) tagDisplay += ` id="${elementData.id}"`;
    if (elementData.className) tagDisplay += ` class="${elementData.className.substring(0, 30)}..."`;
    if (elementData.type) tagDisplay += ` type="${elementData.type}"`;
    tagDisplay += '>';

    // Add frame indicator if element is inside iframe
    if (elementData.framePath && elementData.framePath.length > 0) {
      tagDisplay = '🖼️ [iframe] ' + tagDisplay;
    }

    // Add shadow DOM indicator if element is inside shadow DOM
    if (elementData.shadowPath && elementData.shadowPath.length > 0) {
      tagDisplay = '🔮 [shadow] ' + tagDisplay;
    }

    // Add SVG indicator if element is an SVG element
    if (elementData.isSVG) {
      tagDisplay = '🎨 [SVG] ' + tagDisplay;
    }

    elementTag.textContent = tagDisplay;

    // Details
    let details = '';

    // Show frame path if inside iframe
    if (elementData.framePath && elementData.framePath.length > 0) {
      const frameInfo = elementData.framePath.map(f => f.id || f.name || f.selector).join(' → ');
      details += `<span class="attr frame-path">📍 frame: ${frameInfo}</span>`;
    }

    // Show shadow DOM path if inside shadow DOM
    if (elementData.shadowPath && elementData.shadowPath.length > 0) {
      const shadowInfo = elementData.shadowPath.map(s => s.selector).join(' → ');
      details += `<span class="attr shadow-path">🔮 shadow: ${shadowInfo}</span>`;
    }

    if (elementData.id) details += `<span class="attr">id: ${elementData.id}</span>`;
    if (elementData.name) details += `<span class="attr">name: ${elementData.name}</span>`;
    if (elementData.placeholder) details += `<span class="attr">placeholder: ${elementData.placeholder}</span>`;
    if (elementData.text) details += `<span class="attr">text: ${elementData.text.substring(0, 30)}...</span>`;
    if (elementData.ariaLabel) details += `<span class="attr">aria-label: ${elementData.ariaLabel}</span>`;

    elementDetails.innerHTML = details || '<span class="attr">No additional attributes</span>';
  }

  // ============================================
  // ENHANCED COPY FUNCTIONALITY - ELEMENT-AWARE VERSION
  // ============================================

  // Generate variable name from locator - IMPROVED
  function generateVariableName(locatorCode, locatorType, elementInfo, language) {
    // Try to extract meaningful name from the element

    // Helper function to convert text to camelCase
    const toCamelCase = (text, suffix = '') => {
      if (!text) return 'element' + suffix;
      return text
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('') + suffix;
    };

    // Helper function to convert text to snake_case
    const toSnakeCase = (text, suffix = '') => {
      if (!text) return 'element' + suffix;
      return text
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.toLowerCase())
        .join('_') + suffix;
    };

    // Helper function to clean and extract meaningful name from ID/name attributes
    const cleanIdOrName = (idOrName) => {
      if (!idOrName) return null;
      // Remove common prefixes: input-, Form_getForm_, txt_, btn_, sel_, etc.
      let cleaned = idOrName
        .replace(/^(input[-_]?|Form_getForm_|txt[-_]?|btn[-_]?|sel[-_]?|chk[-_]?|rad[-_]?|ta[-_]?|ddl[-_]?|lbl[-_]?|frm[-_]?)/i, '')
        .replace(/[-_]+/g, ' ')  // Replace dashes and underscores with spaces
        // Insert space before uppercase letters to handle camelCase (e.g., "FullName" -> "Full Name")
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // Handle acronyms like "XMLParser" -> "XML Parser"
        .trim();
      return cleaned || idOrName.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    };

    // Helper function to get element type suffix based on tag and type
    const getElementSuffix = (tag, type, isPython = false) => {
      const tagLower = (tag || '').toLowerCase();
      const typeLower = (type || '').toLowerCase();

      if (isPython) {
        if (tagLower === 'input') {
          if (['text', 'email', 'password', 'tel', 'url', 'search', 'number'].includes(typeLower) || !typeLower) return '_input';
          if (typeLower === 'submit') return '_button';
          if (typeLower === 'button') return '_button';
          if (typeLower === 'checkbox') return '_checkbox';
          if (typeLower === 'radio') return '_radio';
          if (typeLower === 'file') return '_file_input';
          return '_input';
        }
        if (tagLower === 'button') return '_button';
        if (tagLower === 'a') return '_link';
        if (tagLower === 'select') return '_dropdown';
        if (tagLower === 'textarea') return '_textarea';
        if (tagLower === 'img') return '_image';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagLower)) return '_heading';
        if (tagLower === 'label') return '_label';
        if (tagLower === 'span' || tagLower === 'div' || tagLower === 'p') return '_text';
        return '_element';
      } else {
        if (tagLower === 'input') {
          if (['text', 'email', 'password', 'tel', 'url', 'search', 'number'].includes(typeLower) || !typeLower) return 'Input';
          if (typeLower === 'submit') return 'Button';
          if (typeLower === 'button') return 'Button';
          if (typeLower === 'checkbox') return 'Checkbox';
          if (typeLower === 'radio') return 'Radio';
          if (typeLower === 'file') return 'FileInput';
          return 'Input';
        }
        if (tagLower === 'button') return 'Button';
        if (tagLower === 'a') return 'Link';
        if (tagLower === 'select') return 'Dropdown';
        if (tagLower === 'textarea') return 'Textarea';
        if (tagLower === 'img') return 'Image';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagLower)) return 'Heading';
        if (tagLower === 'label') return 'Label';
        if (tagLower === 'span' || tagLower === 'div' || tagLower === 'p') return 'Text';
        return 'Element';
      }
    };

    const isPython = language === 'python';
    const info = elementInfo || {};
    const tag = info.tagName || '';
    const type = info.type || '';
    const suffix = getElementSuffix(tag, type, isPython);

    // Priority 1: Use element's ID attribute for meaningful name
    if (info.id) {
      const cleanedId = cleanIdOrName(info.id);
      if (cleanedId) {
        if (isPython) {
          return toSnakeCase(cleanedId, suffix);
        } else {
          return toCamelCase(cleanedId, suffix);
        }
      }
    }

    // Priority 2: Use element's name attribute
    if (info.name || (info.attributes && info.attributes.name)) {
      const nameAttr = info.name || info.attributes.name;
      const cleanedName = cleanIdOrName(nameAttr);
      if (cleanedName) {
        if (isPython) {
          return toSnakeCase(cleanedName, suffix);
        } else {
          return toCamelCase(cleanedName, suffix);
        }
      }
    }

    // Priority 3: Use label text for form inputs
    if (info.labelText) {
      if (isPython) {
        return toSnakeCase(info.labelText, suffix);
      } else {
        return toCamelCase(info.labelText, suffix);
      }
    }

    // Priority 4: Use placeholder for input fields
    if (info.placeholder) {
      if (isPython) {
        return toSnakeCase(info.placeholder, suffix);
      } else {
        return toCamelCase(info.placeholder, suffix);
      }
    }

    // Priority 5: Use aria-label
    if (info.ariaLabel) {
      if (isPython) {
        return toSnakeCase(info.ariaLabel, suffix);
      } else {
        return toCamelCase(info.ariaLabel, suffix);
      }
    }

    // Priority 6: Use data-testid
    if (info.dataTestId) {
      const cleanedTestId = cleanIdOrName(info.dataTestId);
      if (isPython) {
        return toSnakeCase(cleanedTestId, suffix);
      } else {
        return toCamelCase(cleanedTestId, suffix);
      }
    }

    // Priority 7: Try to extract ID from XPath in locator code
    const xpathIdMatch = locatorCode && locatorCode.match(/@id\s*=\s*['"]([^'"]+)['"]/);
    if (xpathIdMatch) {
      const cleanedId = cleanIdOrName(xpathIdMatch[1]);
      if (cleanedId) {
        if (isPython) {
          return toSnakeCase(cleanedId, suffix);
        } else {
          return toCamelCase(cleanedId, suffix);
        }
      }
    }

    // Priority 8: Extract from Playwright semantic locators
    // From getByRole (Playwright)
    const roleMatch = locatorCode && locatorCode.match(/getByRole\s*\(\s*['"](\w+)['"]/);
    if (roleMatch) {
      const role = roleMatch[1];
      let roleSuffix = role.charAt(0).toUpperCase() + role.slice(1);
      if (role === 'heading') roleSuffix = 'Heading';
      else if (role === 'button') roleSuffix = 'Button';
      else if (role === 'link') roleSuffix = 'Link';
      else if (role === 'textbox') roleSuffix = 'Input';
      else if (role === 'checkbox') roleSuffix = 'Checkbox';
      else if (role === 'radio') roleSuffix = 'Radio';
      else if (role === 'combobox') roleSuffix = 'Dropdown';
      else if (role === 'listbox') roleSuffix = 'Listbox';
      else if (role === 'menuitem') roleSuffix = 'MenuItem';
      else if (role === 'tab') roleSuffix = 'Tab';
      else if (role === 'img' || role === 'image') roleSuffix = 'Image';

      const nameMatch = locatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (nameMatch) {
        if (isPython) {
          return toSnakeCase(nameMatch[1], '_' + roleSuffix.toLowerCase());
        } else {
          return toCamelCase(nameMatch[1], roleSuffix);
        }
      }
    }

    // From get_by_role (Python Playwright)
    const pyRoleMatch = locatorCode && locatorCode.match(/get_by_role\s*\(\s*['"](\w+)['"]/);
    if (pyRoleMatch) {
      const role = pyRoleMatch[1];
      let roleSuffix = '_' + role;
      if (role === 'heading') roleSuffix = '_heading';
      else if (role === 'button') roleSuffix = '_button';
      else if (role === 'link') roleSuffix = '_link';
      else if (role === 'textbox') roleSuffix = '_input';
      else if (role === 'checkbox') roleSuffix = '_checkbox';
      else if (role === 'radio') roleSuffix = '_radio';
      else if (role === 'combobox') roleSuffix = '_dropdown';
      else if (role === 'listbox') roleSuffix = '_listbox';
      else if (role === 'menuitem') roleSuffix = '_menu_item';
      else if (role === 'tab') roleSuffix = '_tab';
      else if (role === 'img' || role === 'image') roleSuffix = '_image';

      const nameMatch = locatorCode.match(/name\s*=\s*['"]([^'"]+)['"]/);
      if (nameMatch) {
        return toSnakeCase(nameMatch[1], roleSuffix);
      }
    }

    // From getByLabel (Playwright)
    const labelMatch = locatorCode && locatorCode.match(/getByLabel\(['"]([^'"]+)['"]/);
    if (labelMatch) {
      if (isPython) {
        return toSnakeCase(labelMatch[1], suffix);
      } else {
        return toCamelCase(labelMatch[1], suffix);
      }
    }

    // From get_by_label (Python Playwright)
    const pyLabelMatch = locatorCode && locatorCode.match(/get_by_label\(['"]([^'"]+)['"]/);
    if (pyLabelMatch) {
      return toSnakeCase(pyLabelMatch[1], suffix);
    }

    // From getByPlaceholder
    const placeholderMatch = locatorCode && locatorCode.match(/getByPlaceholder\(['"]([^'"]+)['"]/);
    if (placeholderMatch) {
      if (isPython) {
        return toSnakeCase(placeholderMatch[1], suffix);
      } else {
        return toCamelCase(placeholderMatch[1], suffix);
      }
    }

    // From get_by_placeholder (Python)
    const pyPlaceholderMatch = locatorCode && locatorCode.match(/get_by_placeholder\(['"]([^'"]+)['"]/);
    if (pyPlaceholderMatch) {
      return toSnakeCase(pyPlaceholderMatch[1], suffix);
    }

    // From getByText (Playwright)
    const textMatch = locatorCode && locatorCode.match(/getByText\(['"]([^'"]+)['"]/);
    if (textMatch) {
      if (isPython) {
        return toSnakeCase(textMatch[1], '_text');
      } else {
        return toCamelCase(textMatch[1], 'Text');
      }
    }

    // From get_by_text (Python Playwright)
    const pyTextMatch = locatorCode && locatorCode.match(/get_by_text\(['"]([^'"]+)['"]/);
    if (pyTextMatch) {
      return toSnakeCase(pyTextMatch[1], '_text');
    }

    // From getByTitle (Playwright)
    const titleMatch = locatorCode && locatorCode.match(/getByTitle\(['"]([^'"]+)['"]/);
    if (titleMatch) {
      if (isPython) {
        return toSnakeCase(titleMatch[1], suffix);
      } else {
        return toCamelCase(titleMatch[1], suffix);
      }
    }

    // From get_by_title (Python Playwright)
    const pyTitleMatch = locatorCode && locatorCode.match(/get_by_title\(['"]([^'"]+)['"]/);
    if (pyTitleMatch) {
      return toSnakeCase(pyTitleMatch[1], suffix);
    }

    // From getByAltText (Playwright)
    const altTextMatch = locatorCode && locatorCode.match(/getByAltText\(['"]([^'"]+)['"]/);
    if (altTextMatch) {
      if (isPython) {
        return toSnakeCase(altTextMatch[1], '_image');
      } else {
        return toCamelCase(altTextMatch[1], 'Image');
      }
    }

    // From get_by_alt_text (Python Playwright)
    const pyAltTextMatch = locatorCode && locatorCode.match(/get_by_alt_text\(['"]([^'"]+)['"]/);
    if (pyAltTextMatch) {
      return toSnakeCase(pyAltTextMatch[1], '_image');
    }

    // From getByTestId (Playwright)
    const testIdMatch2 = locatorCode && locatorCode.match(/getByTestId\(['"]([^'"]+)['"]/);
    if (testIdMatch2) {
      const cleanedTestId = cleanIdOrName(testIdMatch2[1]);
      if (isPython) {
        return toSnakeCase(cleanedTestId, suffix);
      } else {
        return toCamelCase(cleanedTestId, suffix);
      }
    }

    // From get_by_test_id (Python Playwright)
    const pyTestIdMatch = locatorCode && locatorCode.match(/get_by_test_id\(['"]([^'"]+)['"]/);
    if (pyTestIdMatch) {
      const cleanedTestId = cleanIdOrName(pyTestIdMatch[1]);
      return toSnakeCase(cleanedTestId, suffix);
    }

    // From CSS selector with ID (#id)
    const cssIdMatch = locatorCode && locatorCode.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/);
    if (cssIdMatch) {
      const cleanedId = cleanIdOrName(cssIdMatch[1]);
      if (isPython) {
        return toSnakeCase(cleanedId, suffix);
      } else {
        return toCamelCase(cleanedId, suffix);
      }
    }

    // From Selenium By.ID
    const seleniumIdMatch = locatorCode && locatorCode.match(/By\.(?:ID|id)\s*[,\(]\s*["']([^"']+)["']/);
    if (seleniumIdMatch) {
      const cleanedId = cleanIdOrName(seleniumIdMatch[1]);
      if (isPython) {
        return toSnakeCase(cleanedId, suffix);
      } else {
        return toCamelCase(cleanedId, suffix);
      }
    }

    // From Selenium By.NAME
    const seleniumNameMatch = locatorCode && locatorCode.match(/By\.(?:NAME|name)\s*[,\(]\s*["']([^"']+)["']/);
    if (seleniumNameMatch) {
      const cleanedName = cleanIdOrName(seleniumNameMatch[1]);
      if (isPython) {
        return toSnakeCase(cleanedName, suffix);
      } else {
        return toCamelCase(cleanedName, suffix);
      }
    }

    // From Selenium By.CSS_SELECTOR with ID
    const cssSelectorIdMatch = locatorCode && locatorCode.match(/By\.(?:CSS_SELECTOR|cssSelector)\s*[,\(]\s*["']#([^"'\s]+)["']/);
    if (cssSelectorIdMatch) {
      const cleanedId = cleanIdOrName(cssSelectorIdMatch[1]);
      if (isPython) {
        return toSnakeCase(cleanedId, suffix);
      } else {
        return toCamelCase(cleanedId, suffix);
      }
    }

    // From Selenium By.linkText / By.LINK_TEXT
    const linkTextMatch = locatorCode && locatorCode.match(/By\.(?:LINK_TEXT|linkText)\s*[,\(]\s*["']([^"']+)["']/);
    if (linkTextMatch) {
      if (isPython) {
        return toSnakeCase(linkTextMatch[1], '_link');
      } else {
        return toCamelCase(linkTextMatch[1], 'Link');
      }
    }

    // From Selenium By.partialLinkText / By.PARTIAL_LINK_TEXT
    const partialLinkTextMatch = locatorCode && locatorCode.match(/By\.(?:PARTIAL_LINK_TEXT|partialLinkText)\s*[,\(]\s*["']([^"']+)["']/);
    if (partialLinkTextMatch) {
      if (isPython) {
        return toSnakeCase(partialLinkTextMatch[1], '_link');
      } else {
        return toCamelCase(partialLinkTextMatch[1], 'Link');
      }
    }

    // From text content (for buttons, links, headings)
    if (info.text && ['button', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag.toLowerCase())) {
      const cleanText = info.text.trim().substring(0, 30); // Limit text length
      if (cleanText) {
        if (isPython) {
          return toSnakeCase(cleanText, suffix);
        } else {
          return toCamelCase(cleanText, suffix);
        }
      }
    }

    // Fallback: generate from element tag and type
    if (tag) {
      if (isPython) {
        const base = tag.toLowerCase() + (type ? '_' + type.toLowerCase() : '');
        return (base + '_element').replace(/[^a-z0-9_]/g, '');
      } else {
        const base = tag.toLowerCase() + (type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : '');
        return (base + 'Element').replace(/[^a-zA-Z0-9]/g, '');
      }
    }

    return isPython ? 'element' : 'element';
  }

  // Generate copy options for different formats
  function generateCopyOptions(locatorCode, locatorType, elementTagName, elementTypeAttr, elementInfo) {
    const framework = LocatorGenerator.framework;
    const language = LocatorGenerator.language;
    const varName = generateVariableName(locatorCode, locatorType, elementInfo, language);

    const options = {
      locatorOnly: locatorCode
    };

    // Check if locatorCode already has page. prefix to avoid page.page duplication
    const hasPagePrefix = locatorCode.startsWith('page.');
    const pagePrefix = hasPagePrefix ? '' : 'page.';

    // Generate variable declaration based on framework and language
    if (framework === 'playwright') {
      if (language === 'javascript' || language === 'typescript') {
        options.withVariable = `const ${varName} = ${pagePrefix}${locatorCode};`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      } else if (language === 'python') {
        options.withVariable = `${varName} = ${pagePrefix}${locatorCode}`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      } else if (language === 'java') {
        options.withVariable = `Locator ${varName} = ${pagePrefix}${locatorCode};`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      }
    } else if (framework === 'selenium') {
      if (language === 'java') {
        options.withVariable = `WebElement ${varName} = ${locatorCode};`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      } else if (language === 'python') {
        options.withVariable = `${varName} = ${locatorCode}`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      } else if (language === 'csharp') {
        options.withVariable = `var ${varName} = ${locatorCode};`;
        options.fullStatement = generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language);
      }
    }

    return options;
  }

  // Generate full statement with action based on element type
  function generateFullStatement(varName, locatorCode, elementTagName, elementTypeAttr, framework, language) {
    const tag = (elementTagName || '').toLowerCase();
    const type = (elementTypeAttr || '').toLowerCase();

    // Check if locatorCode already has page. prefix to avoid page.page duplication
    const hasPagePrefix = locatorCode.startsWith('page.');
    const pagePrefix = hasPagePrefix ? '' : 'page.';

    // Check if element is text-based (headings, paragraphs, spans, etc.)
    const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'li', 'td', 'th', 'caption', 'legend', 'figcaption', 'blockquote', 'cite', 'abbr', 'strong', 'em', 'b', 'i', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'pre', 'code', 'dt', 'dd'].includes(tag);

    // Determine appropriate action based on element type
    if (framework === 'playwright') {
      if (isTextElement) {
        // Text elements - use textContent()
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nconst text = await ${varName}.textContent();`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\ntext = ${varName}.text_content()`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\nString text = ${varName}.textContent();`;
        }
      } else if (tag === 'button' || type === 'submit' || type === 'button') {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.click()`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.click();`;
        }
      } else if (tag === 'a') {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.click()`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.click();`;
        }
      } else if (tag === 'input' && (type === 'text' || type === 'email' || type === 'password' || type === 'search' || type === 'tel' || type === 'url' || type === '')) {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.fill('');`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.fill('')`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.fill("");`;
        }
      } else if (tag === 'textarea') {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.fill('');`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.fill('')`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.fill("");`;
        }
      } else if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.check();`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.check()`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.check();`;
        }
      } else if (tag === 'select') {
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.selectOption('');`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.select_option('')`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.selectOption("");`;
        }
      } else if (tag === 'img') {
        // Images - get alt text or src
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nconst altText = await ${varName}.getAttribute('alt');`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\nalt_text = ${varName}.get_attribute('alt')`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\nString altText = ${varName}.getAttribute("alt");`;
        }
      } else {
        // Default: click
        if (language === 'javascript' || language === 'typescript') {
          return `const ${varName} = ${pagePrefix}${locatorCode};\nawait ${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${pagePrefix}${locatorCode}\n${varName}.click()`;
        } else if (language === 'java') {
          return `Locator ${varName} = ${pagePrefix}${locatorCode};\n${varName}.click();`;
        }
      }
    } else if (framework === 'selenium') {
      if (isTextElement) {
        // Text elements - use getText()
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\nString text = ${varName}.getText();`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\ntext = ${varName}.text`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\nvar text = ${varName}.Text;`;
        }
      } else if (tag === 'button' || type === 'submit' || type === 'button') {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.click()`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.Click();`;
        }
      } else if (tag === 'a') {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.click()`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.Click();`;
        }
      } else if (tag === 'input' && (type === 'text' || type === 'email' || type === 'password' || type === 'search' || type === 'tel' || type === 'url' || type === '')) {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.sendKeys("");`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.send_keys('')`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.SendKeys("");`;
        }
      } else if (tag === 'textarea') {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.sendKeys("");`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.send_keys('')`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.SendKeys("");`;
        }
      } else if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.click()`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.Click();`;
        }
      } else if (tag === 'select') {
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\nnew Select(${varName}).selectByVisibleText("");`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\nSelect(${varName}).select_by_visible_text('')`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\nnew SelectElement(${varName}).SelectByText("");`;
        }
      } else if (tag === 'img') {
        // Images - get alt text or src
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\nString altText = ${varName}.getAttribute("alt");`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\nalt_text = ${varName}.get_attribute('alt')`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\nvar altText = ${varName}.GetAttribute("alt");`;
        }
      } else {
        // Default: click
        if (language === 'java') {
          return `WebElement ${varName} = ${locatorCode};\n${varName}.click();`;
        } else if (language === 'python') {
          return `${varName} = ${locatorCode}\n${varName}.click()`;
        } else if (language === 'csharp') {
          return `var ${varName} = ${locatorCode};\n${varName}.Click();`;
        }
      }
    }

    return locatorCode;
  }

  // Copy to clipboard directly (for dropdown use)
  function copyToClipboardDirect(text, button) {
    if (window.electronAPI) {
      window.electronAPI.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    showToast('Copied to clipboard!', 'success');

    // Visual feedback on the button
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = '✓';
      button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 1000);
    }
  }

  // Show copy dropdown menu
  function showCopyDropdown(button, locatorCode, locatorType, elementTagName, elementTypeAttr, elementInfo) {
    // Remove any existing dropdowns
    document.querySelectorAll('.copy-dropdown').forEach(d => d.remove());

    const options = generateCopyOptions(locatorCode, locatorType, elementTagName, elementTypeAttr, elementInfo);

    const dropdown = document.createElement('div');
    dropdown.className = 'copy-dropdown';
    dropdown.innerHTML = `
      <button class="copy-dropdown-item" data-option="locatorOnly">
        <span>📋</span>
        <span>Copy Locator Only</span>
      </button>
      <button class="copy-dropdown-item" data-option="withVariable">
        <span>💾</span>
        <span>Copy with Variable</span>
      </button>
      <button class="copy-dropdown-item" data-option="fullStatement">
        <span>⚡</span>
        <span>Copy Full Statement</span>
      </button>
    `;

    // Append to body for fixed positioning
    document.body.appendChild(dropdown);

    // Position dropdown below button
    const rect = button.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 5}px`;
    dropdown.style.left = `${Math.max(5, rect.left - 150)}px`; // Align to right of button, with min left margin

    // Show dropdown with animation
    setTimeout(() => dropdown.classList.add('active'), 10);

    // Add click handlers for options
    dropdown.querySelectorAll('.copy-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const option = item.dataset.option;
        const textToCopy = options[option];

        copyToClipboardDirect(textToCopy, button);
        dropdown.remove();
      });
    });

    // Close dropdown when clicking outside
    setTimeout(() => {
      const closeHandler = function(e) {
        if (!dropdown.contains(e.target) && !button.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 100);
  }

  // =====================
  // DISPLAY LOCATORS
  // =====================
  function displayLocators(locators) {
    if (locators.length === 0) {
      locatorsList.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><p>No locators could be generated</p></div>';
      return;
    }

    locatorsList.innerHTML = locators.map(loc => createLocatorCard(loc)).join('');
    attachLocatorEventHandlers();
  }

  function attachLocatorEventHandlers() {
    // Attach copy handlers with dropdown
    locatorsList.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.dataset.code;
        const strategy = btn.dataset.strategy;

        // Get element info from currentElementData
        const elementTagName = currentElementData ? currentElementData.tagName : '';
        const elementTypeAttr = currentElementData ? currentElementData.type : '';
        const elementInfo = currentElementData || {};

        showCopyDropdown(btn, code, strategy, elementTagName, elementTypeAttr, elementInfo);
      });
    });

    // Attach highlight handlers
    locatorsList.querySelectorAll('.highlight-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        // Populate the test locator field and run test to highlight and show count
        // (runTestLocator handles all locator types including getByRole, frameLocator, etc.)
        testLocatorInput.value = code;
        runTestLocator();
      });
    });

    // Attach add-to-cart handlers
    locatorsList.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.dataset.code;
        const strategy = btn.dataset.strategy;

        // Check if already in cart
        if (pageObjectCart.some(item => item.locatorCode === code)) {
          showToast('Already in Page Object cart', 'info');
          return;
        }

        addToPageObjectCart(code, strategy);

        // Update button to show it's been added
        btn.classList.add('in-cart');
        btn.innerHTML = '✓';
        btn.title = 'Already in Page Object cart';
      });
    });
  }

  function createLocatorCard(locator) {
    const qualityDots = createQualityDots(locator.quality.score);

    // Hide highlight button for Selenium shadow DOM locators (can't directly highlight)
    const showHighlightBtn = !locator.isShadowDOM;

    // Check if this locator is already in the cart
    const isInCart = pageObjectCart.some(item => item.locatorCode === locator.value);

    return `
      <div class="locator-card">
        <div class="locator-header">
          <div class="locator-strategy">
            <span class="strategy-badge ${locator.quality.class}">${locator.quality.label}</span>
            <span class="strategy-name">${locator.strategy}</span>
          </div>
          <div class="quality-indicator">${qualityDots}</div>
        </div>
        <div class="locator-code">
          <code class="code-content">${escapeHtml(locator.value)}</code>
          <div class="locator-actions">
            <button class="action-btn add-to-cart-btn ${isInCart ? 'in-cart' : ''}" data-code="${escapeAttr(locator.value)}" data-strategy="${escapeAttr(locator.strategy)}" title="${isInCart ? 'Already in Page Object cart' : 'Add to Page Objects'}">
              ${isInCart ? '✓' : '+'}
            </button>
            <button class="action-btn copy-btn" data-code="${escapeAttr(locator.value)}" data-strategy="${escapeAttr(locator.strategy)}" title="Copy">📋</button>
            ${showHighlightBtn ? `<button class="highlight-btn" data-code="${escapeAttr(locator.value)}" title="Highlight">🎯</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function createQualityDots(score) {
    let dots = '';
    for (let i = 0; i < 3; i++) {
      dots += `<span class="quality-dot ${i < score ? 'filled' : ''}"></span>`;
    }
    return dots;
  }

  // =====================
  // FRAMEWORK & LANGUAGE
  // =====================
  function setupFrameworkToggle() {
    // Handle framework tab clicks
    frameworkBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Only allow clicking visible tabs
        if (btn.classList.contains('hidden')) return;

        frameworkBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        LocatorGenerator.framework = btn.dataset.framework;

        // Update visible languages based on active framework
        updateLanguageButtons(btn.dataset.framework);

        // Update test locator placeholder based on framework
        updateTestLocatorPlaceholder(btn.dataset.framework);

        // Regenerate locators with new framework
        regenerateLocators();
      });
    });

    // Handle "Show Code For" checkboxes
    toolCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const framework = checkbox.dataset.framework;

        // Get currently checked frameworks
        const checkedFrameworks = Array.from(toolCheckboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.dataset.framework);

        // Ensure at least one framework is selected
        if (checkedFrameworks.length === 0) {
          // Prevent unchecking the last one
          checkbox.checked = true;
          toolSelectionHint.classList.add('visible');
          setTimeout(() => {
            toolSelectionHint.classList.remove('visible');
          }, 2000);
          return;
        }

        // Update selected frameworks array
        selectedFrameworks = checkedFrameworks;

        // Show/hide framework tabs based on checkboxes
        updateFrameworkTabs();

        // Regenerate locators with new framework selection
        regenerateLocators();
      });
    });

    // Initialize framework tabs visibility
    updateFrameworkTabs();
  }

  // Update framework tabs visibility based on selected checkboxes
  function updateFrameworkTabs() {
    let activeTabHidden = false;

    frameworkBtns.forEach(btn => {
      const framework = btn.dataset.framework;
      const isSelected = selectedFrameworks.includes(framework);

      if (isSelected) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
        if (btn.classList.contains('active')) {
          activeTabHidden = true;
        }
      }
    });

    // If active tab is now hidden, switch to first visible tab
    if (activeTabHidden) {
      const firstVisibleBtn = Array.from(frameworkBtns).find(btn => !btn.classList.contains('hidden'));
      if (firstVisibleBtn) {
        frameworkBtns.forEach(b => b.classList.remove('active'));
        firstVisibleBtn.classList.add('active');
        LocatorGenerator.framework = firstVisibleBtn.dataset.framework;

        // Update languages for new active framework
        updateLanguageButtons(firstVisibleBtn.dataset.framework);
        updateTestLocatorPlaceholder(firstVisibleBtn.dataset.framework);
      }
    }
  }

  function updateTestLocatorPlaceholder(framework) {
    if (framework === 'selenium') {
      testLocatorInput.placeholder = 'e.g., driver.findElement(By.id("username"))';
    } else if (framework === 'cypress') {
      testLocatorInput.placeholder = "e.g., cy.get('#username') or cy.contains('Submit')";
    } else {
      testLocatorInput.placeholder = "e.g., page.getByRole('textbox', { name: 'user' })";
    }
  }

  function updateLanguageButtons(frameworks) {
    // Handle both single framework (string) and multiple frameworks (array)
    const frameworkList = Array.isArray(frameworks) ? frameworks : [frameworks];
    let hasActiveVisible = false;

    langBtns.forEach(btn => {
      const supportedFrameworks = btn.dataset.frameworks.split(',');
      // Show language if any selected framework supports it
      const isSupported = frameworkList.some(fw => supportedFrameworks.includes(fw));

      // Show/hide based on framework support
      btn.style.display = isSupported ? '' : 'none';

      // Check if current active button is still visible
      if (btn.classList.contains('active') && isSupported) {
        hasActiveVisible = true;
      }
    });

    // If active button is hidden, select the preferred default
    if (!hasActiveVisible) {
      // Default language preferences: if Playwright or Cypress is selected -> JS/TS, otherwise -> Java
      const preferredLang = (frameworkList.includes('playwright') || frameworkList.includes('cypress')) ? 'javascript' : 'java';
      let preferredBtn = Array.from(langBtns).find(btn =>
        btn.dataset.lang === preferredLang && btn.style.display !== 'none'
      );

      // Fallback to first visible if preferred not found
      if (!preferredBtn) {
        preferredBtn = Array.from(langBtns).find(btn => btn.style.display !== 'none');
      }

      if (preferredBtn) {
        langBtns.forEach(b => b.classList.remove('active'));
        preferredBtn.classList.add('active');
        LocatorGenerator.language = preferredBtn.dataset.lang;
      }
    }
  }

  function setupLanguageToggle() {
    langBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        LocatorGenerator.language = btn.dataset.lang;

        // Regenerate locators with new language
        regenerateLocators();
      });
    });

    // Initialize language buttons for the ACTIVE framework only (not all selected)
    // This ensures only relevant languages are shown (e.g., no Java for Playwright)
    const activeFramework = LocatorGenerator.framework || 'playwright';
    updateLanguageButtons(activeFramework);
  }

  // =====================
  // UTILITIES
  // =====================
  function copyToClipboard(text) {
    if (window.electronAPI) {
      window.electronAPI.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    showToast('Copied to clipboard!', 'success');
  }

  function highlightElement(locatorCode) {
    if (!currentElementData) {
      showToast('No element data available', 'error');
      return;
    }

    // Serialize element data for use in script
    const elementDataJson = JSON.stringify(currentElementData);

    const script = `
      (function() {
        try {
          const elementData = ${elementDataJson};
          const framePath = elementData.framePath || [];
          let targetDoc = document;

          // Navigate to the correct iframe if needed
          console.log('Frame path:', JSON.stringify(framePath));
          for (const frame of framePath) {
            console.log('Looking for frame with selector:', frame.selector);
            // Try multiple ways to find the iframe
            let iframe = targetDoc.querySelector('iframe' + frame.selector) ||
                         targetDoc.querySelector('frame' + frame.selector) ||
                         targetDoc.querySelector(frame.selector);

            // Also try by name or id directly
            if (!iframe && frame.name) {
              iframe = targetDoc.querySelector('iframe[name="' + frame.name + '"]') ||
                       targetDoc.querySelector('frame[name="' + frame.name + '"]');
            }
            if (!iframe && frame.id) {
              iframe = targetDoc.getElementById(frame.id);
            }

            console.log('Found iframe:', iframe);
            if (iframe && iframe.contentDocument) {
              targetDoc = iframe.contentDocument;
              console.log('Switched to iframe document');
            } else if (iframe && !iframe.contentDocument) {
              console.log('Iframe found but contentDocument is null (cross-origin?)');
              return { success: false, error: 'Cannot access iframe content (cross-origin restriction)' };
            } else {
              console.log('Could not find iframe:', frame.selector);
              return { success: false, error: 'Could not find iframe: ' + frame.selector };
            }
          }

          // Handle Shadow DOM navigation if needed
          const shadowPath = elementData.shadowPath || [];
          let shadowRoot = null;
          if (shadowPath.length > 0) {
            console.log('Shadow DOM path:', JSON.stringify(shadowPath));
            let currentNode = targetDoc;
            for (const shadow of shadowPath) {
              console.log('Looking for shadow host:', shadow.selector);
              const host = currentNode.querySelector ? currentNode.querySelector(shadow.selector) : null;
              if (host && host.shadowRoot) {
                console.log('Found shadow host, entering shadow root');
                currentNode = host.shadowRoot;
                shadowRoot = currentNode;
              } else {
                console.log('Could not find shadow host or shadowRoot');
                return { success: false, error: 'Could not access shadow DOM: ' + shadow.selector };
              }
            }
            // Use shadowRoot for element searches
            if (shadowRoot) {
              targetDoc = shadowRoot;
              console.log('Now searching inside shadow root');
            }
          }

          // Try multiple strategies to find the element
          let el = null;
          let foundBy = '';
          console.log('Element data for search:', JSON.stringify(elementData));

          // Strategy 1: By ID (use querySelector for shadow DOM compatibility)
          if (!el && elementData.id) {
            console.log('Trying strategy 1: By ID -', elementData.id);
            el = targetDoc.getElementById ? targetDoc.getElementById(elementData.id) : null;
            if (!el) {
              // Fallback to querySelector for shadow roots
              el = targetDoc.querySelector('#' + CSS.escape(elementData.id));
            }
            if (el) foundBy = 'ID';
          }

          // Strategy 2: By data-testid
          if (!el && elementData.dataTestId) {
            console.log('Trying strategy 2: By data-testid -', elementData.dataTestId);
            el = targetDoc.querySelector('[data-testid="' + elementData.dataTestId + '"]') ||
                 targetDoc.querySelector('[data-test-id="' + elementData.dataTestId + '"]');
            if (el) foundBy = 'data-testid';
          }

          // Strategy 3: By name attribute (element's name, not the "name" option in getByRole)
          if (!el && elementData.attributes && elementData.attributes.name) {
            console.log('Trying strategy 3: By name attr -', elementData.attributes.name);
            el = targetDoc.querySelector('[name="' + elementData.attributes.name + '"]');
            if (el) foundBy = 'name attribute';
          }

          // Strategy 4: By placeholder
          if (!el && elementData.placeholder) {
            console.log('Trying strategy 4: By placeholder -', elementData.placeholder);
            el = targetDoc.querySelector('[placeholder="' + elementData.placeholder + '"]');
            if (el) foundBy = 'placeholder';
          }

          // Strategy 5: By aria-label
          if (!el && elementData.ariaLabel) {
            console.log('Trying strategy 5: By aria-label -', elementData.ariaLabel);
            el = targetDoc.querySelector('[aria-label="' + elementData.ariaLabel + '"]');
            if (el) foundBy = 'aria-label';
          }

          // Strategy 6: By href for links
          if (!el && elementData.tagName === 'A' && elementData.href) {
            console.log('Trying strategy 6: By href -', elementData.href);
            el = targetDoc.querySelector('a[href="' + elementData.href + '"]');
            if (el) foundBy = 'href';
          }

          // Strategy 7: By text content using XPath (for links and buttons)
          if (!el && elementData.text && elementData.text.trim()) {
            const tag = elementData.tagName.toLowerCase();
            const text = elementData.text.trim();
            console.log('Trying strategy 7: By text XPath - tag:', tag, 'text:', text);

            // Try exact match first
            try {
              const xpath = '//' + tag + '[normalize-space(.)="' + text.replace(/"/g, "'") + '"]';
              console.log('XPath exact:', xpath);
              const result = targetDoc.evaluate(xpath, targetDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              el = result.singleNodeValue;
              if (el) foundBy = 'text XPath exact';
            } catch(e) { console.log('XPath exact error:', e); }

            // Try contains match if exact didn't work
            if (!el) {
              try {
                const shortText = text.substring(0, 30);
                const xpathContains = '//' + tag + '[contains(normalize-space(.), "' + shortText.replace(/"/g, "'") + '")]';
                console.log('XPath contains:', xpathContains);
                const resultContains = targetDoc.evaluate(xpathContains, targetDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                el = resultContains.singleNodeValue;
                if (el) foundBy = 'text XPath contains';
              } catch(e) { console.log('XPath contains error:', e); }
            }
          }

          // Strategy 8: By class and tag
          if (!el && elementData.className && elementData.tagName) {
            const classes = (elementData.className || '').split(' ').filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
              try {
                const selector = elementData.tagName.toLowerCase() + '.' + CSS.escape(classes[0]);
                console.log('Trying strategy 8: By class -', selector);
                el = targetDoc.querySelector(selector);
                if (el) foundBy = 'class';
              } catch(e) {}
            }
          }

          // Strategy 9: By role attribute
          if (!el && elementData.role) {
            console.log('Trying strategy 9: By role -', elementData.role);
            el = targetDoc.querySelector('[role="' + elementData.role + '"]');
            if (el) foundBy = 'role';
          }

          // Strategy 10: By tag and type
          if (!el && elementData.tagName && elementData.type) {
            console.log('Trying strategy 10: By tag+type');
            el = targetDoc.querySelector(elementData.tagName.toLowerCase() + '[type="' + elementData.type + '"]');
            if (el) foundBy = 'tag+type';
          }

          // Strategy 11: Just by tag name (last resort)
          if (!el && elementData.tagName) {
            const tag = elementData.tagName.toLowerCase();
            const allElements = targetDoc.querySelectorAll(tag);
            console.log('Trying strategy 11: By tag only, found', allElements.length, tag, 'elements');
            // If there's text, try to match it
            if (elementData.text && allElements.length > 0) {
              const text = elementData.text.trim().toLowerCase();
              for (const candidate of allElements) {
                const candidateText = (candidate.textContent || '').trim().toLowerCase();
                if (candidateText === text || candidateText.includes(text)) {
                  el = candidate;
                  foundBy = 'tag + text match';
                  break;
                }
              }
            }
          }

          console.log('Element found:', el, 'by:', foundBy);

          if (el) {
            // Remove previous highlights from all documents (including shadow DOM)
            function clearHighlights(root) {
              try {
                root.querySelectorAll('.__locatorlabs_highlight_temp').forEach(e => {
                  e.style.outline = '';
                  e.style.outlineOffset = '';
                  e.classList.remove('__locatorlabs_highlight_temp');
                });
                root.querySelectorAll('.__locatorlabs_test_highlight').forEach(e => {
                  e.style.outline = e.__llOriginalOutline || '';
                  e.style.outlineOffset = e.__llOriginalOutlineOffset || '';
                  e.classList.remove('__locatorlabs_test_highlight');
                });
                // Clear in iframes
                root.querySelectorAll('iframe, frame').forEach(iframe => {
                  try {
                    if (iframe.contentDocument) clearHighlights(iframe.contentDocument);
                  } catch(e) {}
                });
                // Clear in shadow DOMs
                root.querySelectorAll('*').forEach(el => {
                  if (el.shadowRoot) {
                    clearHighlights(el.shadowRoot);
                  }
                });
              } catch(e) {}
            }
            clearHighlights(document);

            el.style.outline = '4px solid #dc2626';
            el.style.outlineOffset = '2px';
            el.classList.add('__locatorlabs_highlight_temp');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return { success: true };
          } else {
            return { success: false, error: 'Element not found with any strategy' };
          }
        } catch(e) {
          console.error('Highlight failed:', e);
          return { success: false, error: e.message };
        }
      })();
    `;

    webview.executeJavaScript(script).then(result => {
      if (result && !result.success) {
        console.log('Highlight failed:', result.error);
        showToast('Highlight failed: ' + result.error, 'error');
      }
    }).catch(err => {
      console.error('Highlight script error:', err);
      showToast('Highlight error: ' + err.message, 'error');
    });
  }

  function extractSelectorFromCode(locatorCode) {
    // Try to extract CSS selector from locator code
    const patterns = [
      /locator\(['"](.+?)['"]\)/,           // locator('selector')
      /Locator\(['"](.+?)['"]\)/,           // Locator('selector') - C#
      /locator\("(.+?)"\)/,                 // locator("selector") - Java/Python
      /#([\w-]+)/,                          // #id
      /By\.id\(['"](.+?)['"]\)/,            // By.id('value')
      /By\.id\("(.+?)"\)/,                  // By.id("value")
      /By\.ID,\s*["'](.+?)["']/,            // By.ID, "value" - Python
      /By\.name\(['"](.+?)['"]\)/,          // By.name('value')
      /By\.name\("(.+?)"\)/,                // By.name("value")
      /By\.NAME,\s*["'](.+?)["']/,          // By.NAME, "value" - Python
      /By\.cssSelector\("(.+?)"\)/,         // By.cssSelector("selector")
      /By\.CSS_SELECTOR,\s*["'](.+?)["']/,  // By.CSS_SELECTOR, "selector"
    ];

    for (const pattern of patterns) {
      const match = locatorCode.match(pattern);
      if (match) {
        const value = match[1];
        // Determine selector type based on pattern
        if (pattern.source.includes('id') || pattern.source.includes('ID')) {
          return `#${value}`;
        }
        if (pattern.source.includes('name') || pattern.source.includes('NAME')) {
          return `[name="${value}"]`;
        }
        return value;
      }
    }

    return null;
  }

  function showToast(message, type = 'info', duration = 2500, position = 'left') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} toast-${position}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // =====================
  // PAGE OBJECT MODEL FEATURE
  // =====================

  function addToPageObjectCart(locatorCode, strategy) {
    // Check for duplicate - if same locator code already exists, don't add
    const isDuplicate = pageObjectCart.some(item => item.locatorCode === locatorCode);
    if (isDuplicate) {
      showToast('Element already in cart!', 'error', 800, 'right');
      return;
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Determine element type from current element data
    const elementType = currentElementData ? currentElementData.tagName : 'element';
    const elementTypeAttr = currentElementData ? currentElementData.type : '';

    // Generate a variable name for this element
    const language = LocatorGenerator.language || 'javascript';
    const varName = generateVariableName(locatorCode, strategy, currentElementData || {}, language);

    pageObjectCart.push({
      id,
      elementType: elementType.toLowerCase(),
      elementTypeAttr,
      locatorType: strategy,
      locatorCode,
      varName,
      elementInfo: currentElementData ? { ...currentElementData } : {},
      selected: true
    });

    updateCartBadge();
    showToast('Added to Page Object', 'success', 800, 'right');
  }

  function removeFromPageObjectCart(id) {
    pageObjectCart = pageObjectCart.filter(item => item.id !== id);
    updateCartBadge();
    renderPageObjectModal();
  }

  function updateCartBadge() {
    const badge = document.getElementById('poCartBadge');
    if (badge) {
      badge.textContent = pageObjectCart.length;
      badge.style.display = pageObjectCart.length > 0 ? 'flex' : 'none';
    }
  }

  function setupPageObjectModal() {
    const poCartBtn = document.getElementById('poCartBtn');
    const poModal = document.getElementById('poModal');
    const poModalClose = document.getElementById('poModalClose');
    const poModalCancel = document.getElementById('poModalCancel');
    const poSelectAll = document.getElementById('poSelectAll');
    const poDeselectAll = document.getElementById('poDeselectAll');
    const poClearAll = document.getElementById('poClearAll');
    const poGenerateBtn = document.getElementById('poGenerateBtn');
    const poCopyBtn = document.getElementById('poCopyBtn');
    const poFrameworkSelect = document.getElementById('poFrameworkSelect');

    if (!poCartBtn || !poModal) return;

    // Open modal
    poCartBtn.addEventListener('click', () => {
      if (pageObjectCart.length === 0) {
        showToast('No elements in Page Object cart. Use the + button to add locators.', 'info');
        return;
      }
      renderPageObjectModal();
      poModal.classList.add('active');
    });

    // Close modal
    poModalClose.addEventListener('click', () => {
      poModal.classList.remove('active');
    });

    poModalCancel.addEventListener('click', () => {
      poModal.classList.remove('active');
    });

    // Close on backdrop click
    poModal.addEventListener('click', (e) => {
      if (e.target === poModal) {
        poModal.classList.remove('active');
      }
    });

    // Select All
    poSelectAll.addEventListener('click', () => {
      pageObjectCart.forEach(item => item.selected = true);
      renderPageObjectModal();
    });

    // Deselect All
    poDeselectAll.addEventListener('click', () => {
      pageObjectCart.forEach(item => item.selected = false);
      renderPageObjectModal();
    });

    // Clear All - with confirmation
    poClearAll.addEventListener('click', () => {
      if (pageObjectCart.length === 0) {
        showToast('Cart is already empty', 'info');
        return;
      }

      const confirmed = confirm(`Are you sure you want to clear all ${pageObjectCart.length} element(s) from the cart?\n\nThis action cannot be undone.`);
      if (confirmed) {
        pageObjectCart = [];
        updateCartBadge();
        poModal.classList.remove('active');
        showToast('Page Object cart cleared', 'info');
      }
    });

    // Generate Page Object
    poGenerateBtn.addEventListener('click', () => {
      const pageName = document.getElementById('poPageName').value.trim();
      if (!pageName) {
        showToast('Please enter a Page Name', 'error');
        return;
      }

      const selectedItems = pageObjectCart.filter(item => item.selected);
      if (selectedItems.length === 0) {
        showToast('Please select at least one element', 'error');
        return;
      }

      const framework = poFrameworkSelect.value;
      const code = generatePageObjectCode(pageName, selectedItems, framework);

      // Determine file extension based on framework
      const fileExtension = getFileExtension(framework);
      const fileName = `${toPascalCase(pageName)}${fileExtension}`;

      // Download file
      downloadFile(fileName, code);

      showToast(`Downloaded ${fileName}`, 'success');
      poModal.classList.remove('active');
    });

    // Copy to Clipboard
    poCopyBtn.addEventListener('click', () => {
      const pageName = document.getElementById('poPageName').value.trim();
      if (!pageName) {
        showToast('Please enter a Page Name', 'error');
        return;
      }

      const selectedItems = pageObjectCart.filter(item => item.selected);
      if (selectedItems.length === 0) {
        showToast('Please select at least one element', 'error');
        return;
      }

      const framework = poFrameworkSelect.value;
      const code = generatePageObjectCode(pageName, selectedItems, framework);

      // Copy to clipboard
      if (window.electronAPI) {
        window.electronAPI.copyToClipboard(code);
      } else {
        navigator.clipboard.writeText(code);
      }

      showToast('Page Object code copied to clipboard!', 'success');
      poModal.classList.remove('active');
    });

    // Update selected count when framework changes
    poFrameworkSelect.addEventListener('change', updateSelectedCount);
  }

  function renderPageObjectModal() {
    const poElementsList = document.getElementById('poElementsList');
    if (!poElementsList) return;

    poElementsList.innerHTML = pageObjectCart.map(item => `
      <div class="po-element-item" data-id="${item.id}">
        <input type="checkbox" class="po-element-checkbox" ${item.selected ? 'checked' : ''} data-id="${item.id}">
        <span class="po-element-type">${item.elementType}</span>
        <span class="po-element-locator">${item.locatorType}: ${escapeHtml(item.locatorCode)}</span>
        <button class="po-element-remove" data-id="${item.id}" title="Remove">×</button>
      </div>
    `).join('');

    // Attach checkbox handlers
    poElementsList.querySelectorAll('.po-element-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const item = pageObjectCart.find(i => i.id === id);
        if (item) {
          item.selected = e.target.checked;
          updateSelectedCount();
        }
      });
    });

    // Attach remove handlers
    poElementsList.querySelectorAll('.po-element-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromPageObjectCart(btn.dataset.id);
      });
    });

    updateSelectedCount();
  }

  function updateSelectedCount() {
    const countEl = document.getElementById('poSelectedCount');
    if (countEl) {
      const selectedCount = pageObjectCart.filter(item => item.selected).length;
      countEl.textContent = `Elements (${selectedCount})`;
    }
  }

  function generatePageObjectCode(pageName, elements, framework) {
    switch (framework) {
      case 'playwright-ts':
        return generatePlaywrightTS(pageName, elements);
      case 'playwright-js':
        return generatePlaywrightJS(pageName, elements);
      case 'playwright-python':
        return generatePlaywrightPython(pageName, elements);
      case 'selenium-java':
        return generateSeleniumJava(pageName, elements);
      case 'selenium-python':
        return generateSeleniumPython(pageName, elements);
      case 'cypress-js':
        return generateCypressJS(pageName, elements);
      case 'cypress-ts':
        return generateCypressTS(pageName, elements);
      case 'cypress':
        return generateCypressJS(pageName, elements);
      case 'webdriverio':
        return generateWebdriverIO(pageName, elements);
      case 'robot':
        return generateRobotFramework(pageName, elements);
      default:
        return generatePlaywrightTS(pageName, elements);
    }
  }

  // Playwright TypeScript Page Object
  function generatePlaywrightTS(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `import { Page, Locator } from '@playwright/test';\n\n`;
    code += `export class ${className} {\n`;
    code += `  readonly page: Page;\n`;

    // Declare locators
    elements.forEach(el => {
      // Use varName directly - it's already properly formatted by generateVariableName
      const varName = el.varName || 'element';
      code += `  readonly ${varName}: Locator;\n`;
    });

    code += `\n  constructor(page: Page) {\n`;
    code += `    this.page = page;\n`;

    // Initialize locators
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const locator = convertToPlaywrightTS(el.locatorCode);
      code += `    this.${varName} = page.${locator};\n`;
    });

    code += `  }\n\n`;

    // Generate action methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `  async fill${methodName}(value: string): Promise<void> {\n`;
        code += `    await this.${varName}.fill(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'textarea') {
        code += `  async fill${methodName}(value: string): Promise<void> {\n`;
        code += `    await this.${varName}.fill(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `  async click${methodName}(): Promise<void> {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      } else if (elementType === 'select') {
        code += `  async select${methodName}(value: string): Promise<void> {\n`;
        code += `    await this.${varName}.selectOption(value);\n`;
        code += `  }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `  async check${methodName}(): Promise<void> {\n`;
        code += `    await this.${varName}.check();\n`;
        code += `  }\n\n`;
      } else {
        code += `  async click${methodName}(): Promise<void> {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      }
    });

    code += `}\n`;
    return code;
  }

  // Playwright JavaScript Page Object
  function generatePlaywrightJS(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `class ${className} {\n`;
    code += `  constructor(page) {\n`;
    code += `    this.page = page;\n`;

    // Initialize locators
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const locator = convertToPlaywrightJS(el.locatorCode);
      code += `    this.${varName} = page.${locator};\n`;
    });

    code += `  }\n\n`;

    // Generate action methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `  async fill${methodName}(value) {\n`;
        code += `    await this.${varName}.fill(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'textarea') {
        code += `  async fill${methodName}(value) {\n`;
        code += `    await this.${varName}.fill(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `  async click${methodName}() {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      } else if (elementType === 'select') {
        code += `  async select${methodName}(value) {\n`;
        code += `    await this.${varName}.selectOption(value);\n`;
        code += `  }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `  async check${methodName}() {\n`;
        code += `    await this.${varName}.check();\n`;
        code += `  }\n\n`;
      } else {
        code += `  async click${methodName}() {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      }
    });

    code += `}\n\nmodule.exports = { ${className} };\n`;
    return code;
  }

  // Playwright Python Page Object
  function generatePlaywrightPython(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `from playwright.sync_api import Page, Locator\n\n\n`;
    code += `class ${className}:\n`;
    code += `    def __init__(self, page: Page):\n`;
    code += `        self.page = page\n`;

    // Initialize locators
    elements.forEach(el => {
      // Convert camelCase varName to snake_case for Python
      const varName = toSnakeCase(el.varName || 'element');
      const locator = convertToPlaywrightPython(el.locatorCode);
      code += `        self.${varName} = page.${locator}\n`;
    });

    code += `\n`;

    // Generate action methods
    elements.forEach(el => {
      // Convert camelCase varName to snake_case for Python
      const varName = toSnakeCase(el.varName || 'element');
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `    def fill_${varName}(self, value: str) -> None:\n`;
        code += `        self.${varName}.fill(value)\n\n`;
      } else if (elementType === 'textarea') {
        code += `    def fill_${varName}(self, value: str) -> None:\n`;
        code += `        self.${varName}.fill(value)\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `    def click_${varName}(self) -> None:\n`;
        code += `        self.${varName}.click()\n\n`;
      } else if (elementType === 'select') {
        code += `    def select_${varName}(self, value: str) -> None:\n`;
        code += `        self.${varName}.select_option(value)\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `    def check_${varName}(self) -> None:\n`;
        code += `        self.${varName}.check()\n\n`;
      } else {
        code += `    def click_${varName}(self) -> None:\n`;
        code += `        self.${varName}.click()\n\n`;
      }
    });

    return code;
  }

  // Selenium Java Page Object
  function generateSeleniumJava(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `import org.openqa.selenium.By;\n`;
    code += `import org.openqa.selenium.WebDriver;\n`;
    code += `import org.openqa.selenium.WebElement;\n`;
    code += `import org.openqa.selenium.support.FindBy;\n`;
    code += `import org.openqa.selenium.support.PageFactory;\n\n`;

    code += `public class ${className} {\n`;
    code += `    private WebDriver driver;\n\n`;

    // Declare elements with @FindBy annotations
    elements.forEach(el => {
      // varName is already in camelCase from generateVariableName
      const varName = el.varName || 'element';
      const findBy = convertToSeleniumFindBy(el.locatorCode, el.elementInfo);
      code += `    @FindBy(${findBy})\n`;
      code += `    private WebElement ${varName};\n\n`;
    });

    // Constructor
    code += `    public ${className}(WebDriver driver) {\n`;
    code += `        this.driver = driver;\n`;
    code += `        PageFactory.initElements(driver, this);\n`;
    code += `    }\n\n`;

    // Generate action methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `    public void enter${methodName}(String value) {\n`;
        code += `        ${varName}.clear();\n`;
        code += `        ${varName}.sendKeys(value);\n`;
        code += `    }\n\n`;
      } else if (elementType === 'textarea') {
        code += `    public void enter${methodName}(String value) {\n`;
        code += `        ${varName}.clear();\n`;
        code += `        ${varName}.sendKeys(value);\n`;
        code += `    }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `    public void click${methodName}() {\n`;
        code += `        ${varName}.click();\n`;
        code += `    }\n\n`;
      } else if (elementType === 'select') {
        code += `    public void select${methodName}(String value) {\n`;
        code += `        new org.openqa.selenium.support.ui.Select(${varName}).selectByVisibleText(value);\n`;
        code += `    }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `    public void click${methodName}() {\n`;
        code += `        if (!${varName}.isSelected()) {\n`;
        code += `            ${varName}.click();\n`;
        code += `        }\n`;
        code += `    }\n\n`;
      } else {
        code += `    public void click${methodName}() {\n`;
        code += `        ${varName}.click();\n`;
        code += `    }\n\n`;
      }
    });

    code += `}\n`;
    return code;
  }

  // Selenium Python Page Object
  function generateSeleniumPython(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `from selenium.webdriver.common.by import By\n`;
    code += `from selenium.webdriver.support.ui import Select\n\n\n`;

    code += `class ${className}:\n`;

    // Locators as class attributes (UPPER_SNAKE_CASE for Python constants)
    elements.forEach(el => {
      // Convert camelCase to snake_case then uppercase for constants (e.g., fullNameInput -> FULL_NAME_INPUT)
      const varName = toSnakeCase(el.varName || 'element');
      const constName = varName.toUpperCase();
      const locator = convertToSeleniumPythonLocator(el.locatorCode, el.elementInfo);
      code += `    ${constName} = ${locator}\n`;
    });

    code += `\n    def __init__(self, driver):\n`;
    code += `        self.driver = driver\n\n`;

    // Generate action methods
    elements.forEach(el => {
      // Convert camelCase to snake_case for Python naming convention
      const varName = toSnakeCase(el.varName || 'element');
      const constName = varName.toUpperCase();
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `    def enter_${varName}(self, value):\n`;
        code += `        element = self.driver.find_element(*self.${constName})\n`;
        code += `        element.clear()\n`;
        code += `        element.send_keys(value)\n\n`;
      } else if (elementType === 'textarea') {
        code += `    def enter_${varName}(self, value):\n`;
        code += `        element = self.driver.find_element(*self.${constName})\n`;
        code += `        element.clear()\n`;
        code += `        element.send_keys(value)\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `    def click_${varName}(self):\n`;
        code += `        self.driver.find_element(*self.${constName}).click()\n\n`;
      } else if (elementType === 'select') {
        code += `    def select_${varName}(self, value):\n`;
        code += `        element = self.driver.find_element(*self.${constName})\n`;
        code += `        Select(element).select_by_visible_text(value)\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `    def click_${varName}(self):\n`;
        code += `        element = self.driver.find_element(*self.${constName})\n`;
        code += `        if not element.is_selected():\n`;
        code += `            element.click()\n\n`;
      } else {
        code += `    def click_${varName}(self):\n`;
        code += `        self.driver.find_element(*self.${constName}).click()\n\n`;
      }
    });

    return code;
  }

  // Cypress JavaScript Page Object
  function generateCypressJS(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `class ${className} {\n`;

    // Locator methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const locator = convertToCypressLocator(el.locatorCode, el.elementInfo);
      code += `  get ${varName}() {\n`;
      code += `    return ${locator};\n`;
      code += `  }\n\n`;
    });

    // Action methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `  fill${methodName}(value) {\n`;
        code += `    this.${varName}.clear().type(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'textarea') {
        code += `  fill${methodName}(value) {\n`;
        code += `    this.${varName}.clear().type(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `  click${methodName}() {\n`;
        code += `    this.${varName}.click();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'select') {
        code += `  select${methodName}(value) {\n`;
        code += `    this.${varName}.select(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `  check${methodName}() {\n`;
        code += `    this.${varName}.check();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else {
        code += `  click${methodName}() {\n`;
        code += `    this.${varName}.click();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      }
    });

    code += `}\n\nexport default new ${className}();\n`;
    return code;
  }

  // Cypress TypeScript Page Object
  function generateCypressTS(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `/// <reference types="cypress" />\n\n`;
    code += `class ${className} {\n`;

    // Locator methods with return types
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const locator = convertToCypressLocator(el.locatorCode, el.elementInfo);
      code += `  get ${varName}(): Cypress.Chainable<JQuery<HTMLElement>> {\n`;
      code += `    return ${locator};\n`;
      code += `  }\n\n`;
    });

    // Action methods with return types
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `  fill${methodName}(value: string): this {\n`;
        code += `    this.${varName}.clear().type(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'textarea') {
        code += `  fill${methodName}(value: string): this {\n`;
        code += `    this.${varName}.clear().type(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `  click${methodName}(): this {\n`;
        code += `    this.${varName}.click();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (elementType === 'select') {
        code += `  select${methodName}(value: string): this {\n`;
        code += `    this.${varName}.select(value);\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `  check${methodName}(): this {\n`;
        code += `    this.${varName}.check();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      } else {
        code += `  click${methodName}(): this {\n`;
        code += `    this.${varName}.click();\n`;
        code += `    return this;\n`;
        code += `  }\n\n`;
      }
    });

    code += `}\n\nexport default new ${className}();\n`;
    return code;
  }

  // WebdriverIO Page Object
  function generateWebdriverIO(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `class ${className} {\n`;

    // Locator getters
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const locator = convertToWebdriverIOLocator(el.locatorCode, el.elementInfo);
      code += `  get ${varName}() {\n`;
      code += `    return ${locator};\n`;
      code += `  }\n\n`;
    });

    // Action methods
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const methodName = toPascalCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `  async fill${methodName}(value) {\n`;
        code += `    await this.${varName}.setValue(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'textarea') {
        code += `  async fill${methodName}(value) {\n`;
        code += `    await this.${varName}.setValue(value);\n`;
        code += `  }\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `  async click${methodName}() {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      } else if (elementType === 'select') {
        code += `  async select${methodName}(value) {\n`;
        code += `    await this.${varName}.selectByVisibleText(value);\n`;
        code += `  }\n\n`;
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        code += `  async check${methodName}() {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      } else {
        code += `  async click${methodName}() {\n`;
        code += `    await this.${varName}.click();\n`;
        code += `  }\n\n`;
      }
    });

    code += `}\n\nmodule.exports = new ${className}();\n`;
    return code;
  }

  // Robot Framework Page Object
  function generateRobotFramework(pageName, elements) {
    const className = toPascalCase(pageName);
    let code = `*** Settings ***\n`;
    code += `Library    SeleniumLibrary\n\n`;
    code += `*** Variables ***\n`;

    // Variables (UPPER_CASE for Robot Framework)
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const constName = varName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const locator = convertToRobotLocator(el.locatorCode, el.elementInfo);
      code += `\${${constName}}    ${locator}\n`;
    });

    code += `\n*** Keywords ***\n`;

    // Keywords (action methods)
    elements.forEach(el => {
      const varName = el.varName || 'element';
      const constName = varName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const keywordName = toTitleCase(varName);
      const elementType = el.elementType;
      const inputType = el.elementTypeAttr;

      if (elementType === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', ''].includes(inputType)) {
        code += `Enter ${keywordName}\n`;
        code += `    [Arguments]    \${value}\n`;
        code += `    Input Text    \${${constName}}    \${value}\n\n`;
      } else if (elementType === 'textarea') {
        code += `Enter ${keywordName}\n`;
        code += `    [Arguments]    \${value}\n`;
        code += `    Input Text    \${${constName}}    \${value}\n\n`;
      } else if (elementType === 'button' || elementType === 'a' || inputType === 'submit' || inputType === 'button') {
        code += `Click ${keywordName}\n`;
        code += `    Click Element    \${${constName}}\n\n`;
      } else if (elementType === 'select') {
        code += `Select ${keywordName}\n`;
        code += `    [Arguments]    \${value}\n`;
        code += `    Select From List By Label    \${${constName}}    \${value}\n\n`;
      } else if (inputType === 'checkbox') {
        code += `Check ${keywordName}\n`;
        code += `    Select Checkbox    \${${constName}}\n\n`;
      } else if (inputType === 'radio') {
        code += `Select ${keywordName}\n`;
        code += `    Click Element    \${${constName}}\n\n`;
      } else {
        code += `Click ${keywordName}\n`;
        code += `    Click Element    \${${constName}}\n\n`;
      }
    });

    return code;
  }

  // Helper functions for locator conversion
  function convertToPlaywrightTS(locatorCode) {
    // Already in Playwright format, just clean it up
    if (locatorCode.startsWith('page.')) {
      return locatorCode.substring(5); // Remove 'page.'
    }
    return locatorCode;
  }

  function convertToPlaywrightJS(locatorCode) {
    return convertToPlaywrightTS(locatorCode);
  }

  function convertToPlaywrightPython(locatorCode) {
    // Convert JS Playwright to Python Playwright
    let code = locatorCode;
    if (code.startsWith('page.')) {
      code = code.substring(5);
    }
    // Convert camelCase methods to snake_case
    code = code.replace(/getByRole/g, 'get_by_role');
    code = code.replace(/getByLabel/g, 'get_by_label');
    code = code.replace(/getByText/g, 'get_by_text');
    code = code.replace(/getByPlaceholder/g, 'get_by_placeholder');
    code = code.replace(/getByAltText/g, 'get_by_alt_text');
    code = code.replace(/getByTitle/g, 'get_by_title');
    code = code.replace(/getByTestId/g, 'get_by_test_id');
    return code;
  }

  // Helper function to strip frameLocator/frame_locator portion from locator code
  // This ensures we extract selectors from the element locator, not the iframe selector
  function stripFrameLocatorFromCode(code) {
    if (!code) return code;
    // Remove all frameLocator('...') or frame_locator("...") chains
    // Match frameLocator('selector'). or frame_locator("selector").
    let cleaned = code.replace(/frameLocator\(['"](.*?)['"]\)\./g, '');
    cleaned = cleaned.replace(/frame_locator\(['"](.*?)['"]\)\./g, '');
    // Also remove the page. prefix if present to get just the element locator
    cleaned = cleaned.replace(/^page\./, '');
    return cleaned;
  }

  function convertToSeleniumFindBy(locatorCode, elementInfo) {
    const info = elementInfo || {};

    // Priority 1: Use element's actual ID if available
    if (info.id) {
      return `id = "${info.id}"`;
    }

    // Priority 2: Use element's name attribute if available
    if (info.attributes && info.attributes.name) {
      return `name = "${info.attributes.name}"`;
    }

    // Strip frameLocator portion to avoid matching iframe selectors instead of element selectors
    const elementLocatorCode = stripFrameLocatorFromCode(locatorCode);

    // Priority 3: Extract from locator code - ID selector
    if (elementLocatorCode.includes('#')) {
      const match = elementLocatorCode.match(/#([^\s'")\]]+)/);
      if (match) return `id = "${match[1]}"`;
    }

    // Priority 4: Extract from locator code - name selector
    if (elementLocatorCode.includes('[name=')) {
      const match = elementLocatorCode.match(/\[name=['"]?([^'")\]]+)/);
      if (match) return `name = "${match[1]}"`;
    }

    // Priority 5: Use placeholder as CSS selector
    if (info.placeholder) {
      return `css = "[placeholder='${info.placeholder}']"`;
    }

    // Priority 6: Selenium locator patterns
    if (elementLocatorCode.includes('By.id')) {
      const match = elementLocatorCode.match(/By\.id\(['"](.+?)['"]\)/);
      if (match) return `id = "${match[1]}"`;
    }
    if (elementLocatorCode.includes('By.name')) {
      const match = elementLocatorCode.match(/By\.name\(['"](.+?)['"]\)/);
      if (match) return `name = "${match[1]}"`;
    }
    if (elementLocatorCode.includes('By.cssSelector')) {
      const match = elementLocatorCode.match(/By\.cssSelector\(['"](.+?)['"]\)/);
      if (match) return `css = "${match[1]}"`;
    }
    if (elementLocatorCode.includes('By.xpath')) {
      const match = elementLocatorCode.match(/By\.xpath\(['"](.+?)['"]\)/);
      if (match) return `xpath = "${match[1]}"`;
    }

    // Priority 7: CSS selector from Playwright locator()
    const cssMatch = elementLocatorCode.match(/locator\(['"](.+?)['"]\)/);
    if (cssMatch) return `css = "${cssMatch[1]}"`;

    // Priority 8: For getByLabel, use XPath to find by label text
    if (elementLocatorCode.includes('getByLabel')) {
      const match = elementLocatorCode.match(/getByLabel\(['"](.+?)['"]\)/);
      if (match) {
        return `xpath = "//label[contains(text(),'${match[1]}')]/following::input[1] | //input[@id=(//label[contains(text(),'${match[1]}')]/@for)]"`;
      }
    }

    // Priority 9: For getByRole with name, use XPath
    if (elementLocatorCode.includes('getByRole')) {
      const roleMatch = elementLocatorCode.match(/getByRole\(['"](\w+)['"]/);
      const nameMatch = elementLocatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (roleMatch && nameMatch) {
        const role = roleMatch[1];
        const name = nameMatch[1];
        // Map Playwright roles to HTML elements/attributes
        if (role === 'textbox') {
          return `xpath = "//input[contains(@placeholder,'${name}')] | //input[contains(@id,'${name.toLowerCase().replace(/\s+/g, '')}')] | //textarea[contains(@placeholder,'${name}')]"`;
        } else if (role === 'button') {
          return `xpath = "//button[contains(text(),'${name}')] | //input[@type='button' and @value='${name}'] | //input[@type='submit' and @value='${name}']"`;
        } else if (role === 'link') {
          return `xpath = "//a[contains(text(),'${name}')]"`;
        } else if (role === 'checkbox') {
          return `xpath = "//input[@type='checkbox' and (following-sibling::label[contains(text(),'${name}')] or preceding-sibling::label[contains(text(),'${name}')])]"`;
        }
        return `xpath = "//*[contains(text(),'${name}')]"`;
      }
    }

    // Priority 10: For getByText
    if (elementLocatorCode.includes('getByText')) {
      const match = elementLocatorCode.match(/getByText\(['"](.+?)['"]\)/);
      if (match) {
        return `xpath = "//*[contains(text(),'${match[1]}')]"`;
      }
    }

    // Priority 11: For getByPlaceholder
    if (elementLocatorCode.includes('getByPlaceholder')) {
      const match = elementLocatorCode.match(/getByPlaceholder\(['"](.+?)['"]\)/);
      if (match) {
        return `css = "[placeholder='${match[1]}']"`;
      }
    }

    // Priority 12: For getByTestId
    if (elementLocatorCode.includes('getByTestId')) {
      const match = elementLocatorCode.match(/getByTestId\(['"](.+?)['"]\)/);
      if (match) {
        return `css = "[data-testid='${match[1]}']"`;
      }
    }

    return `css = "body"`;
  }

  function convertToSeleniumPythonLocator(locatorCode, elementInfo) {
    const info = elementInfo || {};

    // Priority 1: Use element's actual ID if available
    if (info.id) {
      return `(By.ID, "${info.id}")`;
    }

    // Priority 2: Use element's name attribute if available
    if (info.attributes && info.attributes.name) {
      return `(By.NAME, "${info.attributes.name}")`;
    }

    // Strip frameLocator portion to avoid matching iframe selectors instead of element selectors
    const elementLocatorCode = stripFrameLocatorFromCode(locatorCode);

    // Priority 3: Extract from locator code - ID selector
    if (elementLocatorCode.includes('#')) {
      const match = elementLocatorCode.match(/#([^\s'")\]]+)/);
      if (match) return `(By.ID, "${match[1]}")`;
    }

    // Priority 4: Extract from locator code - name selector
    if (elementLocatorCode.includes('[name=')) {
      const match = elementLocatorCode.match(/\[name=['"]?([^'")\]]+)/);
      if (match) return `(By.NAME, "${match[1]}")`;
    }

    // Priority 5: Use placeholder as CSS selector
    if (info.placeholder) {
      return `(By.CSS_SELECTOR, "[placeholder='${info.placeholder}']")`;
    }

    // Priority 6: Selenium locator patterns
    if (elementLocatorCode.includes('By.ID')) {
      const match = elementLocatorCode.match(/By\.ID,\s*["'](.+?)["']/);
      if (match) return `(By.ID, "${match[1]}")`;
    }
    if (elementLocatorCode.includes('By.NAME')) {
      const match = elementLocatorCode.match(/By\.NAME,\s*["'](.+?)["']/);
      if (match) return `(By.NAME, "${match[1]}")`;
    }
    if (elementLocatorCode.includes('By.CSS_SELECTOR')) {
      const match = elementLocatorCode.match(/By\.CSS_SELECTOR,\s*["'](.+?)["']/);
      if (match) return `(By.CSS_SELECTOR, "${match[1]}")`;
    }
    if (elementLocatorCode.includes('By.XPATH')) {
      const match = elementLocatorCode.match(/By\.XPATH,\s*["'](.+?)["']/);
      if (match) return `(By.XPATH, "${match[1]}")`;
    }

    // Priority 7: CSS selector from Playwright locator()
    const cssMatch = elementLocatorCode.match(/locator\(['"](.+?)['"]\)/);
    if (cssMatch) return `(By.CSS_SELECTOR, "${cssMatch[1]}")`;

    // Priority 8: For getByLabel, use XPath
    if (elementLocatorCode.includes('getByLabel')) {
      const match = elementLocatorCode.match(/getByLabel\(['"](.+?)['"]\)/);
      if (match) {
        return `(By.XPATH, "//label[contains(text(),'${match[1]}')]/following::input[1] | //input[@id=(//label[contains(text(),'${match[1]}')]/@for)]")`;
      }
    }

    // Priority 9: For getByRole with name
    if (elementLocatorCode.includes('getByRole')) {
      const roleMatch = elementLocatorCode.match(/getByRole\(['"](\w+)['"]/);
      const nameMatch = elementLocatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (roleMatch && nameMatch) {
        const role = roleMatch[1];
        const name = nameMatch[1];
        if (role === 'textbox') {
          return `(By.XPATH, "//input[contains(@placeholder,'${name}')] | //input[contains(@id,'${name.toLowerCase().replace(/\s+/g, '')}')] | //textarea[contains(@placeholder,'${name}')]")`;
        } else if (role === 'button') {
          return `(By.XPATH, "//button[contains(text(),'${name}')] | //input[@type='button' and @value='${name}'] | //input[@type='submit' and @value='${name}']")`;
        } else if (role === 'link') {
          return `(By.XPATH, "//a[contains(text(),'${name}')]")`;
        }
        return `(By.XPATH, "//*[contains(text(),'${name}')]")`;
      }
    }

    // Priority 10: For getByText
    if (elementLocatorCode.includes('getByText')) {
      const match = elementLocatorCode.match(/getByText\(['"](.+?)['"]\)/);
      if (match) {
        return `(By.XPATH, "//*[contains(text(),'${match[1]}')]")`;
      }
    }

    // Priority 11: For getByPlaceholder
    if (elementLocatorCode.includes('getByPlaceholder')) {
      const match = elementLocatorCode.match(/getByPlaceholder\(['"](.+?)['"]\)/);
      if (match) {
        return `(By.CSS_SELECTOR, "[placeholder='${match[1]}']")`;
      }
    }

    // Priority 12: For getByTestId
    if (elementLocatorCode.includes('getByTestId')) {
      const match = elementLocatorCode.match(/getByTestId\(['"](.+?)['"]\)/);
      if (match) {
        return `(By.CSS_SELECTOR, "[data-testid='${match[1]}']")`;
      }
    }

    return `(By.CSS_SELECTOR, "body")`;
  }

  function convertToCypressLocator(locatorCode, elementInfo) {
    // Convert to Cypress cy.get() format
    // Priority: ID > name > testid > placeholder > CSS/XPath
    const info = elementInfo || {};

    // Priority 1: Use element's actual ID if available
    if (info.id) {
      return `cy.get('#${info.id}')`;
    }

    // Priority 2: Use element's name attribute if available
    if (info.attributes && info.attributes.name) {
      return `cy.get('[name="${info.attributes.name}"]')`;
    }

    // Priority 3: Use data-testid if available
    if (info.attributes && info.attributes['data-testid']) {
      return `cy.get('[data-testid="${info.attributes['data-testid']}"]')`;
    }

    // Priority 4: Use placeholder if available (for input elements)
    if (info.attributes && info.attributes.placeholder) {
      return `cy.get('[placeholder="${info.attributes.placeholder}"]')`;
    }

    // Strip frameLocator portion to avoid matching iframe selectors instead of element selectors
    const elementLocatorCode = stripFrameLocatorFromCode(locatorCode);

    // Priority 5: Parse the locator code for other strategies
    if (elementLocatorCode.includes('getByTestId')) {
      const match = elementLocatorCode.match(/getByTestId\(['"](.+?)['"]\)/);
      if (match) return `cy.get('[data-testid="${match[1]}"]')`;
    }
    if (elementLocatorCode.includes('getByPlaceholder')) {
      const match = elementLocatorCode.match(/getByPlaceholder\(['"](.+?)['"]\)/);
      if (match) return `cy.get('[placeholder="${match[1]}"]')`;
    }
    if (elementLocatorCode.includes('getByText')) {
      const match = elementLocatorCode.match(/getByText\(['"](.+?)['"]\)/);
      if (match) return `cy.contains('${match[1]}')`;
    }
    if (elementLocatorCode.includes('getByRole')) {
      const roleMatch = elementLocatorCode.match(/getByRole\(['"](\w+)['"]/);
      const nameMatch = elementLocatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (roleMatch && nameMatch) {
        return `cy.contains('${nameMatch[1]}')`;
      }
      if (roleMatch) {
        return `cy.get('[role="${roleMatch[1]}"]')`;
      }
    }
    if (elementLocatorCode.includes('getByLabel')) {
      const match = elementLocatorCode.match(/getByLabel\(['"](.+?)['"]\)/);
      if (match) return `cy.contains('label', '${match[1]}').find('input, textarea, select')`;
    }
    if (elementLocatorCode.includes('#')) {
      const match = elementLocatorCode.match(/#([^\s'")\]]+)/);
      if (match) return `cy.get('#${match[1]}')`;
    }
    const cssMatch = elementLocatorCode.match(/locator\(['"](.+?)['"]\)/);
    if (cssMatch) return `cy.get('${cssMatch[1]}')`;

    return `cy.get('body')`;
  }

  function convertToWebdriverIOLocator(locatorCode, elementInfo) {
    // Convert to WebdriverIO $() format
    // Priority: ID > name > testid > placeholder > CSS
    const info = elementInfo || {};

    // Priority 1: Use element's actual ID if available
    if (info.id) {
      return `$('#${info.id}')`;
    }

    // Priority 2: Use element's name attribute if available
    if (info.attributes && info.attributes.name) {
      return `$('[name="${info.attributes.name}"]')`;
    }

    // Priority 3: Use data-testid if available
    if (info.attributes && info.attributes['data-testid']) {
      return `$('[data-testid="${info.attributes['data-testid']}"]')`;
    }

    // Priority 4: Use placeholder if available (for input elements)
    if (info.attributes && info.attributes.placeholder) {
      return `$('[placeholder="${info.attributes.placeholder}"]')`;
    }

    // Strip frameLocator portion to avoid matching iframe selectors instead of element selectors
    const elementLocatorCode = stripFrameLocatorFromCode(locatorCode);

    // Priority 5: Parse the locator code for other strategies
    if (elementLocatorCode.includes('getByTestId')) {
      const match = elementLocatorCode.match(/getByTestId\(['"](.+?)['"]\)/);
      if (match) return `$('[data-testid="${match[1]}"]')`;
    }
    if (elementLocatorCode.includes('getByPlaceholder')) {
      const match = elementLocatorCode.match(/getByPlaceholder\(['"](.+?)['"]\)/);
      if (match) return `$('[placeholder="${match[1]}"]')`;
    }
    if (elementLocatorCode.includes('getByText')) {
      const match = elementLocatorCode.match(/getByText\(['"](.+?)['"]\)/);
      if (match) return `$('*=${match[1]}')`;
    }
    if (elementLocatorCode.includes('getByRole')) {
      const roleMatch = elementLocatorCode.match(/getByRole\(['"](\w+)['"]/);
      const nameMatch = elementLocatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (roleMatch && nameMatch) {
        // Use text content or role attribute for WebdriverIO
        return `$('//*[@role="${roleMatch[1]}"][contains(text(), "${nameMatch[1]}")]')`;
      }
      if (roleMatch) {
        return `$('[role="${roleMatch[1]}"]')`;
      }
    }
    if (elementLocatorCode.includes('getByLabel')) {
      const match = elementLocatorCode.match(/getByLabel\(['"](.+?)['"]\)/);
      if (match) return `$('//label[contains(text(), "${match[1]}")]/following-sibling::*[1]')`;
    }
    if (elementLocatorCode.includes('#')) {
      const match = elementLocatorCode.match(/#([^\s'")\]]+)/);
      if (match) return `$('#${match[1]}')`;
    }
    const cssMatch = elementLocatorCode.match(/locator\(['"](.+?)['"]\)/);
    if (cssMatch) return `$('${cssMatch[1]}')`;

    return `$('body')`;
  }

  function convertToRobotLocator(locatorCode, elementInfo) {
    // Convert to Robot Framework locator format
    // Priority: ID > name > testid > placeholder > CSS/XPath
    const info = elementInfo || {};

    // Priority 1: Use element's actual ID if available
    if (info.id) {
      return `id=${info.id}`;
    }

    // Priority 2: Use element's name attribute if available
    if (info.attributes && info.attributes.name) {
      return `name=${info.attributes.name}`;
    }

    // Priority 3: Use data-testid if available
    if (info.attributes && info.attributes['data-testid']) {
      return `xpath=//*[@data-testid='${info.attributes['data-testid']}']`;
    }

    // Priority 4: Use placeholder if available (for input elements)
    if (info.attributes && info.attributes.placeholder) {
      return `xpath=//*[@placeholder='${info.attributes.placeholder}']`;
    }

    // Strip frameLocator portion to avoid matching iframe selectors instead of element selectors
    const elementLocatorCode = stripFrameLocatorFromCode(locatorCode);

    // Priority 5: Parse the locator code for other strategies
    if (elementLocatorCode.includes('getByTestId')) {
      const match = elementLocatorCode.match(/getByTestId\(['"](.+?)['"]\)/);
      if (match) return `xpath=//*[@data-testid='${match[1]}']`;
    }
    if (elementLocatorCode.includes('getByPlaceholder')) {
      const match = elementLocatorCode.match(/getByPlaceholder\(['"](.+?)['"]\)/);
      if (match) return `xpath=//*[@placeholder='${match[1]}']`;
    }
    if (elementLocatorCode.includes('getByText')) {
      const match = elementLocatorCode.match(/getByText\(['"](.+?)['"]\)/);
      if (match) return `xpath=//*[contains(text(), '${match[1]}')]`;
    }
    if (elementLocatorCode.includes('getByRole')) {
      const roleMatch = elementLocatorCode.match(/getByRole\(['"](\w+)['"]/);
      const nameMatch = elementLocatorCode.match(/name:\s*['"]([^'"]+)['"]/);
      if (roleMatch && nameMatch) {
        return `xpath=//*[@role='${roleMatch[1]}' and contains(text(), '${nameMatch[1]}')]`;
      }
    }
    if (elementLocatorCode.includes('getByLabel')) {
      const match = elementLocatorCode.match(/getByLabel\(['"](.+?)['"]\)/);
      if (match) return `xpath=//label[contains(text(), '${match[1]}')]/following-sibling::*[1]`;
    }
    if (elementLocatorCode.includes('#')) {
      const match = elementLocatorCode.match(/#([^\s'")\]]+)/);
      if (match) return `id=${match[1]}`;
    }
    if (elementLocatorCode.includes('[name=')) {
      const match = elementLocatorCode.match(/\[name=['"]?([^'")\]]+)/);
      if (match) return `name=${match[1]}`;
    }
    const cssMatch = elementLocatorCode.match(/locator\(['"](.+?)['"]\)/);
    if (cssMatch) return `css=${cssMatch[1]}`;

    return `xpath=//body`;
  }

  // String case conversion helpers
  function toPascalCase(str) {
    return str
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  function toCamelCase(str) {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  function toSnakeCase(str) {
    return str
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      // Insert underscore before uppercase letters to handle camelCase (e.g., fullNameInput -> full_Name_Input)
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Handle consecutive uppercase letters followed by lowercase (e.g., XMLParser -> XML_Parser)
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .split(/[\s_-]+/)
      .map(word => word.toLowerCase())
      .join('_');
  }

  function toTitleCase(str) {
    return str
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      // Insert space before uppercase letters to handle camelCase (e.g., fullNameInput -> full Name Input)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Handle consecutive uppercase letters followed by lowercase (e.g., XMLParser -> XML Parser)
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Get file extension based on framework
  function getFileExtension(framework) {
    const extensions = {
      'playwright-ts': '.ts',
      'playwright-js': '.js',
      'playwright-python': '.py',
      'selenium-java': '.java',
      'selenium-python': '.py',
      'cypress': '.js',
      'cypress-js': '.js',
      'cypress-ts': '.ts',
      'webdriverio': '.js',
      'robot': '.robot'
    };
    return extensions[framework] || '.txt';
  }

  // Download file
  function downloadFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =============================================
  // TOUR GUIDE MODULE
  // =============================================

  const TourGuide = {
    currentStep: 0,
    isActive: false,

    // Tour steps configuration
    steps: [
      {
        target: '#frameworkToggle',
        icon: '🔧',
        title: 'Select Your Framework',
        content: 'Choose between <strong>Playwright</strong>, <strong>Selenium</strong>, or <strong>Cypress</strong> as your testing framework. This determines the syntax of generated locators.',
        position: 'right'
      },
      {
        target: '.tool-selection-section',
        icon: '✅',
        title: 'Show Code For Multiple Frameworks',
        content: 'Select which frameworks to display locators for. You can enable multiple frameworks to see locators in different syntaxes side by side.',
        position: 'right'
      },
      {
        target: '#languageToggle',
        icon: '💻',
        title: 'Choose Your Language',
        content: 'Select your preferred programming language. Options vary based on the selected framework: <strong>JavaScript/TypeScript</strong>, <strong>Python</strong>, or <strong>Java</strong>.',
        position: 'right'
      },
      {
        target: '#inspectBtn',
        icon: '🎯',
        title: 'Start Inspecting Elements',
        content: 'Click this button to enable element inspection. Then hover over elements in the browser to see their details and generate locators automatically.',
        position: 'right'
      },
      {
        target: '.test-locator-section',
        icon: '🔍',
        title: 'Test Your Locators',
        content: 'Paste any locator here to test if it works. The matching elements will be highlighted in the browser. You can also perform actions like <strong>click()</strong> or <strong>type()</strong>.',
        position: 'right'
      },
      {
        target: '#locatorsContainer',
        icon: '📋',
        title: 'Generated Locators',
        content: 'When you inspect an element, all possible locators appear here ranked by reliability. Click the <strong>copy icon</strong> to copy a locator, or the <strong>+ icon</strong> to add it to your Page Object.',
        position: 'right'
      },
      {
        target: '#poModeBtn',
        icon: '🎯',
        title: 'Page Object Mode',
        content: 'Click <strong>PO</strong> to enable Page Object Mode. Then simply click on elements in the page to automatically add them to your cart. Export as a complete Page Object class in your favorite framework and language!',
        position: 'bottom'
      },
      {
        target: '#poCartBtn',
        icon: '📦',
        title: 'Page Object Cart',
        content: 'Elements you add with the + icon appear here. Click to open the Page Object generator where you can customize names and download as a complete class file.',
        position: 'bottom'
      },
      {
        target: '.url-input-wrapper',
        icon: '🌐',
        title: 'Navigate to Your App',
        content: 'Enter any URL to navigate the built-in browser. You can test your web application directly within Locator Labs.',
        position: 'bottom'
      },
      {
        target: '#devToolsBtn',
        icon: '🛠️',
        title: 'Chrome DevTools',
        content: 'Open Chrome DevTools to inspect the page, debug JavaScript, analyze network requests, and access advanced browser developer features.',
        position: 'bottom'
      }
    ],

    // DOM Elements
    elements: {
      welcomeOverlay: null,
      spotlight: null,
      tooltip: null,
      icon: null,
      title: null,
      content: null,
      progress: null,
      stepInfo: null,
      prevBtn: null,
      nextBtn: null,
      skipBtn: null,
      skipStepBtn: null,
      startBtn: null,
      helpBtn: null
    },

    // Initialize the tour guide
    init() {
      this.cacheElements();
      this.bindEvents();
      this.checkFirstVisit();
    },

    // Cache DOM elements
    cacheElements() {
      this.elements = {
        welcomeOverlay: document.getElementById('tourWelcomeOverlay'),
        spotlight: document.getElementById('tourSpotlight'),
        tooltip: document.getElementById('tourTooltip'),
        icon: document.getElementById('tourIcon'),
        title: document.getElementById('tourTitle'),
        content: document.getElementById('tourContent'),
        progress: document.getElementById('tourProgress'),
        stepInfo: document.getElementById('tourStepInfo'),
        prevBtn: document.getElementById('tourPrevBtn'),
        nextBtn: document.getElementById('tourNextBtn'),
        skipBtn: document.getElementById('tourSkipBtn'),
        skipStepBtn: document.getElementById('tourSkipStepBtn'),
        startBtn: document.getElementById('tourStartBtn'),
        helpBtn: document.getElementById('tourHelpBtn')
      };
    },

    // Bind event listeners
    bindEvents() {
      this.elements.startBtn?.addEventListener('click', () => this.startTour());
      this.elements.skipBtn?.addEventListener('click', () => this.skipTour());
      this.elements.skipStepBtn?.addEventListener('click', () => this.endTour());
      this.elements.prevBtn?.addEventListener('click', () => this.prevStep());
      this.elements.nextBtn?.addEventListener('click', () => this.nextStep());
      this.elements.helpBtn?.addEventListener('click', () => this.showWelcome());

      // Handle window resize
      window.addEventListener('resize', () => {
        if (this.isActive) {
          this.positionElements();
        }
      });

      // Handle escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isActive) {
          this.endTour();
        }
      });
    },

    // Check if this is the user's first visit
    checkFirstVisit() {
      const hasSeenTour = localStorage.getItem('locatorlabs_tour_completed');
      if (!hasSeenTour) {
        // Show welcome modal after a short delay
        setTimeout(() => this.showWelcome(), 1000);
      }
    },

    // Show welcome modal
    showWelcome() {
      this.elements.welcomeOverlay?.classList.add('active');
    },

    // Hide welcome modal
    hideWelcome() {
      this.elements.welcomeOverlay?.classList.remove('active');
    },

    // Start the tour
    startTour() {
      this.hideWelcome();
      this.currentStep = 0;
      this.isActive = true;
      // Reset state from previous tour
      if (this.elements.spotlight) {
        this.elements.spotlight.classList.remove('active');
      }
      if (this.elements.tooltip) {
        this.elements.tooltip.classList.remove('active');
      }
      this.showStep();
    },

    // Skip the tour from welcome modal
    skipTour() {
      this.hideWelcome();
      this.markTourCompleted();
    },

    // End the tour
    endTour() {
      this.isActive = false;
      if (this.elements.spotlight) {
        this.elements.spotlight.classList.remove('active');
      }
      if (this.elements.tooltip) {
        this.elements.tooltip.classList.remove('active');
      }
      this.markTourCompleted();
    },

    // Mark tour as completed
    markTourCompleted() {
      localStorage.setItem('locatorlabs_tour_completed', 'true');
    },

    // Show current step
    showStep() {
      const step = this.steps[this.currentStep];
      if (!step) return;

      const targetEl = document.querySelector(step.target);
      if (!targetEl) {
        // Skip to next step if target not found
        if (this.currentStep < this.steps.length - 1) {
          this.currentStep++;
          this.showStep();
        }
        return;
      }

      // Update tooltip content
      this.elements.icon.textContent = step.icon;
      this.elements.title.textContent = step.title;
      this.elements.content.innerHTML = step.content;
      this.elements.stepInfo.textContent = `Step ${this.currentStep + 1} of ${this.steps.length}`;

      // Update progress dots
      this.updateProgressDots();

      // Update button states
      this.updateButtons();

      // Position elements
      this.positionElements();

      // Show elements with animation
      setTimeout(() => {
        this.elements.spotlight.classList.add('active');
        this.elements.tooltip.classList.add('active');
      }, 50);
    },

    // Update progress dots
    updateProgressDots() {
      let dotsHtml = '';
      for (let i = 0; i < this.steps.length; i++) {
        let className = 'tour-progress-dot';
        if (i < this.currentStep) className += ' completed';
        if (i === this.currentStep) className += ' active';
        dotsHtml += `<div class="${className}"></div>`;
      }
      this.elements.progress.innerHTML = dotsHtml;
    },

    // Update button visibility
    updateButtons() {
      // Hide prev on first step
      this.elements.prevBtn.style.display = this.currentStep === 0 ? 'none' : 'block';

      // Change next to finish on last step
      if (this.currentStep === this.steps.length - 1) {
        this.elements.nextBtn.textContent = 'Finish';
        this.elements.nextBtn.classList.remove('next');
        this.elements.nextBtn.classList.add('finish');
      } else {
        this.elements.nextBtn.textContent = 'Next';
        this.elements.nextBtn.classList.remove('finish');
        this.elements.nextBtn.classList.add('next');
      }
    },

    // Position spotlight and tooltip
    positionElements() {
      const step = this.steps[this.currentStep];
      const targetEl = document.querySelector(step.target);
      if (!targetEl) return;

      const rect = targetEl.getBoundingClientRect();
      const padding = 8;

      // Position spotlight
      this.elements.spotlight.style.top = `${rect.top - padding}px`;
      this.elements.spotlight.style.left = `${rect.left - padding}px`;
      this.elements.spotlight.style.width = `${rect.width + padding * 2}px`;
      this.elements.spotlight.style.height = `${rect.height + padding * 2}px`;

      // Position tooltip based on step position
      const tooltipRect = this.elements.tooltip.getBoundingClientRect();
      let tooltipTop, tooltipLeft;

      // Remove existing arrow classes
      this.elements.tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');

      switch (step.position) {
        case 'right':
          tooltipTop = rect.top;
          tooltipLeft = rect.right + 20;
          this.elements.tooltip.classList.add('arrow-left');
          break;
        case 'left':
          tooltipTop = rect.top;
          tooltipLeft = rect.left - tooltipRect.width - 20;
          this.elements.tooltip.classList.add('arrow-right');
          break;
        case 'bottom':
          tooltipTop = rect.bottom + 20;
          tooltipLeft = rect.left;
          this.elements.tooltip.classList.add('arrow-top');
          break;
        case 'top':
          tooltipTop = rect.top - tooltipRect.height - 20;
          tooltipLeft = rect.left;
          this.elements.tooltip.classList.add('arrow-bottom');
          break;
        default:
          tooltipTop = rect.bottom + 20;
          tooltipLeft = rect.left;
          this.elements.tooltip.classList.add('arrow-top');
      }

      // Keep tooltip in viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (tooltipLeft + tooltipRect.width > viewportWidth - 20) {
        tooltipLeft = viewportWidth - tooltipRect.width - 20;
      }
      if (tooltipLeft < 20) tooltipLeft = 20;

      if (tooltipTop + tooltipRect.height > viewportHeight - 20) {
        tooltipTop = viewportHeight - tooltipRect.height - 20;
      }
      if (tooltipTop < 20) tooltipTop = 20;

      this.elements.tooltip.style.top = `${tooltipTop}px`;
      this.elements.tooltip.style.left = `${tooltipLeft}px`;
    },

    // Go to next step
    nextStep() {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
        this.elements.tooltip.classList.remove('active');
        setTimeout(() => this.showStep(), 200);
      } else {
        this.endTour();
      }
    },

    // Go to previous step
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.elements.tooltip.classList.remove('active');
        setTimeout(() => this.showStep(), 200);
      }
    },

    // Reset tour (for testing)
    resetTour() {
      localStorage.removeItem('locatorlabs_tour_completed');
      this.showWelcome();
    }
  };

  // Initialize tour guide
  TourGuide.init();

  // =====================
  // PO MODE FEATURE
  // =====================

  function loadPOPreferences() {
    try {
      const saved = localStorage.getItem(PO_SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load PO preferences:', e);
    }
    return JSON.parse(JSON.stringify(defaultPOPreferences));
  }

  function savePOPreferences() {
    try {
      localStorage.setItem(PO_SETTINGS_KEY, JSON.stringify(poModePreferences));
    } catch (e) {
      console.warn('Failed to save PO preferences:', e);
    }
  }

  function setupPOMode() {
    const poModeBtn = document.getElementById('poModeBtn');
    const poModeSettingsBtn = document.getElementById('poModeSettingsBtn');
    const poSettingsModal = document.getElementById('poSettingsModal');
    const poSettingsModalClose = document.getElementById('poSettingsModalClose');
    const poSettingsReset = document.getElementById('poSettingsReset');
    const poSettingsSave = document.getElementById('poSettingsSave');

    if (!poModeBtn) return;

    // Toggle PO Mode
    poModeBtn.addEventListener('click', togglePOMode);

    // Open settings modal
    poModeSettingsBtn.addEventListener('click', () => {
      renderPOSettingsModal();
      setupLocatorListDragDrop();
      poSettingsModal.classList.add('active');
    });

    // Close settings modal
    poSettingsModalClose.addEventListener('click', () => {
      poSettingsModal.classList.remove('active');
    });

    // Close on backdrop click
    poSettingsModal.addEventListener('click', (e) => {
      if (e.target === poSettingsModal) {
        poSettingsModal.classList.remove('active');
      }
    });

    // Reset to defaults
    poSettingsReset.addEventListener('click', () => {
      poModePreferences = JSON.parse(JSON.stringify(defaultPOPreferences));
      renderPOSettingsModal();
      showToast('Settings reset to defaults', 'info');
    });

    // Save settings
    poSettingsSave.addEventListener('click', () => {
      savePOSettingsFromModal();
      savePOPreferences();
      poSettingsModal.classList.remove('active');
      showToast('PO Mode settings saved', 'success');
    });

    // Setup drag and drop for locator lists
    setupLocatorListDragDrop();
  }

  function togglePOMode() {
    const poModeBtn = document.getElementById('poModeBtn');
    const poModeStatusBar = document.getElementById('poModeStatusBar');

    // If regular inspect mode is active, disable it first
    if (isInspecting) {
      toggleInspectMode();
    }

    isPOModeEnabled = !isPOModeEnabled;

    if (isPOModeEnabled) {
      poModeBtn.classList.add('active');
      poModeStatusBar.classList.add('active');
      injectPOModeScript();
    } else {
      poModeBtn.classList.remove('active');
      poModeStatusBar.classList.remove('active');
      removePOModeScript();
    }
  }

  function injectPOModeScript() {
    const script = `
      (function() {
        // Remove existing if any
        if (window.__poModeInjected) return;
        window.__poModeInjected = true;
        window.__poModeActive = true;

        let hoveredElement = null;
        let highlightOverlay = null;
        let tooltipEl = null;

        // Only create UI elements in top frame
        const isTopFrame = window === window.top;

        // For frameset pages, document.body might not exist - use first frame's body or documentElement
        const isFramesetPage = !document.body && document.querySelector('frameset');

        // Get the container to append UI elements to
        function getUIContainer() {
          if (document.body) return document.body;
          // For frameset pages, try to find first accessible frame's body
          const frames = document.querySelectorAll('frame');
          for (let frame of frames) {
            try {
              if (frame.contentDocument && frame.contentDocument.body) {
                return frame.contentDocument.body;
              }
            } catch(e) {}
          }
          return document.documentElement;
        }

        if (isTopFrame) {
          const uiContainer = getUIContainer();

          // Create highlight overlay
          highlightOverlay = document.createElement('div');
          highlightOverlay.id = '__po_mode_highlight';
          highlightOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 2147483645; border: 2px solid rgb(16, 185, 129); background: rgba(16, 185, 129, 0.1); transition: all 0.1s ease; display: none; border-radius: 4px;';
          uiContainer.appendChild(highlightOverlay);

          // Create tooltip
          tooltipEl = document.createElement('div');
          tooltipEl.id = '__po_mode_tooltip';
          tooltipEl.style.cssText = 'position: fixed; z-index: 2147483646; background: linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%); color: white; padding: 6px 12px; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; font-weight: 500; pointer-events: none; display: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
          uiContainer.appendChild(tooltipEl);

          // Banner removed - now shown in app UI above URL bar
        }

        // Function to get selector for shadow host element
        function getShadowHostSelector(host) {
          if (host.id) return '#' + host.id;
          if (host.className && typeof host.className === 'string') {
            const firstClass = host.className.split(' ').filter(c => c && !c.includes(':'))[0];
            if (firstClass) return host.tagName.toLowerCase() + '.' + firstClass;
          }
          const parent = host.parentElement || host.getRootNode().host;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === host.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(host) + 1;
              return host.tagName.toLowerCase() + ':nth-of-type(' + index + ')';
            }
          }
          return host.tagName.toLowerCase();
        }

        // Function to get shadow DOM path for an element
        function getShadowPath(el) {
          const path = [];
          let current = el;
          while (current) {
            const root = current.getRootNode();
            if (root instanceof ShadowRoot) {
              const host = root.host;
              path.unshift({
                hostTagName: host.tagName.toLowerCase(),
                hostId: host.id || null,
                hostClass: (typeof host.className === 'string') ? host.className : null,
                selector: getShadowHostSelector(host),
                mode: root.mode
              });
              current = host;
            } else {
              break;
            }
          }
          return path;
        }

        // Function to get JS path for Selenium shadow DOM access
        function getJSPathForElement(el, shadowPath) {
          if (!shadowPath || shadowPath.length === 0) return null;
          let jsPath = 'document';
          for (const shadow of shadowPath) {
            jsPath += ".querySelector('" + shadow.selector.replace(/'/g, "\\\\'") + "').shadowRoot";
          }
          let elSelector = el.tagName.toLowerCase();
          if (el.id) {
            elSelector = '#' + el.id;
          } else if (el.className && typeof el.className === 'string') {
            const firstClass = el.className.split(' ').filter(c => c && !c.includes(':'))[0];
            if (firstClass) elSelector = el.tagName.toLowerCase() + '.' + firstClass;
          }
          jsPath += ".querySelector('" + elSelector.replace(/'/g, "\\\\'") + "')";
          return jsPath;
        }

        // Get frame selector
        function getFrameSelector(iframe) {
          if (iframe.id) return '#' + iframe.id;
          if (iframe.name) return '[name="' + iframe.name + '"]';
          if (iframe.src) {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('about:')) return '[src="' + src + '"]';
          }
          const iframes = Array.from(iframe.parentElement.querySelectorAll('iframe, frame'));
          const index = iframes.indexOf(iframe);
          return 'iframe:nth-of-type(' + (index + 1) + ')';
        }

        // Get frame path from current window to top
        function getFramePath(win) {
          const path = [];
          let currentWin = win;
          while (currentWin !== window.top) {
            try {
              const parentWin = currentWin.parent;
              const iframes = parentWin.document.querySelectorAll('iframe, frame');
              for (let iframe of iframes) {
                try {
                  if (iframe.contentWindow === currentWin) {
                    path.unshift({
                      selector: getFrameSelector(iframe),
                      tagName: iframe.tagName.toLowerCase(),
                      id: iframe.id || null,
                      name: iframe.name || null,
                      src: iframe.getAttribute('src') || null
                    });
                    break;
                  }
                } catch(e) {}
              }
              currentWin = parentWin;
            } catch(e) {
              break;
            }
          }
          return path;
        }

        // Send element data to top window
        function sendElementData(data) {
          if (isTopFrame) {
            console.log('LOCATORLABS_PO:' + JSON.stringify(data));
          } else {
            // Post message to parent, which will relay to top
            window.parent.postMessage({ type: 'LOCATORLABS_PO_ELEMENT', data: data }, '*');
          }
        }

        // Send highlight info to top frame
        function sendHighlightInfo(rect, tagName, id, className) {
          if (isTopFrame) {
            updateHighlight(rect, tagName, id, className);
          } else {
            // Convert rect to be relative to top frame
            const frameRect = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
            const adjustedRect = {
              left: rect.left + frameRect.left,
              top: rect.top + frameRect.top,
              width: rect.width,
              height: rect.height
            };
            window.parent.postMessage({
              type: 'LOCATORLABS_PO_HIGHLIGHT',
              rect: adjustedRect,
              tagName: tagName,
              id: id,
              className: className
            }, '*');
          }
        }

        // Update highlight in top frame
        function updateHighlight(rect, tagName, id, className) {
          if (!highlightOverlay || !tooltipEl) return;

          highlightOverlay.style.left = rect.left + 'px';
          highlightOverlay.style.top = rect.top + 'px';
          highlightOverlay.style.width = rect.width + 'px';
          highlightOverlay.style.height = rect.height + 'px';
          highlightOverlay.style.display = 'block';

          const idStr = id ? '#' + id : '';
          const classStr = className ? '.' + className.split(' ').filter(c => c && !c.startsWith('__po')).slice(0, 2).join('.') : '';
          tooltipEl.textContent = tagName + idStr + classStr;
          tooltipEl.style.left = rect.left + 'px';
          tooltipEl.style.top = (rect.top - 30) + 'px';
          tooltipEl.style.display = 'block';

          if (rect.top < 40) {
            tooltipEl.style.top = (rect.top + rect.height + 5) + 'px';
          }
        }

        // Listen for messages from child frames
        window.addEventListener('message', function(event) {
          if (!window.__poModeActive) return;

          if (event.data && event.data.type === 'LOCATORLABS_PO_ELEMENT') {
            if (isTopFrame) {
              console.log('LOCATORLABS_PO:' + JSON.stringify(event.data.data));
            } else {
              // Relay to parent
              window.parent.postMessage(event.data, '*');
            }
          }

          if (event.data && event.data.type === 'LOCATORLABS_PO_HIGHLIGHT') {
            if (isTopFrame) {
              updateHighlight(event.data.rect, event.data.tagName, event.data.id, event.data.className);
            } else {
              // Adjust rect and relay to parent
              const frameRect = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
              const adjustedRect = {
                left: event.data.rect.left + frameRect.left,
                top: event.data.rect.top + frameRect.top,
                width: event.data.rect.width,
                height: event.data.rect.height
              };
              window.parent.postMessage({
                type: 'LOCATORLABS_PO_HIGHLIGHT',
                rect: adjustedRect,
                tagName: event.data.tagName,
                id: event.data.id,
                className: event.data.className
              }, '*');
            }
          }
        });

        // Mouse move handler
        window.__poMouseMove = function(e) {
          if (!window.__poModeActive) return;

          const path = e.composedPath();
          hoveredElement = path[0] || e.target;

          // Skip our own elements
          if (hoveredElement.id && hoveredElement.id.startsWith('__po_mode')) return;

          const rect = hoveredElement.getBoundingClientRect();
          const tagName = hoveredElement.tagName.toLowerCase();
          const id = hoveredElement.id || '';
          const className = (typeof hoveredElement.className === 'string') ? hoveredElement.className : '';

          sendHighlightInfo(rect, tagName, id, className);
        };

        // Track last click to prevent duplicates
        let lastClickTime = 0;
        const CLICK_DEBOUNCE_MS = 200;

        // Click handler
        window.__poClick = function(e) {
          if (!window.__poModeActive) return;

          // Skip our own elements
          if (e.target.id && e.target.id.startsWith('__po_mode')) return;

          // Debounce clicks
          const now = Date.now();
          if (now - lastClickTime < CLICK_DEBOUNCE_MS) return;
          lastClickTime = now;

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const path = e.composedPath();
          const el = path[0] || e.target;
          const shadowPath = getShadowPath(el);
          const jsPath = getJSPathForElement(el, shadowPath);
          const framePath = getFramePath(window);

          // Check if element is SVG
          const isSVGElement = el instanceof SVGElement || el.namespaceURI === 'http://www.w3.org/2000/svg';
          const svgParent = el.closest ? el.closest('svg') : null;
          const isInsideSVG = isSVGElement || (svgParent !== null);

          // Get className and filter out our classes
          let rawClassName = (typeof el.className === 'string') ? el.className : (el.className?.baseVal || null);
          let cleanClassName = null;
          if (rawClassName) {
            cleanClassName = rawClassName.split(' ').filter(c => !c.startsWith('__po')).join(' ').trim() || null;
          }

          // Find parent with ID
          let parentId = null;
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (parent.id) {
              parentId = parent.id;
              break;
            }
            parent = parent.parentElement;
          }

          // Get label text
          let labelText = null;
          const normalizeWhitespace = (str) => {
            if (!str) return null;
            return str.replace(/\\u00A0/g, ' ').replace(/\\u200B/g, '').replace(/  +/g, ' ').trim();
          };

          if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            if (el.id) {
              const labelEl = document.querySelector('label[for="' + el.id + '"]');
              if (labelEl) {
                labelText = normalizeWhitespace(labelEl.textContent);
              }
            }
            if (!labelText) {
              const parentLabel = el.closest('label');
              if (parentLabel) {
                const clone = parentLabel.cloneNode(true);
                const inputs = clone.querySelectorAll('input, select, textarea');
                inputs.forEach(inp => inp.remove());
                labelText = normalizeWhitespace(clone.textContent);
              }
            }
            if (!labelText && el.getAttribute('aria-labelledby')) {
              const labelledById = el.getAttribute('aria-labelledby');
              const labelledByEl = document.getElementById(labelledById);
              if (labelledByEl) {
                labelText = normalizeWhitespace(labelledByEl.textContent);
              }
            }
          }

          const data = {
            tagName: el.tagName,
            id: el.id || null,
            name: el.getAttribute('name') || null,
            className: cleanClassName,
            type: el.getAttribute('type') || null,
            placeholder: el.getAttribute('placeholder') || null,
            text: el.textContent ? el.textContent.trim().substring(0, 100) : null,
            ariaLabel: el.getAttribute('aria-label') || null,
            labelText: labelText,
            dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || null,
            role: el.getAttribute('role') || null,
            href: el.getAttribute('href') || null,
            src: el.getAttribute('src') || null,
            title: el.getAttribute('title') || null,
            value: el.value || null,
            checked: el.checked === true,
            attributes: {
              type: el.getAttribute('type'),
              name: el.getAttribute('name'),
              alt: el.getAttribute('alt'),
              for: el.getAttribute('for'),
              d: el.getAttribute('d'),
              fill: el.getAttribute('fill'),
              viewBox: el.getAttribute('viewBox')
            },
            framePath: framePath,
            shadowPath: shadowPath,
            jsPath: jsPath,
            isSVG: isInsideSVG,
            svgTagName: isSVGElement ? el.tagName.toLowerCase() : null,
            parentId: parentId,
            isPOMode: true
          };

          // Send data
          sendElementData(data);
        };

        // ESC key to exit
        window.__poKeyDown = function(e) {
          if (e.key === 'Escape' && window.__poModeActive) {
            if (isTopFrame) {
              console.log('LOCATORLABS_PO_EXIT');
            } else {
              window.top.postMessage({ type: 'LOCATORLABS_PO_EXIT_MSG' }, '*');
            }
          }
        };

        // Listen for exit message from child frames
        if (isTopFrame) {
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'LOCATORLABS_PO_EXIT_MSG') {
              console.log('LOCATORLABS_PO_EXIT');
            }
          });
        }

        document.addEventListener('mousemove', window.__poMouseMove, true);
        document.addEventListener('click', window.__poClick, true);
        document.addEventListener('keydown', window.__poKeyDown, true);

        // Inject into iframes
        function injectIntoFrame(frame) {
          try {
            const frameDoc = frame.contentDocument || frame.contentWindow.document;
            if (!frameDoc || !frameDoc.body) return;

            // Check if already injected
            if (frame.contentWindow.__poModeInjected) return;

            // Create a script element with the PO mode code
            const script = frameDoc.createElement('script');
            script.textContent = '(' + arguments.callee.toString().replace('arguments.callee', 'function(){}') + ')();';

            // Execute the injection function in the frame context
            frame.contentWindow.eval(\`
              (function() {
                if (window.__poModeInjected) return;
                window.__poModeInjected = true;
                window.__poModeActive = true;

                const isTopFrame = false;
                let hoveredElement = null;

                \${getShadowHostSelector.toString()}
                \${getShadowPath.toString()}
                \${getJSPathForElement.toString()}
                \${getFrameSelector.toString()}
                \${getFramePath.toString()}

                function sendElementData(data) {
                  window.parent.postMessage({ type: 'LOCATORLABS_PO_ELEMENT', data: data }, '*');
                }

                function sendHighlightInfo(rect, tagName, id, className) {
                  const frameRect = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
                  const adjustedRect = {
                    left: rect.left + frameRect.left,
                    top: rect.top + frameRect.top,
                    width: rect.width,
                    height: rect.height
                  };
                  window.parent.postMessage({
                    type: 'LOCATORLABS_PO_HIGHLIGHT',
                    rect: adjustedRect,
                    tagName: tagName,
                    id: id,
                    className: className
                  }, '*');
                }

                window.__poMouseMove = function(e) {
                  if (!window.__poModeActive) return;
                  const path = e.composedPath();
                  hoveredElement = path[0] || e.target;
                  if (hoveredElement.id && hoveredElement.id.startsWith('__po_mode')) return;
                  const rect = hoveredElement.getBoundingClientRect();
                  const tagName = hoveredElement.tagName.toLowerCase();
                  const id = hoveredElement.id || '';
                  const className = (typeof hoveredElement.className === 'string') ? hoveredElement.className : '';
                  sendHighlightInfo(rect, tagName, id, className);
                };

                // Track last click to prevent duplicates
                let lastClickTime = 0;
                const CLICK_DEBOUNCE_MS = 200;

                window.__poClick = function(e) {
                  if (!window.__poModeActive) return;
                  if (e.target.id && e.target.id.startsWith('__po_mode')) return;

                  // Debounce clicks
                  const now = Date.now();
                  if (now - lastClickTime < CLICK_DEBOUNCE_MS) return;
                  lastClickTime = now;

                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();

                  const path = e.composedPath();
                  const el = path[0] || e.target;
                  const shadowPath = getShadowPath(el);
                  const jsPath = getJSPathForElement(el, shadowPath);
                  const framePath = getFramePath(window);

                  const isSVGElement = el instanceof SVGElement || el.namespaceURI === 'http://www.w3.org/2000/svg';
                  const svgParent = el.closest ? el.closest('svg') : null;
                  const isInsideSVG = isSVGElement || (svgParent !== null);

                  let rawClassName = (typeof el.className === 'string') ? el.className : (el.className?.baseVal || null);
                  let cleanClassName = null;
                  if (rawClassName) {
                    cleanClassName = rawClassName.split(' ').filter(c => !c.startsWith('__po')).join(' ').trim() || null;
                  }

                  let parentId = null;
                  let parent = el.parentElement;
                  while (parent && parent !== document.body) {
                    if (parent.id) { parentId = parent.id; break; }
                    parent = parent.parentElement;
                  }

                  let labelText = null;
                  const normalizeWhitespace = (str) => {
                    if (!str) return null;
                    return str.replace(/\\u00A0/g, ' ').replace(/\\u200B/g, '').replace(/  +/g, ' ').trim();
                  };

                  if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                    if (el.id) {
                      const labelEl = document.querySelector('label[for="' + el.id + '"]');
                      if (labelEl) labelText = normalizeWhitespace(labelEl.textContent);
                    }
                    if (!labelText) {
                      const parentLabel = el.closest('label');
                      if (parentLabel) {
                        const clone = parentLabel.cloneNode(true);
                        clone.querySelectorAll('input, select, textarea').forEach(inp => inp.remove());
                        labelText = normalizeWhitespace(clone.textContent);
                      }
                    }
                  }

                  const data = {
                    tagName: el.tagName,
                    id: el.id || null,
                    name: el.getAttribute('name') || null,
                    className: cleanClassName,
                    type: el.getAttribute('type') || null,
                    placeholder: el.getAttribute('placeholder') || null,
                    text: el.textContent ? el.textContent.trim().substring(0, 100) : null,
                    ariaLabel: el.getAttribute('aria-label') || null,
                    labelText: labelText,
                    dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || null,
                    role: el.getAttribute('role') || null,
                    href: el.getAttribute('href') || null,
                    src: el.getAttribute('src') || null,
                    title: el.getAttribute('title') || null,
                    value: el.value || null,
                    checked: el.checked === true,
                    attributes: {
                      type: el.getAttribute('type'),
                      name: el.getAttribute('name'),
                      alt: el.getAttribute('alt'),
                      for: el.getAttribute('for'),
                      d: el.getAttribute('d'),
                      fill: el.getAttribute('fill'),
                      viewBox: el.getAttribute('viewBox')
                    },
                    framePath: framePath,
                    shadowPath: shadowPath,
                    jsPath: jsPath,
                    isSVG: isInsideSVG,
                    svgTagName: isSVGElement ? el.tagName.toLowerCase() : null,
                    parentId: parentId,
                    isPOMode: true
                  };

                  sendElementData(data);
                };

                window.__poKeyDown = function(e) {
                  if (e.key === 'Escape' && window.__poModeActive) {
                    window.top.postMessage({ type: 'LOCATORLABS_PO_EXIT_MSG' }, '*');
                  }
                };

                document.addEventListener('mousemove', window.__poMouseMove, true);
                document.addEventListener('click', window.__poClick, true);
                document.addEventListener('keydown', window.__poKeyDown, true);

                // Try to inject into nested iframes
                document.querySelectorAll('iframe, frame').forEach(function(nestedFrame) {
                  try {
                    if (nestedFrame.contentDocument) {
                      nestedFrame.addEventListener('load', function() {
                        try { injectIntoThisFrame(nestedFrame); } catch(e) {}
                      });
                      if (nestedFrame.contentDocument.readyState === 'complete') {
                        try { injectIntoThisFrame(nestedFrame); } catch(e) {}
                      }
                    }
                  } catch(e) {}
                });

                function injectIntoThisFrame(f) {
                  // Placeholder for nested injection
                }
              })();
            \`);
          } catch (e) {
            // Cross-origin frame, cannot inject
          }
        }

        // Inject into all existing iframes and frames
        if (isTopFrame) {
          // Mark frame as having load listener to prevent duplicate handlers
          function setupFrameInjection(frame) {
            if (frame.__poModeLoadListenerAdded) return;
            frame.__poModeLoadListenerAdded = true;

            frame.addEventListener('load', function() {
              injectIntoFrame(frame);
            });

            try {
              if (frame.contentDocument && frame.contentDocument.readyState === 'complete') {
                injectIntoFrame(frame);
              }
            } catch(e) {}
          }

          document.querySelectorAll('iframe, frame').forEach(setupFrameInjection);

          // Also check window.frames for frameset pages
          if (isFramesetPage) {
            for (let i = 0; i < window.frames.length; i++) {
              try {
                const frameWin = window.frames[i];
                if (frameWin && frameWin.document && !frameWin.__poModeInjected) {
                  // Find the corresponding frame element
                  const frameEls = document.querySelectorAll('frame');
                  if (frameEls[i]) {
                    injectIntoFrame(frameEls[i]);
                  }
                }
              } catch(e) {}
            }
          }

          // Watch for new iframes - use documentElement if body doesn't exist (frameset pages)
          const observeTarget = document.body || document.documentElement;
          if (observeTarget) {
            const observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                  if (node.tagName === 'IFRAME' || node.tagName === 'FRAME') {
                    setupFrameInjection(node);
                  }
                  if (node.querySelectorAll) {
                    node.querySelectorAll('iframe, frame').forEach(setupFrameInjection);
                  }
                });
              });
            });
            observer.observe(observeTarget, { childList: true, subtree: true });
          }
        }

        console.log('PO Mode Inspector injected' + (isTopFrame ? ' (top frame)' : ' (child frame)'));
      })();
    `;

    webview.executeJavaScript(script);

    // Listen for PO Mode messages
    setupPOModeMessageListener();
  }

  function removePOModeScript() {
    const script = `
      (function() {
        function cleanupPOMode(win) {
          try {
            win.__poModeActive = false;

            if (win.__poModeInjected) {
              win.document.removeEventListener('mousemove', win.__poMouseMove, true);
              win.document.removeEventListener('click', win.__poClick, true);
              win.document.removeEventListener('keydown', win.__poKeyDown, true);

              // Remove UI elements from body or documentElement
              function removeUIElement(id) {
                const el = win.document.getElementById(id);
                if (el) el.remove();
                // Also check all frames in case of frameset
                win.document.querySelectorAll('frame').forEach(function(frame) {
                  try {
                    const frameEl = frame.contentDocument && frame.contentDocument.getElementById(id);
                    if (frameEl) frameEl.remove();
                  } catch(e) {}
                });
              }

              removeUIElement('__po_mode_highlight');
              removeUIElement('__po_mode_tooltip');

              win.__poModeInjected = false;
            }

            // Clean up iframes and frames
            win.document.querySelectorAll('iframe, frame').forEach(function(frame) {
              try {
                // Clear the load listener flag
                frame.__poModeLoadListenerAdded = false;
                if (frame.contentWindow) {
                  cleanupPOMode(frame.contentWindow);
                }
              } catch(e) {}
            });
          } catch(e) {}
        }

        cleanupPOMode(window);
        console.log('PO Mode Inspector removed');
      })();
    `;

    webview.executeJavaScript(script);
  }

  function setupPOModeMessageListener() {
    // This listener is already set up in setupWebviewEventsForTab, but we need to handle PO mode messages
    // The console-message listener in setupWebviewEventsForTab will catch these messages
  }

  // Deduplication tracking for PO Mode - prevent same element being added twice
  let lastPOElementHash = null;
  let lastPOElementTime = 0;
  const PO_DEDUPE_WINDOW_MS = 300; // 300ms window to deduplicate

  function getPOElementHash(data) {
    // Create a simple hash based on key element properties
    const parts = [
      data.tagName,
      data.id || '',
      data.className || '',
      data.text ? data.text.substring(0, 50) : '',
      data.ariaLabel || '',
      JSON.stringify(data.framePath || [])
    ];
    return parts.join('|');
  }

  function handlePOModeElementSelected(elementData) {
    if (!isPOModeEnabled) return;

    // Deduplicate - prevent same element being added twice in quick succession
    const hash = getPOElementHash(elementData);
    const now = Date.now();
    if (hash === lastPOElementHash && (now - lastPOElementTime) < PO_DEDUPE_WINDOW_MS) {
      console.log('PO Mode: Duplicate element detected, skipping');
      return;
    }
    lastPOElementHash = hash;
    lastPOElementTime = now;

    // Store element data for locator generation
    currentElementData = elementData;

    // Generate locators for this element
    LocatorGenerator.framework = LocatorGenerator.framework || 'playwright';
    const locators = LocatorGenerator.generateLocators(elementData);

    // Find the best locator based on preferences
    const bestLocator = findBestLocatorForPOMode(locators);

    if (bestLocator) {
      // Add to cart
      addToPageObjectCart(bestLocator.value, bestLocator.strategy);
      updateCartBadge();

      // Visual feedback - flash the highlight
      webview.executeJavaScript(`
        (function() {
          const highlight = document.getElementById('__po_mode_highlight');
          if (highlight) {
            highlight.style.background = 'rgba(16, 185, 129, 0.4)';
            setTimeout(() => {
              highlight.style.background = 'rgba(16, 185, 129, 0.1)';
            }, 200);
          }
        })();
      `);
    } else {
      showToast('Could not generate locator for this element', 'error');
    }
  }

  function findBestLocatorForPOMode(locators) {
    if (!locators || locators.length === 0) return null;

    const framework = LocatorGenerator.framework || 'playwright';
    const prefs = poModePreferences[framework];

    if (!prefs) {
      // No preferences, return first locator
      return locators[0];
    }

    // Map strategy names to preference keys
    const strategyToKey = {
      'getByRole': 'getByRole',
      'getByLabel': 'getByLabel',
      'getByTestId': 'getByTestId',
      'getByPlaceholder': 'getByPlaceholder',
      'getByText': 'getByText',
      'getByAltText': 'getByLabel',
      'getByTitle': 'getByText',
      'ID (CSS)': 'ID',
      'ID': 'ID',
      'Name (CSS)': 'Name',
      'Name': 'Name',
      'CSS': 'CSS',
      'CSS Selector': 'CSS',
      'XPath': 'XPath',
      'XPath (ID)': 'XPath',
      'XPath (Name)': 'XPath',
      'XPath (Text)': 'XPath',
      'Link Text': 'LinkText',
      'LinkText': 'LinkText',
      'Partial Link Text': 'LinkText',
      'ClassName': 'ClassName',
      'data-testid': 'data-testid',
      'contains': 'contains',
      'cy.contains': 'contains',
      'Chained Locator': 'ID'
    };

    // Filter and sort locators based on preferences
    const enabledLocators = locators.filter(loc => {
      const key = strategyToKey[loc.strategy] || loc.strategy;
      return prefs.enabled[key] !== false;
    });

    if (enabledLocators.length === 0) {
      return locators[0]; // Fallback
    }

    // Sort by priority order
    enabledLocators.sort((a, b) => {
      const keyA = strategyToKey[a.strategy] || a.strategy;
      const keyB = strategyToKey[b.strategy] || b.strategy;
      const indexA = prefs.locators.indexOf(keyA);
      const indexB = prefs.locators.indexOf(keyB);

      // Also consider quality rating
      const qualityDiff = (b.quality?.score || 0) - (a.quality?.score || 0);

      if (indexA === -1 && indexB === -1) return qualityDiff;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      // Priority order takes precedence, then quality
      if (indexA !== indexB) return indexA - indexB;
      return qualityDiff;
    });

    return enabledLocators[0];
  }

  function renderPOSettingsModal() {
    // Update checkboxes and order from current preferences
    ['playwright', 'selenium', 'cypress'].forEach(fw => {
      const listId = fw === 'playwright' ? 'playwrightLocatorList' :
                     fw === 'selenium' ? 'seleniumLocatorList' : 'cypressLocatorList';
      const list = document.getElementById(listId);
      if (!list) return;

      const prefs = poModePreferences[fw];
      if (!prefs) return;

      // Update checkbox states
      list.querySelectorAll('.po-settings-locator-item').forEach(item => {
        const locatorType = item.dataset.locator;
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && prefs.enabled.hasOwnProperty(locatorType)) {
          checkbox.checked = prefs.enabled[locatorType];
        }
      });

      // Reorder items based on saved order
      const items = Array.from(list.querySelectorAll('.po-settings-locator-item'));
      const orderedItems = [];

      prefs.locators.forEach(locatorType => {
        const item = items.find(i => i.dataset.locator === locatorType);
        if (item) orderedItems.push(item);
      });

      // Add any remaining items not in the saved order
      items.forEach(item => {
        if (!orderedItems.includes(item)) {
          orderedItems.push(item);
        }
      });

      // Reorder DOM
      orderedItems.forEach(item => list.appendChild(item));
    });
  }

  function savePOSettingsFromModal() {
    ['playwright', 'selenium', 'cypress'].forEach(fw => {
      const listId = fw === 'playwright' ? 'playwrightLocatorList' :
                     fw === 'selenium' ? 'seleniumLocatorList' : 'cypressLocatorList';
      const list = document.getElementById(listId);
      if (!list) return;

      const items = list.querySelectorAll('.po-settings-locator-item');
      const locators = [];
      const enabled = {};

      items.forEach(item => {
        const locatorType = item.dataset.locator;
        const checkbox = item.querySelector('input[type="checkbox"]');
        locators.push(locatorType);
        enabled[locatorType] = checkbox ? checkbox.checked : true;
      });

      poModePreferences[fw] = { locators, enabled };
    });
  }

  function setupLocatorListDragDrop() {
    const lists = document.querySelectorAll('.po-settings-locator-list');

    lists.forEach(list => {
      // Skip if already initialized
      if (list.dataset.dragInitialized === 'true') {
        return;
      }
      list.dataset.dragInitialized = 'true';

      let dragState = {
        item: null,
        placeholder: null,
        isDragging: false,
        startY: 0,
        offsetY: 0
      };

      // Create placeholder element
      function createPlaceholder(height) {
        const el = document.createElement('div');
        el.className = 'po-settings-locator-placeholder';
        el.style.cssText = `
          height: ${height}px;
          border: 2px dashed var(--accent-primary);
          border-radius: var(--radius-sm);
          background: var(--accent-light);
          box-sizing: border-box;
        `;
        return el;
      }

      // Find insertion point based on Y coordinate
      function findInsertionPoint(y) {
        const items = list.querySelectorAll('.po-settings-locator-item:not(.dragging)');
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (y < midY) {
            return item;
          }
        }
        return null; // Insert at end
      }

      // Mouse down handler on items
      list.addEventListener('mousedown', (e) => {
        // Only start drag from the drag handle or the item itself (not checkbox/label)
        const handle = e.target.closest('.drag-handle');
        const item = e.target.closest('.po-settings-locator-item');
        const isCheckbox = e.target.matches('input[type="checkbox"]');
        const isLabel = e.target.matches('label');

        if (!item || isCheckbox || isLabel) return;
        if (!handle && !e.target.matches('.po-settings-locator-item')) return;

        e.preventDefault();

        const rect = item.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();

        dragState.item = item;
        dragState.isDragging = true;
        dragState.startY = e.clientY;
        dragState.offsetY = e.clientY - rect.top;
        dragState.itemHeight = rect.height;
        dragState.listTop = listRect.top;

        // Create placeholder
        dragState.placeholder = createPlaceholder(rect.height);
        item.parentNode.insertBefore(dragState.placeholder, item.nextSibling);

        // Style the dragged item
        item.classList.add('dragging');
        item.style.position = 'absolute';
        item.style.zIndex = '10001';
        item.style.width = rect.width + 'px';
        item.style.left = '0';
        item.style.top = (rect.top - listRect.top) + 'px';
        item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

        // Make list position relative for absolute positioning
        list.style.position = 'relative';
      });

      // Mouse move handler (on document to catch moves outside the list)
      const handleMouseMove = (e) => {
        if (!dragState.isDragging || !dragState.item) return;

        const item = dragState.item;
        const placeholder = dragState.placeholder;

        // Calculate new position
        const listRect = list.getBoundingClientRect();
        let newTop = e.clientY - dragState.offsetY - listRect.top;

        // Constrain to list bounds
        const maxTop = list.scrollHeight - dragState.itemHeight;
        newTop = Math.max(0, Math.min(newTop, maxTop));

        item.style.top = newTop + 'px';

        // Find where to move placeholder
        const insertBefore = findInsertionPoint(e.clientY);

        if (insertBefore) {
          if (insertBefore !== placeholder && insertBefore !== item) {
            list.insertBefore(placeholder, insertBefore);
          }
        } else {
          // Insert at end
          if (list.lastElementChild !== placeholder) {
            list.appendChild(placeholder);
          }
        }
      };

      // Mouse up handler
      const handleMouseUp = (e) => {
        if (!dragState.isDragging || !dragState.item) return;

        const item = dragState.item;
        const placeholder = dragState.placeholder;

        // Reset item styles
        item.classList.remove('dragging');
        item.style.position = '';
        item.style.zIndex = '';
        item.style.width = '';
        item.style.left = '';
        item.style.top = '';
        item.style.boxShadow = '';

        // Move item to placeholder position
        if (placeholder && placeholder.parentNode) {
          list.insertBefore(item, placeholder);
          placeholder.remove();
        }

        // Reset drag state
        dragState.item = null;
        dragState.placeholder = null;
        dragState.isDragging = false;
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }
});
