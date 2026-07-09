const SAVE_KEY = "gymtracker_save";

const DEFAULT_PLAN = {
  "Monday":["Incline DB Press","Bench Press","Machine Chest Press","Pec Deck","Cable Fly","Plank","Hanging Knee Raise"],
  "Tuesday":["Lat Pulldown","Cable Row","Chest Supported Row","Straight Arm Pulldown","EZ Curl","Hammer Curl","Preacher Curl"],
  "Wednesday":["DB Press","Lateral Raise","Cable Lateral Raise","Rear Delt Fly","Face Pull","Cable Crunch","Russian Twist"],
  "Thursday":["Incline Chest Press","Pec Deck","Cable Fly","Rope Pushdown","Bar Pushdown","Overhead Extension","Assisted Dip"],
  "Friday":["Bench Press","Lat Pulldown","Shoulder Press","Chest Supported Row","Close Grip Bench","EZ Curl","Face Pull"],
  "Saturday":["Leg Press","Hack Squat","Leg Extension","Seated Leg Curl","Lying Leg Curl","Hip Thrust","Standing Calf Raise"]
};
const QUOTES = [
  {t:"Success isn't always about greatness. It's about consistency.",a:"Dwayne Johnson"},
  {t:"The pain you feel today will be the strength you feel tomorrow.",a:"Arnold Schwarzenegger"},
  {t:"The iron never lies to you. Two hundred pounds is always two hundred pounds.",a:"Henry Rollins"},
  {t:"Don't count the days, make the days count.",a:"Muhammad Ali"}
];
const PR_FIELDS = ["Bench","Squat","Deadlift","OHP","Incline BP","Lat PD","Barbell Row","Leg Press","Hack Squat","EZ Curl","Calf Raise","Face Pull"];

let S = {
  plan: JSON.parse(JSON.stringify(DEFAULT_PLAN)),
  fields: {},
  water: 0,
  protein: "",
  steps: "",
  streak: {count:0, lastDate:null},
  workoutLog: {},
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  currentRoutine: null,
  weightHistory: [],
  waistHistory: [],
  proteinHistory: [],
  stepsHistory: [],
  workoutDate: "",
  lightTheme: false
};

const dayKeys = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let currentTab = "Dashboard";

let toastTimeout = null;
function showSaveToast(message = "Saved!"){
  let t = document.getElementById("saveToast");
  if(!t) return;
  t.innerHTML = `<span class="toast-icon">✓</span> ${message}`;
  t.classList.add("show");
  if(toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=>{ t.classList.remove("show"); }, 1500);
}

function manualSave(){
  saveState();
  showSaveToast();
}

function saveState(){
  document.querySelectorAll("[data-id]").forEach(el=>{
    S.fields[el.dataset.id] = el.type==="checkbox" ? el.checked : el.value;
  });
  let activeDate = S.workoutDate;
  
  let wVal = S.fields["weight"];
  if(wVal !== undefined){
    let existing = S.weightHistory.find(e=>e.date===activeDate);
    if(existing) existing.value = wVal !== "" ? parseFloat(wVal) : "";
    else if(wVal !== "") S.weightHistory.push({date:activeDate, value:parseFloat(wVal)});
  }
  
  let waVal = S.fields["waist"];
  if(waVal !== undefined){
    let existing = S.waistHistory.find(e=>e.date===activeDate);
    if(existing) existing.value = waVal !== "" ? parseFloat(waVal) : "";
    else if(waVal !== "") S.waistHistory.push({date:activeDate, value:parseFloat(waVal)});
  }

  let protVal = S.fields["protein"];
  if(protVal !== undefined){
    let existing = S.proteinHistory.find(e=>e.date===activeDate);
    if(existing) existing.value = protVal !== "" ? parseInt(protVal) : "";
    else if(protVal !== "") S.proteinHistory.push({date:activeDate, value:parseInt(protVal)});
  }

  let stepsVal = S.fields["steps"];
  if(stepsVal !== undefined){
    let existing = S.stepsHistory.find(e=>e.date===activeDate);
    if(existing) existing.value = stepsVal !== "" ? parseInt(stepsVal) : "";
    else if(stepsVal !== "") S.stepsHistory.push({date:activeDate, value:parseInt(stepsVal)});
  }
  
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  let dayLog = [];
  currentDayExercises.forEach(ex=>{
    let done = document.getElementById(`chk_${ex}`)?.checked || false;
    let sets = [];
    for(let s=1; s<=3; s++){
      let w = document.getElementById(`w_${ex}_${s}`)?.value || "";
      let r = document.getElementById(`r_${ex}_${s}`)?.value || "";
      sets.push({w, r});
    }
    dayLog.push({exercise:ex, done, sets});
  });
  S.workoutLog[activeDate] = dayLog;

  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  updateStreakBadge();
}

