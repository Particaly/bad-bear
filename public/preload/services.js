const { Buffer } = require('node:buffer')

// 确保全局可用（@electron/asar 等依赖库直接读取 global.Buffer）
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

const { spawn } = require('node:child_process')

const fs = require('node:fs')
const path = require('node:path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const t = require('@babel/types')
const asar = require('@electron/asar')

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
    traverse(ast, visitors)
  },

  /**
   * 从 AST 生成代码
   * @param {object} ast - AST 对象
   * @param {object} [options] - babel generator 选项
   * @returns {{ code: string, map?: object }}
   */
  generateCode(ast, options = {}) {
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
  astTypes: t,

  // ===== ASAR 相关能力 =====

  /**
   * 提取 asar 包到目录
   * @param {string} asarPath - asar 文件路径
   * @param {string} destPath - 目标目录
   */
  extractAsar(asarPath, destPath) {
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
    console.log('[Preload] createAsar:', { srcDir, destAsar })
    return asar.createPackage(srcDir, destAsar).then(() => {
      console.log('[Preload] createAsar complete')
    })
  },

  /**
   * 列出 asar 包中的文件
   * @param {string} asarPath - asar 文件路径
   * @returns {string[]}
   */
  listAsar(asarPath) {
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
   * 以 detached 模式启动同目录下的平台原生脚本（swap-asar.bat / swap-asar.sh）
   *
   * - Windows: 通过 cmd /c start 在独立 cmd 窗口运行 .bat，出错 pause 不秒退
   * - Linux/macOS: 通过 bash 运行 .sh，出错 read 等待
   *
   * @param {string[]} args - 传给脚本的参数列表
   * @param {object} [options] - spawn 选项（cwd 等）
   */
  spawnDetached(args, options = {}) {
    console.log('[Preload] spawnDetached:', args)

    // 确保日志目录存在
    const logIdx = args.findIndex(arg => arg.endsWith('.log') || arg.includes('swap-asar.log'))
    if (logIdx >= 0) {
      const logPath = args[logIdx]
      const logDir = path.dirname(logPath)
      if (!fs.existsSync(logDir)) {
        console.log('[Preload] Creating log directory:', logDir)
        fs.mkdirSync(logDir, { recursive: true })
      }
    }

    const isWindows = process.platform === 'win32'
    const scriptPath = path.join(__dirname, `swap-asar${isWindows ? '.bat' : '.sh'}`)

    if (!fs.existsSync(scriptPath)) {
      console.error('[Preload] spawnDetached: script not found:', scriptPath)
      throw new Error(`Script not found: ${scriptPath}`)
    }

    console.log('[Preload] Using script:', scriptPath)

    if (isWindows) {
      // cmd /c start "" /wait script.bat args...
      // start 会打开独立的 cmd 窗口
      const child = spawn('cmd.exe', ['/c', 'start', '', '/wait', scriptPath, ...args], {
        detached: true,
        stdio: 'ignore',
        ...options,
      })
      child.unref()
      console.log('[Preload] spawnDetached: bat launched, pid:', child.pid)
      return child.pid
    }

    const child = spawn('bash', [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore',
      ...options,
    })
    child.unref()
    console.log('[Preload] spawnDetached: sh launched, pid:', child.pid)
    return child.pid
  },
}
