const { program } = require("commander");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

program
  .requiredOption("-h, --host <host>", "Server listen host")
  .requiredOption("-p, --port <number>", "Server listen port")
  .requiredOption("-c, --cache <path>", "Path to cache directory");

program.parse();
const options = program.opts();

const { port, host, cache } = options;
const uploadsPath = path.join(cache, "uploads");
const dbFile = path.join(cache, "inventory.json");

if (!fs.existsSync(cache)) fs.mkdirSync(cache, { recursive: true });

if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);
const upload = multer({ dest: uploadsPath });

if (!fs.existsSync(dbFile))
  fs.writeFileSync(dbFile, JSON.stringify({ nextId: 1, list: [] }), "utf-8");
let inventory = JSON.parse(fs.readFileSync(dbFile));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const formatItemResponse = (item) => {
  const photoUrl = item.photo
    ? `http://${host}:${port}/inventory/${item.id}/photo`
    : null;
  return {
    ...item,
    photo: photoUrl,
  };
};

app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).send("Name required");

  const id = inventory.nextId;
  inventory.nextId += 1;

  let photo = null;
  if (req.file) photo = req.file.filename;

  const item = { id, inventory_name, description, photo };
  inventory.list.push(item);

  fs.writeFileSync(dbFile, JSON.stringify(inventory));

  res.status(200).json(formatItemResponse(item));
});

app.get("/inventory", (req, res) => {
  const inventories = inventory.list.map(formatItemResponse);
  res.status(200).json(inventories);
});

app.get("/inventory/:id", (req, res) => {
  const id = req.params.id;
  const item = inventory.list.find((v) => v.id === Number(id));
  if (item) {
    res.status(200).json(formatItemResponse(item));
  } else {
    res.status(404).json("Inventory with this id not found");
  }
});

app.put("/inventory/:id", (req, res) => {
  const { inventory_name, description } = req.body;

  const id = req.params.id;
  const item = inventory.list.find((v) => v.id === Number(id));

  if (!item) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json("Inventory with this id not found");
  }
  item.inventory_name = inventory_name ?? item.inventory_name;
  item.description = description ?? item.description;

  fs.writeFileSync(dbFile, JSON.stringify(inventory));

  res.status(200).json(formatItemResponse(item));
});

app.get("/inventory/:id/photo", (req, res) => {
  const id = req.params.id;
  const item = inventory.list.find((v) => v.id === Number(id));

  if (!item) {
    res.status(404).json("Inventory with this id not found");
  } else if (item.photo === null) {
    res.status(404).json("Inventory has no photo");
  } else {
    const photoPath = path.join(uploadsPath, item.photo);

    if (!fs.existsSync(photoPath)) {
      return res.status(404).send("Photo not found");
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(photoPath, { root: __dirname });
  }
});

app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const id = req.params.id;
  const item = inventory.list.find((v) => v.id === Number(id));

  if (!item) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json("Inventory with this id not found");
  }

  if (item.photo) {
    const oldPhotoPath = path.join(uploadsPath, item.photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  item.photo = req.file ? req.file.filename : null;
  fs.writeFileSync(dbFile, JSON.stringify(inventory, null, 2));

  res.status(200).json(formatItemResponse(item));
});

app.delete("/inventory/:id", (req, res) => {
  const id = req.params.id;
  const item = inventory.list.find((v) => v.id === Number(id));

  if (!item) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json("Inventory with this id not found");
  }

  inventory.list = inventory.list.filter((i) => i !== item);

  fs.writeFileSync(dbFile, JSON.stringify(inventory));

  res.status(200).json();
});

app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.list.find((v) => v.id === parseInt(id));

  if (!item) {
    return res.status(404).json("Inventory with this id not found");
  }

  let responseItem = formatItemResponse(item);

  if (has_photo === "on") {
    responseItem.description = `${responseItem.description} [Photo: ${responseItem.photo}]`;
  }

  res.status(200).json(responseItem);
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