function loadState(){
  let saved = localStorage.getItem(SAVE_KEY);
  if(saved){
    try {
      let parsed = JSON.parse(saved);
      if(parsed && typeof parsed === "object"){
        S = Object.assign(S, parsed);
      }
    } catch(e) { console.error(e); }
  }
  
  const nowStr = new Date().toISOString().split("T")[0];
  S.workoutDate = nowStr;
  
  let d = new Date(S.workoutDate);
  let dayIdx = (d.getDay()+6)%7;
  S.currentRoutine = dayKeys[dayIdx] || "Monday";
  
  if(S.lightTheme) document.body.classList.add("light-theme");
  else document.body.classList.remove("light-theme");

  document.getElementById("globalWorkoutDate").value = S.workoutDate;
  loadActiveDayLog();
}

function toggleTheme(){
  document.body.classList.toggle("light-theme");
  S.lightTheme = document.body.classList.contains("light-theme");
  saveState();
  showSaveToast();
}

function handleGlobalDateChange(){
  let inputVal = document.getElementById("globalWorkoutDate").value;
  if(inputVal) {
    S.workoutDate = inputVal;
    let d = new Date(inputVal);
    let dayIdx = (d.getDay()+6)%7;
    S.currentRoutine = dayKeys[dayIdx] || "Monday";
    
    loadActiveDayLog();
    renderAllPages();
    if(currentTab === "History") renderCalendar();
    showSaveToast();
  }
}

function loadActiveDayLog(){
  let activeDate = S.workoutDate;
  let loggedDay = S.workoutLog[activeDate];
  
  PR_FIELDS.forEach(f=>{
    if(S.fields[`pr_${f}`] === undefined) S.fields[`pr_${f}`] = "";
  });
  if(S.fields["weight"] === undefined) S.fields["weight"] = "";
  if(S.fields["waist"] === undefined) S.fields["waist"] = "";
  if(S.fields["protein"] === undefined) S.fields["protein"] = "";
  if(S.fields["steps"] === undefined) S.fields["steps"] = "";

  if(loggedDay && Array.isArray(loggedDay)){
    let customPlan = [];
    loggedDay.forEach(item=>{
      customPlan.push(item.exercise);
      S.fields[`chk_${item.exercise}`] = item.done;
      if(item.sets && Array.isArray(item.sets)){
        item.sets.forEach((st, idx)=>{
          if(idx < 3) {
            S.fields[`w_${item.exercise}_${idx+1}`] = st.w || "";
            S.fields[`r_${item.exercise}_${idx+1}`] = st.r || "";
          }
        });
      }
    });
    S.plan[S.currentRoutine] = customPlan;
  } else {
    let currentDayExercises = S.plan[S.currentRoutine] || [];
    currentDayExercises.forEach(ex=>{
      S.fields[`chk_${ex}`] = false;
      for(let s=1; s<=3; s++){
        S.fields[`w_${ex}_${s}`] = "";
        S.fields[`r_${ex}_${s}`] = "";
      }
    });
  }
  
  let wRecord = S.weightHistory.find(e=>e.date===activeDate);
  S.fields["weight"] = (wRecord && wRecord.value !== "") ? wRecord.value : "";
  let waRecord = S.waistHistory.find(e=>e.date===activeDate);
  S.fields["waist"] = (waRecord && waRecord.value !== "") ? waRecord.value : "";
  let protRecord = S.proteinHistory.find(e=>e.date===activeDate);
  S.fields["protein"] = (protRecord && protRecord.value !== "") ? protRecord.value : "";
  let stepsRecord = S.stepsHistory.find(e=>e.date===activeDate);
  S.fields["steps"] = (stepsRecord && stepsRecord.value !== "") ? stepsRecord.value : "";
}

