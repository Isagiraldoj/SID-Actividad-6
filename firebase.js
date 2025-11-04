import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvzR3ydXxeccIL-zpDKMQXUowt1AjHoUA",
  authDomain: "actividad-6-matchmaking.firebaseapp.com",
  databaseURL: "https://actividad-6-matchmaking-default-rtdb.firebaseio.com",
  projectId: "actividad-6-matchmaking",
  storageBucket: "actividad-6-matchmaking.firebasestorage.app",
  messagingSenderId: "279533926177",
  appId: "1:279533926177:web:5f3b0be01ca06bad02b060",
  measurementId: "G-FGJ66Z2C47"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);