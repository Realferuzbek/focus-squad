declare module "next/server" {
  type CookieValue = { value: string };

  export interface NextCookies {
    get(name: string): CookieValue | undefined;
    set(name: string, value: string, options?: unknown): void;
  }

  export interface NextURL extends URL {
    protocol?: string;
  }

  export interface NextRequest extends Request {
    nextUrl: NextURL;
    cookies: NextCookies;
  }

  export class NextResponse extends Response {
    cookies: NextCookies;
    static next(): NextResponse;
    static redirect(
      input: string | URL,
      init?: number | ResponseInit
    ): NextResponse;
    constructor(body?: BodyInit | null, init?: ResponseInit);
  }
}

