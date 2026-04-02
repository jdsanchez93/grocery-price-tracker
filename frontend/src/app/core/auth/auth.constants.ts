export const ROLES_CLAIM = 'https://jd-sanchez.com/roles' as const;

export type UserRole = 'admin' | 'power_user';

export interface Auth0User {
    name?: string;
    [ROLES_CLAIM]?: UserRole[];
}