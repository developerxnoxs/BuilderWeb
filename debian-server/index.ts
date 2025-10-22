import express from "express";
import { registerBuildRoutes } from "./routes";
import { cleanupOldBuilds } from "./build-processor";

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    service: "debian-build-server"
  });
});

registerBuildRoutes(app);

setInterval(() => {
  cleanupOldBuilds();
}, 60 * 60 * 1000);

const PORT = parseInt(process.env.DEBIAN_SERVER_PORT || '3001', 10);
const HOST = process.env.DEBIAN_SERVER_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Debian Build Server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});
