"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const playwright_1 = require("playwright");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class TestRunner {
    browser = null;
    async runTest(testName, steps, options = {}) {
        const startTime = Date.now();
        const stepResults = [];
        let page = null;
        let screenshotPath;
        try {
            this.browser = await playwright_1.chromium.launch({
                headless: options.headless ?? true,
                slowMo: options.slowMo ?? 0,
            });
            const context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
            });
            page = await context.newPage();
            for (const step of steps) {
                const stepStart = Date.now();
                try {
                    await this.executeStep(page, step);
                    stepResults.push({
                        step: step.description,
                        status: "passed",
                        duration: Date.now() - stepStart,
                    });
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    stepResults.push({
                        step: step.description,
                        status: "failed",
                        duration: Date.now() - stepStart,
                        error: errorMsg,
                    });
                    // Take failure screenshot
                    screenshotPath = path.join(os.tmpdir(), `test-failure-${Date.now()}.png`);
                    await page.screenshot({ path: screenshotPath });
                    return {
                        testName,
                        status: "failed",
                        duration: Date.now() - startTime,
                        steps: stepResults,
                        screenshotPath,
                        error: errorMsg,
                    };
                }
            }
            // Take success screenshot
            screenshotPath = path.join(os.tmpdir(), `test-success-${Date.now()}.png`);
            await page.screenshot({ path: screenshotPath });
            return {
                testName,
                status: "passed",
                duration: Date.now() - startTime,
                steps: stepResults,
                screenshotPath,
            };
        }
        finally {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        }
    }
    async executeStep(page, step) {
        const timeout = 10000;
        switch (step.action) {
            case "navigate":
                await page.goto(step.value, { waitUntil: "networkidle", timeout });
                break;
            case "click":
                await this.getLocator(page, step.locator).click({ timeout });
                break;
            case "fill":
                await this.getLocator(page, step.locator).fill(step.value, { timeout });
                break;
            case "assert_visible":
                await this.getLocator(page, step.locator).waitFor({ state: "visible", timeout });
                break;
            case "assert_text":
                const element = this.getLocator(page, step.locator);
                await element.waitFor({ state: "visible", timeout });
                const text = await element.textContent();
                if (!text?.includes(step.value)) {
                    throw new Error(`Expected text "${step.value}" not found. Actual: "${text}"`);
                }
                break;
            case "screenshot":
                const ssPath = path.join(os.tmpdir(), `step-${Date.now()}.png`);
                await page.screenshot({ path: ssPath });
                break;
            case "wait":
                await page.waitForTimeout(parseInt(step.value) || 1000);
                break;
            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }
    getLocator(page, locatorStr) {
        // Parse Playwright locator strings
        if (locatorStr.startsWith("getByRole")) {
            const match = locatorStr.match(/getByRole\('(\w+)'(?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
            if (match)
                return page.getByRole(match[1], match[2] ? { name: match[2] } : undefined);
        }
        if (locatorStr.startsWith("getByText")) {
            const match = locatorStr.match(/getByText\(['"]([^'"]+)['"]\)/);
            if (match)
                return page.getByText(match[1]);
        }
        if (locatorStr.startsWith("getByTestId")) {
            const match = locatorStr.match(/getByTestId\(['"]([^'"]+)['"]\)/);
            if (match)
                return page.getByTestId(match[1]);
        }
        if (locatorStr.startsWith("getByPlaceholder")) {
            const match = locatorStr.match(/getByPlaceholder\(['"]([^'"]+)['"]\)/);
            if (match)
                return page.getByPlaceholder(match[1]);
        }
        if (locatorStr.startsWith("getByLabel")) {
            const match = locatorStr.match(/getByLabel\(['"]([^'"]+)['"]\)/);
            if (match)
                return page.getByLabel(match[1]);
        }
        // Default to CSS/XPath selector
        return page.locator(locatorStr);
    }
    async generateTestScript(testName, steps, language = "typescript") {
        switch (language) {
            case "python":
                return this.generatePythonTest(testName, steps);
            case "javascript":
                return this.generateJavaScriptTest(testName, steps);
            default:
                return this.generateTypeScriptTest(testName, steps);
        }
    }
    generateTypeScriptTest(testName, steps) {
        const stepCode = steps.map((s) => this.stepToTypeScript(s)).join("\n");
        return `import { test, expect } from '@playwright/test';

test('${testName}', async ({ page }) => {
${stepCode}
});
`;
    }
    generateJavaScriptTest(testName, steps) {
        const stepCode = steps.map((s) => this.stepToTypeScript(s)).join("\n");
        return `const { test, expect } = require('@playwright/test');

test('${testName}', async ({ page }) => {
${stepCode}
});
`;
    }
    generatePythonTest(testName, steps) {
        const stepCode = steps.map((s) => this.stepToPython(s)).join("\n");
        const funcName = testName.toLowerCase().replace(/\s+/g, "_");
        return `import pytest
from playwright.sync_api import Page, expect


def test_${funcName}(page: Page):
${stepCode}
`;
    }
    stepToTypeScript(step) {
        const indent = "  ";
        switch (step.action) {
            case "navigate":
                return `${indent}// ${step.description}\n${indent}await page.goto('${step.value}');`;
            case "click":
                return `${indent}// ${step.description}\n${indent}await page.${step.locator}.click();`;
            case "fill":
                return `${indent}// ${step.description}\n${indent}await page.${step.locator}.fill('${step.value}');`;
            case "assert_visible":
                return `${indent}// ${step.description}\n${indent}await expect(page.${step.locator}).toBeVisible();`;
            case "assert_text":
                return `${indent}// ${step.description}\n${indent}await expect(page.${step.locator}).toContainText('${step.value}');`;
            case "wait":
                return `${indent}// ${step.description}\n${indent}await page.waitForTimeout(${step.value});`;
            default:
                return `${indent}// ${step.description}`;
        }
    }
    stepToPython(step) {
        const indent = "    ";
        const pyLocator = step.locator
            ?.replace(/getByRole/g, "get_by_role")
            .replace(/getByText/g, "get_by_text")
            .replace(/getByTestId/g, "get_by_test_id")
            .replace(/getByPlaceholder/g, "get_by_placeholder")
            .replace(/getByLabel/g, "get_by_label");
        switch (step.action) {
            case "navigate":
                return `${indent}# ${step.description}\n${indent}page.goto('${step.value}')`;
            case "click":
                return `${indent}# ${step.description}\n${indent}page.${pyLocator}.click()`;
            case "fill":
                return `${indent}# ${step.description}\n${indent}page.${pyLocator}.fill('${step.value}')`;
            case "assert_visible":
                return `${indent}# ${step.description}\n${indent}expect(page.${pyLocator}).to_be_visible()`;
            case "assert_text":
                return `${indent}# ${step.description}\n${indent}expect(page.${pyLocator}).to_contain_text('${step.value}')`;
            case "wait":
                return `${indent}# ${step.description}\n${indent}page.wait_for_timeout(${step.value})`;
            default:
                return `${indent}# ${step.description}`;
        }
    }
}
exports.TestRunner = TestRunner;
//# sourceMappingURL=test-runner.js.map