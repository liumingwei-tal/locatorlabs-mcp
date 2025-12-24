"use strict";
/**
 * Browser Manager - Handles browser lifecycle for LocatorLabs MCP
 *
 * @author Naveen AutomationLabs
 * @license MIT
 * @date 2025
 * @see https://github.com/naveenanimation20/locatorlabs-mcp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require("playwright");
class BrowserManager {
    browser = null;
    context = null;
    page = null;
    async launch() {
        if (this.browser)
            return;
        this.browser = await playwright_1.chromium.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });
        this.page = await this.context.newPage();
    }
    async getPage() {
        if (!this.page) {
            await this.launch();
        }
        return this.page;
    }
    async navigateTo(url) {
        const page = await this.getPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        return page;
    }
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.page = null;
    }
}
exports.BrowserManager = BrowserManager;
//# sourceMappingURL=browser.js.map