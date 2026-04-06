import { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

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
    // 1. Pending QC count
    const qcQuery = query(collection(db, 'inspections'), where('status', '==', 'Bekleniyor'));
    const unsubQC = onSnapshot(qcQuery, (snap) => {
      setCounts((prev) => ({ ...prev, pendingQC: snap.size }));
    });

    // 2. Pending GRN (Expected from ASN "Yolda" or PO returning)
    const asnQuery = query(collection(db, 'asn'), where('status', '==', 'Yolda'));
    const unsubASN = onSnapshot(asnQuery, (snap) => {
      setCounts((prev) => ({ ...prev, pendingGRN: snap.size }));
    });

    // 3. Delayed PO (Client-side filtering for simplicity due to date fields)
    const poQuery = query(collection(db, 'purchasing_orders'), where('status', 'in', ['Onaylandı', 'Kısmi Teslimat']));
    const unsubPO = onSnapshot(poQuery, (snap) => {
      let delayedCount = 0;
      const today = new Date().toISOString().split('T')[0];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.expectedDeliveryDate && data.expectedDeliveryDate < today) {
          delayedCount++;
        }
      });
      setCounts((prev) => ({ ...prev, delayedPO: delayedCount }));
    });

    // 4. Critical Stock (Client-side filtering because we compare stock <= reorderPoint)
    const partsQuery = query(collection(db, 'parts'));
    const unsubParts = onSnapshot(partsQuery, (snap) => {
      let criticalCount = 0;
      snap.forEach(doc => {
        const data = doc.data();
        // Step 0: logic says reorderPoint is used.
        if (data.reorderPoint > 0 && data.currentStock <= data.reorderPoint) {
          criticalCount++;
        }
      });
      setCounts((prev) => ({ ...prev, criticalStock: criticalCount }));
    });

    // 5. Open NCR
    const ncrQuery = query(collection(db, 'ncr'), where('status', '==', 'Açık'));
    const unsubNCR = onSnapshot(ncrQuery, (snap) => {
      setCounts((prev) => ({ ...prev, openNCR: snap.size }));
    });

    // 6. Expired Calibration
    const calQuery = query(collection(db, 'measuring_tools'), where('status', '==', 'Süresi Dolmuş'));
    const unsubCal = onSnapshot(calQuery, (snap) => {
      setCounts((prev) => ({ ...prev, expiredCalibration: snap.size }));
    });

    return () => {
      unsubQC();
      unsubASN();
      unsubPO();
      unsubParts();
      unsubNCR();
      unsubCal();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ counts }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
