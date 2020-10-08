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
      default: 'auto-size'
    }
  },
  data () {
    return {
      identifier: 'sidebar-promotion'
    }
  }
}
</script>
