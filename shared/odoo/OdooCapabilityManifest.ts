import { toFiniteNumber, toStringValue } from '../utils/Helpers';

/**
 * Odoo version numbers are recorded for diagnostics only. Runtime support is
 * capability-driven and is not restricted to a fixed major-version allowlist.
 */
export type SupportedOdooMajorVersion = number;

export interface OdooCapabilityProfile {
  id: string;
  majorVersion: SupportedOdooMajorVersion;
  supported: true;
  requiredFields: Record<string, string[]>;
  requiredMethods: Record<string, string[]>;
  readProbeModels: string[];
  senderFields: {
    partnerSearch: string[];
    currencySearch: string[];
    moveRecovery: string[];
    moveResume: string[];
    moveRead: string[];
    movePostReconcile: string[];
    wizardRead: string[];
    messageRead: string[];
    notificationRead: string[];
    mailRead: string[];
    attachmentRead: string[];
    userCompanyRead: string[];
    companyRead: string[];
  };
  senderMethods: {
    partnerSearch: string;
    partnerCreate: string;
    currencySearch: string;
    invoiceSearch: string;
    invoiceCreate: string;
    invoiceRead: string;
    invoicePost: string;
    wizardCreate: string;
    wizardRead: string;
    wizardSend: string;
    messageSearch: string;
    notificationSearch: string;
    mailSearch: string;
    attachmentRead: string;
  };
  versionSpecificWizardFields: string[];
}

/**
 * These versions have documented metadata profiles. This is not an allowlist;
 * other Odoo versions use the common capability profile and are accepted when
 * the required API surface is present.
 */
export const SUPPORTED_ODOO_MAJOR_VERSIONS: SupportedOdooMajorVersion[] = [18, 19];

const COMMON_REQUIRED_FIELDS: Record<string, string[]> = {
  'res.partner': ['id', 'name', 'email', 'street'],
  'res.currency': ['id', 'name', 'active'],
  'res.users': ['id', 'company_id', 'company_ids'],
  'res.company': ['id', 'name', 'currency_id'],
  'account.move': [
    'id',
    'name',
    'state',
    'ref',
    'move_type',
    'partner_id',
    'company_id',
    'currency_id',
    'invoice_date',
    'invoice_date_due',
    'invoice_line_ids',
    'narration',
    'invoice_pdf_report_id',
  ],
  'account.move.line': ['name', 'quantity', 'price_unit', 'discount'],
  'account.move.send.wizard': [
    'move_id',
    'company_id',
    'alerts',
    'sending_methods',
    'sending_method_checkboxes',
    'mail_partner_ids',
    'pdf_report_id',
    'mail_attachments_widget',
  ],
  'mail.message': ['id', 'model', 'res_id', 'message_type', 'subject', 'date', 'author_id', 'partner_ids', 'attachment_ids'],
  'mail.notification': [
    'id',
    'notification_type',
    'notification_status',
    'failure_type',
    'failure_reason',
    'res_partner_id',
    'mail_message_id',
    'mail_mail_id',
  ],
  'mail.mail': ['id', 'state', 'failure_type', 'failure_reason', 'email_to', 'recipient_ids', 'mail_message_id'],
  'ir.attachment': ['id', 'name', 'mimetype', 'res_model', 'res_id', 'type'],
};

const COMMON_REQUIRED_METHODS: Record<string, string[]> = {
  'res.partner': ['search_read', 'create'],
  'res.currency': ['search_read'],
  'res.users': ['read'],
  'res.company': ['read'],
  'account.move': ['search_read', 'read', 'create', 'action_post'],
  'account.move.send.wizard': ['create', 'read', 'action_send_and_print'],
  'mail.message': ['search', 'search_read'],
  'mail.notification': ['search_read'],
  'mail.mail': ['search_read'],
  'ir.attachment': ['read'],
};

