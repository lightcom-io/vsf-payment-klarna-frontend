import { KlarnaPlugin } from '../types/KlarnaState'
import newsletter from './newsletter'
import kss from './kss'
import shippingAttributes from './shippingAttributes'
import validateOrderAmount from './validateOrderAmount'
import lastOrder from './lastOrder'
import orderId from './orderId'

export const plugins: KlarnaPlugin[] = []

export const defaultPlugins: KlarnaPlugin[] = [
  kss,
  newsletter,
  shippingAttributes,
  validateOrderAmount,
  lastOrder,
  orderId
]

export function addPlugin (plugin: KlarnaPlugin) {
  plugins.push(plugin)
}
