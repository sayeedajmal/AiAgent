import OpenAI from "openai";
import { configDotenv } from "dotenv";
import readlineSync from "readline-sync";

configDotenv();

const OPENAI_KEY = process.env.OPENAI_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_KEY,
});

function getWeatherDetails(city = "") {
  city = city.toLowerCase();
  if (city === "dubai") return "10°";
  if (city === "new york") return "20°";
  if (city === "london") return "30°";
  if (city === "paris") return "40°";
  if (city === "tokyo") return "50°";
  return "0°";
}

const tools = {
  getWeatherDetails,
};

const SYSTEM_PROMPT = `
You are an AI Assistant with START, PLAN, ACTION, OBSERVATION, and OUTPUT States.
Wait for the user prompt and first PLAN using available Tools.
After planning, take the ACTION with the appropriate Tools and wait for OBSERVATION based on Action.
Once you get the OBSERVATION, return the AI response based on START prompt and OBSERVATION.
Strictly follow the output format as a JSON object.

Available Tools:
  - function getWeatherDetails(city: Str): Str

Example:

START:
{"type": "user", "user": "what's the sum of weather of Dubai and New York?"}
{"type": "plan", "plan": "I will call getWeatherDetails for Dubai"}
{"type": "action", "function": "getWeatherDetails", "input": "Dubai"}
{"type": "observation", "observation": "10°"}
{"type": "plan", "plan": "I will call getWeatherDetails for New York"}
{"type": "action", "function": "getWeatherDetails", "input": "New York"}
{"type": "observation", "observation": "20°"}
{"type": "output", "output": "The sum of weather of Dubai and New York is 30°"}
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

async function chatLoop() {
  while (true) {
    const query = readlineSync.question(">> ");
    const userMsg = {
      type: "user",
      user: query,
    };

    messages.push({
      role: "user",
      content: JSON.stringify(userMsg),
    });

    while (true) {
      const chat = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        response_format: { type: "json_object" },
      });

      const result = chat.choices?.[0]?.message?.content?.trim();

      console.log("📦 AI CHAIN:", result);

      if (!result) break;

      messages.push({
        role: "assistant",
        content: result,
      });

      const parsed = JSON.parse(result);

      if (parsed.type === "output") {
        console.log("🤖 OUTPUT:", parsed.output);
        break;
      }

      if (parsed.type === "action") {
        const fn = tools[parsed.function];
        const observation = fn(parsed.input);

        const obsObj = {
          type: "observation",
          observation: observation,
        };

        messages.push({
          role: "developer",
          content: JSON.stringify(obsObj),
        });

        console.log("⚙️ ACTION:", `${parsed.function}("${parsed.input}")`);
      }

      if (parsed.type === "plan") {
        console.log("🧠 PLAN:", parsed.plan);
      }

      if (parsed.type === "observation") {
        console.log("👁️ OBSERVATION:", parsed.observation);
      }
    }
  }
}

chatLoop();