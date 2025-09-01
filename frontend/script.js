/** Basic front-end logic for the Empowerment Hub **/
const API_URL = localStorage.getItem("API_URL") || "http://localhost:4000";

// Section switching
function showSection(id){
  document.querySelectorAll(".feature-section").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  // Update active nav
  document.querySelectorAll(".nav-item").forEach(li => li.classList.remove("active"));
  const map = {
    dashboard: 0, health: 1, menstrual: 2, reproductive: 3,
    education: 4, career: 5, community: 6, emergency: 7
  };
  const idx = map[id];
  const items = document.querySelectorAll(".nav-item");
  if(items[idx]) items[idx].classList.add("active");
}

// Auth view toggles
function showSignup(){
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("signupForm").classList.remove("hidden");
}
function showLogin(){
  document.getElementById("signupForm").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
}

// JWT helpers
function setToken(t){ localStorage.setItem("EH_TOKEN", t); }
function getToken(){ return localStorage.getItem("EH_TOKEN"); }
function clearToken(){ localStorage.removeItem("EH_TOKEN"); }

// UI helpers
function setLoggedInUI(user){
  // Hide auth, show app
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  // Fill profile
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
  document.getElementById("userNameDisplay").textContent = name;
  document.getElementById("userName").textContent = name;
  document.getElementById("userLocation").textContent = user.location || "—";
  const avatar = document.getElementById("userAvatar");
  avatar.textContent = (name[0] || "U").toUpperCase();
}

function setLoggedOutUI(){
  document.getElementById("authContainer").style.display = "flex";
  document.getElementById("appContainer").style.display = "none";
}

// Signup handler
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const first_name = document.getElementById("firstName").value.trim();
  const last_name  = document.getElementById("lastName").value.trim();
  const email      = document.getElementById("signupEmail").value.trim();
  const age        = document.getElementById("age").value;
  const location   = document.getElementById("location").value;
  const password   = document.getElementById("signupPassword").value;
  const confirm    = document.getElementById("confirmPassword").value;

  if(password !== confirm){
    return alert("Passwords do not match.");
  }

  try{
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ first_name, last_name, email, password, age, location })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.message || "Signup failed"); }
    setToken(data.token);
    setLoggedInUI(data.user);
    showSection("dashboard");
  }catch(err){
    alert(err.message);
  }
});

// Login handler
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try{
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.message || "Login failed"); }
    setToken(data.token);
    setLoggedInUI(data.user);
    showSection("dashboard");
  }catch(err){
    alert(err.message);
  }
});

// Logout
function logout(){
  clearToken();
  setLoggedOutUI();
  showLogin();
}

// Persist session on load
window.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if(token){
    try{
      const res = await fetch(`${API_URL}/api/me`, {
        headers:{ "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if(res.ok){
        setLoggedInUI(data.user);
        showSection("dashboard");
        return;
      }
    }catch{}
  }
  setLoggedOutUI();
  showLogin();
});

/** Health Chat (simple stub via backend) **/
function appendMessage(who, text){
  const wrap = document.getElementById("healthChat");
  const div = document.createElement("div");
  div.className = `message ${who}`;
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}
async function sendHealthMessage(){
  const input = document.getElementById("healthInput");
  const msg = input.value.trim();
  if(!msg) return;
  appendMessage("user", msg);
  input.value = "";
  try{
    const res = await fetch(`${API_URL}/api/health/ask`, {
      method:"POST",
      headers: {
        "Content-Type":"application/json",
        ...(getToken()? {"Authorization":`Bearer ${getToken()}`} : {})
      },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    appendMessage("ai", data.reply || "Thanks for your message. Stay safe and hydrated 💜");
  }catch{
    appendMessage("ai", "I couldn't reach the server right now. Please try again later.");
  }
}
function handleHealthEnter(e){ if(e.key === "Enter") sendHealthMessage(); }

/** Menstrual: trackers & info **/
function showCycleTracker(){
  document.getElementById("cycleTracker").style.display = "block";
}
function showHygieneGuide(){
  alert("Hygiene tips: change pads regularly (every 4–6 hours), wash hands before/after, use clean water, track symptoms, and seek care if you notice unusual discharge or severe pain.");
}
function showDisorderInfo(){
  alert("If you have very heavy bleeding, severe pain, or cycles <21 or >35 days frequently, consider seeing a clinician. If in doubt, consult a professional.");
}
function calculateNextPeriod(){
  const last = document.getElementById("lastPeriodDate").value;
  const cycle = parseInt(document.getElementById("cycleLength").value || "28", 10);
  const duration = parseInt(document.getElementById("periodDuration").value || "5", 10);
  if(!last){ return alert("Please set your last period start date."); }
  const lastDate = new Date(last);
  const next = new Date(lastDate.getTime());
  next.setDate(next.getDate() + cycle);
  const fertileStart = new Date(next.getTime()); fertileStart.setDate(next.getDate() - 14);
  const fertileEnd = new Date(fertileStart.getTime()); fertileEnd.setDate(fertileStart.getDate() + 5);
  const el = document.getElementById("periodPrediction");
  el.innerHTML = `
    <div class="tracking-form">
      <strong>Predicted next period:</strong> ${next.toDateString()} (approx. ${duration} days)<br>
      <strong>Likely fertile window:</strong> ${fertileStart.toDateString()} – ${fertileEnd.toDateString()}<br>
      <em>Predictions are estimates and may vary.</em>
    </div>
  `;
  // Optionally persist to backend
  const token = getToken();
  if(token){
    fetch(`${API_URL}/api/cycles`, {
      method:"POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
      body: JSON.stringify({
        last_period_date: last,
        cycle_length: cycle,
        period_duration: duration
      })
    }).catch(()=>{});
  }
}

/** Reproductive section stubs **/
function showContraceptionInfo(){
  alert("Contraception overview: condoms reduce risk of STIs and pregnancy; pills, implants, IUDs are effective when used correctly. Talk to a clinician for personal guidance.");
}
function showPregnancyInfo(){
  alert("Prenatal care: take folic acid, attend regular checkups, balanced diet, avoid alcohol & smoking, seek urgent care for bleeding or severe pain.");
}
function showSTIInfo(){
  alert("STI prevention: consistent condom use, limiting partners, testing when at risk, and prompt treatment. Seek local clinic or hotline for testing.");
}
function showHPVInfo(){
  alert("HPV vaccination can prevent cervical cancer. Ask your local clinic about availability and eligibility.");
}
function showGBVSupport(){
  alert("If you're in danger, prioritize safety and call local emergency services. You can also use the emergency section for helplines.");
}

/** Emergency **/
function triggerEmergency(){
  alert("Emergency alert: reach out to trusted adults and use the listed helplines immediately. If you are in immediate danger, contact local police/911-equivalent.");
}
