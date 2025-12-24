import { BrowserManager } from "./browser.js";
interface LocatorResult {
    type: string;
    locator: string;
    reliability: number;
    description: string;
}
interface PageElement {
    element: string;
    type: string;
    locators: LocatorResult[];
    recommended: string;
}
interface ValidationResult {
    isValid: boolean;
    matchCount: number;
    isUnique: boolean;
    suggestions: string[];
}
export declare class LocatorEngine {
    private browserManager;
    constructor(browserManager: BrowserManager);
    getLocators(url: string, elementDescription: string): Promise<{
        element: string;
        locators: LocatorResult[];
        recommended: string;
    }>;
    analyzePage(url: string, elementTypes?: string[]): Promise<{
        url: string;
        totalElements: number;
        elements: PageElement[];
    }>;
    generatePageObject(url: string, className: string, language: string): Promise<string>;
    validateLocator(url: string, locatorStr: string): Promise<ValidationResult>;
    private findMatchingElements;
    private getAllInteractiveElements;
    private generateLocators;
    private inferRole;
    private rankLocators;
    private describeElement;
    private generatePropertyName;
    private escape;
    private parseLocatorString;
    private generateTypeScriptPOM;
    private generateJavaScriptPOM;
    private generatePythonPOM;
    private toSnakeCase;
}
export {};
//# sourceMappingURL=locator-engine.d.ts.map