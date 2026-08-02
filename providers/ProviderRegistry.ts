import type { IDataObject, JsonValue } from '../shared/types/N8n';
import { isRecord, slug, toFiniteNumber, toStringValue } from '../shared/utils/Helpers';

export interface ProviderBuildInput {
  providerId: string;
  actionId: string;
  invoice: IDataObject;
  recipient: IDataObject;
  profile: IDataObject;
}

export interface ProviderBuildResult {
  body: JsonValue;
  query: IDataObject;
  warnings: string[];
  errors: string[];
  responsePaths: IDataObject;
  requestMapping: IDataObject;
  responsePolicy: IDataObject;
}


const DEFAULT_RETRYABLE_STATUS_CODES = [408, 409, 425, 429, 500, 502, 503, 504];
const DEFAULT_SUCCESS_STATUS_CODES = [200, 201, 202];

const PROVIDER_REQUEST_MAPPINGS: Record<string, IDataObject> = {
  stripe: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/x-www-form-urlencoded', idempotencyHeader: 'Idempotency-Key', responseKind: 'stripe.invoice' },
  paddle: { canonicalAction: 'create_transaction', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'paddle.transaction' },
  polar: { canonicalAction: 'create_checkout_or_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'polar.checkout' },
  lemonsqueezy: { canonicalAction: 'create_order', method: 'POST', contentType: 'application/vnd.api+json', idempotencyHeader: 'Idempotency-Key', responseKind: 'lemonsqueezy.order' },
  'invoice-ninja': { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'invoice_ninja.invoice' },
  'zoho-books': { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'zoho_books.invoice' },
  xero: { canonicalAction: 'create_accounts_receivable_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'xero.invoices' },
  erpnext: { canonicalAction: 'create_sales_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'erpnext.sales_invoice' },
  odoo: { canonicalAction: 'execute_kw_account_move_create', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'odoo.jsonrpc' },
  quickbooks: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Request-Id', responseKind: 'quickbooks.invoice' },
  freshbooks: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'freshbooks.invoice' },
  chargebee: { canonicalAction: 'create_invoice_or_charge', method: 'POST', contentType: 'application/x-www-form-urlencoded', idempotencyHeader: 'Idempotency-Key', responseKind: 'chargebee.invoice' },
  recurly: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'recurly.invoice' },
  square: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: '', responseKind: 'square.invoice' },
  paypal: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'PayPal-Request-Id', responseKind: 'paypal.invoice' },
  braintree: { canonicalAction: 'graphql_charge', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'braintree.graphql' },
  razorpay: { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'razorpay.invoice' },
  'bill-com': { canonicalAction: 'create_invoice', method: 'POST', contentType: 'application/json', idempotencyHeader: 'X-Request-Id', responseKind: 'bill_com.invoice' },
  custom: { canonicalAction: 'custom_request', method: 'POST', contentType: 'application/json', idempotencyHeader: 'Idempotency-Key', responseKind: 'custom' },
};

function providerRequestMapping(providerId: string, actionId: string): IDataObject {
  const preset = PROVIDER_REQUEST_MAPPINGS[providerId] ?? PROVIDER_REQUEST_MAPPINGS.custom;
  return {
    schemaVersion: '1.0', providerId, actionId: toStringValue(actionId), canonicalAction: preset.canonicalAction,
    method: preset.method, contentType: preset.contentType, idempotencyHeader: preset.idempotencyHeader,
    responseKind: preset.responseKind, allowedMethods: ['POST', 'PUT', 'PATCH'], source: providerId === 'custom' ? 'custom-provider-profile' : 'built-in-provider-preset',
  };
}

function providerResponsePolicy(providerId: string): IDataObject {
  const nonRetryableStatusCodes = [400, 401, 403, 404, 422];
  return {
    schemaVersion: '1.0', providerId, successStatusCodes: DEFAULT_SUCCESS_STATUS_CODES,
    retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES, nonRetryableStatusCodes,
    parseJsonStrings: true, errorMessagePaths: ['error.message', 'message', 'errors.0.message', 'data.error.message'],
  };
}

