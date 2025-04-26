import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import express from "express";
import cors from "cors";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function fetchSimilarGames(gameName) {
    const apiKey = process.env.API_KEY;
    const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(data);

        const topGames = data.results.slice(0, 3).map(g => `- ${g.name} (${g.released})`).join("\n");
        return `These are similar games:\n${topGames}`;
    } catch (error) {
        console.error(error);
        throw new Error("Er is een fout opgetreden bij het ophalen van vergelijkbare games.");
    }
}

async function fetchWeather({location}) {
    console.log("Location received:", location);
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=nl`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(data);

        if (data.cod !== 200) {
            throw new Error(`De stad "${location}" werd niet gevonden of er is een fout (${data.message}).`);
        }

        const weather = data.weather[0].description;
        const temperature = data.main.temp;
        const city = data.name;

        return `Het weer in ${city} is momenteel ${weather} met een temperatuur van ${temperature}°C.`;
    } catch (error) {
        console.error(error);
        throw new Error("Er is een fout opgetreden bij het ophalen van het weer.");
    }
}

function multiplyFunction({ a, b }) {
    return a * b;
}

const gameTool = tool(fetchSimilarGames, {
    name: 'fetchSimilarGames',
    description: 'Fetches similar games based on a given game name.',
    schema: {
        type: "object",
        properties: {
            gameName: { type: "string" }
        },
        required: ["gameName"]
    }
});

const weatherTool = tool(fetchWeather, {
    name: 'fetchWeather',
    description: 'Fetches the current weather for a given city.',
    schema: {
        type: "object",
        properties: {
            location: { type: "string" }
        },
        required: ["location"]
    }
});

const model = new AzureChatOpenAI({
    temperature: 0.8
}).bindTools([gameTool, weatherTool]);

console.log(process.env.AZURE_OPENAI_API_KEY);
console.log(process.env.API_KEY);

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

let vectorStore = await FaissStore.load("flaskborneVectordb", embeddings);

app.get('/', async (req, res) => {
    const result = await tellJoke();
    res.json({ message: result });
});

async function createPrompt(messages) {
    const result = await model.invoke(messages);
    return result.content;
}

async function sendPrompt(prompt, messages) {
    const chatWithContext = [
        new SystemMessage(`You are a helpful assistant. You can use the fetchSimilarGames tool to fetch similar games and the fetchWeather tool to get weather information.`),
        ...messages,
        new HumanMessage(prompt)
    ];

    const result = await model.invoke(chatWithContext);
    messages.push(result);

    if (result.tool_calls && result.tool_calls.length > 0) {
        console.log("Tool calls detected, executing them...");
        const tools = [gameTool, weatherTool];
        const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

        for (const toolCall of result.tool_calls) {
            const selectedTool = toolsByName[toolCall.name];
            const toolInput = toolCall.args;

            console.log("Tool input:", toolInput);  // Debugging line to check the input passed to the tool

            try {
                const toolResult = await selectedTool.invoke(toolInput);
                messages.push(new ToolMessage(toolResult, toolCall.id));
            } catch (error) {
                console.error(`Tool call error:`, error);
                messages.push(new ToolMessage(`Fout bij tool: ${error.message}`, toolCall.id));
            }
        }

        const finalResponse = await model.invoke(messages);
        return finalResponse.content;
    }

    return result.content;
}

async function tellJoke() {
    const joke = await model.invoke("Tell me a Javascript joke!");
    return joke.content;
}

app.post('/ask', async (req, res) => {
    const { prompt, messages } = req.body;

    if (!prompt || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Prompt of messages ontbreken." });
    }

    try {
        await sendPrompt(prompt, messages);
        const stream = await model.stream(messages);


        res.setHeader("Content-Type", "text/plain");

        for await (const chunk of stream) {
            res.write(chunk.content);
        }

        res.end();
    } catch (error) {
        console.error("Streaming error:", error);
        res.status(500).send("Fout tijdens streamen.");
    }
});

app.listen(3000, () => console.log("Luistert naar port 3000"));
