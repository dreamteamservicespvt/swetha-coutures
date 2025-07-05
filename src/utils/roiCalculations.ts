import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BillItem, Bill } from '@/utils/billingUtils';

export interface ROIData {
  totalIncome: number;
  totalCost: number;
  netProfit: number;
  roiPercentage: number;
  itemCount: number;
  avgProfit: number;
}

export interface StaffROI extends ROIData {
  staffId: string;
  staffName: string;
  staffRole: string;
  servicesProvided: BillItem[];
  totalHours?: number;
  hourlyRate?: number;
  salaryCost?: number;
}

export interface InventoryROI extends ROIData {
  inventoryId: string;
  itemName: string;
  category: string;
  unitsSold: number;
  avgSellingPrice: number;
  avgCostPrice: number;
  turnoverRate: number;
}

export interface ServiceROI extends ROIData {
  serviceId: string;
  serviceName: string;
  category: string;
  timesProvided: number;
  avgRate: number;
}

export interface PeriodROI {
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  totalCost: number;
  netProfit: number;
  roiPercentage: number;
  staffROI: StaffROI[];
  inventoryROI: InventoryROI[];
  serviceROI: ServiceROI[];
}

/**
 * Calculate ROI for a specific staff member
 */
export const calculateStaffROI = async (
  staffId: string,
  startDate?: Date,
  endDate?: Date
): Promise<StaffROI> => {
  try {
    // Build query for bills in date range
    let billsQuery = query(collection(db, 'bills'));
    
    if (startDate && endDate) {
      billsQuery = query(
        collection(db, 'bills'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
    }

    const billsSnapshot = await getDocs(billsQuery);
    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[];

    // Filter bill items for this staff member
    const staffServices: BillItem[] = [];
    let totalIncome = 0;
    let totalCost = 0;

    bills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          if (item.type === 'staff' && item.sourceId === staffId) {
            staffServices.push(item);
            totalIncome += item.amount;
            totalCost += item.cost * item.quantity;
          }
        });
      }
    });

    // Get staff details
    const staffData = await getDocs(query(collection(db, 'staff'), where('id', '==', staffId)));
    const staff = staffData.docs[0]?.data() || {};

    const netProfit = totalIncome - totalCost;
    const roiPercentage = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      staffId,
      staffName: staff.name || 'Unknown',
      staffRole: staff.role || staff.designation || 'Staff',
      servicesProvided: staffServices,
      totalIncome,
      totalCost,
      netProfit,
      roiPercentage,
      itemCount: staffServices.length,
      avgProfit: staffServices.length > 0 ? netProfit / staffServices.length : 0,
      hourlyRate: staff.billingRate || 0,
      salaryCost: staff.costRate || 0
    };
  } catch (error) {
    console.error('Error calculating staff ROI:', error);
    throw error;
  }
};

/**
 * Calculate ROI for a specific inventory item
 */
export const calculateInventoryROI = async (
  inventoryId: string,
  startDate?: Date,
  endDate?: Date
): Promise<InventoryROI> => {
  try {
    // Build query for bills in date range
    let billsQuery = query(collection(db, 'bills'));
    
    if (startDate && endDate) {
      billsQuery = query(
        collection(db, 'bills'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
    }

    const billsSnapshot = await getDocs(billsQuery);
    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[];

    // Filter bill items for this inventory item
    const inventoryItems: BillItem[] = [];
    let totalIncome = 0;
    let totalCost = 0;
    let unitsSold = 0;

    bills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          if (item.type === 'inventory' && item.sourceId === inventoryId) {
            inventoryItems.push(item);
            totalIncome += item.amount;
            totalCost += item.cost * item.quantity;
            unitsSold += item.quantity;
          }
        });
      }
    });

    // Get inventory details
    const inventoryData = await getDocs(query(collection(db, 'inventory'), where('id', '==', inventoryId)));
    const inventory = inventoryData.docs[0]?.data() || {};

    const netProfit = totalIncome - totalCost;
    const roiPercentage = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      inventoryId,
      itemName: inventory.name || 'Unknown',
      category: inventory.category || 'Uncategorized',
      unitsSold,
      avgSellingPrice: unitsSold > 0 ? totalIncome / unitsSold : 0,
      avgCostPrice: unitsSold > 0 ? totalCost / unitsSold : 0,
      turnoverRate: inventory.quantity > 0 ? unitsSold / inventory.quantity : 0,
      totalIncome,
      totalCost,
      netProfit,
      roiPercentage,
      itemCount: inventoryItems.length,
      avgProfit: inventoryItems.length > 0 ? netProfit / inventoryItems.length : 0
    };
  } catch (error) {
    console.error('Error calculating inventory ROI:', error);
    throw error;
  }
};

/**
 * Calculate ROI for a specific service
 */
