import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
// import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const model = new AzureChatOpenAI({ temperature: 1 });

let vectorStore;

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

async function loadHamsterStory(){
    const loader = new TextLoader("./public/flaskborne_game_story.txt");
    const docs = await loader.load();
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 150
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`I created ${splitDocs.length} text chunks`);
    vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
    await vectorStore.save("flaskborneVectordb")
    console.log('Vector store created');
}
async function askQuestion(prompt) {
    const relevantDocs = await vectorStore.similaritySearch(prompt, 11)
    console.log(relevantDocs[0].pageContent)
    const context = relevantDocs.map(doc => doc.pageContent).join("\n\n")
    console.log(`De context is: `, context)

    const response = await model.invoke([
        ["system", "You are an expert game storyteller AI. Based on the provided game story context, answer the user's question using only the context."],
        ["user", `the context is ${context} and the question is ${prompt}`]
    ])
    console.log(`De response is: `, response.content)
}


await loadHamsterStory();
await askQuestion("who are the members of the evil group the flaskborne")