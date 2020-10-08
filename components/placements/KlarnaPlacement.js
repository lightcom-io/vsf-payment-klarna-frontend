import { isServer } from '@vue-storefront/core/helpers/index'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'

const country = currentStoreView().i18n.defaultCountry.toUpperCase()
const language = currentStoreView().i18n.defaultLanguage.toLowerCase()

export default {
  props: {
    theme: {
      type: String,
      default: null
    },
    inline: {
      type: Boolean,
      default: false
    },
    preload: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    applicable () {
      return !isServer
    },
    key () {
      return `${this.identifier}-${this.size}`
    },
    locale () {
      return `${language}-${country}`
    }
  },
  methods: {
    refresh () {
      if (!isServer && 'KlarnaOnsiteService' in window) {
        window.KlarnaOnsiteService.push({ eventName: 'refresh-placements' })
      }
    }
  },
  mounted () {
    const data = this.$el.dataset
    Object.assign(data, {
      key: this.key,
      locale: this.locale,
      theme: this.theme,
      inline: this.inline,
      preload: this.preload
    })

    if (this.amount) {
      data.purchaseAmount = this.purchaseAmount
    }
    this.refresh()
  }
}
