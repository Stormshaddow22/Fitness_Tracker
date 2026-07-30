const SAVE_KEY = "gymtracker_save";

// Google Sheets Web App URL for license key validation 
const LICENSE_API_URL = "https://script.google.com/macros/s/AKfycbw8FkI4EkCUS5NpN3BBJqNAd-_lZ6cKTPJSDWyzeyYwxlZXAqL6oFK6ckVu9RD8DiUs0Q/exec"; 

const DEFAULT_PLAN = {
  "Monday": ["Incline DB Press", "Bench Press", "Machine Chest Press", "Pec Deck"],
  "Tuesday": ["Lat Pulldown", "Cable Row", "Straight Arm Pulldown", "EZ Curl"],
  "Wednesday": ["DB Press", "Lateral Raise", "Rear Delt Fly", "Cable Crunch"],
  "Thursday": ["Incline Chest Press", "Pec Deck", "Rope Pushdown", "Overhead Extension"],
  "Friday": ["Bench Press", "Lat Pulldown", "Shoulder Press", "EZ Curl"],
  "Saturday": ["Leg Press", "Hack Squat", "Leg Extension", "Seated Leg Curl"]
};

const PR_FIELDS = ["BENCH", "SQUAT", "DEADLIFT", "OHP", "INCLINE BP", "LAT PD"];

let S = {
  plan: JSON.parse(JSON.stringify(DEFAULT_PLAN)),
  fields: {},
  water: 0,
  streak: { count: 1 },
  workoutLog: {},
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  currentRoutine: "Monday",
  workoutDate: new Date().toISOString().split("T")[0],
  historySelectedDate: new Date().toISOString().split("T")[0],
  theme: "dark"
};

/* --- TOAST & THEME --- */
function showSaveToast() {
  const t = document.getElementById("saveToast");
  if (!t) return;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1200);
}

function manualSave() {
  saveState();
  showSaveToast();
}

function toggleTheme() {
  S.theme = S.theme === "light" ? "dark" : "light";
  applyTheme();
  saveState();
}

function applyTheme() {
  if (S.theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
}

/* --- SETTINGS DRAWER TOGGLE --- */
function toggleSettingsMenu() {
  const drawer = document.getElementById("settingsDrawer");
  const overlay = document.getElementById("settingsOverlay");
  if (!drawer || !overlay) return;

  drawer.classList.toggle("open");
  overlay.classList.toggle("show");
}

/* --- UPDATED LICENSE KEY VERIFICATION PROCESS --- */
async function verifyActivationKey() {
  const keyInput = document.getElementById("activationKeyInput");
  const statusEl = document.getElementById("keyStatus");
  if (!keyInput || !statusEl) return;

  const key = keyInput.value.trim();
  if (!key) {
    statusEl.innerText = "⚠️ Enter a license key";
    statusEl.style.color = "var(--orn)";
    return;
  }

  if (!gUserEmail) {
    statusEl.innerText = "❌ Please connect Google account first";
    statusEl.style.color = "var(--red)";
    return;
  }

  statusEl.innerText = "Verifying with Google Sheets...";
  statusEl.style.color = "var(--ac2)";

  try {
    const response = await fetch(LICENSE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ licenseKey: key, email: gUserEmail })
    });
    
    const data = await response.json();
    if (data.success) {
      statusEl.innerText = `✓ Valid & Bound to ${gUserEmail}`;
      statusEl.style.color = "var(--ac)";
      saveState();
    } else {
      statusEl.innerText = `❌ ${data.message || "Invalid Key"}`;
      statusEl.style.color = "var(--red)";
    }
  } catch (err) {
    statusEl.innerText = "❌ Connection Error";
    statusEl.style.color = "var(--red)";
  }
}

/* --- UPDATED GOOGLE AUTH INIT & UI REFLECT --- */
function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/oauth2/v3/userinfo.email',
    callback: async (response) => {
      if (response.error !== undefined) {
        alert("Authentication failed.");
        return;
      }
      gUserAccessToken = response.access_token;
      await fetchUserInfo();
      await loadDataFromDrive();
    },
  });
}

