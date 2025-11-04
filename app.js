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
  ref, set, get, child, query, orderByChild, update, onValue
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const $ = (s) => document.querySelector(s);

// ======= UI existente =======
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

// ======= UI amigos (nuevo, pero no rompe nada) =======
const friendEmailInput = document.getElementById("friendEmailInput");
const sendFriendReqBtn = document.getElementById("sendFriendReqBtn");
const inboxList = document.getElementById("inboxList");
const friendsList = document.getElementById("friendsList");

let unsubInbox = null;
let unsubFriends = null;
let unsubLeaderboard = null;

// --- Helpers de sesión local ---
const storage = {
  get username() { return localStorage.getItem("sid_username") || ""; },
  set username(v) { v ? localStorage.setItem("sid_username", v) : localStorage.removeItem("sid_username"); },
  get email() { return localStorage.getItem("sid_email") || ""; },
  set email(v) { v ? localStorage.setItem("sid_email", v) : localStorage.removeItem("sid_email"); },
};

function showAuth() {
  loginContainer.classList.remove("hidden");
  appSection.classList.add("hidden");
}
function showApp() {
  loginContainer.classList.add("hidden");
  appSection.classList.remove("hidden");
  welcome.textContent = `Hola, ${storage.username}`;
}
function showAlert(type, text) {
  authAlert.innerHTML = `<div class="alert ${type === "error" ? "alert--error" : "alert--success"}">${text}</div>`;
}
function clearAlert() { authAlert.innerHTML = ""; }

// ======================= AUTH (SIN CAMBIOS DE FLUJO) =======================
async function apiRegister(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const username = email.split("@")[0];
  // guardo email (para buscar por correo en solicitudes de amistad)
  await set(ref(db, `users/${uid}`), {
    username, email, score: 0, createdAt: Date.now()
  });
}

async function apiLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snap = await get(child(ref(db), `users/${uid}`));
  const node = snap.exists() ? snap.val() : {};
  const username = node.username ?? email.split("@")[0];

  storage.username = username;
  storage.email = node.email ?? email;

  // si el nodo de usuario no existe o le falta email/username, lo completamos
  if (!snap.exists() || !node.username || !node.email) {
    await update(ref(db, `users/${uid}`), {
      username, email: storage.email
    });
  }
}

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  storage.username = "";
  storage.email = "";
  cleanupSubscriptions();
  showAuth();
});

// Botones login / register / reset
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

// ======================= SESIÓN =======================
onAuthStateChanged(auth, async (u) => {
  if (u) {
    showApp();
    // asegurar perfil mínimo (username/email)
    await ensureProfile(u);

    // Leaderboard
    await loadLeaderboard();   // carga inicial
    subscribeLeaderboard();    // en vivo

    // Amigos
    subscribeInbox(u.uid);
    subscribeFriends(u.uid);
  } else {
    cleanupSubscriptions();
    showAuth();
  }
});

async function ensureProfile(u) {
  const userRef = ref(db, `users/${u.uid}`);
  const snap = await get(userRef);
  const fallbackName = storage.username || (u.email ? u.email.split("@")[0] : "Usuario");
  const fallbackEmail = storage.email || u.email || "";
  if (!snap.exists()) {
    await set(userRef, {
      username: fallbackName,
      email: fallbackEmail,
      score: 0,
      createdAt: Date.now()
    });
  } else {
    const v = snap.val() || {};
    if (!v.username || !v.email) {
      await update(userRef, {
        username: v.username ?? fallbackName,
        email: v.email ?? fallbackEmail
      });
    }
  }
}