const VERSION_WIZARD_FIELDS: Record<number, string[]> = {
  18: ['mail_template_id', 'mail_subject', 'mail_body'],
  19: ['template_id', 'subject', 'body', 'model', 'res_ids'],
};

function cloneFields(fields: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(fields).map(([model, values]) => [model, [...values]]));
}

function profileForMajor(majorVersion: number): OdooCapabilityProfile {
  const normalizedMajor = Math.max(0, Math.trunc(toFiniteNumber(majorVersion, 0)));
  return {
    id: normalizedMajor > 0 ? `odoo-${normalizedMajor}-invoice-send` : 'odoo-capability-driven-invoice-send',
    majorVersion: normalizedMajor,
    supported: true,
    // Version-specific display/template fields are intentionally not required.
    // InvoiceRouter validates only the fields it actually reads or writes.
    requiredFields: cloneFields(COMMON_REQUIRED_FIELDS),
    requiredMethods: cloneFields(COMMON_REQUIRED_METHODS),
    readProbeModels: ['res.partner', 'account.move'],
    senderFields: {
      partnerSearch: ['id', 'name', 'email'],
      currencySearch: ['id', 'name', 'active'],
      moveRecovery: ['id', 'name', 'state', 'ref', 'partner_id', 'company_id', 'invoice_pdf_report_id'],
      moveResume: ['id', 'name', 'state', 'partner_id', 'company_id', 'invoice_pdf_report_id'],
      moveRead: [
        'id',
        'name',
        'state',
        'ref',
        'partner_id',
        'company_id',
        'currency_id',
        'invoice_date',
        'invoice_date_due',
        'invoice_pdf_report_id',
      ],
      movePostReconcile: ['id', 'state', 'company_id'],
      wizardRead: ['move_id', 'company_id', 'sending_methods', 'sending_method_checkboxes', 'mail_partner_ids', 'alerts'],
      messageRead: ['id', 'message_type', 'subject', 'date', 'author_id', 'partner_ids', 'attachment_ids'],
      notificationRead: [
        'id',
        'notification_type',
        'notification_status',
        'failure_type',
        'failure_reason',
        'res_partner_id',
        'mail_message_id',
        'mail_mail_id',
      ],
      mailRead: ['id', 'state', 'failure_type', 'failure_reason', 'email_to', 'recipient_ids', 'mail_message_id'],
      attachmentRead: ['id', 'name', 'mimetype', 'res_model', 'res_id', 'type'],
      userCompanyRead: ['id', 'company_id', 'company_ids'],
      companyRead: ['id', 'name', 'currency_id'],
    },
    senderMethods: {
      partnerSearch: 'search_read',
      partnerCreate: 'create',
      currencySearch: 'search_read',
      invoiceSearch: 'search_read',
      invoiceCreate: 'create',
      invoiceRead: 'read',
      invoicePost: 'action_post',
      wizardCreate: 'create',
      wizardRead: 'read',
      wizardSend: 'action_send_and_print',
      messageSearch: 'search',
      notificationSearch: 'search_read',
      mailSearch: 'search_read',
      attachmentRead: 'read',
    },
    versionSpecificWizardFields: [...(VERSION_WIZARD_FIELDS[normalizedMajor] ?? [])],
  };
}

export function odooMajorVersion(value: unknown): number {
  if (Array.isArray(value)) return odooMajorVersion(value[0]);
  if (typeof value === 'number') return Math.max(0, Math.trunc(value));
  const text = toStringValue(value).trim();
  // Odoo Online may report values such as "saas~19.4+e".
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function resolveOdooCapabilityProfile(serverVersion: unknown): OdooCapabilityProfile {
  return profileForMajor(odooMajorVersion(serverVersion));
}

export function requireOdooCapabilityProfile(serverVersion: unknown): OdooCapabilityProfile {
  return resolveOdooCapabilityProfile(serverVersion);
}

export function odooCapabilityProfileByMajor(value: unknown): OdooCapabilityProfile {
  return profileForMajor(odooMajorVersion(value));
}
