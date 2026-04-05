import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Generates the next Lot Number: LOT-YYYY-MM-XXX
 */
export const generateLotNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `LOT-${year}-${month}`;

    const q = query(
        collection(db, 'inventory_batches'),
        where('batchId', '>=', prefix),
        where('batchId', '<=', prefix + '\uf8ff'),
        orderBy('batchId', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);
    let seq = 1;

    if (!snapshot.empty) {
        const lastId = snapshot.docs[0].data().batchId;
        const lastSeq = parseInt(lastId.split('-').pop());
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${String(seq).padStart(3, '0')}`;
};

/**
 * Generates the next Work Order Number: WO-YYYY-XXX
 */
export const generateWorkOrderNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `WO-${year}`;

    const q = query(
        collection(db, 'work_orders'),
        where('woNumber', '>=', prefix),
        where('woNumber', '<=', prefix + '\uf8ff'),
        orderBy('woNumber', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);
    let seq = 1;

    if (!snapshot.empty) {
        const lastId = snapshot.docs[0].data().woNumber;
        const lastSeq = parseInt(lastId.split('-').pop());
        if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${String(seq).padStart(3, '0')}`;
};
