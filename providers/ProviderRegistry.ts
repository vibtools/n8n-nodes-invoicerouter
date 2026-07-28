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
  responsePaths: IDataObject;
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
    invoiceId: 'id',
    invoiceNumber: 'invoice_number',
    status: 'status',
    invoiceUrl: 'hosted_invoice_url',
    pdfUrl: 'invoice_pdf',
    transactionId: 'transaction_id',
    errorCode: 'error.code',
    errorMessage: 'error.message',
  };
  const overrides: Record<string, IDataObject> = {
    stripe: { invoiceId: 'id', invoiceNumber: 'number', status: 'status', invoiceUrl: 'hosted_invoice_url', pdfUrl: 'invoice_pdf' },
    paddle: { invoiceId: 'data.id', status: 'data.status', invoiceUrl: 'data.checkout.url', transactionId: 'data.id' },
    lemonsqueezy: { invoiceId: 'data.id', status: 'data.attributes.status', invoiceUrl: 'data.attributes.urls.receipt' },
    'invoice-ninja': { invoiceId: 'data.id', invoiceNumber: 'data.number', status: 'data.status_id', invoiceUrl: 'data.invitations.0.link' },
    'zoho-books': { invoiceId: 'invoice.invoice_id', invoiceNumber: 'invoice.invoice_number', status: 'invoice.status', invoiceUrl: 'invoice.invoice_url' },
    xero: { invoiceId: 'Invoices.0.InvoiceID', invoiceNumber: 'Invoices.0.InvoiceNumber', status: 'Invoices.0.Status' },
    erpnext: { invoiceId: 'data.name', invoiceNumber: 'data.name', status: 'data.status' },
    quickbooks: { invoiceId: 'Invoice.Id', invoiceNumber: 'Invoice.DocNumber', status: 'Invoice.EmailStatus' },
    freshbooks: { invoiceId: 'response.result.invoice.invoiceid', invoiceNumber: 'response.result.invoice.invoice_number', status: 'response.result.invoice.status' },
    square: { invoiceId: 'invoice.id', invoiceNumber: 'invoice.invoice_number', status: 'invoice.status', invoiceUrl: 'invoice.public_url' },
    paypal: { invoiceId: 'id', status: 'status', invoiceUrl: 'href' },
    razorpay: { invoiceId: 'id', invoiceNumber: 'invoice_number', status: 'status', invoiceUrl: 'short_url' },
  };
  return { ...generic, ...(overrides[providerId] ?? {}) };
}

