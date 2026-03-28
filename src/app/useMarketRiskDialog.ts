import { computed, type Ref } from 'vue'

const MARKET_RISK_DIALOG_TITLE = '风险提示'
const MARKET_RISK_DIALOG_KEY = 'bad-bear-market-risk-tip-dismissed'
const MARKET_RISK_MESSAGE =
  '商店内的插件均由用户上传，无法保证一定不存在恶意软件或其他风险内容。\n\n' +
  '安装、运行此类插件后，可能会对计算机稳定性以及相关程序的稳定性造成影响，请您自行甄别并谨慎使用。\n\n' +
  '请不要上传有版权风险、破解付费的插件，本应用只是为了方便大家分享插件，如有问题随时跑路！'

export function useMarketRiskDialog(options: {
  confirmAction: (params: {
    title?: string
    message: string
    type?: 'info' | 'warning' | 'danger'
    confirmText?: string
    cancelText?: string
  }) => Promise<boolean>
}) {
  const hasDismissedMarketRiskDialog = computed(() => {
    try {
      return localStorage.getItem(MARKET_RISK_DIALOG_KEY) === '1'
    } catch {
      return false
    }
  })

  async function openMarketRiskDialog(): Promise<void> {
    const acknowledged = await options.confirmAction({
      title: MARKET_RISK_DIALOG_TITLE,
      message: MARKET_RISK_MESSAGE,
      type: 'warning',
      confirmText: '确定',
      cancelText: '不再提示',
    })

    if (!acknowledged) {
      try {
        localStorage.setItem(MARKET_RISK_DIALOG_KEY, '1')
      } catch (error) {
        console.warn('[BadBear] Failed to persist market risk dialog preference:', error)
      }
    }
  }

  return {
    hasDismissedMarketRiskDialog,
    openMarketRiskDialog,
  }
}
