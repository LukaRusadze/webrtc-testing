// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCTMutOpydLjDIbJah7-Fqsr0A8R157ebs",
  authDomain: "kynoa-93560.firebaseapp.com",
  projectId: "kynoa-93560",
  storageBucket: "kynoa-93560.firebasestorage.app",
  messagingSenderId: "186247980831",
  appId: "1:186247980831:web:b2262821606d5c5268322a",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
