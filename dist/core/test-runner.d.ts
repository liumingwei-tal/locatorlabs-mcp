/**
 * Test Runner - Core test execution engine for LocatorLabs MCP
 *
 * @author Naveen AutomationLabs
 * @license MIT
 * @date 2025
 * @see https://github.com/naveenanimation20/locatorlabs-mcp
 */
export interface TestStep {
    action: "navigate" | "click" | "fill" | "assert_visible" | "assert_text" | "screenshot" | "wait";
    locator?: string;
    value?: string;
    description: string;
}
export interface TestResult {
    testName: string;
    status: "passed" | "failed";
    duration: number;
    steps: StepResult[];
    screenshotPath?: string;
    error?: string;
}
export interface StepResult {
    step: string;
    status: "passed" | "failed";
    duration: number;
    error?: string;
}
export declare class TestRunner {
    private browser;
    runTest(testName: string, steps: TestStep[], options?: {
        headless?: boolean;
        slowMo?: number;
    }): Promise<TestResult>;
    private executeStep;
    private getLocator;
    generateTestScript(testName: string, steps: TestStep[], language?: "typescript" | "javascript" | "python"): Promise<string>;
    private generateTypeScriptTest;
    private generateJavaScriptTest;
    private generatePythonTest;
    private stepToTypeScript;
    private stepToPython;
}
//# sourceMappingURL=test-runner.d.ts.map