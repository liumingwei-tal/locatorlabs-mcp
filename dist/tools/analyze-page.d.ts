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
    href?: string;
    title?: string;
    xpath: string;
    selector: string;
}
export interface LocatorResult {
    type: string;
    locator: string;
    reliability: number;
    description: string;
}
export interface PageElement {
    element: string;
    type: string;
    locators: LocatorResult[];
    recommended: string;
}
export interface AnalyzePageResult {
    url: string;
    totalElements: number;
    returnedElements: number;
    truncated: boolean;
    elements: PageElement[];
}
export declare class AnalyzePageTool {
    private browserManager;
    constructor(browserManager: BrowserManager);
    execute(url: string, elementTypes?: string[]): Promise<AnalyzePageResult>;
    private getAllInteractiveElements;
    private generateLocators;
    private inferRole;
    private rankLocators;
    private describeElement;
    private escape;
}
//# sourceMappingURL=analyze-page.d.ts.map