const PROVIDER_ALIASES: Record<string, string> = {
  'zoho-books': 'zoho-books',
  zoho: 'zoho-books',
  'invoice-ninja': 'invoice-ninja',
  invoiceninja: 'invoice-ninja',
  'lemon-squeezy': 'lemonsqueezy',
  lemon_squeezy: 'lemonsqueezy',
  'bill-com': 'bill-com',
  bill: 'bill-com',
};

export function normalizeProviderId(value: unknown): string {
  const id = slug(value);
  return PROVIDER_ALIASES[id] ?? id;
}

function custom(invoice: IDataObject, recipient: IDataObject, key: string): JsonValue | undefined {
  const invoiceCustom = isRecord(invoice.customFields) ? invoice.customFields : {};
  const recipientCustom = isRecord(recipient.customFields) ? recipient.customFields : {};
  return invoiceCustom[key] ?? recipientCustom[key];
}

function hasValue(value: unknown): boolean {
  return toStringValue(value).trim().length > 0;
}

function hasCustom(invoice: IDataObject, recipient: IDataObject, key: string): boolean {
  return hasValue(custom(invoice, recipient, key));
}

function requireCustom(errors: string[], invoice: IDataObject, recipient: IDataObject, key: string, providerName: string): void {
  if (!hasCustom(invoice, recipient, key)) errors.push(`${providerName} requires custom_fields.${key}.`);
}

function requireAnyCustom(errors: string[], invoice: IDataObject, recipient: IDataObject, keys: string[], providerName: string, label: string): void {
  if (!keys.some((key) => hasCustom(invoice, recipient, key))) errors.push(`${providerName} requires ${label} (${keys.map((key) => `custom_fields.${key}`).join(' or ')}).`);
}

function requireItemCustom(errors: string[], invoice: IDataObject, recipient: IDataObject, items: IDataObject[], keyPrefix: string, fallbackKey: string, providerName: string, label: string): void {
  if (items.length === 0) return;
  items.forEach((item, index) => {
    const itemName = toStringValue(item.name, String(index + 1));
    const namedKey = `${keyPrefix}${itemName}`;
    const indexedKey = `${keyPrefix}${index + 1}`;
    if (!hasCustom(invoice, recipient, namedKey) && !hasCustom(invoice, recipient, indexedKey) && !hasCustom(invoice, recipient, fallbackKey)) {
      errors.push(`${providerName} line ${index + 1} requires ${label} (custom_fields.${namedKey} or custom_fields.${indexedKey} or custom_fields.${fallbackKey}).`);
    }
  });
}

function lineItems(invoice: IDataObject): IDataObject[] {
  return Array.isArray(invoice.lineItems) ? invoice.lineItems.filter(isRecord) : [];
}

function commonItems(invoice: IDataObject): IDataObject[] {
  return lineItems(invoice).map((item) => ({
    name: toStringValue(item.name ?? item.description, 'Item'),
    description: toStringValue(item.description),
    quantity: Math.max(1, toFiniteNumber(item.quantity, 1)),
    unitPrice: toFiniteNumber(item.unitPrice ?? item.price ?? item.amount, 0),
    lineTotal: toFiniteNumber(item.lineTotal, toFiniteNumber(item.quantity, 1) * toFiniteNumber(item.unitPrice ?? item.price ?? item.amount, 0)),
  }));
}

function validateCommon(invoice: IDataObject, recipient: IDataObject, items: IDataObject[]): string[] {
  const errors: string[] = [];
  if (!hasValue(recipient.email)) errors.push('Recipient email is required.');
  if (!hasValue(invoice.invoiceNumber)) errors.push('Invoice number is required.');
  if (!hasValue(invoice.invoiceDate)) errors.push('Invoice date is required.');
  if (!hasValue(invoice.currency)) errors.push('Invoice currency is required.');
  if (items.length === 0) errors.push('At least one invoice line item is required.');
  items.forEach((item, index) => {
    if (!hasValue(item.name) && !hasValue(item.description)) errors.push(`Line item ${index + 1} requires a name or description.`);
    if (toFiniteNumber(item.quantity, 0) <= 0) errors.push(`Line item ${index + 1} quantity must be greater than zero.`);
    if (toFiniteNumber(item.unitPrice, -1) < 0) errors.push(`Line item ${index + 1} unit price must be zero or greater.`);
  });
  return errors;
}

