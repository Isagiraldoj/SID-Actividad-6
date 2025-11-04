// app.js
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  ref, set, get, child, query, orderByChild, update
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const $ = (s) => document.querySelector(s);
const loginContainer = $("#loginContainer");
const appSection = $("#appSection");
const authMsg = $("#authMsg");
const authAlert = $("#authAlert");
const welcome = $("#welcome");
const inpUser = $("#usernameInput");
const inpPass = $("#passwordInput");
const loginButton = $("#loginButton");
const registerButton = $("#registerButton");
const resetPwdButton = $("#resetPwdButton");
const logoutButton = $("#logoutButton");
const btnRefresh = $("#btnRefresh");
const tblBody = $("#tblBody");
const listMsg = $("#listMsg");

// --- Helpers de sesión local ---
const storage = {
  get username() { return localStorage.getItem("sid_username") || ""; },
  set username(v) { v ? localStorage.setItem("sid_username", v) : localStorage.removeItem("sid_username"); },
};

function showAuth() { loginContainer.classList.remove("hidden"); appSection.classList.add("hidden"); }
function showApp() { loginContainer.classList.add("hidden"); appSection.classList.remove("hidden"); welcome.textContent = `Hola, ${storage.username}`; }
function showAlert(type, text) {
  authAlert.innerHTML = `<div class="alert ${type === "error" ? "alert--error" : "alert--success"}">${text}</div>`;
}
function clearAlert() { authAlert.innerHTML = ""; }

// --- Auth Firebase ---
async function apiRegister(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const username = email.split("@")[0];
  await set(ref(db, `users/${uid}`), { username, score: 0, createdAt: Date.now() });
}

async function apiLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snap = await get(child(ref(db), `users/${uid}/username`));
  storage.username = snap.exists() ? snap.val() : email.split("@")[0];
}

async function apiUpdateScore(score) {
  const u = auth.currentUser;
  if (!u) throw new Error("No autenticado");
  await update(ref(db, `users/${u.uid}`), { score, lastPlayed: Date.now() });
}

async function apiListUsers() {
  const q = query(ref(db, "users"), orderByChild("score"));
  const snap = await get(q);
  const list = snap.exists() ? Object.values(snap.val()) : [];
  return list.sort((a, b) => b.score - a.score);
}

// --- Eventos de interfaz ---
loginButton.addEventListener("click", async (e) => {
  e.preventDefault(); clearAlert(); authMsg.textContent = "";
  const u = inpUser.value.trim(), p = inpPass.value;
  try {
    await apiLogin(u, p);
  } catch {
    showAlert("error", "Error al iniciar sesión");
  }
});

registerButton.addEventListener("click", async () => {
  clearAlert();
  const u = inpUser.value.trim(), p = inpPass.value;
  try {
    await apiRegister(u, p);
    showAlert("success", "Usuario registrado correctamente.");
  } catch {
    showAlert("error", "No se pudo registrar.");
  }
});

resetPwdButton.addEventListener("click", async () => {
  const email = inpUser.value.trim();
  if (!email.includes("@")) return showAlert("error", "Escribe tu email.");
  await sendPasswordResetEmail(auth, email);
  showAlert("success", "Correo de recuperación enviado.");
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  storage.username = "";
  showAuth();
});

onAuthStateChanged(auth, async (u) => {
  if (u) { showApp(); loadLeaderboard(); }
  else { showAuth(); }
});

// --- Leaderboard ---
btnRefresh.addEventListener("click", loadLeaderboard);
async function loadLeaderboard() {
  listMsg.textContent = "Cargando...";
  tblBody.innerHTML = "";
  const users = await apiListUsers();
  users.forEach((u, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${u.username}</td><td>${u.score ?? 0}</td>`;
    tblBody.appendChild(tr);
  });
  listMsg.textContent = `Total: ${users.length}`;
}

// --- 🔗 Exponer función al juego ---
window.sendScoreToFirebase = async function (score) {
  try {
    await apiUpdateScore(score);
    await loadLeaderboard();
  } catch (e) {
    console.error("Error al guardar el puntaje:", e);
  }
};