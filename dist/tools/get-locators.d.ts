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
    value?: string;
    xpath: string;
    selector: string;
}
export interface LocatorResult {
    type: string;
    locator: string;
    reliability: number;
    description: string;
}
export interface GetLocatorsResult {
    url: string;
    elementDescription: string;
    matchedElements: number;
    locators: LocatorResult[];
    recommended: string;
    alternativeSelectors: {
        css: string;
        xpath: string;
    };
}
export declare class GetLocatorsTool {
    private browserManager;
    constructor(browserManager: BrowserManager);
    execute(url: string, elementDescription: string): Promise<GetLocatorsResult>;
    private findMatchingElements;
    private getAllElements;
    private generateLocators;
    private inferRole;
    private rankLocators;
    private escape;
}
//# sourceMappingURL=get-locators.d.ts.map