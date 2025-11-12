declare module "next-auth/jwt" {
  export interface GetTokenParams {
    req: unknown;
    secret?: string;
    secureCookie?: boolean;
    cookieName?: string;
    raw?: boolean;
  }

  export type JWT = Record<string, unknown>;

  export function getToken(
    params: GetTokenParams,
  ): Promise<JWT | string | null>;
}
