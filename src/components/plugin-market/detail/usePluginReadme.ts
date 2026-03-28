import { marked } from 'marked'
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { readPluginReadme } from '../../../api/pluginMarket'
import type { PluginMarketUiPlugin } from '../../../types/pluginMarket'

marked.setOptions({ breaks: true, gfm: true })

export function usePluginReadme(plugin: Ref<PluginMarketUiPlugin>) {
  const readmeContent = ref('')
  const readmeLoading = ref(false)
  const readmeError = ref('')

  const renderedMarkdown = computed(() => {
    if (!readmeContent.value) {
      return ''
    }

    return marked(readmeContent.value) as string
  })

  async function loadReadme(): Promise<void> {
    readmeLoading.value = true
    readmeError.value = ''
    readmeContent.value = ''

    try {
      if (plugin.value.installed && plugin.value.path) {
        const localResult = await readPluginReadme(plugin.value.path)
        if (localResult.success && localResult.content) {
          readmeContent.value = localResult.content
          return
        }
      }

      const remoteResult = await readPluginReadme(plugin.value.name)
      if (remoteResult.success && remoteResult.content) {
        readmeContent.value = remoteResult.content
        return
      }

      readmeError.value = remoteResult.error || '暂无详情'
    } catch (error) {
      console.error('[PluginDetail] README 加载失败:', error)
      readmeError.value = error instanceof Error ? error.message : 'README 加载失败'
    } finally {
      readmeLoading.value = false
    }
  }

  onMounted(() => {
    if (plugin.value.name || plugin.value.path) {
      void loadReadme()
    }
  })

  watch(
    () => [plugin.value.name, plugin.value.path],
    () => {
      if (plugin.value.name || plugin.value.path) {
        void loadReadme()
      }
    },
  )

  return {
    readmeLoading,
    readmeError,
    renderedMarkdown,
  }
}
