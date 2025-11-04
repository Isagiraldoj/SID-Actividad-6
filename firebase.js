import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPj_AFAJTnl0_ffTNz3x6WeOPZcojAIcY",
  authDomain: "pruebasid-isabelagiraldo.firebaseapp.com",
  databaseURL: "https://pruebasid-isabelagiraldo-default-rtdb.firebaseio.com",
  projectId: "pruebasid-isabelagiraldo",
  storageBucket: "pruebasid-isabelagiraldo.firebasestorage.app",
  messagingSenderId: "190894139049",
  appId: "1:190894139049:web:b402e288416c691e216bb8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);