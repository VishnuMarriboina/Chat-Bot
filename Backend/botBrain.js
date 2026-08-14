// ─── Bot Brain ────────────────────────────────────────────────────────────────
// All pattern rules and response logic lives here.
// index.js only handles server / socket wiring.

const BOT_NAME = "MyChatBot";

const AI_SYSTEM_PROMPT = `You are ${BOT_NAME}, a friendly and helpful chat assistant.
Keep responses concise and conversational (1–4 sentences max).
Do not use markdown formatting, bullet points, or headers — plain text only.
Be warm, helpful, and a little witty.`;

// ─── Unit Conversion Tables ───────────────────────────────────────────────────

const UNIT_ALIASES = {
  km: "km", kilometer: "km", kilometers: "km",
  mi: "mi", mile: "mi", miles: "mi",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  c: "c", celsius: "c",
  f: "f", fahrenheit: "f",
  m: "m", meter: "m", meters: "m",
  ft: "ft", feet: "ft", foot: "ft",
};

const UNIT_LABELS = {
  km: "km", mi: "mi", kg: "kg", lb: "lbs", c: "°C", f: "°F", m: "m", ft: "ft",
};

const UNIT_CONVERSIONS = {
  "km-mi": (v) => v * 0.621371,
  "mi-km": (v) => v * 1.60934,
  "kg-lb": (v) => v * 2.20462,
  "lb-kg": (v) => v * 0.453592,
  "c-f": (v) => (v * 9) / 5 + 32,
  "f-c": (v) => ((v - 32) * 5) / 9,
  "m-ft": (v) => v * 3.28084,
  "ft-m": (v) => v * 0.3048,
};

