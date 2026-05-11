import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePluginReadme } from './usePluginReadme'
import type { PluginDetailReadme, PluginMarketUiPlugin } from '../../../types/pluginMarket'

const { readPluginReadmeMock } = vi.hoisted(() => ({
  readPluginReadmeMock: vi.fn(),
}))

vi.mock('../../../api/pluginMarket', () => ({
  readPluginReadme: readPluginReadmeMock,
}))

async function flushReadmeLoad() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

function createPlugin(partial: Partial<PluginMarketUiPlugin>): PluginMarketUiPlugin {
  return {
    name: 'demo-plugin',
    version: '1.0.0',
    title: 'Demo Plugin',
    description: 'Demo',
    installed: false,
    ...partial,
  }
}

function mountReadmeHarness(options: {
  plugin: PluginMarketUiPlugin
  remoteReadme?: PluginDetailReadme | null
}) {
  const plugin = ref(options.plugin)
  const remoteReadme = ref<PluginDetailReadme | null | undefined>(options.remoteReadme)
  const state: ReturnType<typeof usePluginReadme> = {} as ReturnType<typeof usePluginReadme>
  const container = document.createElement('div')

  const app = createApp(
    defineComponent({
      setup() {
        Object.assign(state, usePluginReadme(plugin, remoteReadme))
        return () => h('div')
      },
    }),
  )

  app.mount(container)

  return {
    app,
    state,
  }
}

afterEach(() => {
  readPluginReadmeMock.mockReset()
})

describe('usePluginReadme', () => {
  it('prefers remote API README over inline fallback content', async () => {
    readPluginReadmeMock.mockResolvedValue({
      success: true,
      content: '# API README',
    })

    const harness = mountReadmeHarness({
      plugin: createPlugin({ installed: false }),
      remoteReadme: {
        hash: 'sha256:abc',
        content: '# Fallback README',
        isAiGenerated: true,
      },
    })

    await flushReadmeLoad()

    expect(readPluginReadmeMock).toHaveBeenCalledWith('demo-plugin')
    expect(harness.state.readmeError.value).toBe('')
    expect(harness.state.renderedMarkdown.value).toContain('API README')
    expect(harness.state.showAiGeneratedBadge.value).toBe(false)

    harness.app.unmount()
  })

  it('falls back to inline AI README when remote API content is unavailable', async () => {
    readPluginReadmeMock.mockResolvedValue({
      success: false,
      error: '暂无详情',
    })

    const harness = mountReadmeHarness({
      plugin: createPlugin({ installed: false }),
      remoteReadme: {
        hash: 'sha256:abc',
        content: '# AI README',
        isAiGenerated: true,
      },
    })

    await flushReadmeLoad()

    expect(harness.state.renderedMarkdown.value).toContain('AI README')
    expect(harness.state.showAiGeneratedBadge.value).toBe(true)

    harness.app.unmount()
  })

  it('keeps installed plugin README loading on the host path', async () => {
    readPluginReadmeMock.mockResolvedValue({
      success: true,
      content: '# Local README',
    })

    const harness = mountReadmeHarness({
      plugin: createPlugin({ installed: true, path: 'C:/plugins/demo-plugin' }),
      remoteReadme: {
        hash: 'sha256:def',
        content: '# Remote README',
      },
    })

    await flushReadmeLoad()

    expect(readPluginReadmeMock).toHaveBeenCalledWith('C:/plugins/demo-plugin')
    expect(harness.state.renderedMarkdown.value).toContain('Local README')
    expect(harness.state.showAiGeneratedBadge.value).toBe(false)

    harness.app.unmount()
  })
})
