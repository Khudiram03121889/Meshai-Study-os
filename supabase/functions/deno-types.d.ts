// ambient declarations for Deno edge functions

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
}

declare module "https://*" {
  export const serve: any;
  export const createClient: any;
  const value: any;
  export default value;
}

declare module "http://*" {
  const value: any;
  export default value;
}
