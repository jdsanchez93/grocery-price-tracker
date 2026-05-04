import { Routes } from "@angular/router";
import { ScrapeManagement } from "./scrape-management/scrape-management";
import { ConfigureStores } from "./configure-stores/configure-stores";
import { DealsEditor } from "./deals-editor/deals-editor";

export default [
    { path: 'scrape-management', component: ScrapeManagement },
    { path: 'configure-stores', component: ConfigureStores },
    { path: 'edit-deals', component: DealsEditor }
] as Routes;