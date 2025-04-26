import { AzureChatOpenAI, AzureOpenAIEmbeddings,  } from "@langchain/openai";
import {HumanMessage, AIMessage, SystemMessage, ToolMessage} from "@langchain/core/messages";
import express from "express";
import cors from "cors";

import {tool} from "@langchain/core/tools";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function multiplyFunction ({a,b}) {
    return a * b
}
const multiply = tool(multiplyFunction, {
    name: "multiply",
    description: "this is a tool that cna multiply two numbers, use this when the user asks to multiply two numbers",
    schema: {
        type: "object",
        properties: {
            a: {type:"number"},
            b: {type:"number"}
        }
    }
})
let test = await multiply.invoke({a:4, b:12})
console.log(test)
const messages = [
    new SystemMessage({ content: "You are a pokemon trainer. All the pokemon in the apiData are able to be on your team. Please create the best counterteam for the message." })
];
const model = new AzureChatOpenAI({
    temperature: 0.2,
}).bindTools([multiply]);

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0.2,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME,
});



async function createJoke() {
    const result = await model.invoke("tell me a javascript joke");
    return result.content;
}

async function sendPrompt(prompt) {
    const tools = [multiply]
    const toolsByName = Object.fromEntries(tools.map(tool => [tool.name, tool]))
    messages.push(new HumanMessage(prompt))
    const result = await model.invoke(messages);
    messages.push(new AIMessage(result.content))
    console.log(messages);
    console.log(result)
    console.log(`Het taalmodel wil ${result.tool_calls.length} tool calls uitvoeren`)

    for (let call of result.tool_calls) {
        const selectedTools = toolsByName[call.name]
        console.log(`now trynna call ${call.name}`)
        const toolResult = await selectedTools.invoke(call)
        messages.push(toolResult)
    }
    return result.content;

}

// async function sendPrompt(prompt) {
//     const relevantDocs = await vectorStore.similaritySearch(prompt, 60);
//     console.log(relevantDocs[0].pageContent);
//     const context = relevantDocs.map((doc) => doc.pageContent).join("\n");
//     console.log(context)
//     //chat
//     const response = await model.invoke([
//         ["system", "You are a movie expert. You know everything about movies. You will receive the context for the movie and a question. Answer the question based on the context."],
//         ["user", `The context is ${context}, the question is ${prompt}`]
//     ]);
//     return response.content
// }

app.get("/joke", async (req, res) => {
    let joke = await createJoke();
    res.json({ message: joke });
});

app.post("/ask", async (req, res) => {
    let prompt = req.body.prompt;
    console.log("the user asked for");
    console.log(prompt);
    let result = await sendPrompt(prompt);
    console.log(result);
    res.json({ message: result });
});

app.listen(3000, () => console.log("server op poort 3000"));