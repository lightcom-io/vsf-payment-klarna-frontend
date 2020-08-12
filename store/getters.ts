import { GetterTree } from 'vuex'
import KlarnaState, { KlarnaOrder, KlarnaShippingOption, KlarnaShippingOrderLine } from '../types/KlarnaState'
import RootState from '@vue-storefront/core/types/RootState'
import config from 'config'
import { currentStoreView, localizedRoute } from '@vue-storefront/core/lib/multistore'
import { getThumbnailPath } from '@vue-storefront/core/helpers'
import { router } from '@vue-storefront/core/app'
import CartItem from '@vue-storefront/core/modules/cart/types/CartItem'

const unique = (arr: any[]): any[] => [...new Set(arr)]
const sumByKey = (key: string, arr: any[]) => arr.reduce((sum, item) => sum + item[key], 0)

const getFullMethodCode = (method: Record<string, any>): string => unique([method.carrier_code, method.method_code].filter(Boolean)).join('_')
const getFullMethodName = (method: Record<string, any>): string => unique([method.carrier_title, method.method_title].filter(Boolean)).join(' - ')

const formatRawAmount = (amount: number): number => amount ? Math.round(amount * 100) : 0
const getTaxAmount = (totalAmount: number, taxRate: number): number => totalAmount / (1 + (1 / taxRate))
const calcTaxRate = (incl: number, excl: number) => excl ? ((incl / excl) - 1) * 10000 : 0

const makeKlarnaShippingOption = (method: Record<string, any>, preSelected: boolean = false): KlarnaShippingOption => {
  return {
    id: getFullMethodCode(method),
    name: getFullMethodName(method),
    price: formatRawAmount(method.price_incl_tax),
    tax_amount: formatRawAmount(method.price_incl_tax - method.price_excl_tax),
    tax_rate: calcTaxRate(method.price_incl_tax, method.price_excl_tax),
    preselected: preSelected
  }
}

const makeKlarnaShippingRow = (option: KlarnaShippingOption): KlarnaShippingOrderLine => {
  return {
    type: 'shipping_fee',
    quantity: 1,
    name: option.name,
    total_amount: option.price,
    unit_price: option.price,
    total_tax_amount: option.tax_amount,
    tax_rate: option.tax_rate
  }
}

const getProductUrl = product => {
  const storeView = currentStoreView()
  const productUrl = localizedRoute({
    name: product.type_id + '-product',
    fullPath: product.url_path,
    params: { parentSku: product.parentSku ? product.parentSku : product.sku, slug: product.slug, childSku: product.sku }
  }, storeView.storeCode)
  return router.resolve(productUrl).href
}

const mapProductToKlarna = (product) => {
  const vsfProduct = product.product

  // Total amount including tax and discounts
  // const total_amount = formatRawAmount(product.row_total) - formatRawAmount(product.discount_amount) + formatRawAmount(product.tax_amount)
  // const total_discount_amount = formatRawAmount(product.row_total_incl_tax) - total_amount
  // const total_tax_amount = formatRawAmount(product.tax_amount)
  const total_amount = formatRawAmount(product.row_total_incl_tax) - formatRawAmount(product.discount_amount)
  const total_discount_amount = formatRawAmount(product.discount_amount)
  const total_tax_amount = formatRawAmount(product.tax_amount)

  const klarnaProduct: any = {
    name: product.name,
    quantity: product.qty,
    unit_price: formatRawAmount(product.price_incl_tax),
    tax_rate: formatRawAmount(product.tax_percent),
    total_amount,
    total_discount_amount,
    total_tax_amount
  }
  if (vsfProduct) {
    klarnaProduct.image_url = getThumbnailPath(vsfProduct.image, 600, 600) || ''
    klarnaProduct.reference = vsfProduct.sku
    if (config.klarna.productBaseUrl) {
      klarnaProduct.product_url = config.klarna.productBaseUrl + getProductUrl(vsfProduct)
    }
  }
  return klarnaProduct
}

