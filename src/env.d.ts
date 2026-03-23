/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

// Preload services 类型声明（对应 public/preload/services.js）
interface Services {
  // AST 相关
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

  // ASAR 相关
  extractAsar: (asarPath: string, destPath: string) => void
  createAsar: (srcDir: string, destAsar: string) => Promise<void>
  listAsar: (asarPath: string) => string[]
  extractFileFromAsar: (asarPath: string, filePath: string) => { data: string }

  // 文件系统
  readFile: (filePath: string, encoding?: string) => string
  writeFile: (filePath: string, content: string) => void
  exists: (p: string) => boolean
  path: {
    join: (...paths: string[]) => string
    dirname: (p: string) => string
    basename: (p: string, ext?: string) => string
  }
  rename: (oldPath: string, newPath: string) => void
  removeDirectory: (dirPath: string) => void
  removeFile: (filePath: string) => void
  copyFile: (src: string, dest: string) => void

  // 进程管理
  spawnDetached: (args: string[], options?: Record<string, any>) => number
}

// ZTools API 扩展类型
interface ZToolsInternal {
  getAllPlugins(): Promise<string[]>
}

interface ZToolsAPI {
  getPath: (type: 'exe' | 'userData') => string
  internal: ZToolsInternal
  onPluginEnter(callback: (action: { code: string }) => void): void
  onPluginOut(callback: () => void): void
  showTip: (message: string) => void
}

declare global {
  interface Window {
    services: Services
    ztools: ZToolsAPI
  }
}

export {}
