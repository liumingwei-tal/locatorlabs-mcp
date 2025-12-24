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
    execute(url: string, className: string, language?: "typescript" | "javascript" | "python"): Promise<GeneratePOMResult>;
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
}
//# sourceMappingURL=generate-pom.d.ts.map