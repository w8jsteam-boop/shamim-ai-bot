import TelegramBot from "node-telegram-bot-api";
import { GoogleGenAI } from "@google/genai";

// ===============================
// Environment Variables
// ===============================
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing");
}

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

// ===============================
// Gemini AI
// ===============================
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

// ===============================
// Telegram Bot
// ===============================
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

// User conversation history
const userChats = new Map();

// ===============================
// Welcome Message
// ===============================
const welcomeMessage = `
🤖 *Shamim AI Assistant*

আমি Shamim Team দ্বারা পরিচালিত একটি Telegram Chat Bot।

তুমি আমাকে বাংলা বা ইংরেজিতে যেকোনো প্রশ্ন করতে পারো।

*Commands:*
/start - বট শুরু
/help - সাহায্য
/about - বট সম্পর্কে
/clear - কথোপকথন পরিষ্কার
/id - Telegram ID

এখন তোমার প্রশ্ন পাঠাও।
`;

// ===============================
// /start
// ===============================
bot.onText(/^\/start$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    welcomeMessage,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💬 Start Chat",
              callback_data: "start_chat"
            }
          ],
          [
            {
              text: "ℹ️ About",
              callback_data: "about"
            },
            {
              text: "🆘 Help",
              callback_data: "help"
            }
          ],
          [
            {
              text: "🗑 Clear Chat",
              callback_data: "clear_chat"
            }
          ]
        ]
      }
    }
  );
});

// ===============================
// /help
// ===============================
bot.onText(/^\/help$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `
*Help*

সাধারণ মেসেজ পাঠালে Gemini AI উত্তর দেবে।

/start - বট শুরু
/help - সাহায্য
/about - বট সম্পর্কে
/clear - আগের কথোপকথন পরিষ্কার
/id - নিজের Telegram ID দেখা
`,
    { parse_mode: "Markdown" }
  );
});

// ===============================
// /about
// ===============================
bot.onText(/^\/about$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `
*Shamim AI Assistant*

Powered by Gemini AI

বাংলা ও ইংরেজি ভাষায় চ্যাট করা যায়।

তোমার মেসেজের উত্তর AI তৈরি করে।
`,
    { parse_mode: "Markdown" }
  );
});

// ===============================
// /id
// ===============================
bot.onText(/^\/id$/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `তোমার Telegram ID: \`${msg.from.id}\``,
    { parse_mode: "Markdown" }
  );
});

// ===============================
// /clear
// ===============================
bot.onText(/^\/clear$/, async (msg) => {
  userChats.delete(msg.from.id);

  await bot.sendMessage(
    msg.chat.id,
    "তোমার আগের কথোপকথন পরিষ্কার করা হয়েছে।"
  );
});

// ===============================
// Button Handler
// ===============================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (data === "start_chat") {
    await bot.answerCallbackQuery(query.id);

    await bot.sendMessage(
      chatId,
      "ঠিক আছে। এখন তোমার প্রশ্ন পাঠাও।"
    );
  }

  if (data === "about") {
    await bot.answerCallbackQuery(query.id);

    await bot.sendMessage(
      chatId,
      "*Shamim AI Assistant*\n\nPowered by Gemini AI",
      { parse_mode: "Markdown" }
    );
  }

  if (data === "help") {
    await bot.answerCallbackQuery(query.id);

    await bot.sendMessage(
      chatId,
      "সাধারণ মেসেজ পাঠালে AI উত্তর দেবে।\n\n/clear - Chat পরিষ্কার"
    );
  }

  if (data === "clear_chat") {
    userChats.delete(userId);

    await bot.answerCallbackQuery(query.id, {
      text: "Chat cleared"
    });

    await bot.sendMessage(
      chatId,
      "আগের কথোপকথন পরিষ্কার করা হয়েছে।"
    );
  }
});

// ===============================
// AI Chat
// ===============================
bot.on("message", async (msg) => {
  if (!msg.text) return;

  // Commands skip
  if (msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = msg.text;

  try {
    await bot.sendChatAction(chatId, "typing");

    // Get previous history
    let history = userChats.get(userId) || [];

    // Keep last 10 messages
    history = history.slice(-10);

    const contents = [
      ...history,
      {
        role: "user",
        parts: [
          {
            text: userMessage
          }
        ]
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction:
          "You are Shamim AI Assistant. Reply helpfully in the same language as the user. If the user writes Bengali, reply in Bengali. If the user writes English, reply in English. Be concise and friendly.",
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });

    const reply =
      response.text ||
      "দুঃখিত, এই মুহূর্তে কোনো উত্তর তৈরি করা যায়নি।";

    // Save conversation
    history.push(
      {
        role: "user",
        parts: [
          {
            text: userMessage
          }
        ]
      },
      {
        role: "model",
        parts: [
          {
            text: reply
          }
        ]
      }
    );

    userChats.set(userId, history.slice(-10));

    await bot.sendMessage(chatId, reply);

  } catch (error) {
    console.error("AI Error:", error.message);

    await bot.sendMessage(
      chatId,
      "দুঃখিত, AI-এর সাথে যোগাযোগ করতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করো।"
    );
  }
});

// ===============================
// Bot Status
// ===============================
bot.getMe().then((me) => {
  console.log(`Bot started: @${me.username}`);
});

console.log("Shamim AI Bot is running...");
