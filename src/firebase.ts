
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7N4cPv0GicoQyfq_QsmK7ZkwQ28m6NRI",
  authDomain: "s2k-esports-60e0a.firebaseapp.com",
  projectId: "s2k-esports-60e0a",
  storageBucket: "s2k-esports-60e0a.firebasestorage.app",
  messagingSenderId: "316122627563",
  appId: "1:316122627563:web:73616ba1eae3974168edae",
  measurementId: "G-BSP8HLYW1Y"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
