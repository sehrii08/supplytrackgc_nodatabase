// data.js - the NO-DATABASE version. It has the SAME function names as the Firebase version,
// but the data is saved inside this browser (localStorage). That is why app.js and admin.js work the same in both versions.
const CODE_PREFIX = "GC-BC-";                           // codes look like GC-BC-01, GC-BC-02, ...
const SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];   // pickup hours: 8 AM to 4 PM
const SLOT_LIMIT = 10;                                   // max reservations per hour
const FREES = ["Rejected", "Cancelled", "Expired"];      // these statuses give the hour back

const money = n => "₱" + Number(n).toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hourLabel = h => (h % 12 || 12) + ":00 " + (h < 12 ? "AM" : "PM");
const dateText = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");   // 2026-10-30
const todayText = () => dateText(new Date());

/* ---------- Saving in the browser ---------- */
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } };
// The first time (nothing saved yet) the 12 sample products from products.js are used, so the catalog is never empty at the start.
const loadProducts = () => read("supplytrack-products", null) || PRODUCTS.map((p, n) => ({ id: "s" + n, ...p }));
const loadReservations = () => read("supplytrack-reservations", []);

/* ---------- "Live" updates: when something is saved, every watcher runs again ---------- */
let watchers = [];
const changed = () => watchers.forEach(run => run());
window.addEventListener("storage", changed);   // another tab of this browser saved something
function watch(get, show) {   // shows the data now, shows it again after every change, and returns a "stop" function
  const run = () => show(get());
  watchers.push(run); run();
  return () => { watchers = watchers.filter(w => w !== run); };
}
function save(key, value) {
  if (!write(key, value)) throw new Error("Could not save in this browser. Storage may be blocked or full.");
  changed();
}
const watchProducts = show => watch(loadProducts, show);
const watchReservation = (code, show) => watch(() => loadReservations().find(r => r.code === code) || null, show);
const watchAllReservations = show => watch(() => loadReservations().reverse(), show);   // newest first
const watchSlots = (date, show) => watch(() => {   // {hour: how many are booked}
  const used = {};
  loadReservations().forEach(r => { if (r.pickup_date === date && !FREES.includes(r.status)) used[r.pickup_hour] = (used[r.pickup_hour] || 0) + 1; });
  return used;
}, show);

/* ---------- Student: send a reservation ---------- */
async function reserve(info) {
  const taken = loadReservations().filter(r => r.pickup_date === info.pickup_date && r.pickup_hour === info.pickup_hour && !FREES.includes(r.status)).length;
  if (taken >= SLOT_LIMIT) throw new Error("Sorry, that hour just became full. Please pick another time.");
  const n = read("supplytrack-counter", 0) + 1, now = Date.now(), list = loadReservations(), code = CODE_PREFIX + String(n).padStart(2, "0");
  list.push({ ...info, code: code, status: "Pending", reason: "", created_at: now, history: [{ status: "Pending", at: now }] });
  write("supplytrack-counter", n);
  save("supplytrack-reservations", list);
  return code;
}

/* ---------- Admin: change a status, manage products ---------- */
async function setStatus(r, to, reason) {
  const list = loadReservations(), item = list.find(x => x.code === r.code);
  item.status = to; item.reason = reason || item.reason; item.history.push({ status: to, at: Date.now() });
  save("supplytrack-reservations", list);
}
async function addProduct(p) { const list = loadProducts(); list.push({ id: "p" + Date.now() + list.length, ...p }); save("supplytrack-products", list); }
async function setAvailability(id, value) { const list = loadProducts(); list.find(p => p.id === id).availability = value; save("supplytrack-products", list); }
async function removeProduct(id) { save("supplytrack-products", loadProducts().filter(p => p.id !== id)); }
async function loadSamples() { const list = loadProducts(); PRODUCTS.forEach((p, n) => list.push({ id: "s" + n + Date.now(), ...p })); save("supplytrack-products", list); }
