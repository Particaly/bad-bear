const PLUGIN_NAME = 'bad-bear'
const TARGET_FILE = 'out/main/index.js'
const INTERNAL_PLUGINS_FILE = 'internal-plugins.json'

type PathContext = {
  resourcesPath: string
  exePath: string
  appAsarPath: string
  newAsarPath: string
  backupPath: string
  injectLogPath: string
  restoreLogPath: string
  pluginDataPath: string
}

export function createPathContext(): PathContext {
  const exePath = window.ztools.getPath('exe')
  const exeDir = window.services.path.dirname(exePath)
  const resourcesPath = window.services.path.join(exeDir, 'resources')
  const pluginDataPath = window.services.path.join(
    window.ztools.getPath('userData'),
    'plugins',
    PLUGIN_NAME,
  )

  return {
    resourcesPath,
    exePath,
    pluginDataPath,
    appAsarPath: window.services.path.join(resourcesPath, 'app.asar'),
    newAsarPath: window.services.path.join(resourcesPath, 'app.new.asar'),
    backupPath: window.services.path.join(resourcesPath, 'app.bak.asar'),
    injectLogPath: window.services.path.join(pluginDataPath, 'swap-asar.log'),
    restoreLogPath: window.services.path.join(pluginDataPath, 'restore-asar.log'),
  }
}

export function checkInjectedStatus(): Promise<boolean> {
  return window.ztools.internal.getAllPlugins().then(
    (plugins) => plugins.some((plugin) => plugin.name === PLUGIN_NAME),
    () => false,
  )
}

export async function performInjection(options: {
  updateInjectStep: (step: string) => void
}): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
    const context = createPathContext()

    options.updateInjectStep('正在解压 app.asar...')
    const appFolderPath = window.services.path.join(context.resourcesPath, 'app')
    const targetFilePath = window.services.path.join(appFolderPath, TARGET_FILE)

    if (window.services.exists(appFolderPath)) {
      window.services.removeDirectory(appFolderPath)
    }

    window.services.extractAsar(context.appAsarPath, appFolderPath)

    options.updateInjectStep('正在读取并分析代码...')
    const originalCode = window.services.readFile(targetFilePath, 'utf-8')

    options.updateInjectStep('正在注入插件名称...')
    const internalPluginNames: string[] = []
    const { code: modifiedCode } = window.services.transformCode(
      originalCode,
      {
        VariableDeclarator(path) {
          if (
            path.node.id.type === 'Identifier' &&
            path.node.id.name === 'INTERNAL_PLUGIN_NAMES'
          ) {
            const init = path.node.init
            if (init && init.type === 'ArrayExpression') {
              for (const element of init.elements) {
                if (element && element.type === 'StringLiteral') {
                  internalPluginNames.push(element.value)
                }
              }

              const hasPlugin = init.elements.some(
                (element) => element && element.type === 'StringLiteral' && element.value === PLUGIN_NAME,
              )

              if (!hasPlugin) {
                init.elements.push(window.services.astTypes.stringLiteral(PLUGIN_NAME))
                internalPluginNames.push(PLUGIN_NAME)
              }
            }
          }
        },
        ClassMethod(path) {
          if (path.node.key.type !== 'Identifier' || path.node.key.name !== 'getPlugins') return

          path.traverse({
            ReturnStatement(returnPath) {
              const arg = returnPath.node.argument
              if (!arg || arg.type !== 'CallExpression') return
              if (arg.callee.type !== 'MemberExpression') return
              if (arg.callee.property.type !== 'Identifier') return
              if (arg.callee.property.name !== 'filter') return

              returnPath.get('argument').replaceWith(arg.callee.object)
            },
          })
        },
      },
      {},
      { retainLines: true },
    )

    window.services.writeFile(targetFilePath, modifiedCode)

    if (internalPluginNames.length > 0) {
      options.updateInjectStep('正在保存内置插件名单...')
      const internalPluginsFilePath = window.services.path.join(context.pluginDataPath, INTERNAL_PLUGINS_FILE)
      window.services.writeFile(internalPluginsFilePath, JSON.stringify(internalPluginNames, null, 2))
    }

    options.updateInjectStep('正在打包 app.new.asar...')
    await window.services.createAsar(appFolderPath, context.newAsarPath)

    window.services.removeDirectory(appFolderPath)

    options.updateInjectStep('准备重启，正在启动替换脚本...')
    window.services.spawnDetached([context.resourcesPath, context.exePath, context.injectLogPath], {
      scriptName: 'swap-asar',
    })

    return {
      success: true,
      backupPath: context.backupPath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function getInternalPluginNames(): string[] {
  try {
    const context = createPathContext()
    const filePath = window.services.path.join(context.pluginDataPath, INTERNAL_PLUGINS_FILE)
    if (!window.services.exists(filePath)) return []
    const content = window.services.readFile(filePath, 'utf-8')
    const names: unknown = JSON.parse(content)
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : []
  } catch {
    return []
  }
}

export async function scheduleRestore(): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
    const context = createPathContext()

    if (!window.services.exists(context.backupPath)) {
      return {
        success: false,
        error: `未找到备份文件，无法解除注入\n路径: ${context.backupPath}`,
      }
    }

    window.services.spawnDetached([context.resourcesPath, context.exePath, context.restoreLogPath], {
      scriptName: 'restore-asar',
    })

    return {
      success: true,
      backupPath: context.backupPath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '启动恢复脚本失败',
    }
  }
}

