import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './nodeFirebaseConfig.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function loadSeedModule() {
  const sourcePath = path.join(rootDir, 'src', 'firebase', 'demoData.js');
  const generatedPath = path.join(__dirname, '.generated-demoData.mjs');
  let source = await fs.readFile(sourcePath, 'utf8');
  source = source.replace("from './config'", "from './nodeFirebaseConfig.mjs'");
  await fs.writeFile(generatedPath, source, 'utf8');
  return import(`${pathToFileURL(generatedPath).href}?t=${Date.now()}`);
}

async function main() {
  const tempEmail = `demo.seed.${Date.now()}@artegon.local`;
  const tempPassword = `Artegon!${Math.random().toString(36).slice(2, 10)}1`;
  let userUid = '';
  let currentUser = null;

  try {
    console.log(`Seeder account creating: ${tempEmail}`);
    const credential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
    userUid = credential.user.uid;
    currentUser = credential.user;
    console.log(`Seeder account created: ${userUid}`);

    await setDoc(
      doc(db, 'users', userUid),
      {
        email: tempEmail,
        full_name: 'Demo Seeder',
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log('Seeder user document created');

    const { seedDemoData } = await loadSeedModule();
    console.log('Seed module loaded');
    const summary = await seedDemoData({
      currentUserName: 'Demo Seeder',
      currentUserEmail: tempEmail,
    });
    console.log('Demo data committed to Firestore');

    console.log(JSON.stringify({ ok: true, summary }, null, 2));

    try {
      await deleteDoc(doc(db, 'users', userUid));
      await deleteUser(currentUser);
      await signOut(auth);
      console.log('Temporary seeder account cleaned');
    } catch (cleanupError) {
      console.log(`Cleanup skipped: ${cleanupError?.code || cleanupError?.message || cleanupError}`);
    }
    process.exit(0);
  } catch (error) {
    if (userUid) {
      try {
        await deleteDoc(doc(db, 'users', userUid));
      } catch {}
    }
    if (currentUser) {
      try {
        await deleteUser(currentUser);
      } catch {}
    }
    try {
      await signOut(auth);
    } catch {}
    console.error(JSON.stringify({ ok: false, message: error?.message || String(error), code: error?.code || null }, null, 2));
    process.exitCode = 1;
    process.exit(1);
  }
}

main();
