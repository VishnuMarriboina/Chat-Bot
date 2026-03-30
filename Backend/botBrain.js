// ─── Bot Brain ────────────────────────────────────────────────────────────────
// All pattern rules and response logic lives here.
// index.js only handles server / socket wiring.

const BOT_NAME = "MyChatBot";

const AI_SYSTEM_PROMPT = `You are ${BOT_NAME}, a friendly and helpful chat assistant.
Keep responses concise and conversational (1–4 sentences max).
Do not use markdown formatting, bullet points, or headers — plain text only.
Be warm, helpful, and a little witty.`;

// ─── Rules ────────────────────────────────────────────────────────────────────
// Each rule has:
//   pattern   — RegExp to test the message
//   responses — string[] or () => string[]   (random pick)
//   handler   — (msg) => string | null       (dynamic compute, takes priority)

const botRules = [
  // ── Greetings & Smalltalk ──────────────────────────────────────────────────
  {
    pattern:
      /\b(hi|hello|hey|howdy|greetings|what'?s up|sup|whats up|GoodMorning)\b/i,
    responses: [
      "Hello! 👋 How can I help you today?",
      "Hey there! What's on your mind?",
      "Hi! Great to see you. What can I do for you?",
    ],
  },
  {
    pattern: /\b(bye|goodbye|see you|cya|later|good night)\b/i,
    responses: [
      "Goodbye! Have a nice day! 👋",
      "Goodbye! Have a wonderful day! 👋",
      "See you later! Take care! 😊",
      "Bye! Come back anytime you need help.",
    ],
  },
  {
    pattern: /\b(thank(s| you)|thx|cheers)\b/i,
    responses: [
      "You're welcome! 😊",
      "Happy to help!",
      "Anytime! Let me know if you need anything else.",
    ],
  },
  {
    pattern: /\b(how are you|how do you do|you okay|you good)\b/i,
    responses: [
      "I'm doing great, thanks for asking! How about you?",
      "All systems running smoothly! 🤖 How can I assist you?",
      "I'm fantastic! Ready to help with anything.",
    ],
  },
  {
    pattern: /\b(what('?s)? your name|who are you|tell me about yourself)\b/i,
    responses: [
      `I'm ${BOT_NAME}, your personal chat assistant! 🤖`,
      `The name's ${BOT_NAME}! I'm here to chat and help you out.`,
    ],
  },
  {
    pattern: /\b(joke|funny|make me laugh|tell me a joke)\b/i,
    responses: [
      "Why don't scientists trust atoms? Because they make up everything! 😂",
      "I told my computer I needed a break... now it won't stop sending me Kit-Kat ads. 😄",
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😂",
      "What do you call a fish without eyes? A fsh! 🐟",
    ],
  },

  // ── Date & Time ────────────────────────────────────────────────────────────
  {
    pattern: /\b(time|what time|current time|clock)\b/i,
    responses: () => [
      `The current time is ${new Date().toLocaleTimeString()} ⏰`,
    ],
  },
  {
    pattern: /\b(date|today|what('?s)? the date|current date)\b/i,
    responses: () => [
      `Today is ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })} 📅`,
    ],
  },

  // Day of week for any historical/future date
  // e.g. "what day was august 16 1947", "which day was 15 august 1947"
  {
    pattern:
      /\b(?:what|which)\s+(?:day|weekday).*\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b|\b(?:what|which)\s+(?:day|weekday).*\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})[,\s]+(\d{4})\b/i,
    handler(msg) {
      const months = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };

      // Try "16 august 1947" format
      let m = msg.match(
        /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
      );
      // Try "august 16 1947" format
      if (!m) {
        m = msg.match(
          /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})[,\s]+(\d{4})/i,
        );
        if (m) m = [m[0], m[2], m[1], m[3]]; // reorder → [full, day, month, year]
      }
      if (!m) return null;

      const day = parseInt(m[1]);
      const month = months[m[2].toLowerCase()];
      const year = parseInt(m[3]);

      const date = new Date(year, month, day);
      // Validate the date is real
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      )
        return `That doesn't seem like a valid date. Double-check the day and month! 🤔`;

      const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
      const full = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return `📅 ${full} was a ${weekday}!`;
    },
  },

  // Day of week — numeric formats: "16-08-2000", "16/08/2000", "1/3/1923"
  {
    pattern: /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/,
    handler(msg) {
      const m = msg.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (!m) return null;

      const day   = parseInt(m[1]);
      const month = parseInt(m[2]) - 1; // 0-indexed
      const year  = parseInt(m[3]);

      if (month < 0 || month > 11 || day < 1 || day > 31)
        return `That doesn't look like a valid date. Use DD-MM-YYYY format. 🤔`;

      const date = new Date(year, month, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth()    !== month ||
        date.getDate()     !== day
      )
        return `That doesn't seem like a valid date. Double-check day and month! 🤔`;

      const full = date.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
      return `📅 ${full} was a ${weekday}!`;
    },
  },

  // ── Arithmetic ─────────────────────────────────────────────────────────────
  {
    // "what is 5 + 3", "calculate 10 * 5", "5+3", "2^10", "(3+4)*2"
    pattern:
      /(?:(?:what(?:'?s)?\s*(?:is)?|calculate|compute|solve|evaluate)\s+)?-?\d[\d\s]*(?:[\+\-\*\/\^%]\s*[\d.(][\d\s).]*){1,}/i,
    handler(msg) {
      const raw = msg.match(/-?[\d\s.(]+(?:[\+\-\*\/\^%]+\s*-?[\d\s.(]+)+/);
      if (!raw) return null;
      const expr = raw[0].trim().replace(/\^/g, "**");
      if (!/^[\d\s\+\-\*\/\(\)\.%\*]+$/.test(expr)) return null;
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        if (!isFinite(result))
          return result === Infinity
            ? "♾️ That's division by zero — undefined!"
            : "That doesn't compute! 🤔";
        const display = expr.replace(/\*\*/g, "^");
        const formatted = Number.isInteger(result)
          ? result
          : parseFloat(result.toFixed(8));
        return `🧮 ${display} = ${formatted}`;
      } catch {
        return null;
      }
    },
  },

  // Square root  e.g. "sqrt 144", "square root of 81"
  {
    pattern: /(?:sqrt|square\s+root\s+(?:of\s+)?)\s*(\d+\.?\d*)/i,
    handler(msg) {
      const m = msg.match(/(?:sqrt|square\s+root\s+(?:of\s+)?)\s*(\d+\.?\d*)/i);
      if (!m) return null;
      const n = parseFloat(m[1]);
      const r = Math.sqrt(n);
      return `🧮 √${n} = ${Number.isInteger(r) ? r : r.toFixed(6)}`;
    },
  },

  // Factorial  e.g. "5!" or "factorial of 7"
  {
    pattern:
      /(?:factorial\s+(?:of\s+)?)?(\d+)\s*!|factorial\s+(?:of\s+)?(\d+)/i,
    handler(msg) {
      const m = msg.match(
        /(?:factorial\s+(?:of\s+)?)?(\d+)\s*!|factorial\s+(?:of\s+)?(\d+)/i,
      );
      const n = parseInt(m[1] ?? m[2]);
      if (n > 20)
        return `${n}! is astronomically large 🔢 (overflow territory!)`;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return `🧮 ${n}! = ${r}`;
    },
  },

  // GCD / LCM  e.g. "what is the LCM of 4 and 6"
  {
    pattern: /\b(what is the (lcm|hcf|gcd) of|lcm|gcd|hcf)\b.*\d.*\d/i,
    handler(msg) {
      const nums = msg
        .match(/-?\d+/g)
        ?.map(Number)
        .filter((n) => n > 0);
      if (!nums || nums.length < 2) return null;
      const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
      const lcm = (a, b) => (a / gcd(a, b)) * b;
      const isLcm = /lcm/i.test(msg);
      const result = nums.reduce(isLcm ? lcm : gcd);
      return `🧮 ${isLcm ? "LCM" : "GCD"} of ${nums.join(", ")} = ${result}`;
    },
  },

  // ── Number Properties ──────────────────────────────────────────────────────

  // Prime check  e.g. "is 17 a prime?"
  {
    pattern: /is\s+(\d+)\s+(?:a\s+)?prime/i,
    handler(msg) {
      const m = msg.match(/is\s+(\d+)\s+(?:a\s+)?prime/i);
      const n = parseInt(m[1]);
      if (n < 2) return `${n} is NOT prime. Primes start at 2!`;
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0)
          return `❌ ${n} is NOT prime — it's divisible by ${i}.`;
      }
      return `✅ ${n} IS a prime number! (only divisible by 1 and itself)`;
    },
  },

  // Even / Odd  e.g. "is 42 even?"
  {
    pattern: /is\s+(\d+)\s+(even|odd)/i,
    handler(msg) {
      const m = msg.match(/is\s+(\d+)\s+(even|odd)/i);
      const n = parseInt(m[1]);
      const isEven = n % 2 === 0;
      return `${n} is ${isEven ? "even ✅" : "odd ✅"} (${isEven ? "" : "not "}divisible by 2)`;
    },
  },

  // Divisibility  e.g. "is 100 divisible by 7?"
  {
    pattern: /(\d+)\s+divisible\s+by\s+(\d+)/i,
    handler(msg) {
      const m = msg.match(/(\d+)\s+divisible\s+by\s+(\d+)/i);
      const a = parseInt(m[1]),
        b = parseInt(m[2]);
      if (b === 0) return "🚫 Cannot divide by zero!";
      const ok = a % b === 0;
      const correct = ok ? "" : ` The correct result: ${a} ÷ ${b} = ${(a / b).toFixed(2)} (remainder ${a % b})`;
      return `${ok ? "✅ Yes" : "❌ No"}, ${a} is ${ok ? "" : "NOT "}divisible by ${b}.${correct}`;
    },
  },

  // Comparison — symbol shorthand: "15>9", "15 >= 9", "15==9", "15!=9"
  {
    pattern: /(-?\d+\.?\d*)\s*(>=|<=|!=|==|>|<)\s*(-?\d+\.?\d*)/,
    handler(msg) {
      const m = msg.match(/(-?\d+\.?\d*)\s*(>=|<=|!=|==|>|<)\s*(-?\d+\.?\d*)/);
      if (!m) return null;
      const a = parseFloat(m[1]), op = m[2], b = parseFloat(m[3]);
      const results = { ">": a>b, "<": a<b, ">=": a>=b, "<=": a<=b, "==": a===b, "!=": a!==b };
      const labels  = { ">": "greater than", "<": "less than", ">=": "greater than or equal to", "<=": "less than or equal to", "==": "equal to", "!=": "not equal to" };
      const ok = results[op];
      const actualSign = a > b ? ">" : a < b ? "<" : "==";
      const correct = ok ? "" : ` The correct answer: ${a} ${actualSign} ${b}`;
      return `${ok ? "✅ Yes" : "❌ No"} — ${a} is ${ok ? "" : "NOT "}${labels[op]} ${b}.${correct}`;
    },
  },

  // Comparison — natural language: "is 15 greater than 9?"
  {
    pattern:
      /is\s+(-?\d+\.?\d*)\s+(greater|larger|bigger|more|less|smaller|fewer)\s+than\s+(-?\d+\.?\d*)/i,
    handler(msg) {
      const m = msg.match(
        /is\s+(-?\d+\.?\d*)\s+(greater|larger|bigger|more|less|smaller|fewer)\s+than\s+(-?\d+\.?\d*)/i,
      );
      const a = parseFloat(m[1]), op = m[2].toLowerCase(), b = parseFloat(m[3]);
      const wantGreater = ["greater", "larger", "bigger", "more"].includes(op);
      const result = wantGreater ? a > b : a < b;
      const actualSign = a > b ? ">" : a < b ? "<" : "==";
      const correct = result ? "" : ` The correct answer: ${a} ${actualSign} ${b}`;
      return `${result ? "✅ Yes" : "❌ No"} — ${a} is ${result ? "" : "NOT "}${wantGreater ? "greater" : "less"} than ${b}.${correct}`;
    },
  },


 
];

// ─── matchRule ────────────────────────────────────────────────────────────────
// Returns a matched response string, or null to fall through to AI.

function matchRule(message) {
  const trimmed = message.trim();
  for (const rule of botRules) {
    if (rule.pattern.test(trimmed)) {
      if (rule.handler) {
        const result = rule.handler(trimmed);
        if (result) return result;
        continue; // handler returned null → try next rule
      }
      const list =
        typeof rule.responses === "function"
          ? rule.responses()
          : rule.responses;
      return list[Math.floor(Math.random() * list.length)];
    }
  }
  return null;
}

module.exports = { BOT_NAME, AI_SYSTEM_PROMPT, matchRule };