function updateProgress(){
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  let total = currentDayExercises.length;
  let done = 0;
  currentDayExercises.forEach(ex=>{
    if(document.getElementById(`chk_${ex}`)?.checked) done++;
  });
  let pct = total > 0 ? Math.round((done/total)*100) : 0;
  let lbl = document.getElementById("pctLabel");
  let cnt = document.getElementById("doneCount");
  let bar = document.getElementById("bar");
  if(lbl) lbl.innerText = pct + "%";
  if(cnt) cnt.innerText = `${done}/${total} exercises`;
  if(bar) bar.style.width = pct + "%";
  if(pct === 100 && total > 0) { triggerConfetti(); }
}

function updateDashStats(){
  let w = S.fields["weight"] || "";
  let wa = S.fields["waist"] || "";
  let prot = S.fields["protein"] || "";
  let stp = S.fields["steps"] || "";
  
  let we = document.getElementById("statWeight");
  let wae = document.getElementById("statWaist");
  let prote = document.getElementById("statProtein");
  let stpe = document.getElementById("statSteps");
  
  if(we) we.innerText = w !== "" ? w + " kg" : "--";
  if(wae) wae.innerText = wa !== "" ? wa + " cm" : "--";
  if(prote) prote.innerText = prot !== "" ? prot + " g" : "--";
  if(stpe) stpe.innerText = stp !== "" ? parseInt(stp).toLocaleString() : "--";
}

function switchTab(tabId){
  currentTab = tabId;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("show"));
  let tPage = document.getElementById(`page_${tabId}`);
  if(tPage) tPage.classList.add("show");
  
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  let tBtn = document.querySelector(`[data-nav="${tabId}"]`);
  if(tBtn) tBtn.classList.add("active");
  
  let pBar = document.getElementById("headerProgressBar");
  if(pBar){
    if(tabId === "Workout") {
      pBar.classList.add("visible");
      updateProgress();
    } else {
      pBar.classList.remove("visible");
    }
  }
  
  if(tabId === "Dashboard") updateDashStats();
  if(tabId === "History") renderCalendar();
}

function buildBottomNav(){
  let nav = document.getElementById("bottomNav");
  nav.innerHTML = "";
  let cfg = [
    {id:"Dashboard",label:"My Routine",icon:"📊"},
    {id:"Workout",label:"Workout",icon:"🏋️"},
    {id:"History",label:"History",icon:"📅"}
  ];
  cfg.forEach(c=>{
    let b = document.createElement("button");
    b.className = "nav-btn";
    b.dataset.nav = c.id;
    b.innerHTML = `<span class="nav-icon">${c.icon}</span><span class="nav-label" id="navLabel_${c.id}">${c.label}</span>`;
    b.onclick = () => switchTab(c.id);
    nav.appendChild(b);
  });
}

