/**
 * The map of what "the whole website" means for backup purposes.
 *
 * Every Firestore collection the app reads or writes is listed here. If a new collection is
 * ever added to the app, add it here too — a collection that is not on this list is silently
 * absent from every backup, which is the one failure mode a backup system must never have.
 *
 * To check nothing has drifted, list the collections the code actually touches and diff them
 * against this file:
 *
 *   grep -rhoE "(collection|doc)\(db,\s*'[a-zA-Z]+'" src/ api/ \
 *     | sed "s/.*'\(.*\)'/\1/" | sort -u
 *
 * `dateFields` is what a date-range export filters on. Collections with no date field are
 * reference data (categories, product names, roles…) and are always exported in full: they
 * are small, and a monthly backup that omitted them could not be restored on its own.
 */

export interface CollectionSpec {
  /** Firestore collection id. */
  name: string;
  /** Sheet name in the workbook — Excel caps these at 31 characters. */
  sheet: string;
  /** Human label shown in the backup UI. */
  label: string;
  /**
   * Field(s) used for date filtering, tried in order. Empty = always export everything
   * (reference data that a restore would be broken without).
   */
  dateFields: string[];
  /** Short note on what this holds, shown in the UI and written into the manifest. */
  description: string;
}

export const BACKUP_COLLECTIONS: CollectionSpec[] = [
  // ---- Core business records
  { name: 'bills', sheet: 'bills', label: 'Bills', dateFields: ['date', 'createdAt'], description: 'Invoices, products, payments' },
  { name: 'billing', sheet: 'billing_legacy', label: 'Billing (legacy)', dateFields: ['createdAt'], description: 'Older billing collection' },
  { name: 'orders', sheet: 'orders', label: 'Orders', dateFields: ['orderDate', 'createdAt', 'date'], description: 'Stitching orders and designs' },
  { name: 'customers', sheet: 'customers', label: 'Customers', dateFields: ['createdAt'], description: 'Customer records and sizes' },
  { name: 'inventory', sheet: 'inventory', label: 'Inventory', dateFields: ['broughtAt', 'createdAt'], description: 'Materials and stock' },
  { name: 'appointments', sheet: 'appointments', label: 'Appointments', dateFields: ['date', 'appointmentDate', 'createdAt'], description: 'Bookings' },
  { name: 'alterations', sheet: 'alterations', label: 'Alterations', dateFields: ['date', 'createdAt'], description: 'Alteration jobs' },
  { name: 'tasks', sheet: 'tasks', label: 'Tasks', dateFields: ['date', 'createdAt'], description: 'Internal tasks' },

  // ---- Finance
  { name: 'income', sheet: 'income', label: 'Income entries', dateFields: ['date', 'createdAt'], description: 'Custom income' },
  { name: 'expenses', sheet: 'expenses', label: 'Expenses', dateFields: ['date', 'createdAt'], description: 'Custom expenses' },

  // ---- People
  { name: 'staff', sheet: 'staff', label: 'Employees', dateFields: [], description: 'Employee records and pay' },
  { name: 'users', sheet: 'users', label: 'Login users', dateFields: [], description: 'Auth profiles and roles' },
  { name: 'attendance', sheet: 'attendance_legacy', label: 'Attendance (legacy)', dateFields: ['date'], description: 'Old attendance collection' },
  { name: 'attendanceEmployees', sheet: 'att_employees', label: 'Attendance employees', dateFields: [], description: 'Fingerprint employees + pay basis' },
  { name: 'attendanceRecords', sheet: 'att_records', label: 'Attendance records', dateFields: ['date'], description: 'Daily check-in / check-out' },
  { name: 'salaryPayments', sheet: 'salary_payments', label: 'Salary payments', dateFields: ['paidAt', 'periodStart'], description: 'Payroll history' },
  { name: 'devices', sheet: 'devices', label: 'Fingerprint devices', dateFields: [], description: 'Terminals + approval status' },
  { name: 'devicePunches', sheet: 'device_punches', label: 'Raw punches', dateFields: ['punchDate', 'receivedAt'], description: 'Every fingerprint press from the device' },
  // deviceRawLogs is deliberately NOT backed up: it is short-lived diagnostic traffic with a
  // TTL policy on it, and every punch it contains is already in devicePunches.

  // ---- Reference / catalog data (always exported in full)
  { name: 'products', sheet: 'ref_products', label: 'Product names', dateFields: [], description: 'Billing catalog' },
  { name: 'descriptions', sheet: 'ref_descriptions', label: 'Descriptions', dateFields: [], description: 'Billing catalog' },
  { name: 'categories', sheet: 'ref_categories', label: 'Categories', dateFields: [], description: 'Income/expense categories' },
  { name: 'inventoryCategories', sheet: 'ref_inv_categories', label: 'Inventory categories', dateFields: [], description: 'Inventory reference' },
  { name: 'inventoryTypes', sheet: 'ref_inv_types', label: 'Inventory types', dateFields: [], description: 'Inventory reference' },
  { name: 'workDescriptions', sheet: 'ref_work_desc', label: 'Work descriptions', dateFields: [], description: 'Order/bill presets' },
  { name: 'customItemTypes', sheet: 'ref_item_types', label: 'Custom item types', dateFields: [], description: 'Order presets' },
  { name: 'roles', sheet: 'ref_roles', label: 'Roles', dateFields: [], description: 'Staff org structure' },
  { name: 'departments', sheet: 'ref_departments', label: 'Departments', dateFields: [], description: 'Staff org structure' },
  { name: 'settings', sheet: 'settings', label: 'Business settings', dateFields: [], description: 'Branding, bank, UPI' },
  { name: 'syncState', sheet: 'sync_state', label: 'Sync state', dateFields: [], description: 'Backup history' },

  // ---- Design & preferences
  // `designs` holds the saved design-canvas data for order items. Losing it means the
  // sketches sent to the master tailor cannot be reopened or edited, only viewed as images.
  { name: 'designs', sheet: 'designs', label: 'Saved designs', dateFields: ['lastModified'], description: 'Design canvas data per order item' },
  { name: 'userPreferences', sheet: 'user_prefs', label: 'User preferences', dateFields: [], description: 'Per-user theme and settings' },
];

/** Collections whose contents are always exported regardless of the date range. */
export const isReferenceCollection = (spec: CollectionSpec) => spec.dateFields.length === 0;

/** The sheet that records what the file is, so a restore can verify it. */
export const MANIFEST_SHEET = '_manifest';

/** Catalogue of every Cloudinary image the data references. Documentation, not restorable data. */
export const MEDIA_SHEET = '_media';

/** Bumped whenever the file layout changes in a way a restore must know about. */
export const BACKUP_FORMAT_VERSION = 1;
