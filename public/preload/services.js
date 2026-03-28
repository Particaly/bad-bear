const { Buffer } = require('node:buffer')

// 确保全局可用（@electron/asar 等依赖库直接读取 global.Buffer）
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

const { spawn } = require('node:child_process')

const fs = require('node:fs')
const { createHash } = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const { createBrotliCompress, constants: zlibConstants } = require('node:zlib')

function createMissingDependencyError(packageName, error) {
  const reason = error instanceof Error ? error.message : String(error)
  return new Error(
    `Preload 依赖缺失：${packageName}。请在 public/preload 目录重新安装依赖。原始错误：${reason}`,
  )
}

function requireDependency(packageName) {
  try {
    return require(packageName)
  } catch (error) {
    throw createMissingDependencyError(packageName, error)
  }
}

let babelToolsCache = null
let asarCache = null

function loadBabelTools() {
  if (babelToolsCache) {
    return babelToolsCache
  }

  babelToolsCache = {
    parser: requireDependency('@babel/parser'),
    traverse: requireDependency('@babel/traverse').default,
    generate: requireDependency('@babel/generator').default,
    t: requireDependency('@babel/types'),
  }

  return babelToolsCache
}

function loadAsar() {
  if (asarCache) {
    return asarCache
  }

  asarCache = requireDependency('@electron/asar')
  return asarCache
}

function createTempFilePath(extension) {
  const random = Math.random().toString(36).slice(2, 8)
  return path.join(os.tmpdir(), `zpx-${Date.now()}-${random}${extension}`)
}