export const calculateServiceROI = async (
  serviceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceROI> => {
  try {
    // Build query for bills in date range
    let billsQuery = query(collection(db, 'bills'));
    
    if (startDate && endDate) {
      billsQuery = query(
        collection(db, 'bills'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      );
    }

    const billsSnapshot = await getDocs(billsQuery);
    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[];

    // Filter bill items for this service
    const serviceItems: BillItem[] = [];
    let totalIncome = 0;
    let totalCost = 0;

    bills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach(item => {
          if (item.type === 'service' && item.sourceId === serviceId) {
            serviceItems.push(item);
            totalIncome += item.amount;
            totalCost += item.cost * item.quantity;
          }
        });
      }
    });

    // Get service details from work descriptions
    const serviceData = await getDocs(query(collection(db, 'workDescriptions'), where('id', '==', serviceId)));
    const service = serviceData.docs[0]?.data() || {};

    const netProfit = totalIncome - totalCost;
    const roiPercentage = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      serviceId,
      serviceName: service.description || 'Unknown',
      category: service.category || 'Uncategorized',
      timesProvided: serviceItems.length,
      avgRate: serviceItems.length > 0 ? totalIncome / serviceItems.length : 0,
      totalIncome,
      totalCost,
      netProfit,
      roiPercentage,
      itemCount: serviceItems.length,
      avgProfit: serviceItems.length > 0 ? netProfit / serviceItems.length : 0
    };
  } catch (error) {
    console.error('Error calculating service ROI:', error);
    throw error;
  }
};

/**
 * Calculate comprehensive ROI for a specific period
 */
export const calculatePeriodROI = async (
  startDate: Date,
  endDate: Date
): Promise<PeriodROI> => {
  try {
    // Get all bills in the period
    const billsQuery = query(
      collection(db, 'bills'),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );

    const billsSnapshot = await getDocs(billsQuery);
    const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[];

    // Calculate total income and costs
    let totalIncome = 0;
    let totalCost = 0;
    
    // Track unique staff, inventory, and service IDs
    const staffIds = new Set<string>();
    const inventoryIds = new Set<string>();
    const serviceIds = new Set<string>();

    bills.forEach(bill => {
      totalIncome += bill.totalAmount || 0;
      
      if (bill.items) {
        bill.items.forEach(item => {
          totalCost += item.cost * item.quantity;
          
          if (item.sourceId) {
            if (item.type === 'staff') {
              staffIds.add(item.sourceId);
            } else if (item.type === 'inventory') {
              inventoryIds.add(item.sourceId);
            } else if (item.type === 'service') {
              serviceIds.add(item.sourceId);
            }
          }
        });
      }
    });

    // Calculate ROI for each category
    const staffROI: StaffROI[] = [];
    const inventoryROI: InventoryROI[] = [];
    const serviceROI: ServiceROI[] = [];

    // Calculate staff ROI
    for (const staffId of staffIds) {
      try {
        const roi = await calculateStaffROI(staffId, startDate, endDate);
        staffROI.push(roi);
      } catch (error) {
        console.error(`Error calculating ROI for staff ${staffId}:`, error);
      }
    }

    // Calculate inventory ROI
    for (const inventoryId of inventoryIds) {
      try {
        const roi = await calculateInventoryROI(inventoryId, startDate, endDate);
        inventoryROI.push(roi);
      } catch (error) {
        console.error(`Error calculating ROI for inventory ${inventoryId}:`, error);
      }
    }

    // Calculate service ROI
    for (const serviceId of serviceIds) {
      try {
        const roi = await calculateServiceROI(serviceId, startDate, endDate);
        serviceROI.push(roi);
      } catch (error) {
        console.error(`Error calculating ROI for service ${serviceId}:`, error);
      }
    }

    const netProfit = totalIncome - totalCost;
    const roiPercentage = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      startDate,
      endDate,
      totalIncome,
      totalCost,
      netProfit,
      roiPercentage,
      staffROI: staffROI.sort((a, b) => b.roiPercentage - a.roiPercentage),
      inventoryROI: inventoryROI.sort((a, b) => b.roiPercentage - a.roiPercentage),
      serviceROI: serviceROI.sort((a, b) => b.roiPercentage - a.roiPercentage)
    };
  } catch (error) {
    console.error('Error calculating period ROI:', error);
    throw error;
  }
};

/**
 * Get top performing staff members
 */
export const getTopPerformingStaff = async (
  limit: number = 10,
  startDate?: Date,
  endDate?: Date
): Promise<StaffROI[]> => {
  try {
    // Get all staff members
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    const staff = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate ROI for each staff member
    const staffROI: StaffROI[] = [];
    
    for (const staffMember of staff) {
      try {
        const roi = await calculateStaffROI(staffMember.id, startDate, endDate);
        if (roi.totalIncome > 0) { // Only include staff with actual income
          staffROI.push(roi);
        }
      } catch (error) {
        console.error(`Error calculating ROI for staff ${staffMember.id}:`, error);
      }
    }

    // Sort by ROI percentage and return top performers
    return staffROI
      .sort((a, b) => b.roiPercentage - a.roiPercentage)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top performing staff:', error);
    throw error;
  }
};
