import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserDoc } from '../firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getUserDoc(firebaseUser.uid);
          if (snap.exists()) {
            setUserDoc(snap.data());
          } else {
            setUserDoc({ role: 'viewer', displayName: firebaseUser.email, full_name: firebaseUser.email });
          }
        } catch {
          setUserDoc({ role: 'viewer', displayName: firebaseUser.email, full_name: firebaseUser.email });
        }
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const role = userDoc?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isEngineer = ['admin', 'engineer'].includes(role);
  const isWarehouse = ['admin', 'warehouse'].includes(role);
  const isKalite = ['admin', 'kalite'].includes(role);
  const isOperator = role === 'operator';
  const isSatinAlma = ['admin', 'satin_alma'].includes(role);
  const isFinance = ['admin', 'finance'].includes(role);
  const isSales = ['admin', 'sales'].includes(role);

  return (
    <AuthContext.Provider value={{ user, userDoc, role, isAdmin, isEngineer, isWarehouse, isKalite, isOperator, isSatinAlma, isFinance, isSales, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
