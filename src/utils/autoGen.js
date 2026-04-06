import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

const buildLocalLotFallback = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const rows = JSON.parse(window.localStorage.getItem('artegon.demo.inventory_lots') || '[]');
        const now = new Date();
        const prefix = `LOT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const seqs = rows
            .map((item) => item.batchId || item.lotNumber || '')
            .filter((value) => value.startsWith(prefix))
            .map((value) => Number.parseInt(value.split('-').pop(), 10))
            .filter((value) => Number.isFinite(value));
        return `${prefix}-${String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0')}`;
    } catch {
        return null;
    }
};

const buildLocalWOFallback = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const rows = JSON.parse(window.localStorage.getItem('artegon.demo.production_orders') || '[]');
        const year = new Date().getFullYear();
        const prefix = `WO-${year}`;
        const seqs = rows
            .map((item) => item.woNumber || '')
            .filter((value) => value.startsWith(prefix))
            .map((value) => Number.parseInt(value.split('-').pop(), 10))
            .filter((value) => Number.isFinite(value));
        return `${prefix}-${String((seqs.length ? Math.max(...seqs) : 0) + 1).padStart(3, '0')}`;
    } catch {
        return null;
    }
};

/**
 * Generates the next Lot Number: LOT-YYYY-MM-XXX
 */
export const generateLotNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `LOT-${year}-${month}`;

    const q = query(
        collection(db, 'inventory_lots'),
        where('batchId', '>=', prefix),
        where('batchId', '<=', prefix + '\uf8ff'),
        orderBy('batchId', 'desc'),
        limit(1)
    );

    try {
        const snapshot = await getDocs(q);
        let seq = 1;

        if (!snapshot.empty) {
            const lastId = snapshot.docs[0].data().batchId;
            const lastSeq = parseInt(lastId.split('-').pop(), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }

        return `${prefix}-${String(seq).padStart(3, '0')}`;
    } catch {
        return buildLocalLotFallback() || `${prefix}-001`;
    }
};

/**
 * Generates the next Work Order Number: WO-YYYY-XXX
 */
export const generateWorkOrderNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `WO-${year}`;

    const q = query(
        collection(db, 'production_orders'),
        where('woNumber', '>=', prefix),
        where('woNumber', '<=', prefix + '\uf8ff'),
        orderBy('woNumber', 'desc'),
        limit(1)
    );

    try {
        const snapshot = await getDocs(q);
        let seq = 1;

        if (!snapshot.empty) {
            const lastId = snapshot.docs[0].data().woNumber;
            const lastSeq = parseInt(lastId.split('-').pop(), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }

        return `${prefix}-${String(seq).padStart(3, '0')}`;
    } catch {
        return buildLocalWOFallback() || `${prefix}-001`;
    }
};