function renderAllPages(){
  let container = document.getElementById("pages");
  container.innerHTML = "";
  
  let dash = document.createElement("div");
  dash.className = "page";
  dash.id = "page_Dashboard";
  
  let q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  let prHTML = "";
  PR_FIELDS.forEach(f=>{
    let val = S.fields[`pr_${f}`] || "";
    prHTML += `<div class="pr-item"><label>${f}</label><input type="text" data-id="pr_${f}" value="${val}" placeholder="--" onchange="saveState(); showSaveToast();"></div>`;
  });

  dash.innerHTML = `
    <div class="card quote-card">
      <div class="quote-text">"${q.t}"</div>
      <div class="quote-author">— ${q.a}</div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="stat-box">
          <div class="stat-val green" id="statWeight">--</div>
          <div class="stat-label">Weight</div>
          <div class="weight-log-row">
            <input type="number" step="0.1" data-id="weight" value="${S.fields["weight"]||""}" placeholder="kg" oninput="saveState();updateDashStats();showSaveToast();">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-val cyan" id="statWaist">--</div>
          <div class="stat-label">Rest</div>
          <div class="weight-log-row">
            <input type="number" step="0.1" data-id="waist" value="${S.fields["waist"]||""}" placeholder="cm" oninput="saveState();updateDashStats();showSaveToast();">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-val purple" id="statProtein">--</div>
          <div class="stat-label">Protein Intake</div>
          <div class="weight-log-row">
            <input type="number" data-id="protein" value="${S.fields["protein"]||""}" placeholder="grams" oninput="saveState();updateDashStats();showSaveToast();">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="stat-box">
          <div class="stat-val orange" id="statSteps">--</div>
          <div class="stat-label">Daily Steps</div>
          <div class="weight-log-row">
            <input type="number" data-id="steps" value="${S.fields["steps"]||""}" placeholder="steps" oninput="saveState();updateDashStats();showSaveToast();">
          </div>
        </div>
      </div>
       <div class="card dash-full" style="min-height:auto;">
        <div class="stat-label" style="text-align:center;margin-bottom:6px;">🥛 H2O Counter</div>
        <div class="water-row" id="waterRow"></div>
      </div>
      <div class="card dash-full" style="min-height:auto;padding-bottom:16px;">
        <div class="analytics-title" style="color:var(--ac3);">🏆 PERSONAL RECORDS (PR TRACKER)</div>
        <div class="pr-grid">${prHTML}</div>
      </div>
    <div class="card dash-full">
      <h3 style="font-size:0.85rem;margin-bottom:6px;">📝 Weekly Notes</h3>
      <textarea data-id="notes" oninput="saveState(); showSaveToast();" rows="3" placeholder="Log progress observations...">${S.fields["notes"]||""}</textarea>
    </div>
    </div>
  `;
  container.appendChild(dash);

  let wk = document.createElement("div");
  wk.className = "page";
  wk.id = "page_Workout";
  
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  let exHTML = "";
  if(currentDayExercises.length === 0){
    exHTML = `<div style="text-align:center;padding:40px var(--tx2);font-size:0.85rem;color:var(--tx2);">Rest block configured. Use manage buttons to append tracks.</div>`;
  } else {
    currentDayExercises.forEach(ex=>{
      let isDone = S.fields[`chk_${ex}`] || false;
      let setRows = "";
      for(let s=1; s<=3; s++){
        let wV = S.fields[`w_${ex}_${s}`] || "";
        let rV = S.fields[`r_${ex}_${s}`] || "";
        setRows += `
          <div class="set-chip ${wV!=''?'done-set':''}">
            <span class="set-num">Set ${s}</span>
            <input type="text" id="w_${ex}_${s}" placeholder="kg" value="${wV}" style="padding:2px 4px;font-size:0.7rem;text-align:center;margin-top:2px;" oninput="saveState(); showSaveToast();">
            <input type="number" id="r_${ex}_${s}" placeholder="reps" value="${rV}" style="padding:2px 4px;font-size:0.7rem;text-align:center;margin-top:2px;" oninput="saveState(); showSaveToast();">
          </div>
        `;
      }
      exHTML += `
        <div class="card ${isDone?'completed':''}" id="card_${ex}">
          <div class="exercise-header">
            <div class="name">${ex}</div>
            <div class="check-wrap">
              <input type="checkbox" id="chk_${ex}" ${isDone?'checked':''} onchange="handleCheck('${ex}')">
              <div class="check-box"></div>
            </div>
          </div>
          <div class="sets-row">${setRows}</div>
        </div>
      `;
    });
  }
  
  wk.innerHTML = `
    <div class="day-header">
      <div class="day-title">${S.currentRoutine} Layout</div>
      <div class="day-header-right">
        <button class="action-icon-btn" onclick="promptAddExercise()">➕</button>
        <button class="action-icon-btn" onclick="openRemoveModal()">🗑️</button>
        <button class="complete-all-btn" onclick="completeAll()">Quick Clear</button>
      </div>
    </div>
    <div id="exerciseListContainer">${exHTML}</div>
  `;
  container.appendChild(wk);

  let hist = document.createElement("div");
  hist.className = "page";
  hist.id = "page_History";
  hist.innerHTML = `
   <div class="card">
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <div class="stat-box" style="flex:1;min-width:100px;">
        <div class="stat-val green">1</div>
        <div class="stat-label">Current Streak</div>
      </div>
      <div class="stat-box" style="flex:1;min-width:100px;">
        <div class="stat-val cyan" id="histTotal">2</div>
        <div class="stat-label">Completed Sessions</div>
      </div>
    </div>
    </div>   
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="calendar-nav-btn" onclick="changeMonth(-1)">◀</button>
        <div class="calendar-month-title" id="calMonthTitle">Month Year</div>
        <button class="calendar-nav-btn" onclick="changeMonth(1)">▶</button>
      </div>
      <div class="calendar-grid" id="calendarGrid"></div>
    </div>
    <div style="margin-top:14px; font-weight:700; font-size:0.8rem; color:var(--ac3); text-transform:uppercase;">Selected Log Metrics & Records</div>
    <div class="selected-day-log" id="selectedDayLogContainer">Select a highlighted day to inspect logged structural items.</div> <br>
    <div class="version-card">
      <span>Build Version</span>
      <span class="version-tag">v3.0.1</span>
    </div>
  `;
  container.appendChild(hist);
  
  buildWaterGlasses();

  let activePage = document.getElementById(`page_${currentTab}`);
  if(activePage) activePage.classList.add("show");
}

