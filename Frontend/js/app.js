// ── Connect to the backend Socket.IO server ──────────────────────────────────
const socket = io("http://localhost:3345");

// ── DOM References ────────────────────────────────────────────────────────────
const form           = document.getElementById("form");
const input          = document.getElementById("input");
const sendBtn        = document.getElementById("send-btn");
const messagesEl     = document.getElementById("messages");
const typingEl       = document.getElementById("typing-indicator");
const onlineCountEl  = document.getElementById("online-count");
const msgCountEl     = document.getElementById("msg-count");
const statusText     = document.getElementById("status-text");
const connBadge      = document.getElementById("connection-badge");
const connLabel      = document.getElementById("connection-label");
const clearBtn       = document.getElementById("clear-btn");
const quickBtns      = document.querySelectorAll(".quick-btn");
const themeToggle    = document.getElementById("theme-toggle");

let messageCount = 0;
let mySocketId   = null;

// True while we're waiting on a reply to the last message we sent —
// blocks a new request from going out until this one resolves.
let awaitingResponse = false;

function setAwaitingResponse(value) {
  awaitingResponse = value;
  sendBtn.disabled = value || !input.value.trim() || !socket.connected;
}

// Holds reference to the currently-streaming bot bubble (if any)
let streamingBubble  = null;
let streamingWrapper = null;

// ── Utility ───────────────────────────────────────────────────────────────────
function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Render a complete message bubble ─────────────────────────────────────────
function addMessage({ text, type, timestamp }) {
  const row = document.createElement("div");
  row.className = `message-row ${type === "user" ? "user" : "bot"}`;

  if (type !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "bot-avatar tiny";
    avatar.innerHTML = `<span>${type === "other" ? "U" : "A"}</span>`;
    row.appendChild(avatar);
  }

  row.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble-wrap">
       <div class="bubble">${escapeHtml(text)}</div>
       <div class="bubble-time">${formatTime(timestamp)}</div>
     </div>`
  );

  messagesEl.appendChild(row);
  messageCount++;
  msgCountEl.textContent = messageCount;
  scrollToBottom();
}

// ── Streaming bubble helpers ──────────────────────────────────────────────────

// Create an empty bot bubble that will be filled by stream chunks
function createStreamingBubble(timestamp) {
  const row = document.createElement("div");
  row.className = "message-row bot";

  const avatar = document.createElement("div");
  avatar.className = "bot-avatar tiny";
  avatar.innerHTML = `<span>A</span>`;
  row.appendChild(avatar);

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble streaming";

  const timeEl = document.createElement("div");
  timeEl.className = "bubble-time";
  timeEl.textContent = formatTime(timestamp);

  wrap.appendChild(bubble);
  wrap.appendChild(timeEl);
  row.appendChild(wrap);

  messagesEl.appendChild(row);
  scrollToBottom();

  return { bubble, timeEl };
}

// Append a chunk of text to the active streaming bubble
function appendStreamChunk(text) {
  if (!streamingBubble) return;
  // Use a text node to safely append raw text without XSS risk
  streamingBubble.appendChild(document.createTextNode(text));
  scrollToBottom();
}

// Finalize the streaming bubble (remove cursor, update time)
function finalizeStreamingBubble(timestamp) {
  if (!streamingBubble) return;
  streamingBubble.classList.remove("streaming");
  if (streamingWrapper) {
    streamingWrapper.textContent = formatTime(timestamp);
  }
  messageCount++;
  msgCountEl.textContent = messageCount;
  streamingBubble  = null;
  streamingWrapper = null;
}

// ── Connection Events ─────────────────────────────────────────────────────────
socket.on("connect", () => {
  mySocketId = socket.id;
  connBadge.className = "connection-badge connected";
  connLabel.textContent = "Connected";
  statusText.className = "online-text";
  statusText.textContent = "Online — ready to chat";
  sendBtn.disabled = awaitingResponse || !input.value.trim();
});

socket.on("disconnect", () => {
  connBadge.className = "connection-badge disconnected";
  connLabel.textContent = "Disconnected";
  statusText.className = "offline-text";
  statusText.textContent = "Offline — reconnecting...";
  sendBtn.disabled = true;
});

// ── Online Count ──────────────────────────────────────────────────────────────
socket.on("online count", (count) => {
  onlineCountEl.textContent = count;
});

// ── Bot Message (rule-matched, instant) ───────────────────────────────────────
socket.on("bot message", ({ text, timestamp }) => {
  addMessage({ text, type: "bot", timestamp });
  setAwaitingResponse(false);
});

// ── Bot Typing Indicator ──────────────────────────────────────────────────────
socket.on("bot typing", (isTyping) => {
  typingEl.style.display = isTyping ? "flex" : "none";
  if (isTyping) scrollToBottom();
});

// ── AI Streaming Events ───────────────────────────────────────────────────────

// Tier 2: Claude API response starts — create empty bubble
socket.on("bot stream start", ({ timestamp }) => {
  typingEl.style.display = "none";
  const { bubble, timeEl } = createStreamingBubble(timestamp);
  streamingBubble  = bubble;
  streamingWrapper = timeEl;
});

// Tier 2: incoming text chunk — append to bubble
socket.on("bot stream chunk", ({ text }) => {
  appendStreamChunk(text);
});

// Tier 2: stream complete — finalize bubble
socket.on("bot stream end", ({ timestamp, error }) => {
  if (error) {
    // Stream was aborted — remove the empty streaming bubble if present
    if (streamingBubble) {
      const row = streamingBubble.closest(".message-row");
      if (row) row.remove();
      streamingBubble  = null;
      streamingWrapper = null;
    }
  } else {
    finalizeStreamingBubble(timestamp);
  }
  setAwaitingResponse(false);
});

// ── Incoming Chat Message (from another user) ─────────────────────────────────
socket.on("chat message", ({ text, sender, timestamp }) => {
  if (sender === mySocketId) return;
  addMessage({ text, type: "other", timestamp });
});

// ── Send Message ──────────────────────────────────────────────────────────────
function sendMessage(text) {
  if (!text.trim() || !socket.connected || awaitingResponse) return;
  addMessage({ text, type: "user", timestamp: new Date().toISOString() });
  socket.emit("chat message", text);
  input.value = "";
  input.focus();
  setAwaitingResponse(true);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  sendBtn.disabled = awaitingResponse || !input.value.trim() || !socket.connected;
});

// ── Quick Prompt Buttons & Capability Cards ───────────────────────────────────
document.querySelectorAll(".quick-btn, .cap-btn").forEach((btn) => {
  btn.addEventListener("click", () => sendMessage(btn.getAttribute("data-msg")));
});

// ── Theme Toggle ──────────────────────────────────────────────────────────────
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("mychatbot-theme", next);
});

// ── Clear Chat ────────────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  messagesEl.innerHTML = `<div class="day-divider"><span>Today</span></div>`;
  messageCount = 0;
  msgCountEl.textContent = 0;
  streamingBubble  = null;
  streamingWrapper = null;
});
