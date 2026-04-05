import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db, isFirebaseConfigured } from "../../config/firebase";
import { COLLECTIONS } from "../../constants/collections";

const AuthContext = createContext(null);

const demoUser = {
  uid: "demo-admin",
  email: "demo@defense-erp.local",
  displayName: "Demo Admin",
};

const demoProfile = {
  role: "admin",
  full_name: "Demo Admin",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isFirebaseConfigured ? null : demoUser);
  const [profile, setProfile] = useState(isFirebaseConfigured ? null : demoProfile);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);

      const profileRef = doc(db, COLLECTIONS.USERS, nextUser.uid);
      const profileSnapshot = await getDoc(profileRef);

      setProfile(
        profileSnapshot.exists()
          ? profileSnapshot.data()
          : { role: "engineer", full_name: nextUser.displayName || nextUser.email },
      );
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      role: profile?.role || "engineer",
      loading,
      isDemoMode: !isFirebaseConfigured,
      signIn: async (email, password) => {
        if (!auth) {
          return;
        }
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOutUser: async () => {
        if (!auth) {
          setUser(demoUser);
          setProfile(demoProfile);
          return;
        }
        await signOut(auth);
      },
    }),
    [loading, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