function handleCheck(ex){
  let cb = document.getElementById(`chk_${ex}`);
  let card = document.getElementById(`card_${ex}`);
  if(cb && card){
    if(cb.checked) card.classList.add("completed");
    else card.classList.remove("completed");
  }
  saveState();
  updateProgress();
  showSaveToast();
}

function completeAll(){
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  currentDayExercises.forEach(ex=>{
    let cb = document.getElementById(`chk_${ex}`);
    let card = document.getElementById(`card_${ex}`);
    if(cb){
      cb.checked = true;
      if(card) card.classList.add("completed");
    }
  });
  saveState();
  updateProgress();
  showSaveToast();
}

function promptAddExercise(){
  let name = prompt("Enter custom track name:");
  if(name && name.trim() !== ""){
    if(!S.plan[S.currentRoutine]) S.plan[S.currentRoutine] = [];
    S.plan[S.currentRoutine].push(name.trim());
    saveState();
    renderAllPages();
    switchTab("Workout");
    showSaveToast();
  }
}

function openRemoveModal(){
  let currentDayExercises = S.plan[S.currentRoutine] || [];
  let container = document.getElementById("removeCheckboxes");
  if(!container) return;
  container.innerHTML = "";
  if(currentDayExercises.length === 0){
    container.innerHTML = `<p style="font-size:0.75rem;color:var(--tx3);">No target tracks present.</p>`;
  } else {
    currentDayExercises.forEach(ex=>{
      container.innerHTML += `
        <label class="exercise-check">
          <input type="checkbox" value="${ex}">
          <span>${ex}</span>
        </label>
      `;
    });
  }
  document.getElementById("removeModal").classList.add("open");
}

function closeRemoveModal(){
  document.getElementById("removeModal").classList.remove("open");
}

function confirmRemove(){
  let checked = document.querySelectorAll("#removeCheckboxes input:checked");
  let toRemove = Array.from(checked).map(c=>c.value);
  if(toRemove.length > 0){
    S.plan[S.currentRoutine] = (S.plan[S.currentRoutine]||[]).filter(ex=>!toRemove.includes(ex));
    saveState();
    renderAllPages();
    switchTab("Workout");
    showSaveToast();
  }
  closeRemoveModal();
}

function buildWaterGlasses(){
  let wr = document.getElementById("waterRow");
  if(!wr) return;
  wr.innerHTML = "";
  for(let i=0; i<8; i++){
    let g = document.createElement("div");
    g.className = "water-glass" + (i < S.water ? " filled" : "");
    g.innerText = "💧";
    g.onclick = () => {
      if(i < S.water) S.water = i;
      else S.water = i + 1;
      saveState();
      buildWaterGlasses();
      showSaveToast();
    };
    wr.appendChild(g);
  }
}

function updateStreakBadge(){
  let countEl = document.getElementById("streakCount");
  if(countEl) countEl.innerText = S.streak.count || 0;
  let tBadge = document.getElementById("todayBadge");
  if(tBadge){
    let loggedToday = S.workoutLog[new Date().toISOString().split("T")[0]];
    if(loggedToday && loggedToday.some(e=>e.done)) tBadge.style.display = "inline-flex";
    else tBadge.style.display = "none";
  }
}

