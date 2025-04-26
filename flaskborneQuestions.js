// import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
//
// import { FaissStore } from "@langchain/community/vectorstores/faiss";
//
// const model = new AzureChatOpenAI({ temperature: 1 });
//
//
//
// const embeddings = new AzureOpenAIEmbeddings({
//     temperature: 0,
//     azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
// });
//
// let vectorStore = await FaissStore.load("flasborneVectordb", embeddings)
//
//
// async function askQuestion(prompt) {
//     const relevantDocs = await vectorStore.similaritySearch(prompt, 3)
//     console.log(relevantDocs[0].pageContent)
//     const context = relevantDocs.map(doc => doc.pageContent).join("\n\n")
//     console.log(context)
//
//     const response = await model.invoke([
//         ["system", "you will get a context an a question. Use only the context to answer the question"],
//         ["user", `the context is ${context} and the question is ${prompt}`]
//     ])
//     console.log(response.content)
// }
//
//
// await askQuestion("What are all of the characters")