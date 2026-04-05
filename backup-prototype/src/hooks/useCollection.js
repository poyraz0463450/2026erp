import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db, isFirebaseConfigured } from "../config/firebase";

export const useCollection = (
  collectionName,
  options = {},
) => {
  const {
    orderByField = "created_at",
    orderDirection = "desc",
    filters = [],
  } = options;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  const constraints = useMemo(() => {
    const activeFilters = filters
      .filter((filter) => filter?.field && filter?.operator)
      .map((filter) => where(filter.field, filter.operator, filter.value));

    return [...activeFilters, orderBy(orderByField, orderDirection)];
  }, [filters, orderByField, orderDirection]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      setError("");
      setRecords([]);
      return undefined;
    }

    const collectionRef = collection(db, collectionName);
    const collectionQuery = query(collectionRef, ...constraints);

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        setRecords(snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [collectionName, constraints]);

  return { records, loading, error };
};