function renderCalendar(){
  let titleEl = document.getElementById("calMonthTitle");
  let gridEl = document.getElementById("calendarGrid");
  if(!titleEl || !gridEl) return;
  
  let months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  titleEl.innerText = `${months[S.calMonth]} ${S.calYear}`;
  gridEl.innerHTML = "";
  
  let days = ["M","T","W","T","F","S","S"];
  days.forEach(d=>{ gridEl.innerHTML += `<div class="calendar-day-lbl">${d}</div>`; });
  
  let firstDay = new Date(S.calYear, S.calMonth, 1).getDay();
  let shift = firstDay === 0 ? 6 : firstDay - 1;
  let daysInMo = new Date(S.calYear, S.calMonth + 1, 0).getDate();
  
  for(let i=0; i<shift; i++){ gridEl.innerHTML += `<div></div>`; }
  
  for(let d=1; d<=daysInMo; d++){
    let dateStr = `${S.calYear}-${String(S.calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let hasLog = S.workoutLog[dateStr] && S.workoutLog[dateStr].some(e=>e.done);
    let cell = document.createElement("div");
    cell.className = "calendar-cell" + (dateStr === S.workoutDate ? " active-day" : "");
    cell.innerText = d;
    if(hasLog){
      let dot = document.createElement("div");
      dot.className = "dot-indicator";
      cell.appendChild(dot);
    }
    cell.onclick = () => showDayLog(dateStr);
    gridEl.appendChild(cell);
  }
}

function changeMonth(dir){
  S.calMonth += dir;
  if(S.calMonth < 0) { S.calMonth = 11; S.calYear--; }
  if(S.calMonth > 11) { S.calMonth = 0; S.calYear++; }
  renderCalendar();
}

function showDayLog(dateStr){
  S.workoutDate = dateStr;
  document.getElementById("globalWorkoutDate").value = dateStr;
  loadActiveDayLog();
  
  let d = new Date(dateStr);
  let dayIdx = (d.getDay()+6)%7;
  S.currentRoutine = dayKeys[dayIdx] || "Monday";
  
  renderAllPages();
  switchTab("History");
  
  let logs = S.workoutLog[dateStr];
  let container = document.getElementById("selectedDayLogContainer");
  if(!container) return;
  
  let html = `<div style="font-weight:700;margin-bottom:8px;color:var(--ac);">${dateStr}</div>`;
  let recordsFound = false;
  
  let prFieldsWithData = Object.keys(S.fields).filter(k=>k.startsWith("pr_") && S.fields[k] !== "");
  if(prFieldsWithData.length > 0){
    recordsFound = true;
    html += `<div style="font-weight:700;font-size:0.7rem;color:var(--tx2);margin-bottom:4px;text-transform:uppercase;">Personal Track records</div>`;
    prFieldsWithData.forEach(k=>{
      let fieldName = k.replace("pr_", "");
      html += `
        <div class="history-pr-card">
          <span class="history-pr-name">${fieldName}</span>
          <span class="history-pr-val">${S.fields[k]}</span>
        </div>
      `;
    });
  }

  let wRec = S.weightHistory.find(e=>e.date===dateStr);
  let waRec = S.waistHistory.find(e=>e.date===dateStr);
  let protRec = S.proteinHistory.find(e=>e.date===dateStr);
  let stepsRec = S.stepsHistory.find(e=>e.date===dateStr);
  
  if(wRec || waRec || protRec || stepsRec){
    recordsFound = true;
    html += `<div style="font-weight:700;font-size:0.7rem;color:var(--tx2);margin-top:8px;margin-bottom:4px;text-transform:uppercase;">Tracked Metrics</div>`;
    if(wRec && wRec.value !== "") html += `<div class="history-pr-card"><span class="history-pr-name">Weight</span><span class="history-pr-val" style="color:var(--ac); background:rgba(0,230,118,0.1);">${wRec.value} kg</span></div>`;
    if(waRec && waRec.value !== "") html += `<div class="history-pr-card"><span class="history-pr-name">Waist</span><span class="history-pr-val" style="color:var(--ac); background:rgba(0,230,118,0.1);">${waRec.value} cm</span></div>`;
    if(protRec && protRec.value !== "") html += `<div class="history-pr-card"><span class="history-pr-name">Protein</span><span class="history-pr-val" style="color:var(--ac3); background:rgba(124,77,255,0.1);">${protRec.value} g</span></div>`;
    if(stepsRec && stepsRec.value !== "") html += `<div class="history-pr-card"><span class="history-pr-name">Steps</span><span class="history-pr-val" style="color:var(--orn); background:rgba(255,171,64,0.1);">${stepsRec.value.toLocaleString()}</span></div>`;
  }
  
  if(logs && Array.isArray(logs)){
    recordsFound = true;
    html += `<div style="font-weight:700;font-size:0.7rem;color:var(--tx2);margin-top:8px;margin-bottom:4px;text-transform:uppercase;">Executed Track Exercises</div>`;
    logs.forEach(l=>{
      if(l.done){
        let setDetails = l.sets ? l.sets.map((s,i)=>(s.w||s.r)?`S${i+1}: ${s.w||0}kg x ${s.r||0}r`:null).filter(Boolean).join(" | ") : "";
        html += `
          <div class="history-pr-card" style="align-items:flex-start; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; width:100%;">
              <span class="history-pr-name" style="color:var(--tx);">✔ ${l.exercise}</span>
            </div>
            ${setDetails?`<div style="font-size:0.65rem; color:var(--tx2);">${setDetails}</div>`:''}
          </div>
        `;
      }
    });
  }
  
  if(!recordsFound){
    html += `<div style="color:var(--tx3);font-size:0.75rem;">No metrics or session logs stored on this node.</div>`;
  }
  
  container.innerHTML = html;
  showSaveToast();
}

let audioCtx = null;
function playBeep(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let times = [0, 0.25, 0.5];
  times.forEach(t=>{
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + t);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + t);
    osc.stop(audioCtx.currentTime + t + 0.15);
  });
}

let timerInt = null;
let timerSeconds = 60;
let timerRunning = false;

function toggleTimer(){
  let el = document.getElementById("timerOverlay");
  if(el.classList.contains("open")) el.classList.remove("open");
  else el.classList.add("open");
}

function setTimerPreset(sec, btn){
  document.querySelectorAll(".timer-preset").forEach(p=>p.classList.remove("active"));
  if(btn) btn.classList.add("active");
  timerSeconds = sec;
  updateTimerDisplay();
}

function updateTimerDisplay(){
  let m = Math.floor(timerSeconds/60);
  let s = timerSeconds%60;
  document.getElementById("timerDisplay").innerText = `${m}:${String(s).padStart(2,'0')}`;
}

function startTimer(){
  let btn = document.getElementById("timerStartBtn");
  let tBtn = document.getElementById("timerToggle");
  if(timerRunning){
    clearInterval(timerInt);
    timerRunning = false;
    if(btn) btn.innerText = "Start";
    if(tBtn) tBtn.classList.remove("running");
  } else {
    timerRunning = true;
    if(btn) btn.innerText = "Stop";
    if(tBtn) tBtn.classList.add("running");
    timerInt = setInterval(()=>{
      timerSeconds--;
      if(timerSeconds <= 0){
        clearInterval(timerInt);
        timerRunning = false;
        timerSeconds = 60;
        if(btn) btn.innerText = "Start";
        if(tBtn) tBtn.classList.remove("running");
        playBeep();
        triggerConfetti();
      }
      updateTimerDisplay();
    },1000);
  }
}

function resetTimer(){
  clearInterval(timerInt);
  timerRunning = false;
  timerSeconds = 60;
  let btn = document.getElementById("timerStartBtn");
  let tBtn = document.getElementById("timerToggle");
  if(btn) btn.innerText = "Start";
  if(tBtn) tBtn.classList.remove("running");
  document.querySelectorAll(".timer-preset").forEach(p=>p.classList.remove("active"));
  let firstP = document.querySelector(".timer-preset");
  if(firstP) firstP.classList.add("active");
  updateTimerDisplay();
}

function triggerConfetti(){
  let canvas = document.getElementById("confetti");
  if(!canvas) return;
  let ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let pieces = [];
  for(let i=0; i<60; i++){
    pieces.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height - canvas.height,
      r: Math.random()*4+2,
      d: Math.random()*canvas.height,
      color: ["#00e676","#00bcd4","#7c4dff","#ffab40"][Math.floor(Math.random()*4)],
      tilt: Math.random()*10-5
    });
  }
  let start = Date.now();
  function draw(){
    if(Date.now() - start > 2000){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      return;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{
      p.y += 4;
      p.tilt += 0.1;
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r/2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r/2);
      ctx.stroke();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

window.onload = () => {
  loadState();
  buildBottomNav();
  renderAllPages();
  updateStreakBadge();
  switchTab("Dashboard");
};
