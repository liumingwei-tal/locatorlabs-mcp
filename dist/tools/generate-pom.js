"use strict";
/**
 * Generate POM Tool - Auto-generate Page Object Model classes
 *
 * @author Naveen AutomationLabs
 * @license MIT
 * @date 2025
 * @see https://github.com/naveenanimation20/locatorlabs-mcp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratePOMTool = void 0;
const MAX_ELEMENTS = 30;
const MAX_TEXT_LENGTH = 50;
class GeneratePOMTool {
    browserManager;
    constructor(browserManager) {
        this.browserManager = browserManager;
    }
    async execute(url, className, language = "typescript") {
        const page = await this.browserManager.navigateTo(url);
        const elements = await this.getPageElements(page);
        // Generate properties for each element
        const properties = elements.map((el) => ({
            propertyName: this.generatePropertyName(el),
            locator: this.getBestLocator(el),
            elementType: el.tagName,
            description: this.describeElement(el),
            // Add Selenium-specific locators
            seleniumLocator: this.getSeleniumLocator(el),
            id: el.id,
            name: el.name,
            xpath: this.getXPath(el),
            cssSelector: this.getCssSelector(el),
        }));
        // Remove duplicates by property name
        const uniqueProperties = this.deduplicateProperties(properties);
        // Generate code based on language
        let code;
        switch (language) {
            case "python":
                code = this.generatePythonPOM(className, uniqueProperties, url);
                break;
            case "javascript":
                code = this.generateJavaScriptPOM(className, uniqueProperties, url);
                break;
            case "java-selenium":
                code = this.generateJavaSeleniumPOM(className, uniqueProperties, url);
                break;
            case "python-selenium":
                code = this.generatePythonSeleniumPOM(className, uniqueProperties, url);
                break;
            case "csharp-selenium":
                code = this.generateCSharpSeleniumPOM(className, uniqueProperties, url);
                break;
            default:
                code = this.generateTypeScriptPOM(className, uniqueProperties, url);
        }
        return {
            url,
            className,
            language,
            elementsFound: uniqueProperties.length,
            code,
        };
    }
    async getPageElements(page) {
        const elements = await page.evaluate((maxText) => {
            const selectors = [
                "button",
                "a[href]",
                "input",
                "select",
                "textarea",
                "[role='button']",
                "[role='link']",
                "[role='textbox']",
                "[role='checkbox']",
                "[role='radio']",
            ];
            const results = [];
            const seen = new Set();
            selectors.forEach((sel) => {
                document.querySelectorAll(sel).forEach((el) => {
                    if (seen.has(el))
                        return;
                    seen.add(el);
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (rect.width === 0 ||
                        rect.height === 0 ||
                        style.display === "none" ||
                        style.visibility === "hidden") {
                        return;
                    }
                    const htmlEl = el;
                    const inputEl = el;
                    results.push({
                        tagName: el.tagName.toLowerCase(),
                        id: el.id || undefined,
                        name: inputEl.name || undefined,
                        className: el.className?.toString() || undefined,
                        type: inputEl.type || undefined,
                        placeholder: inputEl.placeholder || undefined,
                        text: htmlEl.innerText?.trim().substring(0, maxText) || undefined,
                        ariaLabel: el.getAttribute("aria-label") || undefined,
                        role: el.getAttribute("role") || undefined,
                        testId: el.getAttribute("data-testid") ||
                            el.getAttribute("data-test-id") ||
                            el.getAttribute("data-cy") ||
                            undefined,
                    });
                });
            });
            return results;
        }, MAX_TEXT_LENGTH);
        return elements.slice(0, MAX_ELEMENTS);
    }
    generatePropertyName(el) {
        // Priority: testId > id > name > ariaLabel > text > placeholder > generic
        let baseName = el.testId ||
            el.id ||
            el.name ||
            el.ariaLabel ||
            el.text ||
            el.placeholder ||
            el.tagName;
        // Clean the name
        baseName = baseName
            .replace(/[^a-zA-Z0-9\s]/g, " ")
            .trim()
            .replace(/\s+/g, " ");
        // Convert to camelCase
        const words = baseName.split(" ").slice(0, 4);
        const camelCase = words
            .map((word, index) => {
            const lower = word.toLowerCase();
            return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
            .join("");
        // Add suffix based on element type
        const suffix = this.getElementSuffix(el);
        const name = camelCase + suffix;
        return name || "element";
    }
    getElementSuffix(el) {
        const type = el.type?.toLowerCase();
        const tag = el.tagName.toLowerCase();
        if (tag === "button" || type === "submit" || type === "button")
            return "Button";
        if (tag === "a")
            return "Link";
        if (tag === "select")
            return "Select";
        if (tag === "textarea")
            return "Textarea";
        if (type === "checkbox")
            return "Checkbox";
        if (type === "radio")
            return "Radio";
        if (type === "password")
            return "Input";
        if (tag === "input")
            return "Input";
        return "";
    }
    getBestLocator(el) {
        // Priority order for Playwright best practices
        if (el.testId) {
            return `getByTestId('${this.escape(el.testId)}')`;
        }
        const role = el.role || this.inferRole(el);
        if (role && (el.ariaLabel || el.text)) {
            const name = el.ariaLabel || el.text;
            return `getByRole('${role}', { name: '${this.escape(name)}' })`;
        }
        if (el.ariaLabel) {
            return `getByLabel('${this.escape(el.ariaLabel)}')`;
        }
        if (el.placeholder) {
            return `getByPlaceholder('${this.escape(el.placeholder)}')`;
        }
        if (el.text && !["input", "textarea"].includes(el.tagName)) {
            return `getByText('${this.escape(el.text)}')`;
        }
        if (el.id) {
            return `locator('#${el.id}')`;
        }
        if (el.name) {
            return `locator('[name="${el.name}"]')`;
        }
        return `locator('${el.tagName}')`;
    }
    inferRole(el) {
        const tag = el.tagName.toLowerCase();
        const type = el.type?.toLowerCase();
        if (tag === "button" || type === "submit" || type === "button")
            return "button";
        if (tag === "a")
            return "link";
        if (tag === "select")
            return "combobox";
        if (type === "checkbox")
            return "checkbox";
        if (type === "radio")
            return "radio";
        if (tag === "input" || tag === "textarea")
            return "textbox";
        return null;
    }
    describeElement(el) {
        const parts = [];
        if (el.text)
            parts.push(`"${el.text}"`);
        if (el.placeholder)
            parts.push(`placeholder: ${el.placeholder}`);
        if (el.type)
            parts.push(`type: ${el.type}`);
        return parts.join(", ") || el.tagName;
    }
    deduplicateProperties(properties) {
        const seen = new Map();
        return properties.map((prop) => {
            const count = seen.get(prop.propertyName) || 0;
            seen.set(prop.propertyName, count + 1);
            if (count > 0) {
                return { ...prop, propertyName: `${prop.propertyName}${count + 1}` };
            }
            return prop;
        });
    }
    escape(str) {
        return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").substring(0, MAX_TEXT_LENGTH);
    }
    generateTypeScriptPOM(className, properties, url) {
        const propDeclarations = properties
            .map((p) => `  readonly ${p.propertyName}: Locator; // ${p.description}`)
            .join("\n");
        const propInitializations = properties
            .map((p) => `    this.${p.propertyName} = page.${p.locator};`)
            .join("\n");
        const actions = this.generateTypeScriptActions(properties);
        return `import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for: ${url}
 * Generated by LocatorLabs MCP
 * Elements: ${properties.length}
 */
