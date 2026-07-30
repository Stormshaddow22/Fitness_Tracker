function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// When Google Sign-In succeeds:
function handleCredentialResponse(response) {
    const responsePayload = parseJwt(response.credential);
    
    gUserEmail = responsePayload.email;
    console.log("Logged in user email:", gUserEmail);
    
    // Save email securely
    localStorage.setItem('userEmail', gUserEmail);
    updateGoogleAuthUIStates();
}

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

// Check persistent session storage across page transitions
let isSessionVerified = localStorage.getItem("gym_session_verified") === "true";
let gUserEmail = localStorage.getItem("userEmail") || null;

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

/* --- OVERLAY & SESSION VALIDATION LOGIC --- */
function checkSessionVerification() {
  const overlay = document.getElementById("activationOverlay");
  const savedKey = localStorage.getItem("gym_license_key");
  
  // If session is already verified via local storage credentials, hide popup automatically
  if (isSessionVerified && savedKey && gUserEmail) {
    if (overlay) overlay.style.display = "none";
    updateSettingsDisplay();
  } else {
    if (overlay) overlay.style.display = "flex";
    if (savedKey) {
      const overlayInput = document.getElementById("overlayKeyInput");
      if (overlayInput) overlayInput.value = savedKey;
    }
    if (gUserEmail) {
      updateGoogleAuthUIStates();
    }
  }
}

function updateGoogleAuthUIStates() {
  const overlayGoogleBtn = document.getElementById("overlayGoogleBtn");
  const overlayEmailDisplay = document.getElementById("overlayEmailDisplay");
  if (gUserEmail) {
    if (overlayGoogleBtn) overlayGoogleBtn.innerText = "🔄 Reconnect Google Account";
    if (overlayEmailDisplay) {
      overlayEmailDisplay.style.display = "block";
      overlayEmailDisplay.innerText = `Connected: ${gUserEmail}`;
    }
  }
  updateSettingsDisplay();
}

function updateSettingsDisplay() {
  const statusEl = document.getElementById("settingsAccountStatus");
  const googleBtn = document.getElementById("settingsGoogleBtn");
  const keyDisplay = document.getElementById("settingsActiveKeyDisplay");
  
  if (statusEl) {
    statusEl.innerText = gUserEmail ? `Connected as: ${gUserEmail}` : "Google Account not connected";
  }
  if (googleBtn) {
    googleBtn.innerText = gUserEmail ? "🔄 Reconnect Google Account" : "🌐 Connect Google Account";
  }
  if (keyDisplay) {
    const savedKey = localStorage.getItem("gym_license_key");
    keyDisplay.innerText = savedKey ? savedKey : "None";
  }
}

async function overlayVerifyAndUnlock() {
  const keyInputEl = document.getElementById('overlayKeyInput');
  const statusDiv = document.getElementById('overlayKeyStatus');

  const key = keyInputEl ? keyInputEl.value.trim() : "";
  
  if (!gUserEmail) {
    if (statusDiv) {
      statusDiv.innerText = "❌ Please connect your Google account first!";
      statusDiv.style.color = "var(--red)";
    }
    return;
  }
  
  if (!key) {
    if (statusDiv) {
      statusDiv.innerText = "⚠️ Please enter a license key.";
      statusDiv.style.color = "var(--orn)";
    }
    return;
  }

  if (statusDiv) {
    statusDiv.innerText = "Verifying key...";
    statusDiv.style.color = "var(--ac2)";
  }

  try {
    const response = await fetch(LICENSE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ licenseKey: key, email: gUserEmail })
    });
    
    const data = await response.json();
    if (data.success) {
      isSessionVerified = true;
      localStorage.setItem("gym_session_verified", "true");
      localStorage.setItem("gym_license_key", key);
      
      if (statusDiv) {
        statusDiv.innerText = "✓ Success! Unlocking...";
        statusDiv.style.color = "var(--ac)";
      }
      
      setTimeout(() => {
        const overlay = document.getElementById("activationOverlay");
        if (overlay) overlay.style.display = "none";
        updateSettingsDisplay();
      }, 800);
    } else {
      // If code expired or is invalid, force popup to stay active and require new credentials
      isSessionVerified = false;
      localStorage.setItem("gym_session_verified", "false");
      
      if (statusDiv) {
        statusDiv.innerText = `❌ ${data.message || "Invalid or Expired Key"}`;
        statusDiv.style.color = "var(--red)";
      }
    }
  } catch (err) {
    if (statusDiv) {
      statusDiv.innerText = "❌ Connection error during validation.";
      statusDiv.style.color = "var(--red)";
    }
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

  renderPageSpecifics();
  checkSessionVerification();
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
    if (button) button.textContent = "Unselect All";
  } else {
    if (button) button.textContent = "Complete All";
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

/* --- GOOGLE AUTH & DRIVE SYNC --- */
let tokenClient;
let gUserAccessToken = null;

const GOOGLE_CLIENT_ID = "223614031278-omh19sjhmrvqn64tmbrore8lclg3qk2r.apps.googleusercontent.com";

function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) return;
  
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  const btnDiv = document.getElementById("overlayGoogleBtn") || document.getElementById("buttonDiv");
  if (btnDiv) {
    google.accounts.id.renderButton(
      btnDiv,
      { theme: "outline", size: "large", width: "100%" }
    );
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.error !== undefined) {
        alert("Authentication failed.");
        return;
      }
      gUserAccessToken = response.access_token;
      await loadDataFromDrive();
    },
  });
}

function handleGoogleLogin() {
  try {
    google.accounts.id.prompt();
  } catch (e) {
    if (!tokenClient) initGoogleAuth();
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
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
    playTone(audioCtx, 880, 0, 0.3);
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

window.onload = () => {
  loadState();
  setTimeout(initGoogleAuth, 500);
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.log('Service Worker Registration Failed:', err));
  });
}