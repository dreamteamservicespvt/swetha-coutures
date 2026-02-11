/**
 * Barcode utility — generates unique barcode values for inventory items.
 * Rendering is handled by the BarcodeDisplay component (uses JsBarcode CODE128).
 * Scanning is handled by html5-qrcode in ProductDescriptionManager.
 */

/** Generate a unique barcode value for an inventory item.
 *  Uses numeric-only timestamp — same as working_barcode.html.
 *  Short numeric values produce compact CODE128 barcodes ideal for mobile scanning.
 */
export const generateBarcodeValue = (_itemName?: string): string => {
  return Date.now().toString();
};
