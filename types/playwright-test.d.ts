declare module "@playwright/test" {
  export interface PlaywrightTestConfig {
    [key: string]: unknown;
  }

  export function defineConfig(
    config: PlaywrightTestConfig
  ): PlaywrightTestConfig;

  export const devices: Record<string, unknown>;
}

