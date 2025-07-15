import React, { useState } from 'react';
import EditableCombobox from '@/components/EditableCombobox';

const EditableComboboxDropdownTest: React.FC = () => {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  
  const productOptions = [
    'Shirts', 'Pants', 'Jackets', 'Dresses', 'Blouses', 'Skirts', 'Lehengas', 'Sarees'
  ];
  
  const descriptionOptions = [
    'Stitching', 'Alteration', 'Embroidery', 'Fitting', 'Hemming', 'Tailoring'
  ];

  const handleProductChange = (value: string) => {
    console.log('Product changed to:', value);
    setProductName(value);
  };

  const handleDescriptionChange = (value: string) => {
    console.log('Description changed to:', value);
    setDescription(value);
  };

  return (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <h2 className="text-xl font-bold mb-4">EditableCombobox Dropdown Test</h2>
      
      <div>
        <label className="block text-sm font-medium mb-2">Product Name *</label>
        <EditableCombobox
          value={productName}
          onValueChange={handleProductChange}
          options={productOptions}
          placeholder="Type or select product name..."
          allowAdd={false}
          className="w-full"
        />
        <p className="text-sm text-gray-600 mt-1">Selected: {productName}</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Sub-Item Description *</label>
        <EditableCombobox
          value={description}
          onValueChange={handleDescriptionChange}
          options={descriptionOptions}
          placeholder="Type or select description..."
          allowAdd={false}
          className="w-full"
        />
        <p className="text-sm text-gray-600 mt-1">Selected: {description}</p>
      </div>
      
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold mb-2">Test Instructions:</h3>
        <ol className="text-sm space-y-1">
          <li>1. Select a product name from the dropdown</li>
          <li>2. Immediately select a different product name</li>
          <li>3. The selection should stick without disappearing</li>
          <li>4. Try rapid selections - each should work properly</li>
        </ol>
      </div>
    </div>
  );
};

export default EditableComboboxDropdownTest;
