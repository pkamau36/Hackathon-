/**
 * Empowerment Hub Backend (Express + MySQL)
 * Features: Auth (JWT), User profile, Cycle saving, Simple health Q&A stub
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "empower_hub";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

let pool;

/** Initialize DB: ensure database and tables exist */
async function initDb(){
  // 1) connect without DB to ensure DB exists
  const serverConn = await mysql.createConnection({
    host: DB_HOST, user: DB_USER, password: DB_PASSWORD, multipleStatements: true
  });
  await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await serverConn.end();

  // 2) create pool to the DB
  pool = mysql.createPool({
    host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    connectionLimit: 10, namedPlaceholders: true
  });

  // 3) ensure tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NULL,
      last_name VARCHAR(100) NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      age VARCHAR(20) NULL,
      location VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cycles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      last_period_date DATE NOT NULL,
      cycle_length INT NOT NULL,
      period_duration INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Database initialized.");
}

/** Helpers */
function signToken(user){
  const payload = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    location: user.location
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req,res,next){
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if(!token) return res.status(401).json({ message: "Missing token" });
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  }catch(err){
    return res.status(401).json({ message: "Invalid token" });
  }
}

/** Routes */
app.get("/health", (req,res) => res.json({ ok:true, service:"empower-hub-backend" }));

// Auth
app.post("/api/auth/signup", async (req,res) => {
  const { first_name, last_name, email, password, age, location } = req.body || {};
  if(!email || !password){
    return res.status(400).json({ message:"Email and password are required." });
  }
  try{
    // check if exists
    const [rows] = await pool.query("SELECT id FROM users WHERE email = :email", { email });
    if(rows.length){
      return res.status(400).json({ message:"Email already registered." });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, age, location)
       VALUES (:first_name, :last_name, :email, :password_hash, :age, :location)`,
      { first_name: first_name || null, last_name: last_name || null, email, password_hash, age: age || null, location: location || null }
    );
    const user = { id: result.insertId, first_name, last_name, email, age, location };
    const token = signToken(user);
    res.json({ token, user });
  }catch(err){
    console.error(err);
    res.status(500).json({ message:"Server error" });
  }
});

app.post("/api/auth/login", async (req,res) => {
  const { email, password } = req.body || {};
  if(!email || !password){
    return res.status(400).json({ message:"Email and password are required." });
  }
  try{
    const [rows] = await pool.query("SELECT * FROM users WHERE email = :email", { email });
    if(!rows.length) return res.status(400).json({ message:"Invalid credentials." });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(400).json({ message:"Invalid credentials." });
    const token = signToken(user);
    const safeUser = {
      id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email,
      age: user.age, location: user.location
    };
    res.json({ token, user: safeUser });
  }catch(err){
    console.error(err);
    res.status(500).json({ message:"Server error" });
  }
});

app.get("/api/me", authMiddleware, async (req,res) => {
  try{
    const [rows] = await pool.query("SELECT id, first_name, last_name, email, age, location FROM users WHERE id = :id", { id: req.user.id });
    if(!rows.length) return res.status(404).json({ message:"User not found" });
    res.json({ user: rows[0] });
  }catch(err){
    console.error(err);
    res.status(500).json({ message:"Server error" });
  }
});

// Cycles
app.post("/api/cycles", authMiddleware, async (req,res) => {
  const { last_period_date, cycle_length, period_duration } = req.body || {};
  if(!last_period_date || !cycle_length || !period_duration){
    return res.status(400).json({ message:"Missing fields." });
  }
  try{
    await pool.query(
      `INSERT INTO cycles (user_id, last_period_date, cycle_length, period_duration)
       VALUES (:user_id, :last_period_date, :cycle_length, :period_duration)`,
      { user_id: req.user.id, last_period_date, cycle_length, period_duration }
    );
    res.json({ ok:true });
  }catch(err){
    console.error(err);
    res.status(500).json({ message:"Server error" });
  }
});

app.get("/api/cycles/latest", authMiddleware, async (req,res) => {
  try{
    const [rows] = await pool.query(
      `SELECT * FROM cycles WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1`,
      { user_id: req.user.id }
    );
    res.json({ latest: rows[0] || null });
  }catch(err){
    console.error(err);
    res.status(500).json({ message:"Server error" });
  }
});

// Simple health Q&A stub
app.post("/api/health/ask", async (req,res) => {
  const message = (req.body && req.body.message || "").toLowerCase();
  let reply = "Thanks for your message. I can share general health information, but not medical diagnosis. For urgent concerns, contact local emergency services.";
  if(message.includes("contraception") || message.includes("condom")){
    reply = "Contraception overview: condoms reduce risk of STIs and pregnancy; pills, implants, and IUDs are effective when used correctly. For personalized advice, talk to a clinician.";
  }else if(message.includes("pregnan")){
    reply = "If you think you might be pregnant, consider taking a test after a missed period and seek prenatal care. Warning signs needing urgent care include heavy bleeding or severe pain.";
  }else if(message.includes("sti") || message.includes("hiv")){
    reply = "STI info: limit partners, use condoms, get tested after risk, and seek prompt treatment. Many clinics provide confidential testing.";
  }else if(message.includes("period") || message.includes("cycle")){
    reply = "Cycle tips: tracking dates helps predict your next period. If you frequently have cycles <21 or >35 days, or very heavy bleeding, consider seeing a clinician.";
  }
  res.json({ reply });
});

// Serve frontend in production if you drop the files into ../frontend
const FRONTEND_DIR = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_DIR));

// Fallback to index.html for unknown routes (basic SPA behavior)
app.get("*", (req,res) => {
  try{ res.sendFile(path.join(FRONTEND_DIR, "index.html")); }
  catch{ res.status(404).send("Not found"); }
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error("Failed to init DB:", err);
  process.exit(1);
});
