const { Buffer } = require('node:buffer')
const os = require('node:os')

// 确保全局可用（某些依赖库直接读取 global.Buffer）
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

const fs = require('node:fs')
const { createHash } = require('node:crypto')
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

let asarCache = null

function loadAsar() {
  if (asarCache) {
    return asarCache
  }

  asarCache = requireDependency('@electron/asar')
  return asarCache
}

function createTempFilePath(extension) {
  const random = Math.random().toString(36).slice(2, 8)
  return path.join(require('node:os').tmpdir(), `zpx-${Date.now()}-${random}${extension}`)
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
  getSystemInfo() {
    const platform = os.platform()
    return {
      platform: platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux',
    }
  },

  getThemeInfo() {
    return window.ztools.getThemeInfo()
  },

  onThemeChange(callback) {
    window.ztools.onThemeChange(callback)
  },
  // ===== 文件系统能力 =====

  /**
   * 读取文件内容
   */
  readFile(filePath, encoding = 'utf-8') {
    console.log('[Preload] readFile:', filePath)
    const content = fs.readFileSync(filePath, encoding)
    console.log('[Preload] readFile complete, size:', content.length)
    return content
  },

  /**
   * 以二进制方式读取文件内容
   */
  readBinaryFile(filePath) {
    console.log('[Preload] readBinaryFile:', filePath)
    const content = fs.readFileSync(filePath)
    console.log('[Preload] readBinaryFile complete, size:', content.byteLength)
    return content
  },

  /**
   * 写入文件
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
   */
  rename(oldPath, newPath) {
    console.log('[Preload] rename:', oldPath, '->', newPath)
    fs.renameSync(oldPath, newPath)
    console.log('[Preload] rename complete')
  },

  /**
   * 递归删除目录
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
   */
  copyFile(src, dest) {
    console.log('[Preload] copyFile:', src, '->', dest)
    fs.copyFileSync(src, dest)
    console.log('[Preload] copyFile complete')
  },

  /**
   * 递归复制目录
   */
  copyDirectory(src, dest) {
    console.log('[Preload] copyDirectory:', src, '->', dest)
    fs.cpSync(src, dest, { recursive: true })
    console.log('[Preload] copyDirectory complete')
  },

  // ===== 插件打包能力 =====

  /**
   * 将目录打包为 zpx 文件（zpx = brotli(asar)）
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
}


window.ztools.setExpendHeight(600)