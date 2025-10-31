// Type declaration override for @vitejs/plugin-react
// This fixes TypeScript 5.8.3 parsing issue with quoted export alias
declare module '@vitejs/plugin-react' {
  import type { Plugin } from 'vite';

  export interface Options {
    /** @default true */
    jsxRuntime?: 'classic' | 'automatic';
    /** @default 'default' */
    jsxImportSource?: string;
    /** @default false */
    babel?: {
      babelrc?: boolean;
      configFile?: boolean | string;
      plugins?: any[];
      presets?: any[];
      compact?: boolean | 'auto';
      minified?: boolean;
      [key: string]: any;
    };
    /** @default false */
    devToolsInProd?: boolean;
    /** @default false */
    fastRefresh?: boolean;
    /** @default true */
    exclude?: string | RegExp | (string | RegExp)[];
    /** @default /\.[jt]sx?$/ */
    include?: string | RegExp | (string | RegExp)[];
    /** @default false */
    includeInvalid?: boolean;
  }

  export interface ReactBabelOptions {
    babelrc?: boolean;
    configFile?: boolean | string;
    plugins?: any[];
    presets?: any[];
    compact?: boolean | 'auto';
    minified?: boolean;
    [key: string]: any;
  }

  export interface BabelOptions {
    babelrc?: boolean;
    configFile?: boolean | string;
    plugins?: any[];
    presets?: any[];
    compact?: boolean | 'auto';
    minified?: boolean;
    [key: string]: any;
  }

  export interface ViteReactPluginApi {
    readonly preambleCode: string;
  }

  /**
   * Vite plugin for React
   */
  function viteReact(options?: Options): Plugin[];

  export default viteReact;
}