async function fetchUserInfo() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${gUserAccessToken}` }
    });
    const data = await res.json();
    gUserEmail = data.email;
    
    // Update button text to "Reconnect" and display email in box
    const loginBtn = document.getElementById("googleLoginBtn");
    if (loginBtn) loginBtn.innerText = "🔄 Reconnect Google Account";

    const emailBox = document.getElementById("googleEmailDisplay");
    if (emailBox) {
      emailBox.style.display = "block";
      emailBox.innerText = `Connected: ${gUserEmail}`;
    }

    // Re-verify key automatically once email is secured
    const keyInput = document.getElementById("activationKeyInput");
    if (keyInput && keyInput.value.trim()) {
      verifyActivationKey();
    }
  } catch (err) {
    console.error("Failed to fetch user info", err);
  }
}

/* --- STATE STORAGE & AUTO-SYNC --- */
let driveSyncTimeout = null;

function saveState() {
  document.querySelectorAll("[data-id]").forEach(el => {
    S.fields[el.dataset.id] = el.type === "checkbox" ? el.checked : el.value;
  });

  const d = S.workoutDate;
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  
  if (!S.workoutLog[d]) {
    S.workoutLog[d] = [];
  }

  currentDayExercises.forEach(ex => {
    let done = document.getElementById(`chk_${ex}`)?.checked || S.fields[`chk_${ex}`] || false;
    let sets = [];
    for (let s = 1; s <= 3; s++) {
      let w = document.getElementById(`w_${ex}_${s}`)?.value || S.fields[`w_${ex}_${s}`] || "";
      let r = document.getElementById(`r_${ex}_${s}`)?.value || S.fields[`r_${ex}_${s}`] || "";
      sets.push({ w, r });
    }

    let existingExIndex = S.workoutLog[d].findIndex(item => item.exercise === ex);
    if (existingExIndex >= 0) {
      S.workoutLog[d][existingExIndex] = { exercise: ex, done, sets };
    } else {
      S.workoutLog[d].push({ exercise: ex, done, sets });
    }
  });

  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  showSaveToast();

  // Automatically sync to Google Drive in the background (debounced by 3 seconds)
  if (gUserAccessToken) {
    clearTimeout(driveSyncTimeout);
    driveSyncTimeout = setTimeout(() => {
      saveDataToDriveSilent();
    }, 3000);
  }
}

function loadState() {
  let saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try { S = Object.assign(S, JSON.parse(saved)); } catch (e) {}
  }
  
  if (!S.historySelectedDate) {
    S.historySelectedDate = S.workoutDate || new Date().toISOString().split("T")[0];
  }
  
  applyTheme();

  if (document.getElementById("globalWorkoutDate")) {
    document.getElementById("globalWorkoutDate").value = S.workoutDate;
  }
  
  if (document.getElementById("streakCount")) {
    document.getElementById("streakCount").innerText = S.streak.count || 1;
  }

  const actKeyInput = document.getElementById("activationKeyInput");
  if (actKeyInput && S.fields["activationKey"] !== undefined) {
    actKeyInput.value = S.fields["activationKey"];
    verifyActivationKey();
  }

  renderPageSpecifics();
}

function handleGlobalDateChange() {
  const dateInput = document.getElementById("globalWorkoutDate");
  if (dateInput) {
    S.workoutDate = dateInput.value;
    saveState();
    renderPageSpecifics(); 
  }
}

/* --- PAGE ROUTING & RENDERING --- */
function renderPageSpecifics() {
  const page = window.CURRENT_PAGE || 'Dashboard';

  if (page === 'Dashboard') {
    renderDashboardPRs();
    buildWaterGlasses();
    updateDashStats();
  } else if (page === 'Workout') {
    renderWorkoutPage();
    updateProgress();
  } else if (page === 'History') {
    renderCalendar();
  }
}

/* --- DASHBOARD --- */
function updateDashStats() {
  ["weight", "waist", "protein", "steps"].forEach(k => {
    const el = document.getElementById(`stat${k.charAt(0).toUpperCase() + k.slice(1)}`);
    const inputEl = document.querySelector(`input[data-id="${k}"]`);
    if (inputEl && S.fields[k] !== undefined) {
      inputEl.value = S.fields[k];
    }
    if (el) el.innerText = S.fields[k] && S.fields[k] !== "" ? S.fields[k] : "--";
  });
}

function renderDashboardPRs() {
  const container = document.getElementById("prGridContainer");
  if (!container) return;
  container.innerHTML = "";
  PR_FIELDS.forEach(f => {
    const val = S.fields[`pr_${f}`] || "";
    container.innerHTML += `
      <div class="pr-item">
        <label>${f}</label>
        <input type="text" data-id="pr_${f}" value="${val}" placeholder="--" oninput="saveState();">
      </div>
    `;
  });
}

function buildWaterGlasses() {
  const wr = document.getElementById("waterRow");
  if (!wr) return;
  wr.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const g = document.createElement("div");
    g.className = "water-glass" + (i < S.water ? " filled" : "");
    g.innerText = "💧";
    g.onclick = () => {
      S.water = (i < S.water) ? i : i + 1;
      saveState();
      buildWaterGlasses();
    };
    wr.appendChild(g);
  }
}

/* --- WORKOUT PAGE --- */
function renderWorkoutPage() {
  const container = document.getElementById("exerciseListContainer");
  if (!container) return;
  
  const titleEl = document.getElementById("routineTitle");
  if (titleEl) titleEl.innerText = `${S.currentRoutine} Routine`;

  const exercises = S.plan[S.currentRoutine] || [];
  let html = "";

  exercises.forEach(ex => {
    const isDone = S.fields[`chk_${ex}`] || false;
    let setRows = "";
    for (let s = 1; s <= 3; s++) {
      const wV = S.fields[`w_${ex}_${s}`] || "";
      const rV = S.fields[`r_${ex}_${s}`] || "";
      setRows += `
        <div class="set-chip">
          <span class="set-num">Set ${s}</span>
          <input type="text" id="w_${ex}_${s}" data-id="w_${ex}_${s}" placeholder="kg" value="${wV}" oninput="saveState();">
          <input type="number" id="r_${ex}_${s}" data-id="r_${ex}_${s}" placeholder="reps" value="${rV}" oninput="saveState();">
        </div>
      `;
    }
    html += `
      <div class="card">
        <div class="exercise-header">
          <div class="name">${ex}</div>
          <div class="check-wrap">
            <input type="checkbox" id="chk_${ex}" ${isDone ? 'checked' : ''} onchange="S.fields['chk_${ex}']=this.checked;saveState();updateProgress();">
          </div>
        </div>
        <div class="sets-row">${setRows}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateProgress() {
  const exercises = S.plan[S.currentRoutine] || [];
  let done = 0;
  exercises.forEach(ex => {
    if (document.getElementById(`chk_${ex}`)?.checked || S.fields[`chk_${ex}`]) done++;
  });
  const pct = exercises.length > 0 ? Math.round((done / exercises.length) * 100) : 0;
  
  if (document.getElementById("pctLabel")) document.getElementById("pctLabel").innerText = `${pct}%`;
  if (document.getElementById("doneCount")) document.getElementById("doneCount").innerText = `${done}/${exercises.length} exercises`;
  if (document.getElementById("bar")) document.getElementById("bar").style.width = `${pct}%`;
}

