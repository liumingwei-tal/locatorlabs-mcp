/**
 * LocatorLabs Desktop
 *
 * Copyright (c) 2025 Naveen AutomationLabs
 * Licensed under the MIT License
 *
 * https://www.locator-labs.com
 *
 * Locator Generator Module
 * Supports: Playwright (JS/TS, Python, Java), Selenium (Java, Python), Cypress
 */

const LocatorGenerator = {
  // Current settings
  framework: 'playwright',
  language: 'javascript',

  // Quality ratings
  QUALITY: {
    BEST: { label: 'BEST', score: 3, class: 'badge-best' },
    GOOD: { label: 'GOOD', score: 2, class: 'badge-good' },
    OK: { label: 'OK', score: 1, class: 'badge-ok' },
    FRAGILE: { label: 'FRAGILE', score: 0, class: 'badge-fragile' }
  },

  // Java AriaRole mapping for Playwright Java API
  JAVA_ARIA_ROLES: {
    'button': 'AriaRole.BUTTON',
    'checkbox': 'AriaRole.CHECKBOX',
    'combobox': 'AriaRole.COMBOBOX',
    'dialog': 'AriaRole.DIALOG',
    'heading': 'AriaRole.HEADING',
    'img': 'AriaRole.IMG',
    'link': 'AriaRole.LINK',
    'list': 'AriaRole.LIST',
    'listitem': 'AriaRole.LISTITEM',
    'listbox': 'AriaRole.LISTBOX',
    'main': 'AriaRole.MAIN',
    'menu': 'AriaRole.MENU',
    'menuitem': 'AriaRole.MENUITEM',
    'navigation': 'AriaRole.NAVIGATION',
    'option': 'AriaRole.OPTION',
    'radio': 'AriaRole.RADIO',
    'radiogroup': 'AriaRole.RADIOGROUP',
    'region': 'AriaRole.REGION',
    'row': 'AriaRole.ROW',
    'searchbox': 'AriaRole.SEARCHBOX',
    'spinbutton': 'AriaRole.SPINBUTTON',
    'tab': 'AriaRole.TAB',
    'tabpanel': 'AriaRole.TABPANEL',
    'textbox': 'AriaRole.TEXTBOX',
    'banner': 'AriaRole.BANNER',
    'complementary': 'AriaRole.COMPLEMENTARY',
    'contentinfo': 'AriaRole.CONTENTINFO',
    'form': 'AriaRole.FORM',
    'article': 'AriaRole.ARTICLE',
    'table': 'AriaRole.TABLE'
  },

  // Generate all locators for an element
  generateLocators(elementData) {
    const locators = [];
    const { tagName, id, name, className, type, placeholder, text, ariaLabel, labelText,
            dataTestId, role, href, src, title, value, checked, attributes, framePath, shadowPath, jsPath,
            isSVG, svgTagName, xpath: elementXPath, parentId, parentSelector } = elementData;

    // Store frame path for use in formatters
    this.currentFramePath = framePath || [];

    // Store shadow DOM info
    this.currentShadowPath = shadowPath || [];
    this.currentJsPath = jsPath || null;

    // Store SVG info
    this.currentIsSVG = isSVG || false;
    this.currentSvgTagName = svgTagName || null;

    // Store element data for helper methods
    this.currentElementData = elementData;

    // Check if element is inside Shadow DOM
    const isInShadowDOM = this.currentShadowPath.length > 0;

    // For Selenium with Shadow DOM, only return JS executor code
    if (this.framework === 'selenium' && isInShadowDOM) {
      return this.generateSeleniumShadowDOMLocators(elementData);
    }

    // Helper to normalize whitespace (including nbsp) - failsafe in case element data has whitespace
    const normalizeWS = (str) => {
      if (!str) return null;
      // Replace nbsp and zero-width space with regular space, then collapse multiple spaces
      return str.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').replace(/  +/g, ' ').trim();
    };

    // Normalize labelText and ariaLabel to ensure clean locators
    const cleanLabelText = normalizeWS(labelText);
    const cleanAriaLabel = normalizeWS(ariaLabel);

    // Clean text for use in locators
    // Store original text length to detect truncation
    const originalText = text ? text.trim() : null;
    const cleanText = originalText ? normalizeWS(originalText).substring(0, 50) : null;
    const isTextTruncated = originalText && originalText.length > 50;
    const tag = tagName.toLowerCase();

    // Check element type categories
    const isFormInput = ['input', 'select', 'textarea'].includes(tag);
    const isButton = tag === 'button' || (tag === 'input' && ['button', 'submit', 'reset'].includes(type));
    const isLink = tag === 'a';
    const isImage = tag === 'img';
    const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
    const isCheckboxOrRadio = tag === 'input' && ['checkbox', 'radio'].includes(type);

    // === PLAYWRIGHT SEMANTIC LOCATORS ===
    if (this.framework === 'playwright') {
      const inferredRole = role || this.inferRole(tagName, type);
      const headingLevel = isHeading ? parseInt(tag.charAt(1)) : null;

      // Determine accessible name based on element type
      // Use normalized versions (cleanAriaLabel, cleanLabelText) to avoid whitespace issues
      let accessibleName = null;
      const isInputButton = tag === 'input' && ['button', 'submit', 'reset'].includes(type);
      if (isImage) {
        // Images: use alt text or aria-label
        accessibleName = cleanAriaLabel || normalizeWS(attributes?.alt) || null;
      } else if (isInputButton) {
        // Input buttons (submit, button, reset): use aria-label or value attribute
        // Playwright uses value as accessible name for these input types
        accessibleName = cleanAriaLabel || normalizeWS(value) || null;
      } else if (isButton) {
        // Regular <button> elements: use aria-label or text content
        accessibleName = cleanAriaLabel || (cleanText && cleanText.length < 50 ? cleanText : null);
      } else if (isFormInput) {
        // Form inputs (textbox, checkbox, etc): use aria-label, label text, or placeholder
        // Priority: aria-label > labelText (from <label>) > placeholder
        // Note: HTML 'name' attribute is NOT accessible name
        accessibleName = cleanAriaLabel || cleanLabelText || normalizeWS(placeholder);
      } else {
        // Links, headings, etc: use aria-label or text content
        accessibleName = cleanAriaLabel || (cleanText && cleanText.length < 50 ? cleanText : null);
      }

      // =============================================
      // RECOMMENDED - BEST QUALITY LOCATORS
      // =============================================

      // 1. getByRole with level (for headings) - BEST - Most specific
      if (isHeading && accessibleName) {
        locators.push({
          strategy: 'getByRole',
          value: this.formatPlaywrightGetByRole('heading', accessibleName, tagName),
          quality: this.QUALITY.BEST,
          description: `Accessibility-based (heading level ${headingLevel})`
        });
      }

      // 2. getByRole (for buttons) - BEST
      if (isButton && accessibleName) {
        locators.push({
          strategy: 'getByRole',
          value: this.formatPlaywrightGetByRole('button', accessibleName, tagName),
          quality: this.QUALITY.BEST,
          description: 'Accessibility-based'
        });
      }

      // 3. getByRole (for links) - BEST
      if (isLink && accessibleName) {
        locators.push({
          strategy: 'getByRole',
          value: this.formatPlaywrightGetByRole('link', accessibleName, tagName),
          quality: this.QUALITY.BEST,
          description: 'Accessibility-based'
        });
      }

      // 4. getByRole (for images) - BEST
      if (isImage && accessibleName) {
        locators.push({
          strategy: 'getByRole',
          value: this.formatPlaywrightGetByRole('img', accessibleName, tagName),
          quality: this.QUALITY.BEST,
          description: 'Accessibility-based'
        });
      }

      // 5. getByRole (for form inputs - textbox, checkbox, radio, combobox) - BEST
      if (isFormInput && inferredRole && accessibleName && !isButton) {
        // For checkbox/radio, include checked state
        const checkedState = isCheckboxOrRadio ? checked : undefined;
        locators.push({
          strategy: 'getByRole',
          value: this.formatPlaywrightGetByRole(inferredRole, accessibleName, tagName, checkedState),
          quality: this.QUALITY.BEST,
          description: isCheckboxOrRadio ? `Accessibility-based (checked: ${checked})` : 'Accessibility-based'
        });
      }

      // 6. getByLabel - BEST (for form inputs with label)
      // Use labelText from associated <label> element, or fallback to ariaLabel/placeholder
      const labelForGetByLabel = cleanLabelText || cleanAriaLabel || normalizeWS(placeholder);
      if (isFormInput && labelForGetByLabel) {
        locators.push({
          strategy: 'getByLabel',
          value: this.formatPlaywrightGetByLabel(labelForGetByLabel),
          quality: this.QUALITY.BEST,
          description: 'Form field label'
        });
      }

      // 7. getByAltText - BEST (for images with alt)
      if (isImage && attributes?.alt) {
        locators.push({
          strategy: 'getByAltText',
          value: this.formatPlaywrightGetByAltText(attributes.alt),
          quality: this.QUALITY.BEST,
          description: 'Image alt text'
        });
      }

      // 8. getByTestId - BEST
      if (dataTestId) {
        locators.push({
          strategy: 'getByTestId',
          value: this.formatPlaywrightGetByTestId(dataTestId),
          quality: this.QUALITY.BEST,
          description: 'Test ID locator - highly stable'
        });
      }

      // =============================================
      // ALTERNATIVE - GOOD QUALITY LOCATORS
      // =============================================

      // 9. ID (CSS) - GOOD
      if (id) {
        locators.push({
          strategy: 'ID (CSS)',
          value: this.formatIdLocator(id),
          quality: this.QUALITY.GOOD,
          description: 'By ID attribute'
        });
      }

      // 10. Name (CSS) - GOOD (for form inputs)
      if (name) {
        locators.push({
          strategy: 'Name (CSS)',
          value: this.formatPlaywrightLocator(`[name="${name}"]`),
          quality: this.QUALITY.GOOD,
          description: 'By name attribute'
        });
      }

      // 11. Chained Locator - GOOD (from parent container)
      if (parentId && accessibleName && isFormInput) {
        locators.push({
          strategy: 'Chained Locator',
          value: this.formatChainedLocatorWithLabel(`#${this.escapeCssId(parentId)}`, accessibleName),
          quality: this.QUALITY.GOOD,
          description: `#${parentId} → label "${accessibleName.substring(0, 15)}..."`
        });
      }

      // 12. getByPlaceholder - GOOD
      if (placeholder) {
        locators.push({
          strategy: 'getByPlaceholder',
          value: this.formatPlaywrightGetByPlaceholder(placeholder),
          quality: this.QUALITY.GOOD,
          description: 'Input placeholder'
        });
      }

      // 13. getByText - GOOD (for elements with text that don't have getByRole)
      // Skip for buttons, links, headings as they have getByRole
      const hasSemanticRole = isButton || isLink || isHeading || isImage;
      if (!isFormInput && !hasSemanticRole && cleanText && cleanText.length > 0 && cleanText.length < 100) {
        locators.push({
          strategy: 'getByText',
          // If text was truncated, use partial match (no exact:true) for realistic locator
          value: this.formatPlaywrightGetByText(cleanText, isTextTruncated),
          quality: this.QUALITY.GOOD,
          description: isTextTruncated ? 'Partial text content (text too long for exact match)' : 'Exact text content'
        });
      }

      // 14. getByTitle - GOOD
      if (title) {
        locators.push({
          strategy: 'getByTitle',
          value: this.formatPlaywrightGetByTitle(title),
          quality: this.QUALITY.GOOD,
          description: 'Title attribute locator'
        });
      }

      // =============================================
      // CSS & XPATH - OK/GOOD QUALITY LOCATORS
      // =============================================

      // 12. Class Names - OK
      if (className) {
        const classes = className.split(' ').filter(c => c && !c.includes(':'));
        if (classes.length > 0) {
          locators.push({
            strategy: 'Class Names',
            value: this.formatPlaywrightLocator('.' + classes[0]),
            quality: this.QUALITY.OK,
            description: `Classes: ${classes.slice(0, 3).join(', ')}`
          });
        }
      }

      // 13. CSS Selector - OK
      const cssSelector = this.generateCssSelector(elementData);
      if (cssSelector && cssSelector !== `#${id}`) {
        locators.push({
          strategy: 'CSS',
          value: this.formatCssLocator(cssSelector),
          quality: this.QUALITY.OK,
          description: 'CSS selector'
        });
      }

      // 14. ID (XPath) - GOOD
      if (!isInShadowDOM && id) {
        locators.push({
          strategy: 'ID (XPath)',
          value: this.formatXPathLocator(`//${tag}[@id='${id}']`),
          quality: this.QUALITY.GOOD,
          description: 'XPath with ID'
        });
      }

      // 15. Name (XPath) - GOOD (for form inputs)
      if (!isInShadowDOM && name) {
        locators.push({
          strategy: 'Name (XPath)',
          value: this.formatXPathLocator(`//${tag}[@name='${name}']`),
          quality: this.QUALITY.GOOD,
          description: 'XPath with name'
        });
      }

      // 16. XPath (structural) - OK
      if (!isInShadowDOM) {
        const structuralXPath = this.generateXPath(elementData);
        if (structuralXPath) {
          locators.push({
            strategy: 'XPath',
            value: this.formatXPathLocator(structuralXPath),
            quality: this.QUALITY.OK,
            description: 'Structural XPath'
          });
        }
      }

      // 17. CSS :has-text() - OK (for non-input elements)
      if (!isFormInput && cleanText && cleanText.length > 0) {
        locators.push({
          strategy: 'CSS :has-text()',
          value: this.formatCssHasText(tag, cleanText),
          quality: this.QUALITY.OK,
          description: 'Text-based CSS'
        });
      }

      // =============================================
      // FRAGILE QUALITY LOCATORS
      // =============================================

      // 18. Absolute XPath - FRAGILE
      if (!isInShadowDOM) {
        const absoluteXPath = this.generateAbsoluteXPath(elementData);
        if (absoluteXPath) {
          locators.push({
            strategy: 'Absolute XPath',
            value: this.formatXPathLocator(absoluteXPath),
            quality: this.QUALITY.FRAGILE,
            description: 'Full path from root - breaks easily'
          });
        }
      }

      // 19. Position XPath - FRAGILE
      if (!isInShadowDOM) {
        const positionXPath = this.generatePositionXPath(elementData);
        if (positionXPath) {
          locators.push({
            strategy: 'Position XPath',
            value: this.formatXPathLocator(positionXPath),
            quality: this.QUALITY.FRAGILE,
            description: 'Index-based using position()'
          });
        }
      }
    }

    // === SELENIUM LOCATORS ===
    if (this.framework === 'selenium') {
      // ID LOCATOR - BEST
      if (id) {
        locators.push({
          strategy: 'ID',
          value: this.formatIdLocator(id),
          quality: this.QUALITY.BEST,
          description: 'Unique ID locator'
        });
      }

      // NAME LOCATOR - GOOD
      if (name) {
        locators.push({
          strategy: 'Name',
          value: this.formatNameLocator(name),
          quality: this.QUALITY.GOOD,
          description: 'Name attribute locator'
        });
      }

      // CSS SELECTOR
      const cssSelector = this.generateCssSelector(elementData);
      if (cssSelector) {
        locators.push({
          strategy: 'CSS',
          value: this.formatCssLocator(cssSelector),
          quality: this.QUALITY.GOOD,
          description: 'CSS selector'
        });
      }

      // ID XPath - GOOD (always generate if ID exists)
      if (!isInShadowDOM && id) {
        locators.push({
          strategy: 'ID (XPath)',
          value: this.formatXPathLocator(`//${tag}[@id='${id}']`),
          quality: this.QUALITY.GOOD,
          description: 'XPath with ID'
        });
      }

      // Name XPath - GOOD (always generate if name exists)
      if (!isInShadowDOM && name) {
        locators.push({
          strategy: 'Name (XPath)',
          value: this.formatXPathLocator(`//${tag}[@name='${name}']`),
          quality: this.QUALITY.GOOD,
          description: 'XPath with name'
        });
      }

      // XPATH with text (for elements with text content)
      if (!isInShadowDOM && cleanText) {
        const xpath = this.generateXPath(elementData);
        if (xpath) {
          locators.push({
            strategy: 'XPath',
            value: this.formatXPathLocator(xpath),
            quality: this.QUALITY.OK,
            description: 'XPath locator'
          });
        }
      }

      // Structural XPath - OK (generate for all elements)
      if (!isInShadowDOM) {
        const structuralXPath = this.generateXPath(elementData);
        if (structuralXPath && !cleanText) {  // Only if we didn't already add text-based XPath
          locators.push({
            strategy: 'XPath',
            value: this.formatXPathLocator(structuralXPath),
            quality: this.QUALITY.OK,
            description: 'Structural XPath'
          });
        }
      }

      // LINK TEXT (for anchors)
      if (tag === 'a' && text) {
        locators.push({
          strategy: 'Link Text',
          value: this.formatLinkTextLocator(text.trim()),
          quality: this.QUALITY.GOOD,
          description: 'Link text locator'
        });
      }

      // CLASS NAME
      if (className) {
        const firstClass = className.split(' ').filter(c => c && !c.includes(':'))[0];
        if (firstClass) {
          locators.push({
            strategy: 'ClassName',
            value: this.formatSeleniumLocator('className', firstClass),
            quality: this.QUALITY.OK,
            description: 'Class name locator'
          });
        }
      }

      // TAG NAME
      locators.push({
        strategy: 'TagName',
        value: this.formatSeleniumLocator('tagName', tag),
        quality: this.QUALITY.OK,
        description: 'Tag name locator'
      });

      // Absolute XPath - FRAGILE
      if (!isInShadowDOM) {
        const absoluteXPath = this.generateAbsoluteXPath(elementData);
        if (absoluteXPath) {
          locators.push({
            strategy: 'Absolute XPath',
            value: this.formatSeleniumLocator('xpath', absoluteXPath),
            quality: this.QUALITY.FRAGILE,
            description: 'Full path from root - breaks easily'
          });
        }
      }

      // Position XPath - FRAGILE
      if (!isInShadowDOM) {
        const positionXPath = this.generatePositionXPath(elementData);
        if (positionXPath) {
          locators.push({
            strategy: 'Position XPath',
            value: this.formatSeleniumLocator('xpath', positionXPath),
            quality: this.QUALITY.FRAGILE,
            description: 'Index-based using position()'
          });
        }
      }
    }

    // === CYPRESS LOCATORS ===
    if (this.framework === 'cypress') {
      // Check if element is inside Shadow DOM - Cypress needs special handling
      const shadowDomOption = isInShadowDOM ? ', { includeShadowDom: true }' : '';
      const shadowDomOptionContains = isInShadowDOM ? '{ includeShadowDom: true }' : '';

      // =============================================
      // RECOMMENDED - BEST QUALITY LOCATORS
      // =============================================

      // 1. cy.get by data-testid - BEST
      if (dataTestId) {
        locators.push({
          strategy: 'data-testid',
          value: this.formatCypressGet(`[data-testid="${dataTestId}"]`, isInShadowDOM),
          quality: this.QUALITY.BEST,
          description: 'Test ID locator - highly stable'
        });
      }

      // 2. cy.get by ID - BEST
      if (id) {
        locators.push({
          strategy: 'ID',
          value: this.formatCypressGet(`#${this.escapeCssId(id)}`, isInShadowDOM),
          quality: this.QUALITY.BEST,
          description: 'By ID attribute'
        });
      }

      // 3. cy.contains for buttons, links with text - BEST
      // For input buttons, use value attribute; for regular buttons/links, use text content
      const isInputButton = tag === 'input' && ['button', 'submit', 'reset'].includes(type);
      const buttonText = isInputButton ? normalizeWS(value) : cleanText;
      if ((isButton || isLink) && buttonText && buttonText.length < 50) {
        locators.push({
          strategy: 'cy.contains',
          value: this.formatCypressContains(tag, buttonText, isInShadowDOM),
          quality: this.QUALITY.BEST,
          description: 'Find by text content'
        });
      }

      // Note: Cypress doesn't have built-in role-based semantic locators like Playwright's getByRole
      // Use cy.contains() and cy.get() with CSS selectors instead

      // =============================================
      // ALTERNATIVE - GOOD QUALITY LOCATORS
      // =============================================

      // 5. cy.get by name attribute - GOOD
      if (name) {
        locators.push({
          strategy: 'Name',
          value: this.formatCypressGet(`[name="${name}"]`, isInShadowDOM),
          quality: this.QUALITY.GOOD,
          description: 'By name attribute'
        });
      }

      // 6. cy.get by placeholder - GOOD
      if (placeholder) {
        locators.push({
          strategy: 'Placeholder',
          value: this.formatCypressGet(`[placeholder="${this.escapeString(placeholder)}"]`, isInShadowDOM),
          quality: this.QUALITY.GOOD,
          description: 'Input placeholder'
        });
      }

      // 7. cy.get by aria-label - GOOD
      if (cleanAriaLabel) {
        locators.push({
          strategy: 'aria-label',
          value: this.formatCypressGet(`[aria-label="${this.escapeString(cleanAriaLabel)}"]`, isInShadowDOM),
          quality: this.QUALITY.GOOD,
          description: 'By aria-label attribute'
        });
      }

      // 9. cy.get by title - GOOD
      if (title) {
        locators.push({
          strategy: 'Title',
          value: this.formatCypressGet(`[title="${this.escapeString(title)}"]`, isInShadowDOM),
          quality: this.QUALITY.GOOD,
          description: 'Title attribute locator'
        });
      }

      // 10. cy.get by alt text - GOOD (for images)
      if (isImage && attributes?.alt) {
        locators.push({
          strategy: 'Alt Text',
          value: this.formatCypressGet(`img[alt="${this.escapeString(attributes.alt)}"]`, isInShadowDOM),
          quality: this.QUALITY.GOOD,
          description: 'Image alt text'
        });
      }

      // =============================================
      // CSS & XPATH - OK QUALITY LOCATORS
      // =============================================

      // 11. cy.get by class - OK
      if (className) {
        const classes = className.split(' ').filter(c => c && !c.includes(':'));
        if (classes.length > 0) {
          locators.push({
            strategy: 'Class Names',
            value: this.formatCypressGet('.' + classes[0], isInShadowDOM),
            quality: this.QUALITY.OK,
            description: `Classes: ${classes.slice(0, 3).join(', ')}`
          });
        }
      }

      // 12. CSS Selector - OK
      const cssSelector = this.generateCssSelector(elementData);
      if (cssSelector && cssSelector !== `#${id}`) {
        locators.push({
          strategy: 'CSS',
          value: this.formatCypressGet(cssSelector, isInShadowDOM),
          quality: this.QUALITY.OK,
          description: 'CSS selector'
        });
      }

      // 13. cy.contains (generic text) - OK
      if (!isFormInput && cleanText && cleanText.length > 0 && cleanText.length < 100 && !isButton && !isLink) {
        locators.push({
          strategy: 'Text',
          value: this.formatCypressContains(null, cleanText, isInShadowDOM),
          quality: this.QUALITY.OK,
          description: 'Text content'
        });
      }

      // 14. XPath (structural) - OK
      // NOTE: Cypress does NOT support XPath natively. Requires cypress-xpath plugin.
      // Install: npm install -D cypress-xpath
      // Import in cypress/support/commands.js: require('cypress-xpath');
      if (!isInShadowDOM) {
        const structuralXPath = this.generateXPath(elementData);
        if (structuralXPath) {
          locators.push({
            strategy: 'XPath',
            value: `cy.xpath('${structuralXPath}')`,
            quality: this.QUALITY.OK,
            description: 'Requires cypress-xpath plugin'
          });
        }
      }

      // =============================================
      // FRAGILE QUALITY LOCATORS
      // =============================================

      // 15. Absolute XPath - FRAGILE
      if (!isInShadowDOM) {
        const absoluteXPath = this.generateAbsoluteXPath(elementData);
        if (absoluteXPath) {
          locators.push({
            strategy: 'Absolute XPath',
            value: `cy.xpath('${absoluteXPath}')`,
            quality: this.QUALITY.FRAGILE,
            description: 'Requires cypress-xpath plugin'
          });
        }
      }

      // 16. Position XPath - FRAGILE
      if (!isInShadowDOM) {
        const positionXPath = this.generatePositionXPath(elementData);
        if (positionXPath) {
          locators.push({
            strategy: 'Position XPath',
            value: `cy.xpath('${positionXPath}')`,
            quality: this.QUALITY.FRAGILE,
            description: 'Requires cypress-xpath plugin'
          });
        }
      }
    }

    // Apply frame context to all locators if element is inside iframe
    if (this.isInFrame()) {
      locators.forEach(loc => {
        loc.value = this.addFrameContext(loc.value);
        // Only add "(in iframe)" for Playwright - Selenium shows frame switch separately
        if (this.framework === 'playwright') {
          loc.description += ' (in iframe)';
        }
        // For Cypress, add iframe note
        if (this.framework === 'cypress') {
          loc.description += ' (in iframe - requires cypress-iframe plugin)';
        }
      });
    }

    // Add shadow DOM note for Playwright locators
    if (isInShadowDOM && this.framework === 'playwright') {
      locators.forEach(loc => {
        loc.description += ' (auto-pierces shadow DOM)';
      });
    }

    // Add shadow DOM note for Cypress locators
    if (isInShadowDOM && this.framework === 'cypress') {
      locators.forEach(loc => {
        loc.description += ' (includeShadowDom: true)';
      });
    }

    return locators;
  },

  // Generate Selenium shadow DOM locators (JS executor approach)
  generateSeleniumShadowDOMLocators(elementData) {
    const locators = [];
    const { jsPath } = elementData;

    if (!jsPath) {
      return locators;
    }

    // JavaScript Executor locator
    if (this.language === 'python') {
      locators.push({
        strategy: 'JavaScript (Shadow DOM)',
        value: `element = driver.execute_script("return ${jsPath}")`,
        quality: this.QUALITY.GOOD,
        description: 'JavaScript executor for shadow DOM element',
        isShadowDOM: true
      });
    } else {
      // Java - include JavascriptExecutor casting
      locators.push({
        strategy: 'JavaScript (Shadow DOM)',
        value: `JavascriptExecutor js = (JavascriptExecutor) driver;\nWebElement element = (WebElement) js.executeScript("return ${jsPath}");`,
        quality: this.QUALITY.GOOD,
        description: 'JavaScript executor for shadow DOM element',
        isShadowDOM: true
      });
    }

    return locators;
  },

  // Helper: Infer ARIA role from tag/type
  inferRole(tagName, type) {
    const roleMap = {
      'button': 'button',
      'a': 'link',
      'img': 'img',
      'input': {
        'button': 'button',
        'submit': 'button',
        'checkbox': 'checkbox',
        'radio': 'radio',
        'text': 'textbox',
        'email': 'textbox',
        'password': 'textbox',
        'search': 'searchbox',
        'number': 'spinbutton'
      },
      'select': 'combobox',
      'textarea': 'textbox',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'article': 'article',
      'aside': 'complementary',
      'dialog': 'dialog',
      'form': 'form',
      'table': 'table',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading'
    };

    const tag = tagName.toLowerCase();
    if (tag === 'input' && type) {
      return roleMap.input[type] || 'textbox';
    }
    return roleMap[tag] || null;
  },

  // Generate CSS selector
  generateCssSelector(elementData) {
    const { tagName, id, className, type, value, attributes } = elementData;
    let selector = tagName.toLowerCase();

    if (id) {
      return `#${this.escapeCssId(id)}`;
    }

    if (className) {
      const classes = className.split(' ').filter(c => c && !c.includes(':'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).map(c => this.escapeCssClass(c)).join('.');
      }
    }

    // Add distinguishing attributes
    if (attributes) {
      if (attributes.type) selector += `[type="${attributes.type}"]`;
      // For submit/button/reset inputs, add value attribute for specificity
      if (value && ['submit', 'button', 'reset'].includes(type)) {
        selector += `[value="${this.escapeString(value)}"]`;
      }
      if (attributes.name) selector += `[name="${attributes.name}"]`;
    }

    return selector;
  },

  // Generate XPath
  generateXPath(elementData) {
    const { tagName, id, text, type, value, attributes, isSVG, svgTagName } = elementData;
    const tag = tagName.toLowerCase();

    // For SVG elements, use local-name() syntax
    // SVG elements are in a different namespace and require special XPath handling
    if (isSVG || this.currentIsSVG) {
      return this.generateSVGXPath(elementData);
    }

    if (id) {
      return `//${tag}[@id='${id}']`;
    }

    // For submit/button/reset inputs, use type and value for specificity
    if (tag === 'input' && ['submit', 'button', 'reset'].includes(type) && value) {
      return `//${tag}[@type='${type}' and @value='${this.escapeString(value)}']`;
    }

    if (text && text.length < 50) {
      return `//${tag}[contains(text(),'${this.escapeString(text.trim().substring(0, 30))}')]`;
    }

    // For inputs, include type attribute for better specificity
    if (tag === 'input' && type) {
      if (attributes?.name) {
        return `//${tag}[@type='${type}' and @name='${attributes.name}']`;
      }
      return `//${tag}[@type='${type}']`;
    }

    if (attributes?.name) {
      return `//${tag}[@name='${attributes.name}']`;
    }

    return `//${tag}`;
  },

  // Generate SVG-specific XPath using local-name()
  // SVG elements are in XML namespace and require local-name() function
  generateSVGXPath(elementData) {
    const { tagName, id, className, attributes } = elementData;
    const tag = tagName.toLowerCase();

    // Use local-name() for SVG elements
    // Syntax: //*[local-name()='svg'] or //*[name()='svg']

    if (id) {
      return `//*[local-name()='${tag}' and @id='${id}']`;
    }

    if (className) {
      const firstClass = className.split(' ').filter(c => c && !c.includes(':'))[0];
      if (firstClass) {
        return `//*[local-name()='${tag}' and contains(@class,'${firstClass}')]`;
      }
    }

    // For SVG path elements, use 'd' attribute if available
    if (tag === 'path' && attributes?.d) {
      const dAttr = attributes.d.substring(0, 30); // Use first 30 chars of path data
      return `//*[local-name()='path' and starts-with(@d,'${this.escapeString(dAttr)}')]`;
    }

    // For elements with data-icon attribute (common in icon libraries)
    if (attributes?.['data-icon']) {
      return `//*[local-name()='${tag}' and @data-icon='${attributes['data-icon']}']`;
    }

    // For elements with viewBox (usually the main svg element)
    if (tag === 'svg' && attributes?.viewBox) {
      return `//*[local-name()='svg' and @viewBox='${attributes.viewBox}']`;
    }

    // Generic SVG element XPath
    return `//*[local-name()='${tag}']`;
  },

  // =============================================
  // PLAYWRIGHT SEMANTIC LOCATOR FORMATTERS
  // Language-specific implementations
  // =============================================

  // Format getByRole without level option (for headings shown without level)
  formatPlaywrightGetByRoleNoLevel(role, nameValue) {
    const escapedName = nameValue ? this.escapeString(nameValue) : null;

    switch (this.language) {
      case 'javascript':
        if (escapedName) {
          return `page.getByRole('${role}', { name: '${escapedName}', exact: true })`;
        }
        return `page.getByRole('${role}')`;

      case 'python':
        if (escapedName) {
          return `page.get_by_role("${role}", name="${escapedName}", exact=True)`;
        }
        return `page.get_by_role("${role}")`;

      case 'java':
        const javaRole = this.JAVA_ARIA_ROLES[role] || `AriaRole.${role.toUpperCase()}`;
        if (escapedName) {
          return `page.getByRole(${javaRole}, new Page.GetByRoleOptions().setName("${escapedName}").setExact(true))`;
        }
        return `page.getByRole(${javaRole})`;

      default:
        return `page.getByRole('${role}')`;
    }
  },

  // Format chained locator (e.g., page.locator('#id').getByRole(...))
  formatChainedLocator(parentSelector, role, nameValue) {
    const escapedName = nameValue ? this.escapeString(nameValue) : null;
    const escapedSelector = parentSelector.replace(/'/g, "\\'");

    switch (this.language) {
      case 'javascript':
        if (escapedName) {
          return `page.locator('${escapedSelector}').getByRole('${role}', { name: '${escapedName}', exact: true })`;
        }
        return `page.locator('${escapedSelector}').getByRole('${role}')`;

      case 'python':
        const pySelector = parentSelector.replace(/"/g, '\\"');
        if (escapedName) {
          return `page.locator("${pySelector}").get_by_role("${role}", name="${escapedName}", exact=True)`;
        }
        return `page.locator("${pySelector}").get_by_role("${role}")`;

      case 'java':
        const javaRole = this.JAVA_ARIA_ROLES[role] || `AriaRole.${role.toUpperCase()}`;
        const javaSelector = parentSelector.replace(/"/g, '\\"');
        if (escapedName) {
          return `page.locator("${javaSelector}").getByRole(${javaRole}, new Locator.GetByRoleOptions().setName("${escapedName}").setExact(true))`;
        }
        return `page.locator("${javaSelector}").getByRole(${javaRole})`;

      default:
        return `page.locator('${escapedSelector}').getByRole('${role}')`;
    }
  },

  // Format chained locator with getByLabel (e.g., page.locator('#parent').getByLabel('...'))
  formatChainedLocatorWithLabel(parentSelector, labelText) {
    const escapedLabel = this.escapeString(labelText);
    const escapedSelector = parentSelector.replace(/'/g, "\\'");

    switch (this.language) {
      case 'javascript':
        return `page.locator('${escapedSelector}').getByLabel('${escapedLabel}', { exact: true })`;

      case 'python':
        const pySelector = parentSelector.replace(/"/g, '\\"');
        return `page.locator("${pySelector}").get_by_label("${escapedLabel}", exact=True)`;

      case 'java':
        const javaSelector = parentSelector.replace(/"/g, '\\"');
        return `page.locator("${javaSelector}").getByLabel("${escapedLabel}", new Locator.GetByLabelOptions().setExact(true))`;

      default:
        return `page.locator('${escapedSelector}').getByLabel('${escapedLabel}')`;
    }
  },

  // Format CSS :has-text() pseudo-selector
  formatCssHasText(tag, text) {
    const escapedText = this.escapeString(text);

    switch (this.language) {
      case 'javascript':
        return `page.locator('${tag}:has-text("${escapedText}")')`;
      case 'python':
        return `page.locator("${tag}:has-text('${escapedText}')")`;
      case 'java':
        return `page.locator("${tag}:has-text(\\"${escapedText}\\")")`;
      default:
        return `page.locator('${tag}:has-text("${escapedText}")')`;
    }
  },

  // Format XPath with normalize-space() for text matching
  formatXPathNormalizeSpace(tag, text) {
    const escapedText = this.escapeString(text).substring(0, 40);
    const xpath = `//${tag}[normalize-space()='${escapedText}']`;
    return this.formatPlaywrightXPath(xpath);
  },

  // Generate absolute XPath from root to element
  generateAbsoluteXPath(elementData) {
    const { tagName, xpath, isSVG, svgTagName } = elementData;

    // For SVG elements, use local-name() syntax
    if (isSVG || svgTagName) {
      const tag = (svgTagName || tagName).toLowerCase();
      return `//*[local-name()='${tag}']`;
    }

    // If we have an xpath from the element, try to use/convert it
    if (xpath) {
      // If it's already absolute (starts with /html or /body), return it
      if (xpath.startsWith('/html') || xpath.startsWith('/body')) {
        return xpath;
      }
    }

    // Build a simple absolute path based on tag hierarchy
    // This is a simplified version - actual implementation would need DOM traversal
    const tag = tagName.toLowerCase();
    return `/html/body//${tag}`;
  },

  // Generate position-based XPath using position()
  generatePositionXPath(elementData) {
    const { tagName, text, className, id, isSVG, svgTagName } = elementData;
    const tag = tagName.toLowerCase();

    // For SVG elements, use local-name() syntax
    if (isSVG || svgTagName) {
      const svgTag = (svgTagName || tag).toLowerCase();
      if (id) {
        return `//*[local-name()='${svgTag}' and @id='${id}'][position()=1]`;
      }
      if (className) {
        const firstClass = className.split(' ').filter(c => c && !c.includes(':'))[0];
        if (firstClass) {
          return `//*[local-name()='${svgTag}' and contains(@class,'${firstClass}')][position()=1]`;
        }
      }
      return `//*[local-name()='${svgTag}'][position()=1]`;
    }

    // Build position-based XPath
    if (text && text.trim().length > 0 && text.trim().length < 50) {
      const cleanText = this.escapeString(text.trim().substring(0, 30));
      return `//${tag}[contains(text(),'${cleanText}')][position()=1]`;
    }

    if (id) {
      return `//${tag}[@id='${id}'][position()=1]`;
    }

    if (className) {
      const firstClass = className.split(' ').filter(c => c && !c.includes(':'))[0];
      if (firstClass) {
        return `//${tag}[contains(@class,'${firstClass}')][position()=1]`;
      }
    }

    return `//${tag}[position()=1]`;
  },

  formatPlaywrightGetByRole(role, nameValue, tagName, checkedState) {
    const escapedName = nameValue ? this.escapeString(nameValue) : null;

    // Extract heading level from tagName (h1 -> 1, h2 -> 2, etc.)
    let headingLevel = null;
    if (role === 'heading' && tagName) {
      const match = tagName.toLowerCase().match(/^h([1-6])$/);
      if (match) {
        headingLevel = parseInt(match[1], 10);
      }
    }

    // Check if this is a checkbox or radio with checked state
    const isCheckableRole = role === 'checkbox' || role === 'radio';
    const hasCheckedState = isCheckableRole && checkedState !== undefined;

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        if (role === 'heading' && headingLevel) {
          if (escapedName) {
            return `page.getByRole('heading', { name: '${escapedName}', exact: true, level: ${headingLevel} })`;
          }
          return `page.getByRole('heading', { level: ${headingLevel} })`;
        }
        if (hasCheckedState && escapedName) {
          return `page.getByRole('${role}', { name: '${escapedName}', exact: true, checked: ${checkedState} })`;
        }
        if (escapedName) {
          return `page.getByRole('${role}', { name: '${escapedName}', exact: true })`;
        }
        return `page.getByRole('${role}')`;

      case 'python':
        if (role === 'heading' && headingLevel) {
          if (escapedName) {
            return `page.get_by_role("heading", name="${escapedName}", exact=True, level=${headingLevel})`;
          }
          return `page.get_by_role("heading", level=${headingLevel})`;
        }
        if (hasCheckedState && escapedName) {
          return `page.get_by_role("${role}", name="${escapedName}", exact=True, checked=${checkedState ? 'True' : 'False'})`;
        }
        if (escapedName) {
          return `page.get_by_role("${role}", name="${escapedName}", exact=True)`;
        }
        return `page.get_by_role("${role}")`;

      case 'java':
        const javaRole = this.JAVA_ARIA_ROLES[role] || `AriaRole.${role.toUpperCase()}`;
        if (role === 'heading' && headingLevel) {
          if (escapedName) {
            return `page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("${escapedName}").setExact(true).setLevel(${headingLevel}))`;
          }
          return `page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setLevel(${headingLevel}))`;
        }
        if (hasCheckedState && escapedName) {
          return `page.getByRole(${javaRole}, new Page.GetByRoleOptions().setName("${escapedName}").setExact(true).setChecked(${checkedState}))`;
        }
        if (escapedName) {
          return `page.getByRole(${javaRole}, new Page.GetByRoleOptions().setName("${escapedName}").setExact(true))`;
        }
        return `page.getByRole(${javaRole})`;

      default:
        return `page.getByRole('${role}')`;
    }
  },

  formatPlaywrightGetByLabel(label) {
    const escapedLabel = this.escapeString(label);

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return `page.getByLabel('${escapedLabel}', { exact: true })`;
      case 'python':
        return `page.get_by_label("${escapedLabel}", exact=True)`;
      case 'java':
        return `page.getByLabel("${escapedLabel}", new Page.GetByLabelOptions().setExact(true))`;
      default:
        return `page.getByLabel('${escapedLabel}')`;
    }
  },

  formatPlaywrightGetByPlaceholder(placeholder) {
    const escapedPlaceholder = this.escapeString(placeholder);

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return `page.getByPlaceholder('${escapedPlaceholder}', { exact: true })`;
      case 'python':
        return `page.get_by_placeholder("${escapedPlaceholder}", exact=True)`;
      case 'java':
        return `page.getByPlaceholder("${escapedPlaceholder}", new Page.GetByPlaceholderOptions().setExact(true))`;
      default:
        return `page.getByPlaceholder('${escapedPlaceholder}')`;
    }
  },

  formatPlaywrightGetByText(text, isPartialMatch = false) {
    const escapedText = this.escapeString(text);

    // If text was truncated, use partial match (no exact option) so locator actually works
    // For short text, use exact: true to avoid false matches
    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return isPartialMatch
          ? `page.getByText('${escapedText}')`
          : `page.getByText('${escapedText}', { exact: true })`;
      case 'python':
        return isPartialMatch
          ? `page.get_by_text("${escapedText}")`
          : `page.get_by_text("${escapedText}", exact=True)`;
      case 'java':
        return isPartialMatch
          ? `page.getByText("${escapedText}")`
          : `page.getByText("${escapedText}", new Page.GetByTextOptions().setExact(true))`;
      default:
        return isPartialMatch
          ? `page.getByText('${escapedText}')`
          : `page.getByText('${escapedText}', { exact: true })`;
    }
  },

  formatPlaywrightGetByTestId(testId) {
    const escapedTestId = this.escapeString(testId);

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return `page.getByTestId('${escapedTestId}')`;
      case 'python':
        return `page.get_by_test_id("${escapedTestId}")`;
      case 'java':
        return `page.getByTestId("${escapedTestId}")`;
      default:
        return `page.getByTestId('${escapedTestId}')`;
    }
  },

  formatPlaywrightGetByAltText(altText) {
    const escapedAltText = this.escapeString(altText);

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return `page.getByAltText('${escapedAltText}', { exact: true })`;
      case 'python':
        return `page.get_by_alt_text("${escapedAltText}", exact=True)`;
      case 'java':
        return `page.getByAltText("${escapedAltText}", new Page.GetByAltTextOptions().setExact(true))`;
      default:
        return `page.getByAltText('${escapedAltText}')`;
    }
  },

  formatPlaywrightGetByTitle(title) {
    const escapedTitle = this.escapeString(title);

    switch (this.language) {
      case 'javascript': // Handles both JS and TS
        return `page.getByTitle('${escapedTitle}', { exact: true })`;
      case 'python':
        return `page.get_by_title("${escapedTitle}", exact=True)`;
      case 'java':
        return `page.getByTitle("${escapedTitle}", new Page.GetByTitleOptions().setExact(true))`;
      default:
        return `page.getByTitle('${escapedTitle}')`;
    }
  },

  // =============================================
  // PLAYWRIGHT LOCATOR FORMATTERS (CSS/XPath/ID)
  // =============================================

  formatIdLocator(id) {
    if (this.framework === 'playwright') {
      return this.formatPlaywrightLocator(`#${this.escapeCssId(id)}`);
    } else {
      return this.formatSeleniumLocator('id', id);
    }
  },

  formatNameLocator(name) {
    if (this.framework === 'playwright') {
      return this.formatPlaywrightLocator(`[name="${name}"]`);
    } else {
      return this.formatSeleniumLocator('name', name);
    }
  },

  formatCssLocator(selector) {
    if (this.framework === 'playwright') {
      return this.formatPlaywrightLocator(selector);
    } else {
      return this.formatSeleniumLocator('css', selector);
    }
  },

  formatXPathLocator(xpath) {
    if (this.framework === 'playwright') {
      return this.formatPlaywrightXPath(xpath);
    } else {
      return this.formatSeleniumLocator('xpath', xpath);
    }
  },

  formatLinkTextLocator(text) {
    if (this.framework === 'playwright') {
      return this.formatPlaywrightGetByRole('link', text);
    } else {
      return this.formatSeleniumLocator('linkText', text);
    }
  },

  formatPlaywrightLocator(selector) {
    switch (this.language) {
      case 'javascript': // Handles both JS and TS - use backticks for selectors with special chars
        return 'page.locator(`' + selector + '`)';
      case 'python':
        return `page.locator("${selector.replace(/"/g, '\\"')}")`;
      case 'java':
        return `page.locator("${selector.replace(/"/g, '\\"')}")`;
      default:
        return 'page.locator(`' + selector + '`)';
    }
  },

  formatPlaywrightXPath(xpath) {
    switch (this.language) {
      case 'javascript': // Handles both JS and TS - use backticks for XPath with quotes
        return 'page.locator(`xpath=' + xpath + '`)';
      case 'python':
        return `page.locator("xpath=${xpath}")`;
      case 'java':
        return `page.locator("xpath=${xpath}")`;
      default:
        return 'page.locator(`xpath=' + xpath + '`)';
    }
  },

  // =============================================
  // SELENIUM LOCATOR FORMATTERS
  // =============================================

  formatSeleniumLocator(by, value) {
    // Only escape double quotes since Selenium uses double quotes for strings
    // Single quotes are safe inside double-quoted strings
    const escapedValue = value.replace(/"/g, '\\"');

    const byMap = {
      python: {
        id: `driver.find_element(By.ID, "${escapedValue}")`,
        name: `driver.find_element(By.NAME, "${escapedValue}")`,
        css: `driver.find_element(By.CSS_SELECTOR, "${escapedValue}")`,
        xpath: `driver.find_element(By.XPATH, "${escapedValue}")`,
        linkText: `driver.find_element(By.LINK_TEXT, "${escapedValue}")`,
        className: `driver.find_element(By.CLASS_NAME, "${escapedValue}")`,
        tagName: `driver.find_element(By.TAG_NAME, "${escapedValue}")`
      },
      java: {
        id: `driver.findElement(By.id("${escapedValue}"))`,
        name: `driver.findElement(By.name("${escapedValue}"))`,
        css: `driver.findElement(By.cssSelector("${escapedValue}"))`,
        xpath: `driver.findElement(By.xpath("${escapedValue}"))`,
        linkText: `driver.findElement(By.linkText("${escapedValue}"))`,
        className: `driver.findElement(By.className("${escapedValue}"))`,
        tagName: `driver.findElement(By.tagName("${escapedValue}"))`
      }
    };

    return byMap[this.language]?.[by] || byMap.java[by];
  },

  // =============================================
  // CYPRESS LOCATOR FORMATTERS
  // =============================================

  // Format cy.get() with optional shadow DOM support
  formatCypressGet(selector, includeShadowDom = false) {
    const escapedSelector = selector.replace(/'/g, "\\'");
    if (includeShadowDom) {
      return `cy.get('${escapedSelector}', { includeShadowDom: true })`;
    }
    return `cy.get('${escapedSelector}')`;
  },

  // Format cy.contains() with optional tag selector
  formatCypressContains(tag, text, includeShadowDom = false) {
    const escapedText = this.escapeString(text);
    let options = includeShadowDom ? ', { includeShadowDom: true }' : '';

    if (tag) {
      return `cy.contains('${tag}', '${escapedText}'${options})`;
    }
    return `cy.contains('${escapedText}'${options.replace(', ', '')})`;
  },

  // Format Cypress iframe access (requires cypress-iframe plugin)
  formatCypressIframe(selector) {
    return `cy.frameLoaded('${selector}')`;
  },

  // Get Cypress frame prefix for iframe handling
  getCypressFramePrefix() {
    if (!this.currentFramePath || this.currentFramePath.length === 0) {
      return '';
    }

    // Cypress uses cy.iframe() from cypress-iframe plugin
    let prefix = '';
    for (const frame of this.currentFramePath) {
      const selector = frame.selector;
      prefix += `cy.iframe('${selector}').find`;
    }
    return prefix;
  },

  // Escape helpers
  escapeString(str) {
    // Escape both single and double quotes, plus newlines
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
  },

  escapeCssId(id) {
    return id.replace(/([^\w-])/g, '\\$1');
  },

  escapeCssClass(cls) {
    return cls.replace(/([^\w-])/g, '\\$1');
  },

  // =============================================
  // FRAME/IFRAME HANDLING
  // =============================================

  // Generate Playwright frameLocator chain
  getPlaywrightFramePrefix() {
    if (!this.currentFramePath || this.currentFramePath.length === 0) {
      return '';
    }

    let prefix = '';
    for (const frame of this.currentFramePath) {
      // Build full selector with tag name for ID selectors (e.g., "iframe#pact2" instead of "#pact2")
      let selector = frame.selector;
      if (selector.startsWith('#') && frame.tagName) {
        selector = frame.tagName + selector;  // "iframe" + "#pact2" = "iframe#pact2"
      }

      switch (this.language) {
        case 'javascript':
          prefix += `frameLocator('${selector}').`;
          break;
        case 'python':
          prefix += `frame_locator("${selector}").`;
          break;
        case 'java':
          prefix += `frameLocator("${selector}").`;
          break;
        default:
          prefix += `frameLocator('${selector}').`;
      }
    }
    return prefix;
  },

  // Generate Selenium frame switch commands
  getSeleniumFrameSwitch() {
    if (!this.currentFramePath || this.currentFramePath.length === 0) {
      return '';
    }

    let commands = '';
    for (const frame of this.currentFramePath) {
      let frameRef;
      // Prefer id, then name, then selector
      if (frame.id) {
        frameRef = `"${frame.id}"`;
      } else if (frame.name) {
        frameRef = `"${frame.name}"`;
      } else {
        // Use findElement to locate frame
        const selector = frame.selector;
        if (this.language === 'python') {
          frameRef = `driver.find_element(By.CSS_SELECTOR, "${selector}")`;
        } else {
          frameRef = `driver.findElement(By.cssSelector("${selector}"))`;
        }
      }

      if (this.language === 'python') {
        commands += `driver.switch_to.frame(${frameRef})\n`;
      } else {
        commands += `driver.switchTo().frame(${frameRef});\n`;
      }
    }
    return commands;
  },

  // Check if element is inside a frame
  isInFrame() {
    return this.currentFramePath && this.currentFramePath.length > 0;
  },

  // Add frame prefix to Playwright locator
  addPlaywrightFramePrefix(locator) {
    if (!this.isInFrame()) return locator;

    const framePrefix = this.getPlaywrightFramePrefix();
    // Replace 'page.' with 'page.frameLocator(...).frameLocator(...).' etc
    // Handle both 'await page.' and 'page.' patterns
    if (locator.includes('await page.')) {
      return locator.replace('await page.', `await page.${framePrefix}`);
    } else {
      return locator.replace('page.', `page.${framePrefix}`);
    }
  },

  // For Selenium, we don't modify the locator - frame switch is shown separately
  addSeleniumFramePrefix(locator) {
    // Return locator unchanged - frame switch commands shown in element info
    return locator;
  },

  // Add frame context to any locator
  addFrameContext(locator) {
    if (this.framework === 'playwright') {
      return this.addPlaywrightFramePrefix(locator);
    } else if (this.framework === 'cypress') {
      return this.addCypressFramePrefix(locator);
    } else {
      // For Selenium, return unchanged - frame info shown in element info section
      return locator;
    }
  },

  // Add frame prefix to Cypress locator (requires cypress-iframe plugin)
  addCypressFramePrefix(locator) {
    if (!this.isInFrame()) return locator;

    // For Cypress with iframes, we need to use the cypress-iframe plugin
    // cy.get() becomes cy.iframe('#frame').find()
    const frames = this.currentFramePath;
    let prefix = '';
    for (const frame of frames) {
      prefix += `cy.iframe('${frame.selector}').find`;
    }

    // Replace cy.get or cy.contains with the iframe chain
    if (locator.startsWith('cy.get(')) {
      const selector = locator.replace('cy.get(', '').replace(')', '');
      return `${prefix}(${selector})`;
    } else if (locator.startsWith('cy.contains(')) {
      // For contains, we need a different approach
      return locator + ' // Note: Use within iframe context';
    }
    return locator;
  },

  // Get frame switch commands for display (used by renderer for element info)
  getFrameSwitchDisplay() {
    if (!this.isInFrame()) return null;
    if (this.framework === 'playwright') return null; // Playwright uses frameLocator in locator itself
    if (this.framework === 'cypress') return this.getCypressFrameSwitch(); // Cypress shows iframe plugin usage

    return this.getSeleniumFrameSwitch();
  },

  // Generate Cypress frame switch info
  getCypressFrameSwitch() {
    if (!this.currentFramePath || this.currentFramePath.length === 0) {
      return '';
    }

    let commands = '// Requires cypress-iframe plugin: npm install -D cypress-iframe\n';
    commands += "// Import in cypress/support/commands.js: import 'cypress-iframe'\n\n";

    for (const frame of this.currentFramePath) {
      const selector = frame.id ? `#${frame.id}` : frame.selector;
      commands += `cy.frameLoaded('${selector}')\n`;
      commands += `cy.iframe('${selector}').find('your-selector')\n`;
    }
    return commands;
  },

  // Get Playwright frame display info for banner
  getPlaywrightFrameDisplay() {
    if (!this.isInFrame()) return null;
    if (this.framework !== 'playwright') return null;

    const frames = this.currentFramePath;
    const frameInfo = frames[frames.length - 1]; // Get the innermost frame
    const frameId = frameInfo.id || frameInfo.name || '';
    const frameSelector = frameInfo.selector;

    return {
      type: 'info',
      title: 'Frame/iframe Detected!',
      frameId: frameId,
      frameSelector: frameSelector,
      message: `This element is inside a frame/iframe.${frameId ? ` ID: ${frameId}` : ''}`,
      autoHandling: 'All locators automatically updated with frameLocator()',
      note: 'Frame elements cannot be highlighted from parent context due to browser security. The locators are correct but test highlighting is limited.'
    };
  },

  // =============================================
  // SHADOW DOM HANDLING
  // =============================================

  // Check if element is inside shadow DOM
  isInShadowDOM() {
    return this.currentShadowPath && this.currentShadowPath.length > 0;
  },

  // Get shadow DOM info for display
  getShadowDOMInfo() {
    if (!this.isInShadowDOM()) return null;

    return {
      path: this.currentShadowPath,
      jsPath: this.currentJsPath,
      depth: this.currentShadowPath.length
    };
  },

  // Get shadow DOM display message
  getShadowDOMDisplay() {
    if (!this.isInShadowDOM()) return null;

    const shadowInfo = this.getShadowDOMInfo();
    const hostPath = shadowInfo.path.map(s => s.selector).join(' → ');

    if (this.framework === 'playwright') {
      return {
        type: 'info',
        title: 'Shadow DOM Detected',
        message: `This element is inside Shadow DOM. Playwright automatically pierces shadow DOM for CSS selectors and semantic locators (getByRole, getByText, etc.). XPath does not work with Shadow DOM.`,
        hostPath: hostPath
      };
    } else if (this.framework === 'cypress') {
      // Cypress - use includeShadowDom option
      return {
        type: 'info',
        title: 'Shadow DOM Detected',
        message: `This element is inside Shadow DOM. Cypress supports shadow DOM with the { includeShadowDom: true } option. All generated locators include this option automatically.`,
        hostPath: hostPath,
        example: `cy.get('your-selector', { includeShadowDom: true })`
      };
    } else {
      // Selenium - provide full executable code with proper casting
      let fullCode;
      if (this.language === 'python') {
        fullCode = `element = driver.execute_script("return ${shadowInfo.jsPath}")`;
      } else {
        // Java - include JavascriptExecutor casting
        fullCode = `JavascriptExecutor js = (JavascriptExecutor) driver;\nWebElement element = (WebElement) js.executeScript("return ${shadowInfo.jsPath}");`;
      }

      return {
        type: 'warning',
        title: 'Shadow DOM Detected',
        message: `This element is inside Shadow DOM. Standard CSS/XPath selectors cannot access Shadow DOM elements in Selenium. Use JavaScript Executor to access the element.`,
        hostPath: hostPath,
        jsPath: shadowInfo.jsPath,
        fullCode: fullCode
      };
    }
  },

  // =============================================
  // SVG ELEMENT HANDLING
  // =============================================

  // Check if element is an SVG element
  isSVGElement() {
    return this.currentIsSVG === true;
  },

  // Get SVG element info for display
  getSVGInfo() {
    if (!this.isSVGElement()) return null;

    return {
      tagName: this.currentSvgTagName,
      isSVG: true
    };
  },

  // Get SVG display message
  getSVGDisplay() {
    if (!this.isSVGElement()) return null;

    const svgTagName = this.currentSvgTagName || 'svg';

    if (this.framework === 'playwright') {
      return {
        type: 'info',
        title: 'SVG Element Detected',
        message: `This is an SVG element (<${svgTagName}>). Playwright CSS selectors work normally with SVG elements. For XPath, use the local-name() syntax shown below.`,
        tagName: svgTagName
      };
    } else if (this.framework === 'cypress') {
      // Cypress - CSS selectors work with SVG
      return {
        type: 'info',
        title: 'SVG Element Detected',
        message: `This is an SVG element (<${svgTagName}>). Cypress CSS selectors work normally with SVG elements. For XPath, use cypress-xpath plugin with local-name() syntax.`,
        tagName: svgTagName,
        example: `cy.get('svg ${svgTagName}') // or use cy.xpath with local-name()`
      };
    } else {
      // Selenium - SVG requires special XPath
      return {
        type: 'warning',
        title: 'SVG Element Detected',
        message: `This is an SVG element (<${svgTagName}>). SVG elements are in XML namespace and require special XPath syntax using local-name(). Standard XPath like //svg will NOT work.`,
        tagName: svgTagName,
        example: `//*[local-name()='${svgTagName}']`
      };
    }
  }
};

// Export for use in renderer
window.LocatorGenerator = LocatorGenerator;
