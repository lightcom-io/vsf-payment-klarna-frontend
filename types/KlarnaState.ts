export interface KlarnaPlugin {
  beforeCreate?: (any) => KlarnaOrder,
  afterCreate?: (any) => void,
  onConfirmation?: (any) => void,
  name: string
}

interface SubState {
  loading: boolean,
  snippet?: string,
  orderId?: string,
  error: boolean,
  attempts?: number,
  order?: Record<string, any>
}

export default interface KlarnaState {
  confirmation: SubState,
  checkout: SubState,
  shippingOptions: boolean,
  merchantData: Record<string, any>,
  purchaseCountry: string
}

export interface KlarnaProduct {
  type?: string,
  reference?: string, // sku
  name: string,
  quantity: number,
  quantity_unit?: string,
  unit_price: number,
  tax_rate: number,
  total_amount: number,
  total_discount_amount?: number,
  total_tax_amount: number,
  merchant_data?: string,
  product_url?: string,
  image_url?: string,
  product_identifiers?: Record<string, any>,
  shipping_attributes?: Record<string, any>
}

interface KlarnaCustomer {
  date_of_birth?: string,
  type?: string,
  organization_registration_id?: string,
  gender?: string
}

export interface KlarnaOrder {
  orderId?: string,
  purchase_country: string,
  purchase_currency: string,
  locale: string,
  billing_address?: Record<string, any>,
  shipping_address?: Record<string, any>,
  order_amount: number,
  order_tax_amount: number,
  order_lines: any[],
  customer?: KlarnaCustomer,
  merchant_reference1?: string,
  // merchant_reference2?: string // reserved for API
  options?: Record<string, any>,
  attachment?: Record<string, any>,
  external_payment_methods?: any[],
  external_checkouts?: any[],
  shipping_countries: string[],
  shipping_options: KlarnaShippingOption[],
  merchant_data: string,
  selected_shipping_option?: KlarnaShippingOption,
  tags?: string[]
}

export interface KlarnaShippingOption {
  id: string,
  name: string,
  price: number,
  tax_amount: number,
  tax_rate: number,
  preselected: boolean
}

export interface KlarnaShippingOrderLine {
  type: string,
  quantity: number,
  name: string,
  total_amount: number,
  unit_price: number,
  total_tax_amount: number,
  tax_rate: number
}