function promptAddExercise() {
  const exName = prompt("Enter new exercise name:");
  if (exName && exName.trim() !== "") {
    if (!S.plan[S.currentRoutine]) S.plan[S.currentRoutine] = [];
    S.plan[S.currentRoutine].push(exName.trim());
    saveState();
    renderWorkoutPage();
    updateProgress();
  }
}

/* --- REMOVE EXERCISES MODAL LOGIC --- */
function openRemoveModal() {
  const exercises = S.plan[S.currentRoutine] || [];
  if (exercises.length === 0) {
    alert("No exercises to remove.");
    return;
  }

  const listContainer = document.getElementById("removeModalList");
  if (!listContainer) return;

  let html = "";
  exercises.forEach(ex => {
    html += `
      <label style="display: flex; align-items: center; gap: 10px; background: var(--bg2, #101c30); padding: 10px; border-radius: 8px; cursor: pointer; color: var(--tx, #fff); font-size: 0.9rem;">
        <input type="checkbox" class="remove-exercise-chk" value="${ex}" style="width: 18px; height: 18px; accent-color: var(--ac, #00ffcc);">
        <span>${ex}</span>
      </label>
    `;
  });
  listContainer.innerHTML = html;

  document.getElementById("removeModalOverlay")?.classList.add("show");
  document.getElementById("removeModalDrawer")?.classList.add("open");
}

