require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { OpenAI } = require("openai");
const { BOT_NAME, AI_SYSTEM_PROMPT, matchRule } = require("./botBrain");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── AI Streaming (Tier 2 fallback) ──────────────────────────────────────────

async function streamAIResponse(message, socket) {
  socket.emit("bot stream start", { timestamp: new Date().toISOString() });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) socket.emit("bot stream chunk", { text });
  }

  socket.emit("bot stream end", { timestamp: new Date().toISOString() });
}

// ─── Hybrid Response Handler ──────────────────────────────────────────────────

async function handleBotResponse(message, socket) {
  // Tier 1 — instant rule match (no AI cost, zero latency)
  const ruleMatch = matchRule(message);
  if (ruleMatch) {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    socket.emit("bot typing", false);
    socket.emit("bot message", { text: ruleMatch, timestamp: new Date().toISOString() });
    return;
  }

  // Tier 2 — OpenAI GPT-4o with real-time streaming
  socket.emit("bot typing", false);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    socket.emit("bot message", {
      text: "Hmm, that's a great question! I'm still learning and growing every day 🌱 Ask me something else — I'm getting smarter!",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    await streamAIResponse(message, socket);
  } catch (err) {
    console.error("OpenAI error:", err.status ?? "", err.message);
    socket.emit("bot stream end", { error: true });

    let userMsg = "Sorry, I'm having trouble reaching my AI brain right now. Please try again! 🙏";
    if (err.status === 401) userMsg = "⚠️ Invalid API key. Check OPENAI_API_KEY in Backend/.env and restart.";
    else if (err.status === 429) userMsg = "⚠️ Rate limit reached. Please wait a moment and try again.";

    socket.emit("bot message", { text: userMsg, timestamp: new Date().toISOString() });
  }
}

// ─── Socket Events ────────────────────────────────────────────────────────────

let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  console.log(`✅ User connected: ${socket.id} | Online: ${onlineUsers}`);

  socket.emit("bot message", {
    text: `Welcome! I'm ${BOT_NAME} 🤖 Ask me anything — math, logic, or just chat!`,
    timestamp: new Date().toISOString(),
  });

  io.emit("online count", onlineUsers);

  socket.on("chat message", (msg) => {
    if (!msg || typeof msg !== "string" || !msg.trim()) return;
    const clean = msg.trim();
    console.log(`💬 [${socket.id}] ${clean}`);

    io.emit("chat message", { text: clean, sender: socket.id, timestamp: new Date().toISOString() });

    setTimeout(() => {
      socket.emit("bot typing", true);
      handleBotResponse(clean, socket);
    }, 300);
  });

  socket.on("disconnect", () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit("online count", onlineUsers);
    console.log(`❌ User disconnected: ${socket.id} | Online: ${onlineUsers}`);
  });
});

// ─── HTTP Routes ──────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = 3345;
server.listen(PORT, () => {
  const aiStatus =
    process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_api_key_here"
      ? "✅ OpenAI GPT-4o enabled"
      : "⚠️  No API key — rule-only mode";
  console.log(`🚀 ${BOT_NAME} running at http://localhost:${PORT}`);
  console.log(`🤖 ${aiStatus}`);
});
