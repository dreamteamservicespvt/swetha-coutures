
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface MeasurementField {
  label: string;
  key: string;
  required?: boolean;
}

interface DynamicMeasurementsProps {
  itemType: string;
  measurements: any;
  onChange: (measurements: any) => void;
}

const measurementsByType: Record<string, MeasurementField[]> = {
  'Blouse': [
    { label: 'Bust', key: 'bust', required: true },
    { label: 'Shoulder', key: 'shoulder', required: true },
    { label: 'Sleeve', key: 'sleeve' },
    { label: 'Length', key: 'length', required: true }
  ],
  'Lehenga': [
    { label: 'Waist', key: 'waist', required: true },
    { label: 'Hip', key: 'hip', required: true },
    { label: 'Length', key: 'length', required: true },
    { label: 'Flair', key: 'flair' }
  ],
  'Saree': [
    { label: 'Blouse Bust', key: 'bust', required: true },
    { label: 'Blouse Length', key: 'blouseLength', required: true },
    { label: 'Sleeve', key: 'sleeve' },
    { label: 'Shoulder', key: 'shoulder' }
  ],
  'Kurti': [
    { label: 'Bust', key: 'bust', required: true },
    { label: 'Waist', key: 'waist' },
    { label: 'Hip', key: 'hip' },
    { label: 'Length', key: 'length', required: true },
    { label: 'Shoulder', key: 'shoulder' },
    { label: 'Sleeve', key: 'sleeve' }
  ],
  'Dress': [
    { label: 'Bust', key: 'bust', required: true },
    { label: 'Waist', key: 'waist', required: true },
    { label: 'Hip', key: 'hip', required: true },
    { label: 'Length', key: 'length', required: true },
    { label: 'Shoulder', key: 'shoulder' }
  ],
  'Gown': [
    { label: 'Bust', key: 'bust', required: true },
    { label: 'Waist', key: 'waist', required: true },
    { label: 'Hip', key: 'hip', required: true },
    { label: 'Length', key: 'length', required: true },
    { label: 'Shoulder', key: 'shoulder' },
    { label: 'Sleeve', key: 'sleeve' }
  ],
  'Suit': [
    { label: 'Chest', key: 'chest', required: true },
    { label: 'Waist', key: 'waist', required: true },
    { label: 'Shoulder', key: 'shoulder', required: true },
    { label: 'Sleeve', key: 'sleeve', required: true },
    { label: 'Length', key: 'length', required: true }
  ]
};

const DynamicMeasurements: React.FC<DynamicMeasurementsProps> = ({
  itemType,
  measurements,
  onChange
}) => {
  const standardFields = measurementsByType[itemType] || measurementsByType['Other'] || [
    { label: 'Chest', key: 'chest' },
    { label: 'Waist', key: 'waist' },
    { label: 'Length', key: 'length' },
    { label: 'Shoulder', key: 'shoulder' }
  ];

  const customFields = Object.keys(measurements).filter(key => 
    !standardFields.some(field => field.key === key)
  );

  const handleFieldChange = (key: string, value: string) => {
    onChange({
      ...measurements,
      [key]: value
    });
  };

  const addCustomField = () => {
    const fieldName = prompt('Enter custom measurement name:');
    if (fieldName && fieldName.trim()) {
      const key = fieldName.toLowerCase().replace(/\s+/g, '_');
      onChange({
        ...measurements,
        [key]: ''
      });
    }
  };

  const removeCustomField = (key: string) => {
    const updatedMeasurements = { ...measurements };
    delete updatedMeasurements[key];
    onChange(updatedMeasurements);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Measurements for {itemType}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomField}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Field
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {standardFields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.key}
              value={measurements[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder="inches"
              required={field.required}
            />
          </div>
        ))}

        {customFields.map((key) => (
          <div key={key} className="relative">
            <Label htmlFor={key}>
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Label>
            <div className="flex">
              <Input
                id={key}
                value={measurements[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                placeholder="inches"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-6 h-8 w-8 p-0"
                onClick={() => removeCustomField(key)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicMeasurements;