function closeRemoveModal() {
  document.getElementById("removeModalOverlay")?.classList.remove("show");
  document.getElementById("removeModalDrawer")?.classList.remove("open");
}

function confirmRemoveSelected() {
  const checkboxes = document.querySelectorAll(".remove-exercise-chk:checked");
  if (checkboxes.length === 0) {
    alert("Please select at least one exercise to delete.");
    return;
  }

  const toRemove = Array.from(checkboxes).map(chk => chk.value);
  let exercises = S.plan[S.currentRoutine] || [];

  S.plan[S.currentRoutine] = exercises.filter(e => !toRemove.includes(e));

  saveState();
  renderWorkoutPage();
  updateProgress();
  closeRemoveModal();
}

function toggleCompleteAll() {
  const exercises = S.plan[S.currentRoutine] || [];
  const button = document.getElementById('completeAllBtn');
  
  const allAreCompleted = exercises.every(ex => S.fields[`chk_${ex}`] === true);
  const newState = !allAreCompleted;

  exercises.forEach(ex => {
    S.fields[`chk_${ex}`] = newState;
    const chk = document.getElementById(`chk_${ex}`);
    if (chk) chk.checked = newState;
  });

  if (newState) {
    button.textContent = "Unselect All";
  } else {
    button.textContent = "Complete All";
  }

  saveState();
  updateProgress();
}

/* --- HISTORY PAGE --- */
function changeMonth(delta) {
  S.calMonth += delta;
  if (S.calMonth > 11) {
    S.calMonth = 0;
    S.calYear++;
  } else if (S.calMonth < 0) {
    S.calMonth = 11;
    S.calYear--;
  }
  renderCalendar();
}

function renderCalendar() {
  const gridEl = document.getElementById("calendarGrid");
  const monthTitle = document.getElementById("calMonthTitle");
  if (!gridEl) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (monthTitle) monthTitle.innerText = `${monthNames[S.calMonth]} ${S.calYear}`;

  gridEl.innerHTML = "";
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  days.forEach(d => { gridEl.innerHTML += `<div class="calendar-day-lbl">${d}</div>`; });

  const daysInMo = new Date(S.calYear, S.calMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMo; d++) {
    const dateStr = `${S.calYear}-${String(S.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement("div");
    cell.className = "calendar-cell" + (dateStr === S.historySelectedDate ? " active-day" : "");
    cell.innerText = d;
    
    if (S.workoutLog[dateStr] && S.workoutLog[dateStr].length > 0) {
      const dot = document.createElement("div");
      dot.className = "dot-indicator";
      cell.appendChild(dot);
    }

    cell.onclick = () => {
      S.historySelectedDate = dateStr;
      
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        S.calYear = parseInt(parts[0], 10);
        S.calMonth = parseInt(parts[1], 10) - 1;
      }

      saveState();
      renderCalendar();
      inspectDayLog(dateStr);
    };

    gridEl.appendChild(cell);
  }

  inspectDayLog(S.historySelectedDate);
}

function inspectDayLog(dateStr) {
  const container = document.getElementById("selectedDayLogContainer");
  if (!container) return;

  const logs = S.workoutLog[dateStr];
  if (!logs || logs.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; color:var(--tx2); font-size:0.8rem;">No entries logged for <strong>${dateStr}</strong>.</div>`;
    return;
  }

  let html = `<div style="font-size:0.8rem;font-weight:900;color:var(--ac3);margin-bottom:8px;">LOG FOR ${dateStr}</div>`;
  
  logs.forEach(l => {
    let setsText = l.sets && l.sets.length > 0 
      ? l.sets.map((s, idx) => `S${idx+1}: ${s.w || '--'}kg × ${s.r || '--'}r`).join(' | ')
      : 'No sets recorded';

    html += `
      <div class="card" style="margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span>${l.done ? '✓' : '✗'} ${l.exercise}</span>
          <span style="font-size: 0.75rem; color: ${l.done ? 'var(--ac)' : 'var(--tx2)'};">${l.done ? 'Completed' : 'Pending'}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--tx2);">${setsText}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.onload = loadState;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA Service Worker Registered! Scope:', reg.scope))
      .catch(err => console.log('Service Worker Registration Failed:', err));
  });
}

/* --- GOOGLE AUTH & DRIVE SYNC --- */
let tokenClient;
let gUserAccessToken = null;
let gUserEmail = null;

const GOOGLE_CLIENT_ID = "223614031278-omh19sjhmrvqn64tmbrore8lclg3qk2r.apps.googleusercontent.com";

function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    callback: async (response) => {
      if (response.error !== undefined) {
        alert("Authentication failed.");
        return;
      }
      gUserAccessToken = response.access_token;
      await fetchUserInfo();
      await loadDataFromDrive();
    },
  });
}

function handleGoogleLogin() {
  if (!tokenClient) initGoogleAuth();
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    alert("Google Identity script is still loading. Try again in a second.");
  }
}

async function fetchUserInfo() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${gUserAccessToken}` }
    });
    const data = await res.json();
    gUserEmail = data.email;
    console.log("Logged in user email:", gUserEmail);
  } catch (err) {
    console.error("Failed to fetch user info", err);
  }
}

