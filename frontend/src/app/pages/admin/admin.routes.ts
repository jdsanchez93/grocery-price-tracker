import { Routes } from "@angular/router";
import { ScrapeManagement } from "./scrape-management/scrape-management";
import { ConfigureStores } from "./configure-stores/configure-stores";

export default [
    { path: 'scrape-management', component: ScrapeManagement },
    { path: 'configure-stores', component: ConfigureStores }
] as Routes;