function validateProfile(profile: IDataObject, providerName: string): string[] {
  const errors: string[] = [];
  if (!hasValue(profile.id)) errors.push(`${providerName} provider profile id is required.`);
  if (!hasValue(profile.baseUrl)) errors.push(`${providerName} provider profile Base URL is required.`);
  if (!hasValue(profile.endpoint)) errors.push(`${providerName} provider profile Endpoint is required.`);
  if (!hasValue(profile.method)) errors.push(`${providerName} provider profile Method is required.`);
  if (!hasValue(profile.credentialRef)) errors.push(`${providerName} provider credential reference is required.`);
  return errors;
}

function commonEnvelope(invoice: IDataObject, recipient: IDataObject): IDataObject {
  return {
    invoice_number: toStringValue(invoice.invoiceNumber),
    invoice_date: toStringValue(invoice.invoiceDate),
    due_date: toStringValue(invoice.dueDate),
    currency: toStringValue(invoice.currency, 'USD'),
    customer: {
      name: toStringValue(recipient.name),
      email: toStringValue(recipient.email),
      phone: toStringValue(recipient.phone),
      company: toStringValue(recipient.company),
      address: toStringValue(recipient.address),
      country: toStringValue(recipient.country),
      state: toStringValue(recipient.state),
      city: toStringValue(recipient.city),
      zip: toStringValue(recipient.zip),
    },
    items: commonItems(invoice),
    totals: isRecord(invoice.totals) ? invoice.totals : {},
    payment: isRecord(invoice.payment) ? invoice.payment : {},
    custom_fields: isRecord(invoice.customFields) ? invoice.customFields : {},
  };
}