async function cleanupTempFile(filePath) {
  const previousNoAsar = process.noAsar
  process.noAsar = true

  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore
  } finally {
    process.noAsar = previousNoAsar
  }
}

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  // ===== AST 相关能力 =====

  /**
   * 解析 JS/TS 代码为 AST
   * @param {string} code - 源代码
   * @param {object} [options] - babel parser 选项
   * @returns {object} AST
   */
  parseCode(code, options = {}) {
    const { parser } = loadBabelTools()
    return parser.parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'],
      ...options,
    })
  },

  /**
   * 遍历并修改 AST
   * @param {object} ast - AST 对象
   * @param {object} visitors - babel traverse visitor 对象
   */
  traverseAST(ast, visitors) {
    const { traverse } = loadBabelTools()
    traverse(ast, visitors)
  },

  /**
   * 从 AST 生成代码
   * @param {object} ast - AST 对象
   * @param {object} [options] - babel generator 选项
   * @returns {{ code: string, map?: object }}
   */
  generateCode(ast, options = {}) {
    const { generate } = loadBabelTools()
    return generate(ast, {
      retainLines: false,
      compact: false,
      ...options,
    })
  },

  /**
   * 解析 -> 修改 -> 生成 一体化操作
   * @param {string} code - 源代码
   * @param {object} visitors - babel traverse visitor 对象
   * @param {object} [parseOptions] - parser 选项
   * @param {object} [generateOptions] - generator 选项
   * @returns {{ code: string, map?: object }}
   */
  transformCode(code, visitors, parseOptions = {}, generateOptions = {}) {
    const ast = this.parseCode(code, parseOptions)
    this.traverseAST(ast, visitors)
    return this.generateCode(ast, generateOptions)
  },

  /** babel types 工具，用于构建/判断 AST 节点 */
  get astTypes() {
    return loadBabelTools().t
  },

  // ===== ASAR 相关能力 =====

  /**
   * 提取 asar 包到目录
   * @param {string} asarPath - asar 文件路径
   * @param {string} destPath - 目标目录
   */
  extractAsar(asarPath, destPath) {
    const asar = loadAsar()
    console.log('[Preload] extractAsar:', { asar, asarPath, destPath })
    asar.extractAll(asarPath, destPath)
    console.log('[Preload] extractAsar complete')
  },

  /**
   * 将目录打包为 asar 文件
   * @param {string} srcDir - 源目录
   * @param {string} destAsar - 目标 asar 文件路径
   * @returns {Promise<void>}
   */
  createAsar(srcDir, destAsar) {
    const asar = loadAsar()
    console.log('[Preload] createAsar:', { srcDir, destAsar })
    return asar.createPackage(srcDir, destAsar).then(() => {
      console.log('[Preload] createAsar complete')
    })
  },

  /**
   * 将目录打包为 zpx 文件（zpx = brotli(asar)）
   * @param {string} sourceDir - 源目录
   * @param {string} outputPath - 目标 zpx 文件路径
   * @returns {Promise<void>}
   */
  async packZpx(sourceDir, outputPath) {
    const asar = loadAsar()
    const tempAsarPath = createTempFilePath('.asar')
    const previousNoAsar = process.noAsar
    process.noAsar = true

    try {
      console.log('[Preload] packZpx create asar:', { sourceDir, tempAsarPath })
      await asar.createPackage(sourceDir, tempAsarPath)
      console.log('[Preload] packZpx compress asar -> zpx:', {
        tempAsarPath,
        outputPath,
      })
      await pipeline(
        fs.createReadStream(tempAsarPath),
        createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
          },
        }),
        fs.createWriteStream(outputPath),
      )
      console.log('[Preload] packZpx complete')
    } finally {
      process.noAsar = previousNoAsar
      await cleanupTempFile(tempAsarPath)
    }
  },

  /**
   * 将插件目录打包到系统临时目录，返回临时 zpx 路径
   * @param {string} sourceDir - 源目录
   * @returns {Promise<string>}
   */
  async packagePluginToTempZpx(sourceDir) {
    console.log('[Preload] packagePluginToTempZpx:', sourceDir)
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`插件目录不存在: ${sourceDir}`)
    }

    const stats = fs.statSync(sourceDir)
    if (!stats.isDirectory()) {
      throw new Error(`插件路径不是目录: ${sourceDir}`)
    }

    const outputPath = createTempFilePath('.zpx')
    try {
      await window.services.packZpx(sourceDir, outputPath)
      console.log('[Preload] packagePluginToTempZpx complete:', outputPath)
      return outputPath
    } catch (error) {
      window.services.removeFile(outputPath)
      throw error
    }
  },

  /**
   * 列出 asar 包中的文件
   * @param {string} asarPath - asar 文件路径
   * @returns {string[]}
   */
  listAsar(asarPath) {
    const asar = loadAsar()
    console.log('[Preload] listAsar:', asarPath)
    const files = asar.listPackage(asarPath)
    console.log('[Preload] listAsar found', files.length, 'files')
    return files
  },

  /**
   * 从 asar 包中读取单个文件
   * @param {string} asarPath - asar 文件路径
   * @param {string} filePath - 包内文件路径
   * @returns {Buffer}
   */
  extractFileFromAsar(asarPath, filePath) {
    const asar = loadAsar()
    console.log('[Preload] extractFileFromAsar:', { asarPath, filePath })
    return asar.extractFile(asarPath, filePath)
  },

  // ===== 文件系统能力 =====

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @param {string} [encoding='utf-8']
   * @returns {string}
   */
  readFile(filePath, encoding = 'utf-8') {
    console.log('[Preload] readFile:', filePath)
    const content = fs.readFileSync(filePath, encoding)
    console.log('[Preload] readFile complete, size:', content.length)
    return content
  },

  /**
   * 以二进制方式读取文件内容
   * @param {string} filePath - 文件路径
   * @returns {Uint8Array}
   */
  readBinaryFile(filePath) {
    console.log('[Preload] readBinaryFile:', filePath)
    const content = fs.readFileSync(filePath)
    console.log('[Preload] readBinaryFile complete, size:', content.byteLength)
    return content
  },

  /**
   * 写入文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   */
  writeFile(filePath, content) {
    console.log('[Preload] writeFile:', filePath, 'size:', content.length)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      console.log('[Preload] Creating directory:', dir)
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log('[Preload] writeFile complete')
  },

  /**
   * 计算文件 hash
   * @param {string} filePath - 文件路径
   * @param {'sha256'} [algorithm='sha256'] - hash 算法
   * @returns {Promise<string>}
   */
  async computeFileHash(filePath, algorithm = 'sha256') {
    console.log('[Preload] computeFileHash:', { filePath, algorithm })

    if (algorithm !== 'sha256') {
      throw new Error(`不支持的 hash 算法: ${algorithm}`)
    }

    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm)
      const stream = fs.createReadStream(filePath)

      stream.on('error', reject)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => {
        const digest = hash.digest('hex')
        console.log('[Preload] computeFileHash complete:', { filePath, algorithm, digest })
        resolve(digest)
      })
    })
  },

  /**
   * 检查路径是否存在
   * @param {string} p - 路径
   * @returns {boolean}
   */
  exists(p) {
    const result = fs.existsSync(p)
    console.log('[Preload] exists:', p, '=>', result)
    return result
  },

  /** path 工具 */
  path,

  /**
   * 重命名文件或目录
   * @param {string} oldPath - 原路径
   * @param {string} newPath - 新路径
   */
  rename(oldPath, newPath) {
    console.log('[Preload] rename:', oldPath, '->', newPath)
    fs.renameSync(oldPath, newPath)
    console.log('[Preload] rename complete')
  },

  /**
   * 递归删除目录
   * @param {string} dirPath - 目录路径
   */
  removeDirectory(dirPath) {
    console.log('[Preload] removeDirectory:', dirPath)
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
      console.log('[Preload] removeDirectory complete')
    } else {
      console.log('[Preload] removeDirectory: path does not exist')
    }
  },

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   */
  removeFile(filePath) {
    console.log('[Preload] removeFile:', filePath)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log('[Preload] removeFile complete')
    } else {
      console.log('[Preload] removeFile: file does not exist')
    }
  },

  /**
   * 复制文件
   * @param {string} src - 源路径
   * @param {string} dest - 目标路径
   */
  copyFile(src, dest) {
    console.log('[Preload] copyFile:', src, '->', dest)
    fs.copyFileSync(src, dest)
    console.log('[Preload] copyFile complete')
  },

  /**
   * 递归复制目录
   * @param {string} src - 源目录
   * @param {string} dest - 目标目录
   */
  copyDirectory(src, dest) {
    console.log('[Preload] copyDirectory:', src, '->', dest)
    fs.cpSync(src, dest, { recursive: true })
    console.log('[Preload] copyDirectory complete')
  },

  /**
   * 以 detached 模式启动同目录下的平台原生脚本（swap-asar.bat / swap-asar.sh / restore-asar.bat / restore-asar.sh）
   *
   * - Windows: 通过 cmd /c start 在独立 cmd 窗口运行 .bat，出错 pause 不秒退
   * - Linux/macOS: 通过 bash 运行 .sh，出错 read 等待
   *
   * @param {string[]} args - 传给脚本的参数列表
   * @param {{ scriptName?: 'swap-asar' | 'restore-asar' } & import('node:child_process').SpawnOptions} [options]
   */
  spawnDetached(args, options = {}) {
    const { scriptName = 'swap-asar', ...spawnOptions } = options
    console.log('[Preload] spawnDetached:', { scriptName, args })

    // 确保日志目录存在
    const logIdx = args.findIndex(arg => typeof arg === 'string' && arg.endsWith('.log'))
    if (logIdx >= 0) {
      const logPath = args[logIdx]
      const logDir = path.dirname(logPath)
      if (!fs.existsSync(logDir)) {
        console.log('[Preload] Creating log directory:', logDir)
        fs.mkdirSync(logDir, { recursive: true })
      }
    }

    const isWindows = process.platform === 'win32'
    const scriptPath = path.join(__dirname, `${scriptName}${isWindows ? '.bat' : '.sh'}`)

    if (!fs.existsSync(scriptPath)) {
      console.error('[Preload] spawnDetached: script not found:', scriptPath)
      throw new Error(`Script not found: ${scriptPath}`)
    }

    console.log('[Preload] Using script:', scriptPath)

    if (isWindows) {
      // cmd /c start "" /wait script.bat args
      const child = spawn('cmd.exe', ['/c', 'start', '', '/wait', scriptPath, ...args], {
        detached: true,
        stdio: 'ignore',
        ...spawnOptions,
      })
      child.unref()
      console.log('[Preload] spawnDetached: bat launched, pid:', child.pid)
      return child.pid
    }

    const child = spawn('bash', [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore',
      ...spawnOptions,
    })
    child.unref()
    console.log('[Preload] spawnDetached: sh launched, pid:', child.pid)
    return child.pid
  },
}
