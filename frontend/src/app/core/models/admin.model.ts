interface AutoScrapeAlreadyScraped {
    success: true;
    alreadyScraped: true;
    weekId: string;
    circularId: string;
    storeInstanceId: string;
    existingDealCount: number;
}

interface AutoScrapeNewResult {
    success: true;
    alreadyScraped: false;
    forced: boolean;
    deletedCount?: number;
    weekId: string;
    circularId: string;
    storeInstanceId: string;
    dealCount: number;
    persisted: number;
    dates: {
        startDate: string;
        endDate: string;
    };
}

export type AutoScrapeResponse = AutoScrapeAlreadyScraped | AutoScrapeNewResult;

interface ScrapeStatus {
    scraped: boolean;
    dealCount?: number;
    circularId?: string;
}

export type ScrapeStatusResponse = Record<string, ScrapeStatus>;