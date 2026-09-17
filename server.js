const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DB_FILE = path.join(ROOT, "data.json");
const UPLOAD_DIR = path.join(PUBLIC, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}
function auth(req, res, next) {
  const token = req.headers.authorization || "";
  if (token !== "Bearer " + process.env.ADMIN_TOKEN && token !== "Bearer SAVASTU-DEMO-ADMIN") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
    cb(null, Date.now() + "-" + crypto.randomBytes(4).toString("hex") + "-" + (safe || "image" + ext));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)) return cb(new Error("Only JPG, PNG, WEBP or AVIF images are allowed."));
    cb(null, true);
  }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC));

app.get("/api/products", (_, res) => {
  res.json(readDB().products);
});

app.post("/api/orders", (req, res) => {
  const { customer, items, subtotal, delivery, total } = req.body;
  if (!customer || !customer.name || !customer.phone || !customer.address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Please provide customer details and at least one product." });
  }
  const db = readDB();
  const order = {
    id: "SV-" + Date.now().toString().slice(-8),
    createdAt: new Date().toISOString(),
    status: "Pending",
    customer,
    items,
    subtotal: Number(subtotal) || 0,
    delivery: Number(delivery) || 0,
    total: Number(total) || 0
  };
  db.orders.unshift(order);
  // Reduce stock where possible
  for (const item of items) {
    const p = db.products.find(x => x.id === item.id);
    if (p && typeof p.stock === "number") p.stock = Math.max(0, p.stock - Number(item.qty || 1));
  }
  writeDB(db);
  res.json({ ok: true, orderId: order.id });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "Savastu@123";
  if (username === expectedUser && password === expectedPass) {
    return res.json({ ok: true, token: process.env.ADMIN_TOKEN || "SAVASTU-DEMO-ADMIN" });
  }
  res.status(401).json({ error: "Invalid username or password." });
});

app.get("/api/admin/orders", auth, (_, res) => res.json(readDB().orders));
app.get("/api/admin/products", auth, (_, res) => res.json(readDB().products));

app.post("/api/admin/products", auth, upload.single("image"), (req, res) => {
  const { name, category, size, price, description, stock, featured } = req.body;
  if (!name || !price) return res.status(400).json({ error: "Name and price are required." });
  const db = readDB();
  const product = {
    id: Date.now(),
    name,
    category: category || "Unisex",
    size: size || "30ml",
    price: Number(price),
    description: description || "",
    stock: Math.max(0, Number(stock) || 0),
    featured: featured === "true",
    image: req.file ? "/uploads/" + req.file.filename : "/assets/hero.jpg"
  };
  db.products.unshift(product);
  writeDB(db);
  res.json(product);
});

app.put("/api/admin/products/:id", auth, (req, res) => {
  const db = readDB();
  const p = db.products.find(x => String(x.id) === String(req.params.id));
  if (!p) return res.status(404).json({ error: "Product not found." });
  Object.assign(p, {
    name: req.body.name ?? p.name,
    category: req.body.category ?? p.category,
    size: req.body.size ?? p.size,
    price: req.body.price !== undefined ? Number(req.body.price) : p.price,
    description: req.body.description ?? p.description,
    stock: req.body.stock !== undefined ? Number(req.body.stock) : p.stock,
    featured: req.body.featured !== undefined ? Boolean(req.body.featured) : p.featured
  });
  writeDB(db);
  res.json(p);
});

app.delete("/api/admin/products/:id", auth, (req, res) => {
  const db = readDB();
  const before = db.products.length;
  db.products = db.products.filter(x => String(x.id) !== String(req.params.id));
  if (db.products.length === before) return res.status(404).json({ error: "Product not found." });
  writeDB(db);
  res.json({ ok: true });
});

app.patch("/api/admin/orders/:id", auth, (req, res) => {
  const allowed = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status." });
  const db = readDB();
  const order = db.orders.find(x => x.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  order.status = req.body.status;
  writeDB(db);
  res.json(order);
});

app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC, "index.html"));
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || "Request failed." });
});

app.listen(PORT, () => {
  console.log(`SAVASTU Fragrances: http://localhost:${PORT}`);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});