import { createContext, useContext, useEffect, useState } from 'react';
import {
  getCollection,
  getInventoryBatches,
  getNcrRecords,
  getParts,
  getPurchaseOrders,
} from '../firebase/firestore';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [counts, setCounts] = useState({
    pendingQC: 0,
    pendingGRN: 0,
    delayedPO: 0,
    criticalStock: 0,
    openNCR: 0,
    expiredCalibration: 0,
  });

  useEffect(() => {
    let active = true;

    const loadCounts = async () => {
      try {
        const [batchSnap, poSnap, partSnap, ncrSnap, toolSnap] = await Promise.all([
          getInventoryBatches(),
          getPurchaseOrders(),
          getParts(),
          getNcrRecords(),
          getCollection('measuring_tools'),
        ]);

        if (!active) return;

        const batchRows = batchSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const poRows = poSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const partRows = partSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const ncrRows = ncrSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const toolRows = toolSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const today = new Date().toISOString().split('T')[0];

        setCounts({
          pendingQC: batchRows.filter((row) => row.status === 'Karantina' || row.qcStatus === 'Karantina').length,
          pendingGRN: poRows.filter((row) => ['Gönderildi', 'Kısmi Teslim'].includes(row.status)).length,
          delayedPO: poRows.filter((row) => ['Gönderildi', 'Kısmi Teslim'].includes(row.status) && row.expectedDeliveryDate && row.expectedDeliveryDate < today).length,
          criticalStock: partRows.filter((row) => {
            const threshold = row.reorderPoint || row.minStock || 0;
            const availableStock = Math.max((row.currentStock || 0) - (row.reservedStock || 0), 0);
            return threshold > 0 && availableStock <= threshold;
          }).length,
          openNCR: ncrRows.filter((row) => ['Açık', 'Yeni', 'İncelemede'].includes(row.status)).length,
          expiredCalibration: toolRows.filter((row) => row.status === 'Süresi Dolmuş').length,
        });
      } catch (error) {
        console.error('Notification load error:', error);
      }
    };

    loadCounts();
    const intervalId = window.setInterval(loadCounts, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ counts }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
