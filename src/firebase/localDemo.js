import { LOCAL_DEMO_COLLECTIONS } from './demoFallbacks';

const PREFIX = 'artegon.demo.';

const countRows = (rows) => rows.length;

export function seedLocalDepartmentDemos({ forceReset = false } = {}) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { initialized: false, collections: 0, records: 0 };
  }

  const summary = {
    initialized: true,
    collections: 0,
    records: 0,
    detail: {},
  };

  Object.entries(LOCAL_DEMO_COLLECTIONS).forEach(([collectionName, rows]) => {
    const key = `${PREFIX}${collectionName}`;
    const existing = window.localStorage.getItem(key);

    if (!existing || forceReset) {
      window.localStorage.setItem(key, JSON.stringify(rows));
    }

    summary.collections += 1;
    summary.records += countRows(rows);
    summary.detail[collectionName] = countRows(rows);
  });

  window.localStorage.setItem(
    `${PREFIX}meta`,
    JSON.stringify({
      version: 'department-demo-v1',
      updatedAt: new Date().toISOString(),
      ...summary,
    })
  );

  return summary;
}
