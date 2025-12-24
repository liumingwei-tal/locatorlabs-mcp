/**
 * Generate POM Tool - Auto-generate Page Object Model classes
 *
 * @author Naveen AutomationLabs
 * @license MIT
 * @date 2025
 * @see https://github.com/naveenanimation20/locatorlabs-mcp
 */
import { BrowserManager } from "../core/browser.js";
export interface ElementInfo {
    tagName: string;
    id?: string;
    name?: string;
    className?: string;
    type?: string;
    placeholder?: string;
    text?: string;
    ariaLabel?: string;
    role?: string;
    testId?: string;
}
export interface PageElementProperty {
    propertyName: string;
    locator: string;
    elementType: string;
    description: string;
    seleniumLocator?: string;
    id?: string;
    name?: string;
    xpath?: string;
    cssSelector?: string;
}
export interface GeneratePOMResult {
    url: string;
    className: string;
    language: string;
    elementsFound: number;
    code: string;
}
export declare class GeneratePOMTool {
    private browserManager;
    constructor(browserManager: BrowserManager);
    execute(url: string, className: string, language?: "typescript" | "javascript" | "python" | "java-selenium" | "python-selenium" | "csharp-selenium"): Promise<GeneratePOMResult>;
    private getPageElements;
    private generatePropertyName;
    private getElementSuffix;
    private getBestLocator;
    private inferRole;
    private describeElement;
    private deduplicateProperties;
    private escape;
    private generateTypeScriptPOM;
    private generateJavaScriptPOM;
    private generatePythonPOM;
    private generateTypeScriptActions;
    private generateJavaScriptActions;
    private generatePythonActions;
    private toPythonLocator;
    private toSnakeCase;
    private getSeleniumLocator;
    private getXPath;
    private getCssSelector;
    private generateJavaSeleniumPOM;
    private generatePythonSeleniumPOM;
    private generateCSharpSeleniumPOM;
    private capitalize;
    private generateJavaSeleniumActions;
    private generatePythonSeleniumActions;
    private generateCSharpSeleniumActions;
}
//# sourceMappingURL=generate-pom.d.ts.map