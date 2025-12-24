/**
 * Run Test Tool - Execute Playwright tests with pass/fail results
 *
 * @author Naveen AutomationLabs
 * @license MIT
 * @date 2025
 * @see https://github.com/naveenanimation20/locatorlabs-mcp
 */
export interface TestStep {
    action: "navigate" | "click" | "fill" | "clear" | "check" | "uncheck" | "select" | "hover" | "press" | "assert_visible" | "assert_hidden" | "assert_text" | "assert_value" | "assert_url" | "assert_title" | "wait" | "wait_for_element" | "screenshot";
    locator?: string;
    value?: string;
    description: string;
}
export interface StepResult {
    step: string;
    action: string;
    status: "passed" | "failed" | "skipped";
    duration: number;
    error?: string;
}
export interface TestResult {
    testName: string;
    status: "passed" | "failed";
    duration: number;
    steps: StepResult[];
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    screenshotPath?: string;
    finalUrl?: string;
    error?: string;
}
export interface TestOptions {
    headless?: boolean;
    slowMo?: number;
    timeout?: number;
    viewport?: {
        width: number;
        height: number;
    };
}
export declare class RunTestTool {
    private browser;
    private page;
    execute(testName: string, steps: TestStep[], options?: TestOptions): Promise<TestResult>;
    private executeStep;
    private getLocator;
    private takeScreenshot;
    private buildResult;
    private cleanup;
    generateScript(testName: string, steps: TestStep[], language?: "typescript" | "javascript" | "python"): Promise<string>;
    private generateTypeScriptScript;
    private generateJavaScriptScript;
    private generatePythonScript;
    private stepToTypeScript;
    private stepToPython;
}
//# sourceMappingURL=run-test.d.ts.map