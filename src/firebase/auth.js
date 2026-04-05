import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  deleteUser as firebaseDeleteUser,
} from 'firebase/auth';
import { auth } from './config';

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const createAuthUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);
