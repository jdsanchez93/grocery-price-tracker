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

export interface PreviewAvailability {
    available: boolean;
    circularId?: string;
    startDate?: string;
    endDate?: string;
    reason?: 'store_not_found' | 'not_implemented' | 'upstream_error';
    message?: string;
}

export interface PreviewAvailabilityResponse {
    availability: Record<string, PreviewAvailability>;
}