function responsePaths(providerId: string): IDataObject {
  const generic = {
    invoiceId: ['id', 'invoice.id', 'data.id'],
    invoiceNumber: ['invoice_number', 'number', 'invoice.invoice_number', 'data.number'],
    status: ['status', 'invoice.status', 'data.status'],
    invoiceUrl: ['hosted_invoice_url', 'invoice_url', 'invoice.invoice_url', 'data.url'],
    pdfUrl: ['invoice_pdf', 'pdf_url', 'invoice.pdf_url'],
    transactionId: ['transaction_id', 'transaction.id', 'data.transaction_id'],
    errorCode: ['error.code', 'code', 'errors.0.code'],
    errorMessage: ['error.message', 'message', 'errors.0.message', 'data.error.message'],
  };
  const overrides: Record<string, IDataObject> = {
    stripe: { invoiceId: ['id', 'invoice.id', 'data.id'], invoiceNumber: ['number', 'invoice.number'], status: ['status', 'invoice.status'], invoiceUrl: ['hosted_invoice_url', 'invoice.hosted_invoice_url'], pdfUrl: ['invoice_pdf', 'invoice.invoice_pdf'] },
    paddle: { invoiceId: ['data.id', 'id'], status: ['data.status', 'status'], invoiceUrl: ['data.checkout.url', 'checkout.url'], transactionId: ['data.id', 'id'] },
    lemonsqueezy: { invoiceId: ['data.id', 'id'], status: ['data.attributes.status', 'status'], invoiceUrl: ['data.attributes.urls.receipt', 'data.attributes.url'] },
    'invoice-ninja': { invoiceId: ['data.id', 'id'], invoiceNumber: ['data.number', 'number'], status: ['data.status_id', 'status'], invoiceUrl: ['data.invitations.0.link', 'data.link'] },
    'zoho-books': { invoiceId: ['invoice.invoice_id', 'invoice_id'], invoiceNumber: ['invoice.invoice_number', 'invoice_number'], status: ['invoice.status', 'status'], invoiceUrl: ['invoice.invoice_url', 'invoice_url'] },
    xero: { invoiceId: ['Invoices.0.InvoiceID', 'InvoiceID'], invoiceNumber: ['Invoices.0.InvoiceNumber', 'InvoiceNumber'], status: ['Invoices.0.Status', 'Status'] },
    erpnext: { invoiceId: ['data.name', 'name'], invoiceNumber: ['data.name', 'name'], status: ['data.status', 'status'] },
    odoo: { invoiceId: ['result.id', 'result', 'id'], invoiceNumber: ['result.name', 'name'], status: ['result.state', 'state'] },
    quickbooks: { invoiceId: ['Invoice.Id', 'QueryResponse.Invoice.0.Id', 'Id'], invoiceNumber: ['Invoice.DocNumber', 'DocNumber'], status: ['Invoice.EmailStatus', 'EmailStatus'] },
    freshbooks: { invoiceId: ['response.result.invoice.invoiceid', 'invoice.invoiceid'], invoiceNumber: ['response.result.invoice.invoice_number', 'invoice.invoice_number'], status: ['response.result.invoice.status', 'invoice.status'] },
    chargebee: { invoiceId: ['invoice.id', 'id'], invoiceNumber: ['invoice.id', 'id'], status: ['invoice.status', 'status'] },
    recurly: { invoiceId: ['id', 'invoice.id'], invoiceNumber: ['number', 'invoice.number'], status: ['state', 'status'] },
    square: { invoiceId: ['invoice.id', 'id'], invoiceNumber: ['invoice.invoice_number', 'invoice_number'], status: ['invoice.status', 'status'], invoiceUrl: ['invoice.public_url', 'public_url'] },
    paypal: { invoiceId: ['id', 'invoice.id'], status: ['status', 'invoice.status'], invoiceUrl: ['href', 'links.0.href'] },
    braintree: { invoiceId: ['data.chargePaymentMethod.transaction.id', 'transaction.id', 'id'], status: ['data.chargePaymentMethod.transaction.status', 'transaction.status', 'status'] },
    razorpay: { invoiceId: ['id', 'invoice.id'], invoiceNumber: ['invoice_number', 'invoice.number'], status: ['status', 'invoice.status'], invoiceUrl: ['short_url', 'invoice.short_url'] },
  };
  return { ...generic, ...(overrides[providerId] ?? {}) };
}

