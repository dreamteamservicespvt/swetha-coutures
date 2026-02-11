import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Self-contained barcode renderer.
 * Renders a real CODE128 barcode using JsBarcode — same approach as working_barcode.html.
 * 
 * The barcode renders reliably because the useEffect runs AFTER this component's
 * own SVG element is mounted in the DOM — no timing issues with parent dialogs.
 */

interface BarcodeDisplayProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  fontSize?: number;
  className?: string;
}

const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
  value,
  width = 2,
  height = 60,
  showText = true,
  fontSize = 14,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: showText,
          fontSize,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (error) {
        console.error('BarcodeDisplay: Failed to render barcode:', error);
      }
    }
  }, [value, width, height, showText, fontSize]);

  if (!value) return null;

  return <svg ref={svgRef} className={className} />;
};

export default BarcodeDisplay;
