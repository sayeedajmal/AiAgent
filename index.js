import OpenAI from "openai";
import { config as configDotenv } from "dotenv";
import readlineSync from "readline-sync";
import { exec } from "node:child_process";
import fs from "fs/promises";
import chalk from "chalk";

configDotenv();

const OPENAI_KEY = process.env.OPENAI_KEY;

const openai = new OpenAI({ apiKey: OPENAI_KEY });

async function readFile(path) {
  try {
    return await fs.readFile(path, "utf-8");
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

async function writeFile({ path, content }) {
  try {
    await fs.writeFile(path, content, "utf-8");
    return `✅ File written successfully to ${path}`;
  } catch (err) {
    return `Error writing file: ${err.message}`;
  }
}

async function appendFile({ path, content }) {
  try {
    await fs.appendFile(path, content, "utf-8");
    return `✅ Content appended successfully to ${path}`;
  } catch (err) {
    return `Error appending to file: ${err.message}`;
  }
}

function executeCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(`❌ Command error: ${error.message}`);
      } else {
        resolve(`📤 STDOUT:\n${stdout}\n📥 STDERR:\n${stderr}`);
      }
    });
  });
}

const tools = {
  readFile,
  writeFile,
  appendFile,
  executeCommand,
};

const SYSTEM_PROMPT = `
You are a Dev CLI AI Assistant with structured reasoning in START, PLAN, ACTION, OBSERVATION, and OUTPUT format.
Your responses MUST be in JSON format — every output must strictly follow the JSON object structure.

Available Tools (you must call them using ACTION):
- function readFile(path: Str): Str
- function writeFile({ path: Str, content: Str }): Str
- function appendFile({ path: Str, content: Str }): Str
- function executeCommand(command: Str): Str

Example:
START:
{"type":"user","user":"create a file index.js with console.log"}
{"type":"plan","plan":"I will use writeFile to create index.js"}
{"type":"action","function":"writeFile","input":{"path":"index.js","content":"console.log('Hello World')"}}
{"type":"observation","observation":"✅ File written successfully to index.js"}
{"type":"output","output":"File created successfully."}
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

async function chatLoop() {
  console.log(chalk.greenBright("🧠 Cursor AI CLI ready!"));

  while (true) {
    const query = readlineSync.question(chalk.cyan(">> "));

    messages.push({
      role: "user",
      content: JSON.stringify({ type: "user", user: query }),
    });

    while (true) {
      const chat = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        response_format: { type: "json_object" },
      });

      const result = chat.choices?.[0]?.message?.content?.trim();
      if (!result) break;

      console.log(chalk.gray("📦 AI CHAIN:"), result);
      messages.push({ role: "assistant", content: result });

      const parsed = JSON.parse(result);

      if (parsed.type === "output") {
        console.log(chalk.yellowBright("🤖 OUTPUT:"), parsed.output);
        break;
      }

      if (parsed.type === "plan") {
        console.log(chalk.magentaBright("🧠 PLAN:"), parsed.plan);
      }

      if (parsed.type === "action") {
        const fn = tools[parsed.function];
        if (!fn) {
          console.log(chalk.red(`❌ Unknown function: ${parsed.function}`));
          break;
        }

        const input = parsed.input;
        const observation = await fn(input);

        messages.push({
          role: "developer",
          content: JSON.stringify({
            type: "observation",
            observation,
          }),
        });

        console.log(chalk.blueBright(`⚙️ ACTION:`), `${parsed.function}(${JSON.stringify(input)})`);
      }

      if (parsed.type === "observation") {
        console.log(chalk.green("👁️ OBSERVATION:"), parsed.observation);
      }
    }
  }
}

chatLoop();
