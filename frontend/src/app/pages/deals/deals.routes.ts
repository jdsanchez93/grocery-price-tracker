import { Routes } from "@angular/router";
import { roleGuard } from "@/app/core/auth/role.guard";
import { CurrentDeals } from "./current-deals/current-deals";
import { TopDeals } from "./top-deals/top-deals";

export default [
    { path: 'current-deals', component: CurrentDeals },
    { path: 'top-deals', component: TopDeals, canActivate: [roleGuard('power_user', 'admin')] },
] as Routes;