function ordinalSuffix(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// ─── Rules ────────────────────────────────────────────────────────────────────
// Each rule has:
//   pattern   — RegExp to test the message
//   responses — string[] or () => string[]   (random pick)
//   handler   — (msg) => string | null       (dynamic compute, takes priority)

const botRules = [
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

  // ── Percentages & Stats ────────────────────────────────────────────────────

  // Percentage  e.g. "20% of 150", "what is 15 percent of 200"
  {
    pattern: /(-?\d+\.?\d*)\s*(?:%|percent)\s*of\s*(-?\d+\.?\d*)/i,
    handler(msg) {
      const m = msg.match(/(-?\d+\.?\d*)\s*(?:%|percent)\s*of\s*(-?\d+\.?\d*)/i);
      if (!m) return null;
      const pct = parseFloat(m[1]);
      const base = parseFloat(m[2]);
      const result = (pct / 100) * base;
      const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
      return `🧮 ${pct}% of ${base} = ${formatted}`;
    },
  },

  // Average / mean / median  e.g. "average of 4, 8, 15, 16, 23, 42"
  {
    pattern: /\b(average|mean|median)\s+of\s+[\d.\-,\s]+\d/i,
    handler(msg) {
      const m = msg.match(/\b(average|mean|median)\s+of\s+([\d.\-,\s]+\d)/i);
      if (!m) return null;
      const nums = m[2].match(/-?\d+\.?\d*/g)?.map(Number);
      if (!nums || nums.length === 0) return null;

      if (m[1].toLowerCase() === "median") {
        const sorted = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        return `🧮 Median of ${nums.join(", ")} = ${med}`;
      }
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const formatted = Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(4));
      return `🧮 Average of ${nums.join(", ")} = ${formatted}`;
    },
  },

  // Fibonacci  e.g. "fibonacci of 10", "10th fibonacci number"
  {
    pattern: /fibonacci\D*\d+|\d+(?:st|nd|rd|th)\s+fibonacci/i,
    handler(msg) {
      const m =
        msg.match(/fibonacci\D*(\d+)/i) || msg.match(/(\d+)(?:st|nd|rd|th)\s+fibonacci/i);
      if (!m) return null;
      const n = parseInt(m[1]);
      if (n > 1000) return `That's way too many Fibonacci numbers to compute! 🔢`;
      let a = 0, b = 1;
      for (let i = 0; i < n; i++) [a, b] = [b, a + b];
      return `🔢 The ${n}${ordinalSuffix(n)} Fibonacci number is ${a}`;
    },
  },

  // Binary / hex / octal conversion  e.g. "10 in binary", "hex of 255"
  {
    pattern:
      /\d+\s*(?:in|to)\s*(?:binary|hex(?:adecimal)?|octal)\b|\b(?:binary|hex(?:adecimal)?|octal)\s*(?:of|for)\s*\d+/i,
    handler(msg) {
      let n, base;
      let m = msg.match(/(\d+)\s*(?:in|to)\s*(binary|hex(?:adecimal)?|octal)/i);
      if (m) {
        n = parseInt(m[1]);
        base = m[2];
      } else {
        m = msg.match(/(binary|hex(?:adecimal)?|octal)\s*(?:of|for)\s*(\d+)/i);
        if (m) {
          n = parseInt(m[2]);
          base = m[1];
        }
      }
      if (n === undefined) return null;
      const radix = /^bin/i.test(base) ? 2 : /^hex/i.test(base) ? 16 : 8;
      const label = radix === 2 ? "binary" : radix === 16 ? "hex" : "octal";
      return `🔢 ${n} in ${label} = ${n.toString(radix).toUpperCase()}`;
    },
  },

  // ── Unit Conversions ───────────────────────────────────────────────────────
  // e.g. "5 km to miles", "convert 10 kg to lbs", "30 c to f"
  {
    pattern:
      /(-?\d+\.?\d*)\s*(kilometers?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|fahrenheit|celsius|meters?|feet|foot|ft|c|f|m)\b\s*(?:to|in|->|=>)\s*(kilometers?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|fahrenheit|celsius|meters?|feet|foot|ft|c|f|m)\b/i,
    handler(msg) {
      const m = msg.match(
        /(-?\d+\.?\d*)\s*(kilometers?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|fahrenheit|celsius|meters?|feet|foot|ft|c|f|m)\b\s*(?:to|in|->|=>)\s*(kilometers?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|fahrenheit|celsius|meters?|feet|foot|ft|c|f|m)\b/i,
      );
      if (!m) return null;
      const value = parseFloat(m[1]);
      const from = UNIT_ALIASES[m[2].toLowerCase()];
      const to = UNIT_ALIASES[m[3].toLowerCase()];
      if (!from || !to) return null;
      if (from === to)
        return `${value} ${UNIT_LABELS[from]} is the same as ${value} ${UNIT_LABELS[to]} 🔁`;
      const convert = UNIT_CONVERSIONS[`${from}-${to}`];
      if (!convert)
        return `I can't convert between ${UNIT_LABELS[from]} and ${UNIT_LABELS[to]} yet 🤔`;
      const result = convert(value);
      const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
      return `📐 ${value} ${UNIT_LABELS[from]} = ${formatted} ${UNIT_LABELS[to]}`;
    },
  },

  // ── Text Utilities ─────────────────────────────────────────────────────────

  // Reverse a string  e.g. reverse 'hello world'
  {
    pattern: /reverse\s+['"“](.+?)['"”]/i,
    handler(msg) {
      const m = msg.match(/reverse\s+['"“](.+?)['"”]/i);
      if (!m) return null;
      return `🔄 Reversed: "${[...m[1]].reverse().join("")}"`;
    },
  },

  // Word count  e.g. "word count 'hello there friend'", "how many words in 'foo bar'"
  {
    pattern: /(?:word count|count (?:the )?words?|how many words)\s*(?:in|of)?\s*['"“](.+?)['"”]/i,
    handler(msg) {
      const m = msg.match(
        /(?:word count|count (?:the )?words?|how many words)\s*(?:in|of)?\s*['"“](.+?)['"”]/i,
      );
      if (!m) return null;
      const text = m[1];
      const words = text.split(/\s+/).filter(Boolean).length;
      return `📝 "${text}" has ${words} word${words === 1 ? "" : "s"}.`;
    },
  },

  // Character count  e.g. "character count 'hello'", "how many characters in 'hello'"
  {
    pattern: /(?:char(?:acter)? count|how many characters)\s*(?:in|of)?\s*['"“](.+?)['"”]/i,
    handler(msg) {
      const m = msg.match(
        /(?:char(?:acter)? count|how many characters)\s*(?:in|of)?\s*['"“](.+?)['"”]/i,
      );
      if (!m) return null;
      const text = m[1];
      return `📝 "${text}" has ${text.length} characters.`;
    },
  },

  // Case conversion  e.g. "uppercase 'hello'", "lowercase 'HELLO'", "capitalize 'hello world'"
  {
    pattern: /(uppercase|lowercase|capitalize)\s+['"“](.+?)['"”]/i,
    handler(msg) {
      const m = msg.match(/(uppercase|lowercase|capitalize)\s+['"“](.+?)['"”]/i);
      if (!m) return null;
      const op = m[1].toLowerCase();
      const text = m[2];
      const result =
        op === "uppercase"
          ? text.toUpperCase()
          : op === "lowercase"
            ? text.toLowerCase()
            : text.replace(/\b\w/g, (c) => c.toUpperCase());
      return `🔤 "${text}" → "${result}"`;
    },
  },

  // Palindrome check  e.g. "is 'racecar' a palindrome"
  {
    pattern: /is\s+['"“](.+?)['"”]\s+a\s+palindrome|palindrome\s*(?:check)?\s*['"“](.+?)['"”]/i,
    handler(msg) {
      const m =
        msg.match(/is\s+['"“](.+?)['"”]\s+a\s+palindrome/i) ||
        msg.match(/palindrome\s*(?:check)?\s*['"“](.+?)['"”]/i);
      if (!m) return null;
      const original = m[1] ?? m[2];
      const cleaned = original.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isPalindrome = cleaned === [...cleaned].reverse().join("");
      return `${isPalindrome ? "✅ Yes" : "❌ No"}, "${original}" is ${isPalindrome ? "" : "NOT "}a palindrome.`;
    },
  },

  // ── Greetings & Smalltalk ──────────────────────────────────────────────────
  // (kept last so specific commands like "reverse 'hello world'" match first)
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
  {
    pattern: /\b(fun fact|random fact|tell me a fact|did you know)\b/i,
    responses: [
      "🐙 Octopuses have three hearts and blue blood!",
      "🍯 Honey never spoils — archaeologists have found edible honey in ancient Egyptian tombs.",
      "🚀 A day on Venus is longer than its year.",
      "🧠 The human brain uses about 20% of the body's energy.",
      "🍌 Bananas are berries, but strawberries aren't!",
      "🌊 More people have been to space than to the deepest part of the ocean.",
    ],
  },
  {
    pattern: /\b(help|what can you do|commands|capabilities)\b/i,
    responses: [
      `I can chat, tell jokes, share fun facts, give the time/date, do math (arithmetic, sqrt, factorial, LCM/GCD, percentages, averages, Fibonacci, binary/hex), convert units (km/mi, kg/lbs, °C/°F, m/ft), and play with text (reverse, word/char count, case conversion, palindrome checks). Just ask me anything! 🤖`,
    ],
  },

  // ── Compliments ─────────────────────────────────────────────────────────────
  {
    pattern: /\b(you'?re|you are)\s+(awesome|amazing|smart|great|the best|so cool|clever)\b/i,
    responses: [
      "Aww, thank you! 🥰 You're pretty great yourself.",
      "You're making me blush! 😊 (if bots could blush)",
      "Thanks! I do my best to be helpful. 🤖✨",
    ],
  },
  {
    pattern: /\b(good bot|nice bot)\b/i,
    responses: ["😊 Thank you!", "That means a lot! 🤖"],
  },

  // ── Mood Check-ins ─────────────────────────────────────────────────────────
  {
    pattern: /\b(i'?m|i am)\s+(sad|upset|down|depressed)\b/i,
    responses: [
      "I'm sorry you're feeling that way. 💙 Want to talk about it, or maybe hear a joke to lighten the mood?",
      "That sounds tough. I'm here if you want to chat about it. 🤗",
    ],
  },
  {
    pattern: /\b(i'?m|i am)\s+(happy|great|excited|good|awesome)\b/i,
    responses: [
      "That's wonderful to hear! 😄 What's got you feeling good?",
      "Love that energy! 🎉 Keep it up!",
    ],
  },
  {
    pattern: /\b(i'?m|i am)\s+(tired|exhausted|sleepy)\b/i,
    responses: [
      "Sounds like you need some rest. 😴 Don't forget to take breaks!",
      "Maybe it's time for a coffee break ☕ or an early night!",
    ],
  },
  {
    pattern: /\b(i'?m|i am)\s+(bored)\b/i,
    responses: [
      "Let's fix that! Want to hear a joke, a fun fact, or solve some math? 🎲",
      "Boredom, begone! Ask me for a joke or a fun fact. 😄",
    ],
  },
  {
    pattern: /\b(i'?m|i am)\s+(stressed|anxious|worried|nervous)\b/i,
    responses: [
      "Take a deep breath. 🌿 One thing at a time — I'm here if you want to talk it through.",
      "That's a lot to carry. Want to take a short break together? 🧘",
    ],
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
