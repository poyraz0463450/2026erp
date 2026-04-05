import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
    const unsubQC = onSnapshot(collection(db, 'inventory_batches'), (snap) => {
      const pendingQC = snap.docs.filter((doc) => doc.data().status === 'Karantina').length;
      setCounts((prev) => ({ ...prev, pendingQC }));
    });

    const unsubPO = onSnapshot(collection(db, 'purchase_orders'), (snap) => {
      const today = new Date().toISOString().split('T')[0];
      let pendingGRN = 0;
      let delayedPO = 0;

      snap.forEach((doc) => {
        const data = doc.data();
        if (['Gönderildi', 'Kısmi Teslim'].includes(data.status)) {
          pendingGRN += 1;
          if (data.expectedDeliveryDate && data.expectedDeliveryDate < today) delayedPO += 1;
        }
      });

      setCounts((prev) => ({ ...prev, pendingGRN, delayedPO }));
    });

    const unsubParts = onSnapshot(collection(db, 'parts'), (snap) => {
      const criticalStock = snap.docs.filter((doc) => {
        const data = doc.data();
        return (data.reorderPoint || 0) > 0 && (data.currentStock || 0) <= data.reorderPoint;
      }).length;

      setCounts((prev) => ({ ...prev, criticalStock }));
    });

    const unsubNCR = onSnapshot(collection(db, 'ncr_records'), (snap) => {
      const openNCR = snap.docs.filter((doc) => doc.data().status === 'Açık').length;
      setCounts((prev) => ({ ...prev, openNCR }));
    });

    const unsubCal = onSnapshot(collection(db, 'measuring_tools'), (snap) => {
      const expiredCalibration = snap.docs.filter((doc) => doc.data().status === 'Süresi Dolmuş').length;
      setCounts((prev) => ({ ...prev, expiredCalibration }));
    });

    return () => {
      unsubQC();
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
