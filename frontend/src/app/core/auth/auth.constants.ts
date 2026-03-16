export const ROLES_CLAIM = 'https://jd-sanchez.com/roles' as const;
export interface Auth0User {
    name?: string;
    [ROLES_CLAIM]?: string[];
}