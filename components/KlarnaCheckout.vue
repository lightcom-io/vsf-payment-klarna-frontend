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
import { alpha3toalpha2 } from '../utils/iso3166'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'
import LoadingSpinner from 'theme/components/theme/blocks/AsyncSidebar/LoadingSpinner.vue'
import { isServer } from '@vue-storefront/core/helpers'

const klarnaEvents = [
  'load', 'customer', 'change', 'billing_address_change', 'shipping_address_change', 'shipping_option_change', 'order_total_change', 'can_not_complete_order', 'network_error'
]

const cleanZipcode = (z) => z.replace(/\W/g, '')

export default {
  name: 'KlarnaCheckout',
  components: {
    LoadingSpinner
  },
  async mounted () {
    if (!isServer) {
      this.initCheckout()
    }
  },
  beforeMount () {
    this.$bus.$on('klarna-update-order', this.updateOrder)
    this.$bus.$on('klarna-created-order', ({ result }) => this.syncShippingOption(result.selected_shipping_option.id))
    this.$bus.$on('klarna-event-shipping_option_change', ({ id }) => this.syncShippingOption(id))
    this.$bus.$on('klarna-event-change', this.syncShippingDetails)
    this.$bus.$on('klarna-event-customer', this.syncShippingDetails)
  },
  beforeDestroy () {
    this.$bus.$off('klarna-update-order')
    this.$bus.$off('klarna-created-order')
    this.$bus.$off('klarna-event-shipping_option_change')
    this.$bus.$off('klarna-event-change')
    this.$bus.$off('klarna-event-customer')
  },
  computed: {
    ...mapGetters({
      shippingDetails: 'checkout/getShippingDetails',
      paymentDetails: 'checkout/getPaymentDetails',
      order: 'kco/order',
      checkout: 'kco/checkout',
      totals: 'kco/platformTotals',
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
        // If shippingMethodChanged, that means it was changed in Klarna, so ignore the change
        let shippingMethodChanged = newValue.base_shipping_amount !== oldValue.base_shipping_amount
        if (!shippingMethodChanged && (newValue.items_qty !== oldValue.items_qty || newValue.base_grand_total !== oldValue.base_grand_total)) {
          // this.$store.dispatch('cart/syncShippingMethods', {}) //  Not sure what this was trying to do...
          this.$bus.$emit('klarna-update-order')
        }
      }
    }
  },
  methods: {
    syncShippingDetails (data) {
      let update = false
      if ('country' in data && alpha3toalpha2(data.country) !== this.shippingDetails.country) {
        this.$set(this.$store.state.checkout.shippingDetails, 'country', alpha3toalpha2(data.country))
        update = true
      }

      if ('postal_code' in data && cleanZipcode(data.postal_code) !== cleanZipcode(this.shippingDetails.zipCode)) {
        this.$set(this.$store.state.checkout.shippingDetails, 'zipCode', data.postal_code)
        update = true
      }

      if ('type' in data) {
        // This is for e.g. Owebia, to know if the customer is a company, to generate correct shiping methods
        if (data.type === 'person' && this.shippingDetails.company) {
          this.$set(this.$store.state.checkout.shippingDetails, 'company', '')
          update = true
        } else if (data.type === 'organization' && !this.shippingDetails.company) {
          this.$set(this.$store.state.checkout.shippingDetails, 'company', 'yes')
          update = true
        }
      }

      update && this.updateOrder()
    },
    syncShippingOption (shippingMethod) {
      localStorage.setItem('kco/shipping_method', shippingMethod)

      if (!shippingMethod) return
      let parts = shippingMethod.split('_')
      let carrier = parts.shift()
      let method = parts.join('_') || carrier

      let methodsData = {
        country: this.shippingDetails.country,
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
    async initCheckout (mount = false) {
      await this.createOrUpdateOrder()
      const { default: postscribe } = await import('postscribe')
      postscribe('#klarna-render-checkout', this.checkout.snippet)
      await Promise.resolve()
      // $nextTick should do it, but if issues arise with events not being triggered, this might have to changed to a timeout.
      this.$nextTick(() => this.setupKlarnaListeners())
    },
    async createOrUpdateOrder () {
      await this.$store.dispatch('kco/createOrder')
    },
    async updateOrder () {
      if (this.checkout.order?.order_id) {
        await this.suspendCheckout()
        await this.createOrUpdateOrder()
        await this.resumeCheckout()
      }
    },
    suspendCheckout () {
      return callApi(api => api.suspend())
    },
    resumeCheckout () {
      return callApi(api => api.resume())
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
