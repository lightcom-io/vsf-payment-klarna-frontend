<template>
  <klarna-placement v-if="applicable" v-pre />
</template>

<script>
import KlarnaPlacement from './KlarnaPlacement'

export default {
  mixins: [KlarnaPlacement],
  props: {
    size: {
      type: String,
      default: 'standard'
    },
    amount: {
      type: Number,
      default: null
    }
  },
  data () {
    return {
      identifier: 'credit-promotion'
    }
  },
  computed: {
    purchaseAmount () {
      return this.amount * 100 // Klarna uses microunits
    }
  },
  watch: {
    amount () {
      this.$el.dataset.purchaseAmount = this.purchaseAmount
      this.refresh()
    }
  }
}
</script>
