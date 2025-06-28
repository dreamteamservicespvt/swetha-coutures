
export interface OrderFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export interface OrderItem {
  madeFor: string;
  category: string;
  description: string;
  quantity: number;
  status: string;
  orderDate: string;
  deliveryDate: string;
  assignedStaff: string[];
  requiredMaterials: { id: string; name: string; quantity: number; unit: string; }[];
  designImages: string[];
  notes: string;
  sizes: Record<string, string>;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  role?: string;
  activeOrdersCount?: number;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
}
