#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const browser_js_1 = require("./core/browser.js");
const analyze_page_js_1 = require("./tools/analyze-page.js");
const get_locators_js_1 = require("./tools/get-locators.js");
const generate_pom_js_1 = require("./tools/generate-pom.js");
const run_test_js_1 = require("./tools/run-test.js");
// Tool definitions
const tools = [
    {
        name: "get_locators",
        description: "Get all possible Playwright locators for a specific element on a webpage. Returns ranked locators with reliability scores. Use this when user asks for locators for a specific element.",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL of the webpage to analyze",
                },
                elementDescription: {
                    type: "string",
                    description: "Description of the element (e.g., 'login button', 'username input', 'submit form', 'email field')",
                },
            },
            required: ["url", "elementDescription"],
        },
    },
    {
        name: "analyze_page",
        description: "Analyze an entire webpage and return all interactive elements with their best locators. Use this to understand page structure or get all elements at once.",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL of the webpage to analyze",
                },
                elementTypes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional filter by element types: 'button', 'input', 'link', 'select', 'textarea', 'checkbox', 'radio'. Leave empty for all.",
                },
            },
            required: ["url"],
        },
    },
    {
        name: "generate_page_object",
        description: "Generate a complete Page Object Model class for a webpage with all interactive elements and helper methods. Returns production-ready code.",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL of the webpage",
                },
                className: {
                    type: "string",
                    description: "Name for the Page Object class (e.g., 'LoginPage', 'CheckoutPage')",
                },
                language: {
                    type: "string",
                    enum: ["typescript", "javascript", "python"],
                    description: "Programming language for the generated code (default: typescript)",
                },
            },
            required: ["url", "className"],
        },
    },
    {
        name: "run_test",
        description: "Execute a Playwright test with given steps and return pass/fail results. Use this to actually run and verify tests in a real browser.",
        inputSchema: {
            type: "object",
            properties: {
                testName: {
                    type: "string",
                    description: "Name of the test",
                },
                steps: {
                    type: "array",
                    description: "Array of test steps to execute",
                    items: {
                        type: "object",
                        properties: {
                            action: {
                                type: "string",
                                enum: [
                                    "navigate",
                                    "click",
                                    "fill",
                                    "clear",
                                    "check",
                                    "uncheck",
                                    "select",
                                    "hover",
                                    "press",
                                    "assert_visible",
                                    "assert_hidden",
                                    "assert_text",
                                    "assert_value",
                                    "assert_url",
                                    "assert_title",
                                    "wait",
                                    "wait_for_element",
                                    "screenshot",
                                ],
                                description: "Action to perform",
                            },
                            locator: {
                                type: "string",
                                description: "Playwright locator string (e.g., getByRole('button', { name: 'Login' }), locator('#submit'))",
                            },
                            value: {
                                type: "string",
                                description: "Value for fill/navigate/assert actions",
                            },
                            description: {
                                type: "string",
                                description: "Human readable description of this step",
                            },
                        },
                        required: ["action", "description"],
                    },
                },
                options: {
                    type: "object",
                    description: "Test execution options",
                    properties: {
                        headless: {
                            type: "boolean",
                            description: "Run browser in headless mode (default: true)",
                        },
                        slowMo: {
                            type: "number",
                            description: "Slow down actions by milliseconds (default: 0)",
                        },
                        timeout: {
                            type: "number",
                            description: "Default timeout in milliseconds (default: 30000)",
                        },
                    },
                },
            },
            required: ["testName", "steps"],
        },
    },
    {
        name: "generate_test",
        description: "Generate a Playwright test script from test steps. Returns executable code that can be saved and run independently.",
        inputSchema: {
            type: "object",
            properties: {
                testName: {
                    type: "string",
                    description: "Name of the test",
                },
                steps: {
                    type: "array",
                    description: "Array of test steps",
                    items: {
                        type: "object",
                        properties: {
                            action: {
                                type: "string",
                                enum: [
                                    "navigate",
                                    "click",
                                    "fill",
                                    "clear",
                                    "check",
                                    "uncheck",
                                    "select",
                                    "hover",
                                    "press",
                                    "assert_visible",
                                    "assert_hidden",
                                    "assert_text",
                                    "assert_value",
                                    "assert_url",
                                    "assert_title",
                                    "wait",
                                    "wait_for_element",
                                    "screenshot",
                                ],
                            },
                            locator: { type: "string" },
                            value: { type: "string" },
                            description: { type: "string" },
                        },
                        required: ["action", "description"],
                    },
                },
                language: {
                    type: "string",
                    enum: ["typescript", "javascript", "python"],
                    description: "Programming language for the test script (default: typescript)",
                },
            },
            required: ["testName", "steps"],
        },
    },
];
// Create server instance
const server = new index_js_1.Server({
    name: "locatorlabs-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Tool instances
let browserManager = null;
let analyzePageTool = null;
let getLocatorsTool = null;
let generatePOMTool = null;
const runTestTool = new run_test_js_1.RunTestTool();
async function getBrowserManager() {
    if (!browserManager) {
        browserManager = new browser_js_1.BrowserManager();
        await browserManager.launch();
    }
    return browserManager;
}
async function getAnalyzePageTool() {
    if (!analyzePageTool) {
        const bm = await getBrowserManager();
        analyzePageTool = new analyze_page_js_1.AnalyzePageTool(bm);
    }
    return analyzePageTool;
}
async function getGetLocatorsTool() {
    if (!getLocatorsTool) {
        const bm = await getBrowserManager();
        getLocatorsTool = new get_locators_js_1.GetLocatorsTool(bm);
    }
    return getLocatorsTool;
}
async function getGeneratePOMTool() {
    if (!generatePOMTool) {
        const bm = await getBrowserManager();
        generatePOMTool = new generate_pom_js_1.GeneratePOMTool(bm);
    }
    return generatePOMTool;
}
// Handle tool listing
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools,
}));
// Handle tool execution
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[LocatorLabs] Tool called: ${name}`);
    try {
        switch (name) {
            case "get_locators": {
                const { url, elementDescription } = args;
                console.error(`[LocatorLabs] Getting locators for "${elementDescription}" on ${url}`);
                const tool = await getGetLocatorsTool();
                const result = await tool.execute(url, elementDescription);
                console.error(`[LocatorLabs] Found ${result.locators.length} locators`);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "analyze_page": {
                const { url, elementTypes } = args;
                console.error(`[LocatorLabs] Analyzing page: ${url}`);
                const tool = await getAnalyzePageTool();
                const result = await tool.execute(url, elementTypes);
                console.error(`[LocatorLabs] Found ${result.totalElements} elements, returned ${result.returnedElements}`);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "generate_page_object": {
                const { url, className, language = "typescript" } = args;
                console.error(`[LocatorLabs] Generating POM "${className}" for ${url} in ${language}`);
                const tool = await getGeneratePOMTool();
                const result = await tool.execute(url, className, language);
                console.error(`[LocatorLabs] Generated POM with ${result.elementsFound} elements`);
                return {
                    content: [{ type: "text", text: result.code }],
                };
            }
            case "run_test": {
                const { testName, steps, options = {} } = args;
                console.error(`[LocatorLabs] Running test: ${testName} (${steps.length} steps)`);
                const result = await runTestTool.execute(testName, steps, options);
                console.error(`[LocatorLabs] Test ${result.status}: ${result.passedSteps}/${result.totalSteps} steps passed`);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "generate_test": {
                const { testName, steps, language = "typescript" } = args;
                console.error(`[LocatorLabs] Generating test script: ${testName} in ${language}`);
                const script = await runTestTool.generateScript(testName, steps, language);
                return {
                    content: [{ type: "text", text: script }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[LocatorLabs] Error: ${errorMessage}`);
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
});
// Cleanup on exit
async function cleanup() {
    console.error("[LocatorLabs] Shutting down...");
    if (browserManager) {
        await browserManager.close();
    }
    process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
// Start server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("[LocatorLabs] MCP Server running on stdio");
    console.error("[LocatorLabs] Available tools: get_locators, analyze_page, generate_page_object, run_test, generate_test");
}
main().catch((error) => {
    console.error("[LocatorLabs] Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map