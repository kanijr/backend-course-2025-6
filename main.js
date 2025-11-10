import { program } from "commander";
import express from "express";
import fs from "fs";

program
  .requiredOption("-h, --host <host>", "Server listen host")
  .requiredOption("-p, --port <number>", "Server listen port")
  .requiredOption("-c, --cache <path>", "Path to cache directory");

program.parse();
const options = program.opts();

const cachePath = options.cache;
const { port, host } = options;

if (!fs.existsSync(cachePath)) {
  fs.mkdirSync(cachePath, { recursive: true });
}

const app = express();

app.get("/", (req, res) => {
  res.send("Server working");
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