async function findExistingFileId(fileName) {
  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${gUserAccessToken}` }
  });
  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function saveDataToDrive() {
  if (!gUserAccessToken) {
    alert("Please sign in with Google first!");
    return;
  }

  const fileContent = JSON.stringify(S);
  const fileId = await findExistingFileId('gymtracker_save.json');

  if (fileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gUserAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });
  } else {
    const metadata = { name: 'gymtracker_save.json', mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${gUserAccessToken}` },
      body: form
    });
  }
  showSaveToast();
}

async function saveDataToDriveSilent() {
  if (!gUserAccessToken) return;
  try {
    const fileContent = JSON.stringify(S);
    const fileId = await findExistingFileId('gymtracker_save.json');

    if (fileId) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${gUserAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: fileContent
      });
    } else {
      const metadata = { name: 'gymtracker_save.json', mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${gUserAccessToken}` },
        body: form
      });
    }
    console.log("Auto-backed up to Google Drive successfully.");
  } catch (err) {
    console.error("Auto-sync failed", err);
  }
}

async function loadDataFromDrive() {
  const fileId = await findExistingFileId('gymtracker_save.json');
  if (!fileId) return;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${gUserAccessToken}` }
  });
  
  if (response.ok) {
    const cloudData = await response.json();
    S = Object.assign(S, cloudData);
    saveState();
    renderPageSpecifics();
    showSaveToast();
  }
}

window.addEventListener('load', () => {
  setTimeout(initGoogleAuth, 500);
});

/* --- REST TIMER MODAL LOGIC --- */
let timerInterval = null;
let timeLeft = 60;
let totalTimerSeconds = 60;

function toggleTimer() {
  const overlay = document.getElementById("timerOverlay");
  if (!overlay) return;
  overlay.classList.toggle("show");
}

function setTimerPreset(seconds, btn) {
  totalTimerSeconds = seconds;
  timeLeft = seconds;
  updateTimerDisplay();

  document.querySelectorAll(".timer-preset").forEach(p => p.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function updateTimerDisplay() {
  const display = document.getElementById("timerDisplay");
  if (!display) return;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  display.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function playTimerBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play first beep
    playTone(audioCtx, 880, 0, 0.3);
    // Play second beep after a short pause
    playTone(audioCtx, 880, 0.4, 0.3);
  } catch (e) {
    console.log("Audio Context not supported or blocked");
  }
}

function playTone(audioCtx, frequency, delay, duration) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

function startTimer() {
  const startBtn = document.getElementById("timerStartBtn");
  if (timerInterval) {
    // Pause timer
    clearInterval(timerInterval);
    timerInterval = null;
    if (startBtn) startBtn.innerText = "Start";
    return;
  }

  if (timeLeft <= 0) timeLeft = totalTimerSeconds;
  if (startBtn) startBtn.innerText = "Pause";

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (startBtn) startBtn.innerText = "Start";
      playTimerBeep();
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timeLeft = totalTimerSeconds;
  updateTimerDisplay();
  const startBtn = document.getElementById("timerStartBtn");
  if (startBtn) startBtn.innerText = "Start";
}
