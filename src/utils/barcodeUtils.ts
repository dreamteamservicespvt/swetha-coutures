
interface BarcodeResponse {
  secure_url: string;
}

export const generateBarcode = async (text: string): Promise<string> => {
  try {
    if (!text || text.trim() === '') {
      throw new Error('No text provided for barcode generation');
    }

    // Clean the text for barcode generation
    const cleanText = text.replace(/[^A-Za-z0-9\-_]/g, '');
    
    if (cleanText.length === 0) {
      throw new Error('Invalid characters for barcode');
    }

    // Use QR Server API for barcode generation (Code128)
    const barcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x100&data=${encodeURIComponent(cleanText)}&format=png&qzone=1`;
    
    // Test if the URL is accessible
    const response = await fetch(barcodeUrl, { method: 'HEAD' });
    
    if (response.ok) {
      return barcodeUrl;
    }
    
    // Fallback to SVG-based barcode
    return generateSVGBarcode(cleanText);
  } catch (error) {
    console.error('Error generating barcode:', error);
    // Return a simple text-based fallback
    return generateSVGBarcode(text);
  }
};

const generateSVGBarcode = (text: string): string => {
  const cleanText = text.substring(0, 20); // Limit length
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="100" fill="white" stroke="#ddd" stroke-width="1"/>
      <g fill="black">
        ${generateCode128Bars(cleanText)}
      </g>
      <text x="150" y="85" text-anchor="middle" font-family="monospace" font-size="10" fill="black">${cleanText}</text>
    </svg>
  `)}`;
};

const generateCode128Bars = (text: string): string => {
  // Simplified Code128 pattern generation for visual representation
  const bars = [];
  let x = 20;
  const barWidth = 2;
  const barHeight = 60;
  
  for (let i = 0; i < text.length && i < 15; i++) {
    const char = text.charCodeAt(i);
    // Create alternating bar pattern based on character code
    const pattern = char % 2 === 0 ? [3, 1, 2, 1, 3] : [2, 1, 3, 1, 2];
    
    for (let j = 0; j < pattern.length; j++) {
      if (j % 2 === 0) {
        // Draw black bar
        bars.push(`<rect x="${x}" y="10" width="${pattern[j] * barWidth}" height="${barHeight}"/>`);
      }
      x += pattern[j] * barWidth;
    }
    x += 2; // Space between character groups
  }
  
  return bars.join('');
};

export const validateBarcodeText = (text: string): boolean => {
  // Enhanced validation for barcode text
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const trimmedText = text.trim();
  
  // Check length constraints
  if (trimmedText.length === 0 || trimmedText.length > 50) {
    return false;
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[A-Za-z0-9\-_\s]+$/;
  return validPattern.test(trimmedText);
};

export const formatBarcodeText = (text: string): string => {
  // Format text for barcode generation
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Za-z0-9\-_]/g, '')
    .substring(0, 20);
};

// Generate barcode data for printing
export const generateBarcodeData = (text: string) => {
  const formattedText = formatBarcodeText(text);
  
  return {
    text: formattedText,
    isValid: validateBarcodeText(text),
    url: generateBarcode(formattedText),
    type: 'Code128',
    size: { width: 300, height: 100 }
  };
};
