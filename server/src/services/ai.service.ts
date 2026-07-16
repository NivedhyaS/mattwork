import { ai } from "../config/ai";

export async function askAI(prompt: string) {
    const response = await ai.chat.completions.create({
        model: "nvidia/nemotron-3-ultra-550b-a55b",
        messages: [
            {
                role: "system",
                content: "You are Mattwork's AI Project Manager."
            },
            {
                role: "user",
                content: prompt
            }
        ]
    });

    return response.choices[0].message.content;
}