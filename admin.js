import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, query, doc, deleteDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
/* ==========================================================================
   1. CONFIGURATION & INITIALIZATION
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyA_JTCBKnJ7zaz8wRSiCpLRU2RcQZ2catw",
    authDomain: "my-firebase-site-a35bb.firebaseapp.com",
    projectId: "my-firebase-site-a35bb",
    storageBucket: "my-firebase-site-a35bb.firebasestorage.app",
    messagingSenderId: "943328160156",
    appId: "1:943328160156:web:9acc1c41989b21b3124059"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ADMIN_CRED = { user: "admin", pass: "admin@123", pin: "0000" };
// DOM Cache
const UI = {
    overlay: document.getElementById('adminOverlay'),
    loader: document.getElementById('overlayLoader'),
    status: document.getElementById('overlayStatus'),
    pinWrap: document.getElementById('pinEntryUI'),
    pinInput: document.getElementById('overlayPinInput'),
    login: document.getElementById('loginSection'),
    content: document.getElementById('adminContent'),
    table: document.getElementById('adminTableBody'),
    search: document.getElementById('adminSearch'),
    count: document.getElementById('count') // Usually the "Total Users" display
};
/* ==========================================================================
   2. UTILITIES
   ========================================================================== */
const toggleOverlay = (show, text = "") => {
    if (UI.overlay) UI.overlay.style.display = show ? 'flex' : 'none';
    if (text && UI.status) UI.status.innerText = text;
};
const clearSensitiveInputs = () => {
    ['loginUser', 'loginPass', 'overlayPinInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
};
/* ==========================================================================
   3. SECURITY (PIN CHALLENGE)
   ========================================================================== */
let pinResolve = null;
const requestPin = () => new Promise((resolve) => {
    pinResolve = resolve;
    UI.loader.style.display = 'none';
    UI.pinWrap.style.display = 'block';
    UI.pinInput.value = '';
    toggleOverlay(true, "Security Verification Required");
    UI.pinInput.focus();
});
const closePinChallenge = (success) => {
    UI.pinWrap.style.display = 'none';
    UI.loader.style.display = 'block';
    toggleOverlay(false);
    if (pinResolve) pinResolve(success);
};
document.getElementById('confirmPinBtn').onclick = () => {
    if (UI.pinInput.value === ADMIN_CRED.pin) closePinChallenge(true);
    else { alert("Invalid PIN"); closePinChallenge(false); }
};
document.getElementById('cancelPinBtn').onclick = () => closePinChallenge(false);
/* ==========================================================================
   4. DASHBOARD RENDERER
   ========================================================================== */
function initDashboard() {
    if (sessionStorage.getItem("isVantageAdmin") !== "true") return;
    UI.login.classList.add('view-hidden');
    UI.content.classList.remove('view-hidden');
    onSnapshot(collection(db, "users"), (snapshot) => {
        UI.table.innerHTML = '';
        const now = new Date();
        const users = [];
        let onlineCount = 0;
        // 1. Process Data & Calculate Live Presence
        snapshot.forEach(d => {
            const data = d.data();
            const lastActive = data.lastLogin?.toDate() || null;
            // Online threshold: 5 minutes (300,000ms)
            const isOnline = lastActive && (now - lastActive < 300000); 
            if (isOnline) onlineCount++;
            users.push({ id: d.id, isOnline, ...data });
        });
        // 2. Update Online/Total Stats in UI
        // Displays: "5 Online / 100 Total"
        if (UI.count) {
            UI.count.innerHTML = `
                <span style="color:var(--success)">${onlineCount} Online</span> 
                <span style="color:var(--text-muted); margin-left:10px;">/ ${snapshot.size} Total</span>
            `;
        }
        // 3. Priority Sorting (Online First, then Recency)
        users.sort((a, b) => {
            if (a.isOnline !== b.isOnline) return b.isOnline - a.isOnline;
            return (b.lastLogin?.toDate() || 0) - (a.lastLogin?.toDate() || 0);
        });
        // 4. Generate HTML
        users.forEach(user => {
            const isGoogle = user.authProvider === "google";
            const row = document.createElement('tr');
            row.className = "user-row";
            row.setAttribute('data-email', (user.email || "").toLowerCase());
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="user-avatar" style="display:flex; align-items:center; justify-content:center; background:var(--surface-light); border-radius:50%; width:32px; height:32px; overflow:hidden; border: 1px solid ${user.isOnline ? 'var(--success)' : 'transparent'}">
                            ${isGoogle && user.photoURL ? `<img src="${user.photoURL}" style="width:100%">` : `<i class="fa-solid fa-user" style="font-size:0.8rem"></i>`}
                        </div>
                        <div>
                            <div style="font-weight:500; font-size:13px;">${user.email}</div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">
                                <span style="color:var(--brand)">${user.authProvider || 'manual'}</span> • ${user.id.substring(0,8)}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-pill ${user.isOnline ? 'online' : 'offline'}" style="color:${user.isOnline ? 'var(--success)' : 'var(--text-muted)'}; font-weight:700; font-size:0.7rem;">
                        <i class="fa-solid ${user.isOnline ? 'fa-circle pulse-green' : 'fa-circle-dot'}" style="font-size:0.5rem; margin-right:5px;"></i>
                        ${user.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </td>
                <td id="key-${user.id}" style="font-family:monospace; font-size:0.85rem; color:${isGoogle ? 'var(--brand)' : 'var(--text-muted)'}">
                    ${isGoogle ? 'PROTECTED' : '••••••••'}
                </td>
                <td style="font-size:0.8rem; color:var(--text-muted)">
                    ${user.lastLogin?.toDate().toLocaleString() || 'N/A'}
                </td>
                <td>
                    <div class="action-group">
                        <button class="btn-view" ${isGoogle ? 'disabled' : ''} onclick="revealKey('${user.id}', '${user.password}')">Show</button>
                        <button class="btn-delete" onclick="terminateUser('${user.id}')">Delete</button>
                    </div>
                </td>
            `;
            UI.table.appendChild(row);
        });
    });
}
/* ==========================================================================
   5. EVENT HANDLERS
   ========================================================================== */
document.getElementById('loginBtn').onclick = () => {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    if (u === ADMIN_CRED.user && p === ADMIN_CRED.pass) {
        toggleOverlay(true, "Establishing Secure Connection...");
        setTimeout(() => {
            sessionStorage.setItem("isVantageAdmin", "true");
            initDashboard();
            toggleOverlay(false);
        }, 1500);
    } else {
        alert("Access Denied");
    }
};
document.getElementById('logoutBtn').onclick = () => {
    if (confirm("End administrative session?")) {
        sessionStorage.clear();
        location.reload();
    }
};
UI.search.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.user-row').forEach(row => {
        row.style.display = row.getAttribute('data-email').includes(term) ? '' : 'none';
    });
};
/* ==========================================================================
   6. GLOBAL WINDOW ACTIONS
   ========================================================================== */
window.revealKey = async (id, val) => {
    if (await requestPin()) {
        const el = document.getElementById(`key-${id}`);
        const original = el.innerText;
        el.innerText = val;
        el.style.color = "var(--success)";
        setTimeout(() => {
            el.innerText = original;
            el.style.color = "var(--text-muted)";
        }, 5000);
    }
};
window.terminateUser = async (id) => {
    if (await requestPin() && confirm("Purge user record?")) {
        toggleOverlay(true, "Deleting...");
        try {
            await deleteDoc(doc(db, "users", id));
        } catch (e) { alert("Error: " + e.message); }
        toggleOverlay(false);
    }
};
// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    clearSensitiveInputs();
    if (sessionStorage.getItem("isVantageAdmin") === "true") initDashboard();
});