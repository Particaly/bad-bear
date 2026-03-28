import type {
  CategoryInfo,
  CategoryLayoutSection,
  InstalledPlugin,
  PluginMarketFetchResponse,
  PluginMarketPlugin,
  PluginMarketSectionModel,
  PluginMarketStorefrontCategory,
  PluginMarketStorefrontSection,
  PluginMarketUiPlugin,
  Platform,
  StorefrontCategorySummary,
} from '../../../types/pluginMarket'
import {
  buildInstalledViewPlugins,
  isPluginVisibleOnPlatform,
  resolvePluginList,
  toInstalledMap,
  toUiPlugin,
} from './shared'

export function buildMarketViewState(
  marketResult: PluginMarketFetchResponse,
  nextInstalledPlugins: InstalledPlugin[],
  nextRunningPluginPaths: string[],
  currentPlatform: Platform,
): {
  uiPlugins: PluginMarketUiPlugin[]
  marketPlugins: PluginMarketPlugin[]
  storefrontCategories: Record<string, CategoryInfo>
  storefrontSections: PluginMarketSectionModel[]
  categoryLayouts: Record<string, CategoryLayoutSection[]>
  installedViewPlugins: ReturnType<typeof buildInstalledViewPlugins>
} {
  const runningSet = new Set<string>(nextRunningPluginPaths)
  const installedMap = toInstalledMap(nextInstalledPlugins)
  const marketPlugins: PluginMarketPlugin[] = (marketResult.data || []).filter((plugin) =>
    isPluginVisibleOnPlatform(plugin, currentPlatform),
  )

  const uiPlugins: PluginMarketUiPlugin[] = marketPlugins.map((plugin) =>
    toUiPlugin(plugin, installedMap, runningSet),
  )

  const nextPluginMap = new Map<string, PluginMarketUiPlugin>(
    uiPlugins.map((plugin) => [plugin.name, plugin]),
  )
  const nextMarketPluginMap = new Map<string, PluginMarketPlugin>(
    marketPlugins.map((plugin) => [plugin.name, plugin]),
  )
  const nextCategories: Record<string, CategoryInfo> = {}
  const storefront = marketResult.storefront

  if (storefront?.categories) {
    Object.entries(storefront.categories).forEach(
      ([key, category]: [string, PluginMarketStorefrontCategory]) => {
        const categoryPlugins = resolvePluginList(category.plugins, nextPluginMap)
        if (categoryPlugins.length > 0) {
          nextCategories[key] = {
            key: category.key,
            title: category.title,
            description: category.description,
            icon: category.icon,
            plugins: categoryPlugins,
          }
        }
      },
    )
  }

  const nextSections: PluginMarketSectionModel[] = []

  ;(storefront?.sections || []).forEach((section: PluginMarketStorefrontSection) => {
    if (section.type === 'banner') {
      if (section.items?.length) {
        nextSections.push(section)
      }
      return
    }

    if (section.type === 'navigation') {
      const categories = (section.categories || []).filter(
        (category: StorefrontCategorySummary) =>
          (nextCategories[category.key]?.plugins.length || 0) > 0,
      )

      if (categories.length > 0) {
        nextSections.push({
          type: 'navigation',
          key: section.key,
          title: section.title,
          categories,
        })
      }
      return
    }

    const sectionPlugins = resolvePluginList(section.plugins, nextPluginMap)
    if (sectionPlugins.length > 0) {
      nextSections.push({
        type: section.type,
        key: section.key,
        title: section.title,
        plugins: sectionPlugins,
      })
    }
  })

  return {
    uiPlugins,
    marketPlugins,
    storefrontCategories: nextCategories,
    storefrontSections: nextSections,
    categoryLayouts: storefront?.categoryLayouts || {},
    installedViewPlugins: buildInstalledViewPlugins(
      nextInstalledPlugins,
      nextMarketPluginMap,
      runningSet,
    ),
  }
}
