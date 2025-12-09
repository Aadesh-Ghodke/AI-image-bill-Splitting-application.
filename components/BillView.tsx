import * as React from 'react';
import { useMemo } from 'react';
import { BillData, PersonSummary } from '../types';
import { User, DollarSign, Receipt, Users } from 'lucide-react';

interface BillViewProps {
  bill: BillData;
}

export const BillView: React.FC<BillViewProps> = ({ bill }) => {
  // Calculate summary per person
  const summary = useMemo(() => {
    const peopleMap = new Map<string, PersonSummary>();
    const unassignedItems: typeof bill.items = [];

    bill.items.forEach(item => {
      if (item.assignedTo.length === 0) {
        unassignedItems.push(item);
        return;
      }

      const splitCount = item.assignedTo.length;
      const pricePerPerson = item.price / splitCount;

      item.assignedTo.forEach(person => {
        const name = person.trim(); // Normalize slightly
        if (!peopleMap.has(name)) {
          peopleMap.set(name, {
            name,
            itemsTotal: 0,
            taxShare: 0,
            tipShare: 0,
            totalOwed: 0
          });
        }
        const p = peopleMap.get(name)!;
        p.itemsTotal += pricePerPerson;
      });
    });

    // Calculate tax and tip shares proportional to items total
    // Note: This assumes tax/tip are proportional to the subtotal of assigned items.
    // If there are unassigned items, the math might be slightly off for the "total bill" view,
    // but correct for the individuals.
    const totalAssignedSubtotal = Array.from(peopleMap.values()).reduce((acc, p) => acc + p.itemsTotal, 0);

    peopleMap.forEach(p => {
      const shareRatio = totalAssignedSubtotal > 0 ? p.itemsTotal / totalAssignedSubtotal : 0;
      // We distribute the TOTAL tax/tip based on the share of ASSIGNED items.
      // This ensures if everyone is assigned, the full tax/tip is covered.
      p.taxShare = bill.tax * shareRatio;
      p.tipShare = bill.tip * shareRatio;
      p.totalOwed = p.itemsTotal + p.taxShare + p.tipShare;
    });

    return {
      people: Array.from(peopleMap.values()),
      unassigned: unassignedItems
    };
  }, [bill]);

  const formatMoney = (amount: number) => {
    return `${bill.currency}${amount.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200">
      <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-indigo-600" />
        <h2 className="font-semibold text-slate-800">Receipt Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
            <tr>
              <th className="p-4 font-medium">Item</th>
              <th className="p-4 font-medium text-right">Price</th>
              <th className="p-4 font-medium">Assigned To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bill.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-slate-800 font-medium">{item.description}</td>
                <td className="p-4 text-slate-600 text-right whitespace-nowrap">{formatMoney(item.price)}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {item.assignedTo.length > 0 ? (
                      item.assignedTo.map((person, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {person}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs italic">Unassigned</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="bg-slate-50 border-t border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-800">Cost Breakdown</h3>
        </div>
        
        {summary.people.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-2">Start chatting to assign items!</p>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {summary.people.map((person) => (
            <div key={person.name} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{person.name}</div>
                  <div className="text-xs text-slate-500">
                    + {formatMoney(person.taxShare + person.tipShare)} tax/tip
                  </div>
                </div>
              </div>
              <div className="text-right">
                 <div className="font-bold text-emerald-600">{formatMoney(person.totalOwed)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between text-sm text-slate-600">
           <span>Subtotal: {formatMoney(bill.subtotal)}</span>
           <span>Tax: {formatMoney(bill.tax)}</span>
           <span>Tip: {formatMoney(bill.tip)}</span>
           <span className="font-bold text-slate-900">Total: {formatMoney(bill.total)}</span>
        </div>
      </div>
    </div>
  );
};