export function buildProviderRequest(input: ProviderBuildInput): ProviderBuildResult {
  const providerId = normalizeProviderId(input.providerId);
  const invoice = input.invoice;
  const recipient = input.recipient;
  const items = commonItems(invoice);
  const warnings: string[] = [];
  const errors: string[] = [...validateCommon(invoice, recipient, items), ...validateProfile(input.profile, providerId || 'Provider')];
  let body: JsonValue = commonEnvelope(invoice, recipient);
  const query: IDataObject = {};

  if (providerId === 'stripe') {
    requireCustom(errors, invoice, recipient, 'customer_id', 'Stripe');
    const customerId = toStringValue(custom(invoice, recipient, 'customer_id'));
    body = {
      customer: customerId || undefined,
      collection_method: toStringValue(custom(invoice, recipient, 'collection_method'), 'send_invoice'),
      days_until_due: Math.max(1, toFiniteNumber(custom(invoice, recipient, 'days_until_due'), 30)),
      description: toStringValue(invoice.notes),
      metadata: {
        invoice_number: toStringValue(invoice.invoiceNumber),
        customer_email: toStringValue(recipient.email),
      },
    };
  } else if (providerId === 'paddle') {
    requireItemCustom(errors, invoice, recipient, items, 'price_id_', 'price_id', 'Paddle', 'a price id');
    body = {
      items: items.map((item) => ({
        price_id: custom(invoice, recipient, `price_id_${toStringValue(item.name)}`) ?? custom(invoice, recipient, 'price_id'),
        quantity: item.quantity,
      })),
      customer: { email: toStringValue(recipient.email), name: toStringValue(recipient.name) },
      currency_code: toStringValue(invoice.currency, 'USD'),
      custom_data: { invoice_number: toStringValue(invoice.invoiceNumber) },
    };
  } else if (providerId === 'polar') {
    if (toFiniteNumber(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0, 0) <= 0) errors.push('Polar requires invoice.totals.grandTotal to be greater than zero.');
    body = {
      customer_email: toStringValue(recipient.email),
      customer_name: toStringValue(recipient.name),
      currency: toStringValue(invoice.currency, 'USD'),
      amount: toFiniteNumber(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0),
      metadata: { invoice_number: toStringValue(invoice.invoiceNumber) },
    };
  } else if (providerId === 'lemonsqueezy') {
    requireCustom(errors, invoice, recipient, 'store_id', 'LemonSqueezy');
    requireCustom(errors, invoice, recipient, 'variant_id', 'LemonSqueezy');
    body = {
      data: {
        type: 'orders',
        attributes: {
          user_email: toStringValue(recipient.email),
          user_name: toStringValue(recipient.name),
          currency: toStringValue(invoice.currency, 'USD'),
          custom_price: Math.round(toFiniteNumber(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0) * 100),
        },
      },
    };
    warnings.push('LemonSqueezy order creation may require store/variant relationships to be added to a custom body override.');
  } else if (providerId === 'invoice-ninja') {
    requireCustom(errors, invoice, recipient, 'client_id', 'Invoice Ninja');
    body = {
      client_id: custom(invoice, recipient, 'client_id'),
      number: toStringValue(invoice.invoiceNumber),
      date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      line_items: items.map((item) => ({ product_key: item.name, notes: item.description, quantity: item.quantity, cost: item.unitPrice })),
      public_notes: toStringValue(invoice.notes),
    };
  } else if (providerId === 'zoho-books') {
    requireCustom(errors, invoice, recipient, 'customer_id', 'Zoho Books');
    requireCustom(errors, invoice, recipient, 'organization_id', 'Zoho Books');
    const organizationId = toStringValue(custom(invoice, recipient, 'organization_id'));
    if (organizationId) query.organization_id = organizationId;
    body = {
      customer_id: custom(invoice, recipient, 'customer_id'),
      invoice_number: toStringValue(invoice.invoiceNumber),
      date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      line_items: items.map((item) => ({ name: item.name, description: item.description, quantity: item.quantity, rate: item.unitPrice })),
      notes: toStringValue(invoice.notes),
    };
  } else if (providerId === 'xero') {
    requireAnyCustom(errors, invoice, recipient, ['contact_id', 'contact_number'], 'Xero', 'an existing contact reference');
    body = {
      Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: custom(invoice, recipient, 'contact_id'), ContactNumber: custom(invoice, recipient, 'contact_number'), EmailAddress: toStringValue(recipient.email), Name: toStringValue(recipient.name) },
        InvoiceNumber: toStringValue(invoice.invoiceNumber),
        Date: toStringValue(invoice.invoiceDate),
        DueDate: toStringValue(invoice.dueDate),
        LineItems: items.map((item) => ({ Description: item.description || item.name, Quantity: item.quantity, UnitAmount: item.unitPrice })),
        CurrencyCode: toStringValue(invoice.currency, 'USD'),
        Status: toStringValue(custom(invoice, recipient, 'xero_status'), 'DRAFT'),
      }],
    };
  } else if (providerId === 'erpnext') {
    requireCustom(errors, invoice, recipient, 'customer', 'ERPNext');
    requireItemCustom(errors, invoice, recipient, items, 'item_code_', 'item_code', 'ERPNext', 'an item code');
    body = {
      customer: custom(invoice, recipient, 'customer') ?? toStringValue(recipient.name),
      posting_date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      currency: toStringValue(invoice.currency, 'USD'),
      items: items.map((item) => ({ item_code: custom(invoice, recipient, `item_code_${toStringValue(item.name)}`) ?? custom(invoice, recipient, 'item_code') ?? item.name, qty: item.quantity, rate: item.unitPrice, description: item.description })),
      remarks: toStringValue(invoice.notes),
    };
  } else if (providerId === 'odoo') {
    requireCustom(errors, invoice, recipient, 'database', 'Odoo');
    requireCustom(errors, invoice, recipient, 'uid', 'Odoo');
    requireCustom(errors, invoice, recipient, 'password', 'Odoo');
    requireCustom(errors, invoice, recipient, 'partner_id', 'Odoo');
    body = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [custom(invoice, recipient, 'database') ?? null, custom(invoice, recipient, 'uid') ?? null, custom(invoice, recipient, 'password') ?? null, 'account.move', 'create', [{ move_type: 'out_invoice', partner_id: custom(invoice, recipient, 'partner_id') ?? null, invoice_date: toStringValue(invoice.invoiceDate), invoice_line_ids: items.map((item) => [0, 0, { name: item.description || item.name || '', quantity: item.quantity ?? 1, price_unit: item.unitPrice ?? 0 }]) }]],
      },
      id: toStringValue(invoice.transactionId),
    };
  } else if (providerId === 'quickbooks') {
    requireCustom(errors, invoice, recipient, 'customer_id', 'QuickBooks');
    requireItemCustom(errors, invoice, recipient, items, 'item_id_', 'item_id', 'QuickBooks', 'an item id');
    body = {
      CustomerRef: { value: custom(invoice, recipient, 'customer_id'), name: toStringValue(recipient.name) },
      DocNumber: toStringValue(invoice.invoiceNumber),
      TxnDate: toStringValue(invoice.invoiceDate),
      DueDate: toStringValue(invoice.dueDate),
      BillEmail: { Address: toStringValue(recipient.email) },
      CurrencyRef: { value: toStringValue(invoice.currency, 'USD') },
      Line: items.map((item, index) => ({ Id: String(index + 1), Amount: item.lineTotal, DetailType: 'SalesItemLineDetail', Description: item.description || item.name, SalesItemLineDetail: { Qty: item.quantity, UnitPrice: item.unitPrice, ItemRef: { value: custom(invoice, recipient, `item_id_${index + 1}`) ?? custom(invoice, recipient, 'item_id') } } })),
    };
  } else if (providerId === 'freshbooks') {
    requireCustom(errors, invoice, recipient, 'customer_id', 'FreshBooks');
    body = { invoice: { customerid: custom(invoice, recipient, 'customer_id'), create_date: toStringValue(invoice.invoiceDate), due_date: toStringValue(invoice.dueDate), currency_code: toStringValue(invoice.currency, 'USD'), lines: items.map((item) => ({ name: item.name, description: item.description, qty: item.quantity, unit_cost: { amount: item.unitPrice, code: toStringValue(invoice.currency, 'USD') } })), notes: toStringValue(invoice.notes) } };
  } else if (providerId === 'chargebee') {
    requireCustom(errors, invoice, recipient, 'customer_id', 'Chargebee');
    body = { customer_id: custom(invoice, recipient, 'customer_id'), currency_code: toStringValue(invoice.currency, 'USD'), charges: items.map((item) => ({ amount: Math.round(toFiniteNumber(item.lineTotal) * 100), description: item.description || item.name })) };
  } else if (providerId === 'recurly') {
    requireCustom(errors, invoice, recipient, 'account_code', 'Recurly');
    body = { account: { code: custom(invoice, recipient, 'account_code'), email: toStringValue(recipient.email), first_name: toStringValue(recipient.name) }, currency: toStringValue(invoice.currency, 'USD'), collection_method: 'manual', line_items: items.map((item) => ({ currency: toStringValue(invoice.currency, 'USD'), unit_amount: item.unitPrice, quantity: item.quantity, description: item.description || item.name })) };
  } else if (providerId === 'square') {
    requireCustom(errors, invoice, recipient, 'location_id', 'Square');
    requireCustom(errors, invoice, recipient, 'order_id', 'Square');
    requireCustom(errors, invoice, recipient, 'customer_id', 'Square');
    body = { invoice: { location_id: custom(invoice, recipient, 'location_id'), order_id: custom(invoice, recipient, 'order_id'), primary_recipient: { customer_id: custom(invoice, recipient, 'customer_id') }, payment_requests: [{ request_type: 'BALANCE', due_date: toStringValue(invoice.dueDate), automatic_payment_source: 'NONE' }], title: toStringValue(invoice.invoiceNumber), description: toStringValue(invoice.notes) }, idempotency_key: toStringValue(invoice.transactionId) };
  } else if (providerId === 'paypal') {
    body = { detail: { invoice_number: toStringValue(invoice.invoiceNumber), invoice_date: toStringValue(invoice.invoiceDate), currency_code: toStringValue(invoice.currency, 'USD'), note: toStringValue(invoice.notes), payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: toStringValue(invoice.dueDate) } }, invoicer: isRecord(custom(invoice, recipient, 'invoicer')) ? custom(invoice, recipient, 'invoicer') : undefined, primary_recipients: [{ billing_info: { name: { full_name: toStringValue(recipient.name) }, email_address: toStringValue(recipient.email) } }], items: items.map((item) => ({ name: item.name, description: item.description, quantity: String(item.quantity), unit_amount: { currency_code: toStringValue(invoice.currency, 'USD'), value: toStringValue(item.unitPrice) } })) };
  } else if (providerId === 'braintree') {
    requireCustom(errors, invoice, recipient, 'payment_method_id', 'Braintree');
    body = { query: 'mutation Charge($input: ChargePaymentMethodInput!) { chargePaymentMethod(input: $input) { transaction { id status } } }', variables: { input: { paymentMethodId: custom(invoice, recipient, 'payment_method_id'), transaction: { amount: toStringValue(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0), orderId: toStringValue(invoice.invoiceNumber) } } } };
  } else if (providerId === 'razorpay') {
    requireAnyCustom(errors, invoice, recipient, ['customer_id', 'contact_id'], 'Razorpay', 'a customer/contact reference');
    body = { type: 'invoice', description: toStringValue(invoice.notes), customer: { name: toStringValue(recipient.name), email: toStringValue(recipient.email), contact: toStringValue(recipient.phone) }, line_items: items.map((item) => ({ name: item.name, description: item.description, amount: Math.round(toFiniteNumber(item.unitPrice) * 100), currency: toStringValue(invoice.currency, 'USD'), quantity: item.quantity })), sms_notify: 0, email_notify: 1, currency: toStringValue(invoice.currency, 'USD') };
  } else if (providerId === 'bill-com') {
    warnings.push('Bill.com requires valid API key and session material from the provider profile or custom body override.');
    body = { operation: toStringValue(input.actionId, 'CreateInvoice'), devKey: custom(invoice, recipient, 'dev_key') ?? '{{API_KEY}}', sessionId: custom(invoice, recipient, 'session_id') ?? '{{SESSION_ID}}', data: commonEnvelope(invoice, recipient) };
  }

  const customBody = custom(invoice, recipient, 'request_body');
  if (isRecord(customBody) || Array.isArray(customBody)) body = customBody;
  return {
    body, query, warnings, errors, responsePaths: responsePaths(providerId),
    requestMapping: providerRequestMapping(providerId, input.actionId),
    responsePolicy: providerResponsePolicy(providerId),
  };
}

export function supportedProviderIds(): string[] {
  return [
    'stripe', 'paddle', 'polar', 'lemonsqueezy', 'invoice-ninja', 'zoho-books', 'xero', 'erpnext', 'odoo',
    'quickbooks', 'freshbooks', 'chargebee', 'recurly', 'square', 'paypal', 'braintree', 'razorpay', 'bill-com', 'custom',
  ];
}