export const getters: GetterTree<KlarnaState, RootState> = {
  checkout (state: KlarnaState) {
    return state.checkout
  },
  confirmation (state: KlarnaState) {
    return state.confirmation
  },
  coupon (state, getters, rootState, rootGetters) {
    // renamed to getCoupon in VSF 1.10
    return rootGetters['cart/getCoupon'] || rootGetters['cart/coupon']
  },
  hasTotals (state, getters, rootState) {
    const {platformTotals: totals} = rootState.cart
    const productTotals = rootState.cart.cartItems.every(item => !!item.totals)
    return !!totals && productTotals
  },
  platformTotals (state, getters, rootState) {
    const {platformTotals: totals} = rootState.cart
    return totals || {items: [], total_segments: []}
  },
  storageTarget () {
    const storeView = currentStoreView()
    const dbNamePrefix = storeView.storeCode ? storeView.storeCode + '-kco' : 'kco'
    return `${dbNamePrefix}/id`
  },
  getTrueCartItems (state: KlarnaState, getters, rootState, rootGetters) {
    const cartItems: CartItem[] = Array.from(rootGetters['cart/getCartItems'])
    const totals = getters.platformTotals
    const trueCartItems = totals.items.map(item => {
      const newItem = {...item}
      const vsfitem = cartItems.find(_item => _item.totals.item_id === item.item_id)
      if (vsfitem) {
        newItem.product = vsfitem
      }
      return newItem
    })
    return trueCartItems
  },
  getPurchaseCountry (state: KlarnaState) {
    const storeView: any = currentStoreView()
    let purchaseCountry = state.purchaseCountry || storeView.i18n.defaultCountry
    if (storeView.shipping_countries && !storeView.shipping_countries.includes(purchaseCountry)) {
      purchaseCountry = storeView.i18n.defaultCountry
    }
    // If purchaseCountry isn't valid ISO 3166 we overwrite it
    if (!/^[A-Za-z]{2,2}$/.test(purchaseCountry)) {
      purchaseCountry = storeView.i18n.defaultCountry
    }
    return purchaseCountry
  },
  isFreeShipping (state: KlarnaState, getters) {
    // Check if it freeshipping from coupon or not
    return getters.platformTotals.total_segments.find((totalsSegment) => {
      return totalsSegment.code === 'shipping' && parseInt(totalsSegment.value) === 0
    })
  },
  order (state: KlarnaState, getters, rootState, rootGetters): KlarnaOrder {
    const storeView: any = currentStoreView()
    const cartItems = getters.getTrueCartItems
    const shippingMethods = rootGetters['checkout/getShippingMethods'] || rootGetters['shipping/getShippingMethods']
    const totals = getters.platformTotals

    const checkoutOrder: KlarnaOrder = {
      purchase_country: getters.getPurchaseCountry,
      purchase_currency: storeView.i18n.currencyCode,
      locale: storeView.i18n.defaultLocale,
      shipping_options: [],
      shipping_countries: storeView.shipping_countries || [],
      order_lines: cartItems.map(mapProductToKlarna),
      order_amount: formatRawAmount(totals.base_grand_total),
      order_tax_amount: formatRawAmount(totals.base_tax_amount),
      options: config.klarna.options ? config.klarna.options : null,
      merchant_data: JSON.stringify(state.merchantData)
    }
    if (state.checkout.orderId) {
      checkoutOrder.orderId = state.checkout.orderId
    }
    if (config.klarna.showShippingOptions && state.shippingOptions) {
      checkoutOrder.order_amount = formatRawAmount(totals.base_grand_total - totals.base_shipping_incl_tax)
      checkoutOrder.order_tax_amount = formatRawAmount(totals.base_tax_amount - totals.base_shipping_tax_amount)
      checkoutOrder.shipping_options = shippingMethods.map((method, index: number) => {
        return makeKlarnaShippingOption(method, index === 0)
      })
    }

    const { shippingMethod: code } = rootState.checkout.shippingDetails

    let shippingMethod = shippingMethods.find(method => method.method_code === code)
    if (shippingMethod) {
      const price = totals.shipping_incl_tax
      const shippingTaxRate = totals.shipping_tax_amount / totals.shipping_amount
      const taxAmount = getTaxAmount(totals.shipping_incl_tax, shippingTaxRate)
      checkoutOrder.order_amount = formatRawAmount(totals.base_grand_total)
      checkoutOrder.order_tax_amount = formatRawAmount(totals.base_tax_amount)
      checkoutOrder.order_lines.push({
        type: 'shipping_fee',
        quantity: 1,
        name: getFullMethodName(shippingMethod),
        total_amount: formatRawAmount(price),
        unit_price: formatRawAmount(price),
        total_tax_amount: formatRawAmount(taxAmount),
        tax_rate: shippingTaxRate ? shippingTaxRate * 10000 : 0
      })
    } else {
      let selectedOption
      const selectedShippingMethodId = localStorage.getItem('kco/shipping_method')
      if (selectedShippingMethodId) {
        selectedOption = shippingMethods.find(method => getFullMethodCode(method) === selectedShippingMethodId)
      }
      if (!selectedOption && shippingMethods.length) {
        selectedOption = shippingMethods[0]
      }

      if (selectedOption) {
        const option: KlarnaShippingOption = makeKlarnaShippingOption(selectedOption)
        const orderLine: KlarnaShippingOrderLine = makeKlarnaShippingRow(option)

        checkoutOrder.order_lines.push(orderLine)
        checkoutOrder.selected_shipping_option = option

        checkoutOrder.order_amount = sumByKey('total_amount', checkoutOrder.order_lines)
        checkoutOrder.order_tax_amount = sumByKey('total_tax_amount', checkoutOrder.order_lines)
      }
    }

    return checkoutOrder
  }
}
