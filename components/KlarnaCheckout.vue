<template>
  <div class="klarna-checkout" id="klarna-checkout">
    <div id="klarna-render-checkout" />
    <div v-if="checkout.loading">
      <loading-spinner />
    </div>
    <div v-if="checkout.error">
      Loading Klarna failed
    </div>
    <div v-if="checkout.snippet" v-html="checkout.snippet" /> <!-- eslint-disable-line vue/no-v-html -->
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { callApi } from '../helpers'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'
import LoadingSpinner from 'theme/components/theme/blocks/AsyncSidebar/LoadingSpinner.vue'
import { isServer } from '@vue-storefront/core/helpers'

const klarnaEvents = [
  'load', 'customer', 'change', 'billing_address_change', 'shipping_address_change', 'shipping_option_change', 'order_total_change', 'can_not_complete_order', 'network_error'
]

export default {
  name: 'KlarnaCheckout',
  components: {
    LoadingSpinner
  },
  async mounted () {
    if (!isServer) {
      this.upsertOrder()
    }
  },
  beforeMount () {
    this.$bus.$on('klarna-update-order', this.configureUpdateOrder)

    // Todo: refactor
    this.$bus.$on('klarna-order-loaded', () => {
      setTimeout(async () => {
        const order = await this.$store.dispatch('kco/fetchOrder', this.checkout.orderId)
        this.onKcoAddressChange({
          totalSegments: this.totals.total_segments,
          shippingAddress: order.shipping_address
        })
      }, 2000)
    })

    this.$bus.$on('klarna-created-order', ({result}) => this.syncShippingOption(result.selected_shipping_option.id))
    this.$bus.$on('klarna-event-shipping_option_change', (data) => this.syncShippingOption(data.id))
    this.$bus.$on('klarna-event-shipping_address_change', () => this.configureUpdateOrder())
  },
  beforeDestroy () {
    this.$bus.$off('klarna-update-order')
    this.$bus.$off('klarna-order-loaded')
    this.$bus.$off('klarna-created-order')
    this.$bus.$off('klarna-event-shipping_option_change')
    this.$bus.$off('klarna-event-shipping_address_change')
  },
  computed: {
    ...mapGetters({
      order: 'kco/order',
      checkout: 'kco/checkout',
      totals: 'kco/platformTotals',
      hasTotals: 'kco/hasTotals',
      coupon: 'kco/coupon'
    })
  },
  watch: {
    coupon (newValue, oldValue) {
      if (!oldValue || newValue.code !== oldValue.code) {
        this.$bus.$emit('klarna-update-order')
      }
    },
    totals (newValue, oldValue) {
      if (oldValue) {
        let shippingMethodChanged = newValue.base_shipping_amount !== oldValue.base_shipping_amount
        if (!shippingMethodChanged && (newValue.items_qty !== oldValue.items_qty || newValue.base_grand_total !== oldValue.base_grand_total)) {
          const storeView = currentStoreView()
          const countryId = this.$store.state.checkout.shippingDetails.country ? this.$store.state.checkout.shippingDetails.country : storeView.tax.defaultCountry
          this.$store.dispatch('cart/syncShippingMethods', {
            country_id: countryId
          })
          this.$bus.$emit('klarna-update-order')
        }
      }
    }
  },
  methods: {
    syncShippingOption (shippingMethod) {
      localStorage.setItem('kco/shipping_method', shippingMethod)

      if (!shippingMethod) return
      let parts = shippingMethod.split('_')
      let carrier = parts.shift()
      let method = parts.join('_') || carrier

      let methodsData = {
        country: this.order.purchase_country,
        carrier_code: carrier,
        method_code: method,
        payment_method: null
      }

      this.$store.dispatch('cart/syncTotals', { forceServerSync: true, methodsData })
    },
    setupKlarnaListeners () {
      const events = {}
      klarnaEvents.forEach(event => {
        events[event] = data => {
          this.$bus.$emit('klarna-event-' + event, data)
        }
      })
      callApi(api => api.on(events))
    },
    async upsertOrder () {
      await this.$store.dispatch('kco/createOrder')
      const { default: postscribe } = await import('postscribe')
      postscribe('#klarna-render-checkout', this.checkout.snippet)
      await Promise.resolve()
      setTimeout(() => this.setupKlarnaListeners(), 500)
    },
    async configureUpdateOrder () {
      if (!this.checkout.order || !this.checkout.order.order_id) {
        return
      }
      await this.suspendCheckout()
      await this.upsertOrder()
      await this.resumeCheckout()
    },
    suspendCheckout () {
      return callApi(api => api.suspend())
    },
    resumeCheckout () {
      return callApi(api => api.resume())
    },
    onKcoAddressChange (orderData) {
      if (orderData.shippingAddress.postal_code) {
        this.$bus.$emit('kcoAddressChange', orderData)
      }
      return callApi(api => api.on({
        'billing_address_change': async (data) => {
          this.$bus.$emit('klarna-order-loaded')
        }
      }))
    }
  }
}
</script>

<style lang="scss">
div.wrapper.wrapper {
  height: 30vh;
  max-width: 100%;
  padding-left: 25px;
}
#klarna-unsupported-page {
  display: none;
}
</style>
