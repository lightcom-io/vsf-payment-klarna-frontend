import { KlarnaPlugin } from '../types/KlarnaState';
import Vue from 'vue';
import VueGtm from 'vue-gtm'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'

const formatAmount = amount => amount / 100
const lastTrackedOrderIdKey = 'gtm/last_tracked_order_id'

const plugin: KlarnaPlugin = {
  name: 'googleTagManager',
  onConfirmation: ({ result: order }) => {
    const GTM: VueGtm = (Vue as any).gtm
    const storeView = currentStoreView()
    const lastTrackedOrderId = localStorage.getItem(lastTrackedOrderIdKey)

    if (order.order_id !== lastTrackedOrderId) {
      localStorage.setItem(lastTrackedOrderIdKey, order.order_id)
      GTM.trackEvent({
        'ecommerce': {
          'purchase': {
            'actionField': {
              'id': order.order_id,
              'affiliation': storeView.seo.defaultTitle,
              'revenue': formatAmount(order.order_amount),
              'tax': formatAmount(order.order_tax_amount),
              'shipping': order.selected_shipping_option ? formatAmount(order.selected_shipping_option.price) : 0
            },
            'products': order.order_lines.filter(line => line.type !== 'shipping_fee').map(line => ({
              name: line.name,
              id: line.reference,
              sku: line.reference,
              price: formatAmount(line.unit_price),
              quantity: line.quantity
            }))
          }
        }
      })
    }
  }
};

export default plugin;
