export interface BillItem {
  id: string;
  description: string;
  price: number;
  assignedTo: string[]; // Array of names
}

export interface BillData {
  items: BillItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  currency: string;
}

export interface PersonSummary {
  name: string;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  totalOwed: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface UpdateResponse {
  updatedBill: BillData;
  responseText: string;
}