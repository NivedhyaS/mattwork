import "dotenv/config";
import { askAI } from "./src/services/ai.service";

async function main() {
    const result = await askAI("Introduce yourself in one sentence.");
    console.log(result);
}

main().catch(console.error);