export class ${className} {
  readonly page: Page;
${propDeclarations}

  constructor(page: Page) {
    this.page = page;
${propInitializations}
  }

  /**
   * Navigate to this page
   */
  async navigate(): Promise<void> {
    await this.page.goto('${url}');
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

${actions}
}
`;
    }
    generateJavaScriptPOM(className, properties, url) {
        const propInitializations = properties
            .map((p) => `    this.${p.propertyName} = page.${p.locator}; // ${p.description}`)
            .join("\n");
        const actions = this.generateJavaScriptActions(properties);
        return `const { expect } = require('@playwright/test');

/**
 * Page Object Model for: ${url}
 * Generated by LocatorLabs MCP
 * Elements: ${properties.length}
 */
class ${className} {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
${propInitializations}
  }

  /**
   * Navigate to this page
   */
  async navigate() {
    await this.page.goto('${url}');
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

${actions}
}

module.exports = { ${className} };
`;
    }
    generatePythonPOM(className, properties, url) {
        const propInitializations = properties
            .map((p) => {
            const pyLocator = this.toPythonLocator(p.locator);
            const pyName = this.toSnakeCase(p.propertyName);
            return `        self.${pyName} = page.${pyLocator}  # ${p.description}`;
        })
            .join("\n");
        const actions = this.generatePythonActions(properties);
        return `"""
Page Object Model for: ${url}
Generated by LocatorLabs MCP
Elements: ${properties.length}
"""
from playwright.sync_api import Page, expect


class ${className}:
    """Page Object for ${className}"""

    def __init__(self, page: Page) -> None:
        self.page = page
${propInitializations}

    def navigate(self) -> None:
        """Navigate to this page"""
        self.page.goto('${url}')

    def wait_for_page_load(self) -> None:
        """Wait for page to be fully loaded"""
        self.page.wait_for_load_state('networkidle')

${actions}
`;
    }
    generateTypeScriptActions(properties) {
        const actions = [];
        // Find form inputs and generate fill methods
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => `${p.propertyName}: string`).join(", ");
            const fills = inputs.map((p) => `    await this.${p.propertyName}.fill(${p.propertyName});`).join("\n");
            actions.push(`  /**
   * Fill all form fields
   */
  async fillForm(${params}): Promise<void> {
${fills}
  }`);
        }
        // Find submit button
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login") ||
            p.propertyName.toLowerCase().includes("signup"));
        if (submitBtn) {
            actions.push(`  /**
   * Click the submit button
   */
  async submit(): Promise<void> {
    await this.${submitBtn.propertyName}.click();
  }`);
        }
        return actions.join("\n\n");
    }
    generateJavaScriptActions(properties) {
        const actions = [];
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => p.propertyName).join(", ");
            const fills = inputs.map((p) => `    await this.${p.propertyName}.fill(${p.propertyName});`).join("\n");
            actions.push(`  /**
   * Fill all form fields
   */
  async fillForm(${params}) {
${fills}
  }`);
        }
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login"));
        if (submitBtn) {
            actions.push(`  /**
   * Click the submit button
   */
  async submit() {
    await this.${submitBtn.propertyName}.click();
  }`);
        }
        return actions.join("\n\n");
    }
    generatePythonActions(properties) {
        const actions = [];
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => `${this.toSnakeCase(p.propertyName)}: str`).join(", ");
            const fills = inputs
                .map((p) => `        self.${this.toSnakeCase(p.propertyName)}.fill(${this.toSnakeCase(p.propertyName)})`)
                .join("\n");
            actions.push(`    def fill_form(self, ${params}) -> None:
        """Fill all form fields"""
${fills}`);
        }
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login"));
        if (submitBtn) {
            actions.push(`    def submit(self) -> None:
        """Click the submit button"""
        self.${this.toSnakeCase(submitBtn.propertyName)}.click()`);
        }
        return actions.join("\n\n");
    }
    toPythonLocator(locator) {
        return locator
            .replace(/getByRole/g, "get_by_role")
            .replace(/getByText/g, "get_by_text")
            .replace(/getByTestId/g, "get_by_test_id")
            .replace(/getByPlaceholder/g, "get_by_placeholder")
            .replace(/getByLabel/g, "get_by_label");
    }
    toSnakeCase(str) {
        return str
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
    }
    getSeleniumLocator(el) {
        if (el.id)
            return `By.id("${el.id}")`;
        if (el.name)
            return `By.name("${el.name}")`;
        return `By.cssSelector("${el.tagName}")`;
    }
    getXPath(el) {
        if (el.id)
            return `//*[@id="${el.id}"]`;
        if (el.name)
            return `//*[@name="${el.name}"]`;
        return `//${el.tagName}`;
    }
    getCssSelector(el) {
        if (el.id)
            return `#${el.id}`;
        if (el.className) {
            const firstClass = el.className.split(" ")[0];
            return `${el.tagName}.${firstClass}`;
        }
        return el.tagName;
    }
    generateJavaSeleniumPOM(className, properties, url) {
        const fields = properties
            .map((p) => {
            const locator = p.id
                ? `@FindBy(id = "${p.id}")`
                : p.name
                    ? `@FindBy(name = "${p.name}")`
                    : `@FindBy(css = "${p.cssSelector || p.elementType}")`;
            return `    ${locator}\n    private WebElement ${p.propertyName}; // ${p.description}`;
        })
            .join("\n\n");
        const getters = properties
            .map((p) => `    public WebElement get${this.capitalize(p.propertyName)}() {\n        return ${p.propertyName};\n    }`)
            .join("\n\n");
        const actions = this.generateJavaSeleniumActions(properties);
        return `package pages;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

/**
 * Page Object Model for: ${url}
 * Generated by LocatorLabs MCP
 * Elements: ${properties.length}
 */
public class ${className} {

    private WebDriver driver;

${fields}

    public ${className}(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }

    /**
     * Navigate to this page
     */
    public void navigate() {
        driver.get("${url}");
    }

${getters}

${actions}
}
`;
    }
    generatePythonSeleniumPOM(className, properties, url) {
        const locators = properties
            .map((p) => {
            const snakeName = this.toSnakeCase(p.propertyName).toUpperCase();
            if (p.id)
                return `    ${snakeName} = (By.ID, "${p.id}")  # ${p.description}`;
            if (p.name)
                return `    ${snakeName} = (By.NAME, "${p.name}")  # ${p.description}`;
            return `    ${snakeName} = (By.CSS_SELECTOR, "${p.cssSelector || p.elementType}")  # ${p.description}`;
        })
            .join("\n");
        const methods = properties
            .map((p) => {
            const snakeName = this.toSnakeCase(p.propertyName);
            const locatorName = snakeName.toUpperCase();
            return `    def get_${snakeName}(self):\n        return self.driver.find_element(*self.${locatorName})`;
        })
            .join("\n\n");
        const actions = this.generatePythonSeleniumActions(properties);
        return `"""
Page Object Model for: ${url}
Generated by LocatorLabs MCP
Elements: ${properties.length}
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class ${className}:
    """Page Object for ${className}"""

    URL = "${url}"

    # Locators
${locators}

    def __init__(self, driver: WebDriver) -> None:
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    def navigate(self) -> None:
        """Navigate to this page"""
        self.driver.get(self.URL)

${methods}

${actions}
`;
    }
    generateCSharpSeleniumPOM(className, properties, url) {
        const fields = properties
            .map((p) => {
            const locator = p.id
                ? `[FindsBy(How = How.Id, Using = "${p.id}")]`
                : p.name
                    ? `[FindsBy(How = How.Name, Using = "${p.name}")]`
                    : `[FindsBy(How = How.CssSelector, Using = "${p.cssSelector || p.elementType}")]`;
            return `        ${locator}\n        private IWebElement ${this.capitalize(p.propertyName)}; // ${p.description}`;
        })
            .join("\n\n");
        const getters = properties
            .map((p) => `        public IWebElement Get${this.capitalize(p.propertyName)}() => ${this.capitalize(p.propertyName)};`)
            .join("\n\n");
        const actions = this.generateCSharpSeleniumActions(properties);
        return `using OpenQA.Selenium;
using OpenQA.Selenium.Support.PageObjects;
using OpenQA.Selenium.Support.UI;

namespace Pages
{
    /// <summary>
    /// Page Object Model for: ${url}
    /// Generated by LocatorLabs MCP
    /// Elements: ${properties.length}
    /// </summary>
    public class ${className}
    {
        private readonly IWebDriver _driver;
        private readonly WebDriverWait _wait;

${fields}

        public ${className}(IWebDriver driver)
        {
            _driver = driver;
            _wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            PageFactory.InitElements(driver, this);
        }

        /// <summary>
        /// Navigate to this page
        /// </summary>
        public void Navigate()
        {
            _driver.Navigate().GoToUrl("${url}");
        }

${getters}

${actions}
    }
}
`;
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    generateJavaSeleniumActions(properties) {
        const actions = [];
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => `String ${p.propertyName}`).join(", ");
            const fills = inputs.map((p) => `        ${p.propertyName}.sendKeys(${p.propertyName});`).join("\n");
            actions.push(`    /**
     * Fill all form fields
     */
    public void fillForm(${params}) {
${fills}
    }`);
        }
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login") ||
            p.propertyName.toLowerCase().includes("button"));
        if (submitBtn) {
            actions.push(`    /**
     * Click submit button
     */
    public void submit() {
        ${submitBtn.propertyName}.click();
    }`);
        }
        return actions.join("\n\n");
    }
    generatePythonSeleniumActions(properties) {
        const actions = [];
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => `${this.toSnakeCase(p.propertyName)}: str`).join(", ");
            const fills = inputs
                .map((p) => `        self.get_${this.toSnakeCase(p.propertyName)}().send_keys(${this.toSnakeCase(p.propertyName)})`)
                .join("\n");
            actions.push(`    def fill_form(self, ${params}) -> None:
        """Fill all form fields"""
${fills}`);
        }
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login"));
        if (submitBtn) {
            actions.push(`    def submit(self) -> None:
        """Click submit button"""
        self.get_${this.toSnakeCase(submitBtn.propertyName)}().click()`);
        }
        return actions.join("\n\n");
    }
    generateCSharpSeleniumActions(properties) {
        const actions = [];
        const inputs = properties.filter((p) => p.elementType === "input" || p.elementType === "textarea");
        if (inputs.length > 0) {
            const params = inputs.map((p) => `string ${p.propertyName}`).join(", ");
            const fills = inputs.map((p) => `            ${this.capitalize(p.propertyName)}.SendKeys(${p.propertyName});`).join("\n");
            actions.push(`        /// <summary>
        /// Fill all form fields
        /// </summary>
        public void FillForm(${params})
        {
${fills}
        }`);
        }
        const submitBtn = properties.find((p) => p.propertyName.toLowerCase().includes("submit") ||
            p.propertyName.toLowerCase().includes("login"));
        if (submitBtn) {
            actions.push(`        /// <summary>
        /// Click submit button
        /// </summary>
        public void Submit()
        {
            ${this.capitalize(submitBtn.propertyName)}.Click();
        }`);
        }
        return actions.join("\n\n");
    }
}
exports.GeneratePOMTool = GeneratePOMTool;
//# sourceMappingURL=generate-pom.js.map