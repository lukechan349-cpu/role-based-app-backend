// server.js — Node/Express backend; connects with webpages/script.js (frontend)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-very-secure-secret'; // In production, use environment variables!

// CORS and JSON first (API routes need these)
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://localhost:8080']
}));
app.use(express.json());

// 🔐 In-memory "database" (replace with MongoDB later)
let users = [
  { id: 1, username: 'admin', password: '$2a$10$...', role: 'admin' },
  { id: 2, username: 'admin@admin.com', password: '$2a$10$...', role: 'admin' },
  { id: 3, username: 'user1', password: '$2a$10$...', role: 'user' }
];
let employees = [];
let departments = [
  { id: 1, name: 'Engineering', description: 'Software team' },
  { id: 2, name: 'HR', description: 'Human Resources' }
];
let requests = [];

// Pre-hash known passwords for demo
// If the placeholder values ('...') exist (or passwords don't look like bcrypt hashes),
// replace with real bcrypt hashes so login works in the demo.
if (users.some(u => u.password.includes('...') || !u.password.startsWith('$2a$'))) {
  const defaultPasswords = {
    'admin': 'admin123',
    'admin@admin.com': 'admin123',
    'user1': 'user123'
  };

  users = users.map(u => {
    const pw = defaultPasswords[u.username];
    if (pw) {
      return { ...u, password: bcrypt.hashSync(pw, 10) };
    }
    // If user already had a real-looking bcrypt hash leave it as-is
    if (u.password && u.password.startsWith('$2a$')) return u;
    // Fallback: hash a generic default
    return { ...u, password: bcrypt.hashSync('password123', 10) };
  });
}

// 🛠️ MIDDLEWARE (must be defined before routes that use them)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// 🧾 API ROUTES (before static so /api/* always hits the server)
app.post('/api/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    role
  };
  users.push(newUser);
  res.status(201).json({ message: 'User registered', username, role });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
  res.json({ token, user: { username: user.username, role: user.role, email: user.username } });
});

app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ message: 'Welcome to admin dashboard!', data: 'Secret admin info' });
});

app.get('/api/content/guest', (req, res) => {
  res.json({ message: 'Public content for all visitors' });
});

// Employees (admin-only)
app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json(employees);
});
app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
  const body = req.body;
  const newId = employees.length ? Math.max(...employees.map(e => e.id)) + 1 : 1;
  const emp = { id: newId, employeeId: body.employeeId, userEmail: body.userEmail, position: body.position, department: body.department, hireDate: body.hireDate };
  employees.push(emp);
  res.status(201).json(emp);
});
app.put('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  employees[idx] = { ...employees[idx], employeeId: body.employeeId, userEmail: body.userEmail, position: body.position, department: body.department, hireDate: body.hireDate };
  res.json(employees[idx]);
});
app.delete('/api/employees/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const len = employees.length;
  employees = employees.filter(e => e.id !== id);
  if (employees.length === len) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Departments (admin-only)
app.get('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json(departments);
});
app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
  const body = req.body;
  const newId = departments.length ? Math.max(...departments.map(d => d.id)) + 1 : 1;
  const dept = { id: newId, name: body.name, description: body.description };
  departments.push(dept);
  res.status(201).json(dept);
});
app.put('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = departments.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  departments[idx] = { ...departments[idx], name: body.name, description: body.description };
  res.json(departments[idx]);
});
app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const len = departments.length;
  departments = departments.filter(d => d.id !== id);
  if (departments.length === len) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Requests (auth required, scoped to user)
app.get('/api/requests', authenticateToken, (req, res) => {
  const list = requests.filter(r => r.employeeEmail === req.user.username);
  res.json(list);
});
app.post('/api/requests', authenticateToken, (req, res) => {
  const body = req.body;
  const newId = requests.length ? Math.max(...requests.map(r => r.id)) + 1 : 1;
  const reqObj = { id: newId, type: body.type, items: body.items || [], employeeEmail: req.user.username, date: new Date().toISOString().split('T')[0], status: 'Pending' };
  requests.push(reqObj);
  res.status(201).json(reqObj);
});
app.delete('/api/requests/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = requests.find(x => x.id === id && x.employeeEmail === req.user.username);
  if (!r) return res.status(404).json({ error: 'Not found' });
  requests = requests.filter(x => x.id !== id);
  res.status(204).send();
});

// Users list / CRUD (admin only)
app.get('/api/users', authenticateToken, authorizeRole('admin'), (req, res) => {
  const list = users.map(u => ({ id: u.id, username: u.username, role: u.role }));
  res.json(list);
});
app.post('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const newUser = { id: users.length + 1, username, password: hashed, role };
  users.push(newUser);
  res.status(201).json({ id: newUser.id, username, role });
});
app.put('/api/users/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { username, password, role } = req.body;
  if (username) user.username = username;
  if (role) user.role = role;
  if (password) user.password = await bcrypt.hash(password, 10);
  res.json({ id: user.id, username: user.username, role: user.role });
});
app.delete('/api/users/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.user.id === id) return res.status(400).json({ error: 'Cannot delete your own account' });
  const adminCount = users.filter(u => u.role === 'admin').length;
  if (users[idx].role === 'admin' && adminCount <= 1) return res.status(400).json({ error: 'Cannot delete last admin' });
  users.splice(idx, 1);
  res.status(204).send();
});

// Serve HTML, JS, CSS last (so /api is not overridden)
app.use(express.static(path.join(__dirname)));

// ⚙️ Start server (frontend: script.js connects to these API routes)
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log('   Frontend (script.js) connects to this server for /api/login, /api/register, etc.');
  console.log('🔐 Open in browser: http://localhost:' + PORT);
  console.log('   Login: admin@admin.com / admin123  or  admin / admin123');
});