/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

import type {
  HashFileResult,
  InjectedPluginRecord,
  InstalledPlugin,
  OperationResult,
  PluginLaunchOptions,
  PluginLaunchResult,
  PluginMarketFetchResponse,
  PluginMarketPlugin,
  PluginMutationResult,
  PluginPackageResult,
  PluginReadmeResponse,
} from './types/pluginMarket'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface SpawnDetachedOptions {
  scriptName?: 'swap-asar' | 'restore-asar'
  cwd?: string
  env?: Record<string, string | undefined>
}

interface Services {
  parseCode: (code: string, options?: Record<string, any>) => any
  traverseAST: (ast: any, visitors: Record<string, any>) => void
  generateCode: (ast: any, options?: Record<string, any>) => { code: string; map?: any }
  transformCode: (
    code: string,
    visitors: Record<string, any>,
    parseOptions?: Record<string, any>,
    generateOptions?: Record<string, any>,
  ) => { code: string; map?: any }
  astTypes: any

  extractAsar: (asarPath: string, destPath: string) => void
  createAsar: (srcDir: string, destAsar: string) => Promise<void>
  packZpx: (sourceDir: string, outputPath: string) => Promise<void>
  packagePluginToTempZpx: (sourceDir: string) => Promise<string>
  listAsar: (asarPath: string) => string[]
  extractFileFromAsar: (asarPath: string, filePath: string) => Buffer

  readFile: (filePath: string, encoding?: string) => string
  readBinaryFile: (filePath: string) => Uint8Array
  writeFile: (filePath: string, content: string) => void
  computeFileHash: (filePath: string, algorithm?: 'sha256') => Promise<string>
  exists: (path: string) => boolean
  path: {
    join: (...paths: string[]) => string
    dirname: (path: string) => string
    basename: (path: string, ext?: string) => string
  }
  rename: (oldPath: string, newPath: string) => void
  removeDirectory: (dirPath: string) => void
  removeFile: (filePath: string) => void
  copyFile: (src: string, dest: string) => void

  spawnDetached: (args: string[], options?: SpawnDetachedOptions) => number
}

interface ImageAnalysisResult {
  isSimpleIcon: boolean
  mainColor: string | null
  isDark: boolean
  needsAdaptation: boolean
}

interface HotkeyRecordingResult extends OperationResult {}

type HotkeyRecordedCallback = (shortcut: string) => void

interface ZToolsInternal {
  getAllPlugins(): Promise<InjectedPluginRecord[]>
  fetchPluginMarket(baseUrl?: string): Promise<PluginMarketFetchResponse>
  getPlugins(): Promise<InstalledPlugin[]>
  installPluginFromMarket(plugin: PluginMarketPlugin): Promise<PluginMutationResult>
  deletePlugin(pluginPath: string): Promise<OperationResult>
  getPluginReadme(target: string): Promise<PluginReadmeResponse>
  dbGet?(key: string): Promise<unknown>
  getPlatform?(): string
  launch?(options: PluginLaunchOptions): Promise<PluginLaunchResult | void>
  getRunningPlugins?(): Promise<string[]>
  reloadPlugin?(pluginPath: string): Promise<OperationResult>
  revealInFinder?(targetPath: string): Promise<void>
  packagePlugin?(pluginPath: string): Promise<PluginPackageResult>
  computeFileHash?(filePath: string, algorithm?: 'sha256'): Promise<HashFileResult>
  analyzeImage?(src: string): Promise<ImageAnalysisResult>
  startHotkeyRecording?(): Promise<HotkeyRecordingResult>
  onHotkeyRecorded?(callback: HotkeyRecordedCallback): void
}

interface ZToolsApi {
  internal: ZToolsInternal
  showTip(message: string): void
  showToast(message: string): void
  shellOpenExternal(url: string): void
  getPath(name: string): string
  onPluginEnter(callback: (action: any) => void): void
  onPluginOut(callback: () => void): void
}

declare global {
  interface Window {
    services: Services
    ztools: ZToolsApi
  }
}

export {}