// ======================= LEADERBOARD =======================
function renderLeaderboard(users) {
  tblBody.innerHTML = "";
  users.forEach((u, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${u.username ?? "—"}</td><td>${Number(u.score) || 0}</td>`;
    tblBody.appendChild(tr);
  });
  listMsg.textContent = `Total: ${users.length}`;
}

async function apiListUsersOnce() {
  const snap = await get(ref(db, "users"));       // <- lectura directa
  if (!snap.exists()) return [];
  const list = Object.values(snap.val() || {});
  // normaliza y ordena DESC por score
  return list
    .map(u => ({
      ...u,
      username: u.username ?? (u.email ? u.email.split("@")[0] : "—"),
      score: Number(u.score) || 0
    }))
    .sort((a, b) => b.score - a.score);
}

async function loadLeaderboard() {
  try {
    listMsg.textContent = "Cargando...";
    const users = await apiListUsersOnce();
    renderLeaderboard(users);
    if (users.length === 0) listMsg.textContent = "Sin datos aún.";
    else listMsg.textContent = `Total: ${users.length}`;
  } catch (e) {
    console.error("Leaderboard error:", e);
    listMsg.textContent = "No se pudo cargar.";
    tblBody.innerHTML = "";
  }
}

btnRefresh.addEventListener("click", loadLeaderboard);

function subscribeLeaderboard() {
  if (unsubLeaderboard) unsubLeaderboard();
  const off = onValue(ref(db, "users"), (snap) => {
    const val = snap.val() || {};
    const list = Object.values(val)
      .map(u => ({
        ...u,
        username: u.username ?? (u.email ? u.email.split("@")[0] : "—"),
        score: Number(u.score) || 0
      }))
      .sort((a, b) => b.score - a.score);

    renderLeaderboard(list);
  }, (err) => {
    console.error("onValue leaderboard:", err);
    listMsg.textContent = "No se pudo cargar.";
    tblBody.innerHTML = "";
  });
  unsubLeaderboard = () => off();
}

// El juego utiliza esta función. No cambiamos firma.
async function apiUpdateScore(score) {
  const u = auth.currentUser;
  if (!u) throw new Error("No autenticado");
  const username = (localStorage.getItem("sid_username")) 
                   || (u.email ? u.email.split("@")[0] : "Usuario");
  await update(ref(db, `users/${u.uid}`), {
    score: Number(score) || 0,
    lastPlayed: Date.now(),
    username
  });
}

// 🔗 Expuesta al juego
window.sendScoreToFirebase = async function (score) {
  try {
    await apiUpdateScore(score);
    await loadLeaderboard();
  } catch (e) {
    console.error("Error al guardar el puntaje:", e);
  }
};

// ======================= AMIGOS =======================
// Estructura usada:
// users/{uid}/friendRequests/outbox/{otherUid}: {toUid, toEmail, status, ts}
// users/{uid}/friendRequests/inbox/{otherUid}:  {fromUid, fromEmail, fromName, status, ts}
// users/{uid}/friends/{otherUid}: {uid, username, email, since}

sendFriendReqBtn?.addEventListener("click", async () => {
  const targetEmail = (friendEmailInput?.value || "").trim().toLowerCase();
  if (!targetEmail || !targetEmail.includes("@")) return showAlert("error", "Escribe un correo válido.");

  const me = auth.currentUser;
  if (!me) return showAlert("error", "Inicia sesión.");

  try {
    const target = await findUserByEmail(targetEmail);
    if (!target) return showAlert("error", "Ese correo no está registrado.");

    if (target.uid === me.uid) return showAlert("error", "No puedes enviarte solicitud a ti mismo.");

    await sendFriendRequest(me.uid, target.uid, targetEmail, storage.username || me.email.split("@")[0]);
    showAlert("success", "Solicitud enviada.");
    friendEmailInput.value = "";
  } catch (e) {
    console.error(e);
    showAlert("error", "No se pudo enviar la solicitud.");
  }
});

async function findUserByEmail(email) {
  // Buscamos recorriendo una sola vez (sencillo y suficiente para esta entrega)
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return null;
  let found = null;
  const users = snap.val();
  Object.keys(users).some(uid => {
    const u = users[uid];
    if ((u.email || "").toLowerCase() === email) {
      found = { uid, ...u };
      return true;
    }
    return false;
  });
  return found;
}

async function sendFriendRequest(fromUid, toUid, toEmail, fromName) {
  const ts = Date.now();
  // outbox en el remitente
  await update(ref(db, `users/${fromUid}/friendRequests/outbox/${toUid}`), {
    toUid, toEmail, status: "pending", ts
  });
  // inbox en el destinatario
  await update(ref(db, `users/${toUid}/friendRequests/inbox/${fromUid}`), {
    fromUid: fromUid, fromEmail: (storage.email || ""), fromName: fromName, status: "pending", ts
  });
}

function subscribeInbox(uid) {
  if (unsubInbox) unsubInbox();
  const off = onValue(ref(db, `users/${uid}/friendRequests/inbox`), (snap) => {
    const data = snap.exists() ? snap.val() : {};
    renderInbox(uid, data);
  });
  unsubInbox = () => off();
}

function renderInbox(myUid, inboxObj) {
  inboxList.innerHTML = "";
  const entries = Object.entries(inboxObj || {});
  if (!entries.length) {
    inboxList.innerHTML = `<li class="muted">No tienes solicitudes.</li>`;
    return;
  }
  entries.forEach(([fromUid, req]) => {
    const li = document.createElement("li");
    const name = req.fromName || (req.fromEmail ? req.fromEmail.split("@")[0] : fromUid);
    const status = req.status || "pending";
    li.innerHTML = `
      <div class="row" style="justify-content:space-between; width:100%;">
        <div><b>${name}</b> <span class="muted">(${status})</span></div>
        <div class="row">
          <button class="acceptBtn">Aceptar</button>
          <button class="rejectBtn secondary">Rechazar</button>
        </div>
      </div>`;
    const acceptBtn = li.querySelector(".acceptBtn");
    const rejectBtn = li.querySelector(".rejectBtn");

    acceptBtn.addEventListener("click", () => acceptRequest(myUid, fromUid, req));
    rejectBtn.addEventListener("click", () => rejectRequest(myUid, fromUid, req));
    inboxList.appendChild(li);
  });
}

async function acceptRequest(myUid, fromUid, req) {
  const mySnap = await get(child(ref(db), `users/${myUid}`));
  const me = mySnap.val() || {};
  const otherSnap = await get(child(ref(db), `users/${fromUid}`));
  const other = otherSnap.val() || {};

  // actualizar estatus en ambos lados
  await update(ref(db, `users/${myUid}/friendRequests/inbox/${fromUid}`), { status: "accepted" });
  await update(ref(db, `users/${fromUid}/friendRequests/outbox/${myUid}`), { status: "accepted" });

  // agregar a lista de amigos de ambos
  const now = Date.now();
  await update(ref(db, `users/${myUid}/friends/${fromUid}`), {
    uid: fromUid, username: other.username || (other.email ? other.email.split("@")[0] : "Usuario"), email: other.email || "", since: now
  });
  await update(ref(db, `users/${fromUid}/friends/${myUid}`), {
    uid: myUid, username: me.username || (me.email ? me.email.split("@")[0] : "Usuario"), email: me.email || "", since: now
  });
}

async function rejectRequest(myUid, fromUid, req) {
  await update(ref(db, `users/${myUid}/friendRequests/inbox/${fromUid}`), { status: "rejected" });
  await update(ref(db, `users/${fromUid}/friendRequests/outbox/${myUid}`), { status: "rejected" });
}

function subscribeFriends(uid) {
  if (unsubFriends) unsubFriends();
  const off = onValue(ref(db, `users/${uid}/friends`), (snap) => {
    const data = snap.exists() ? snap.val() : {};
    renderFriends(data);
  });
  unsubFriends = () => off();
}

function renderFriends(friendsObj) {
  friendsList.innerHTML = "";
  const entries = Object.entries(friendsObj || {});
  if (!entries.length) {
    friendsList.innerHTML = `<li class="muted">Aún no tienes amigos.</li>`;
    return;
  }
  entries
    .map(([uid, f]) => f)
    .sort((a, b) => (a.username || "").localeCompare(b.username || ""))
    .forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f.username || (f.email ? f.email.split("@")[0] : f.uid);
      friendsList.appendChild(li);
    });
}

function cleanupSubscriptions() {
  if (unsubInbox) unsubInbox();
  if (unsubFriends) unsubFriends();
  if (unsubLeaderboard) unsubLeaderboard();
  unsubInbox = unsubFriends = unsubLeaderboard = null;
}