export function buildProviderRequest(input: ProviderBuildInput): ProviderBuildResult {
  const providerId = normalizeProviderId(input.providerId);
  const invoice = input.invoice;
  const recipient = input.recipient;
  const items = commonItems(invoice);
  const warnings: string[] = [];
  let body: JsonValue = commonEnvelope(invoice, recipient);
  const query: IDataObject = {};

  if (providerId === 'stripe') {
    const customerId = toStringValue(custom(invoice, recipient, 'customer_id'));
    if (!customerId) warnings.push('Stripe normally requires custom_fields.customer_id.');
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
    body = {
      customer_email: toStringValue(recipient.email),
      customer_name: toStringValue(recipient.name),
      currency: toStringValue(invoice.currency, 'USD'),
      amount: toFiniteNumber(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0),
      metadata: { invoice_number: toStringValue(invoice.invoiceNumber) },
    };
  } else if (providerId === 'lemonsqueezy') {
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
    warnings.push('LemonSqueezy order creation may require store/variant relationships in custom fields.');
  } else if (providerId === 'invoice-ninja') {
    body = {
      client_id: custom(invoice, recipient, 'client_id'),
      number: toStringValue(invoice.invoiceNumber),
      date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      line_items: items.map((item) => ({ product_key: item.name, notes: item.description, quantity: item.quantity, cost: item.unitPrice })),
      public_notes: toStringValue(invoice.notes),
    };
    if (!custom(invoice, recipient, 'client_id')) warnings.push('Invoice Ninja normally requires custom_fields.client_id.');
  } else if (providerId === 'zoho-books') {
    const organizationId = toStringValue(custom(invoice, recipient, 'organization_id'), '{{organizationId}}');
    if (organizationId) query.organization_id = organizationId;
    else warnings.push('Zoho Books normally requires organization_id in Extra Value or custom fields.');
    body = {
      customer_id: custom(invoice, recipient, 'customer_id'),
      invoice_number: toStringValue(invoice.invoiceNumber),
      date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      line_items: items.map((item) => ({ name: item.name, description: item.description, quantity: item.quantity, rate: item.unitPrice })),
      notes: toStringValue(invoice.notes),
    };
  } else if (providerId === 'xero') {
    body = {
      Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: custom(invoice, recipient, 'contact_id'), EmailAddress: toStringValue(recipient.email), Name: toStringValue(recipient.name) },
        InvoiceNumber: toStringValue(invoice.invoiceNumber),
        Date: toStringValue(invoice.invoiceDate),
        DueDate: toStringValue(invoice.dueDate),
        LineItems: items.map((item) => ({ Description: item.description || item.name, Quantity: item.quantity, UnitAmount: item.unitPrice })),
        CurrencyCode: toStringValue(invoice.currency, 'USD'),
        Status: toStringValue(custom(invoice, recipient, 'xero_status'), 'DRAFT'),
      }],
    };
  } else if (providerId === 'erpnext') {
    body = {
      customer: custom(invoice, recipient, 'customer') ?? toStringValue(recipient.name),
      posting_date: toStringValue(invoice.invoiceDate),
      due_date: toStringValue(invoice.dueDate),
      currency: toStringValue(invoice.currency, 'USD'),
      items: items.map((item) => ({ item_code: custom(invoice, recipient, `item_code_${toStringValue(item.name)}`) ?? item.name, qty: item.quantity, rate: item.unitPrice, description: item.description })),
      remarks: toStringValue(invoice.notes),
    };
  } else if (providerId === 'odoo') {
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
    body = { invoice: { customerid: custom(invoice, recipient, 'customer_id'), create_date: toStringValue(invoice.invoiceDate), due_date: toStringValue(invoice.dueDate), currency_code: toStringValue(invoice.currency, 'USD'), lines: items.map((item) => ({ name: item.name, description: item.description, qty: item.quantity, unit_cost: { amount: item.unitPrice, code: toStringValue(invoice.currency, 'USD') } })), notes: toStringValue(invoice.notes) } };
  } else if (providerId === 'chargebee') {
    body = { customer_id: custom(invoice, recipient, 'customer_id'), currency_code: toStringValue(invoice.currency, 'USD'), charges: items.map((item) => ({ amount: Math.round(toFiniteNumber(item.lineTotal) * 100), description: item.description || item.name })) };
  } else if (providerId === 'recurly') {
    body = { account: { code: custom(invoice, recipient, 'account_code'), email: toStringValue(recipient.email), first_name: toStringValue(recipient.name) }, currency: toStringValue(invoice.currency, 'USD'), collection_method: 'manual', line_items: items.map((item) => ({ currency: toStringValue(invoice.currency, 'USD'), unit_amount: item.unitPrice, quantity: item.quantity, description: item.description || item.name })) };
  } else if (providerId === 'square') {
    body = { invoice: { location_id: custom(invoice, recipient, 'location_id'), order_id: custom(invoice, recipient, 'order_id'), primary_recipient: { customer_id: custom(invoice, recipient, 'customer_id') }, payment_requests: [{ request_type: 'BALANCE', due_date: toStringValue(invoice.dueDate), automatic_payment_source: 'NONE' }], title: toStringValue(invoice.invoiceNumber), description: toStringValue(invoice.notes) }, idempotency_key: toStringValue(invoice.transactionId) };
  } else if (providerId === 'paypal') {
    body = { detail: { invoice_number: toStringValue(invoice.invoiceNumber), invoice_date: toStringValue(invoice.invoiceDate), currency_code: toStringValue(invoice.currency, 'USD'), note: toStringValue(invoice.notes), payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: toStringValue(invoice.dueDate) } }, invoicer: isRecord(custom(invoice, recipient, 'invoicer')) ? custom(invoice, recipient, 'invoicer') : undefined, primary_recipients: [{ billing_info: { name: { full_name: toStringValue(recipient.name) }, email_address: toStringValue(recipient.email) } }], items: items.map((item) => ({ name: item.name, description: item.description, quantity: String(item.quantity), unit_amount: { currency_code: toStringValue(invoice.currency, 'USD'), value: toStringValue(item.unitPrice) } })) };
  } else if (providerId === 'braintree') {
    body = { query: 'mutation Charge($input: ChargePaymentMethodInput!) { chargePaymentMethod(input: $input) { transaction { id status } } }', variables: { input: { paymentMethodId: custom(invoice, recipient, 'payment_method_id'), transaction: { amount: toStringValue(isRecord(invoice.totals) ? invoice.totals.grandTotal : 0), orderId: toStringValue(invoice.invoiceNumber) } } } };
  } else if (providerId === 'razorpay') {
    body = { type: 'invoice', description: toStringValue(invoice.notes), customer: { name: toStringValue(recipient.name), email: toStringValue(recipient.email), contact: toStringValue(recipient.phone) }, line_items: items.map((item) => ({ name: item.name, description: item.description, amount: Math.round(toFiniteNumber(item.unitPrice) * 100), currency: toStringValue(invoice.currency, 'USD'), quantity: item.quantity })), sms_notify: 0, email_notify: 1, currency: toStringValue(invoice.currency, 'USD') };
  } else if (providerId === 'bill-com') {
    body = { operation: toStringValue(input.actionId, 'CreateInvoice'), devKey: custom(invoice, recipient, 'dev_key') ?? '{{API_KEY}}', sessionId: '{{SESSION_ID}}', data: commonEnvelope(invoice, recipient) };
  }

  const customBody = custom(invoice, recipient, 'request_body');
  if (isRecord(customBody) || Array.isArray(customBody)) body = customBody;
  return { body, query, warnings, responsePaths: responsePaths(providerId) };
}

export function supportedProviderIds(): string[] {
  return [
    'stripe', 'paddle', 'polar', 'lemonsqueezy', 'invoice-ninja', 'zoho-books', 'xero', 'erpnext', 'odoo',
    'quickbooks', 'freshbooks', 'chargebee', 'recurly', 'square', 'paypal', 'braintree', 'razorpay', 'bill-com', 'custom',
  ];
}
