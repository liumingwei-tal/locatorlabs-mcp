import { Page } from "playwright";
export declare class BrowserManager {
    private browser;
    private context;
    private page;
    launch(): Promise<void>;
    getPage(): Promise<Page>;
    navigateTo(url: string): Promise<Page>;
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map