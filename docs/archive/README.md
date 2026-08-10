# Archived implementation notes

Working notes written while individual features were built, moved here on 2026-08-10 to
keep the project root readable. They are a historical record, not current documentation —
some describe code that has since been rewritten.

**For how the system works today, read [`project-memory/`](../../project-memory/) instead.**
That folder is the canonical knowledge base and is kept up to date.

| Folder | Notes | Covers |
|---|---|---|
| [`billing/`](./billing/) | 37 (10 empty) | Bill IDs, totals, ordering, sharing, migrations |
| [`cloudinary/`](./cloudinary/) | 5 | Cloudinary image upload setup |
| [`finance/`](./finance/) | 5 | Income & Expenses module |
| [`general/`](./general/) | 7 | Everything else |
| [`orders/`](./orders/) | 2 | Orders and the orders-to-billing flow |
| [`payments/`](./payments/) | 8 | Payment tracking, UPI, screenshots |
| [`pdf-invoices/`](./pdf-invoices/) | 5 (4 empty) | PDF generation and invoice layout |
| [`products/`](./products/) | 3 | Product and description catalog |
| [`staff/`](./staff/) | 2 | Staff module and salary |
| [`ui-components/`](./ui-components/) | 8 | Dashboard, dropdowns, date formats |
| [`whatsapp/`](./whatsapp/) | 7 (3 empty) | WhatsApp sharing and country codes |

## The empty files

Several of these are 0 bytes — they were created and never written. They are kept only so
the archive matches what was in the repository; deleting them loses nothing.
