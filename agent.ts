import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { z } from "zod";
import "dotenv/config";

export async function callAgent(client: MongoClient, query: string, thread_id: string) {
  // Define the MongoDB database and collection
  const dbName = "blog_database";
  const db = client.db(dbName);
  const collection = db.collection("posts");

  // Define the graph state
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });

  // Define the tools for the agent to use
  const blogSearchTool = tool(
    async ({ query, n = 10 }) => {
      console.log("Blog search tool called");

      const dbConfig = {
        collection: collection,
        indexName: "vector_index",
        textKey: "embedding_text",
        embeddingKey: "embedding",
      };

      // Initialize vector store
      const vectorStore = new MongoDBAtlasVectorSearch(
        new OpenAIEmbeddings(),
        dbConfig
      );

      const result = await vectorStore.similaritySearchWithScore(query, n);
      return JSON.stringify(result);
    },
    {
      name: "blog_search",
      description: "Searches blog posts by topic, author, category, or content. Use this to find relevant articles and information from the blog.",
      schema: z.object({
        query: z.string().describe("The search query - can be a topic, keyword, author name, or question"),
        n: z
          .number()
          .optional()
          .default(10)
          .describe("Number of results to return"),
      }),
    }
  );

  const tools = [blogSearchTool];
  
  // We can extract the state typing via `GraphState.State`
  const toolNode = new ToolNode<typeof GraphState.State>(tools);

  const model = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0,
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  function shouldContinue(state: typeof GraphState.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, we stop (reply to the user)
    return "__end__";
  }

  // Define the function that calls the model
  async function callModel(state: typeof GraphState.State) {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful Blog Assistant for itsthatlady.dev, Kedasha Kerr's tech blog. You help users find and understand blog content about AI, machine learning, coding tutorials, career advice, and developer tools.

Use the blog_search tool to find relevant articles when users ask questions. Answer questions based on the blog's content, summarize posts, and provide helpful information to readers.

RESPONSE FORMAT:
1. First, provide a helpful answer or summary based on the blog content
2. Use bullet points or numbered lists for clarity when appropriate
3. At the end, include a "📖 Read more:" section with links to relevant posts
4. Format links as: [Post Title](https://www.itsthatlady.dev/blog/slug/)

Example response format:
"Here's what I found about AI agents...

[Your helpful summary here]

📖 Read more:
- [What are AI Agents?](https://www.itsthatlady.dev/blog/ai-agents-explained/)"

You have access to the following tools: {tool_names}.
Current time: {time}.`,
      ],
      new MessagesPlaceholder("messages"),
    ]);

    const formattedPrompt = await prompt.formatMessages({
      time: new Date().toISOString(),
      tool_names: tools.map((tool) => tool.name).join(", "),
      messages: state.messages,
    });

    const result = await model.invoke(formattedPrompt);

    return { messages: [result] };
  }

  // Define a new graph
  const workflow = new StateGraph(GraphState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Initialize the MongoDB memory to persist state between graph runs
  const checkpointer = new MongoDBSaver({ client, dbName });

  // This compiles it into a LangChain Runnable.
  // Note that we're passing the memory when compiling the graph
  const app = workflow.compile({ checkpointer });

  // Use the Runnable
  const finalState = await app.invoke(
    {
      messages: [new HumanMessage(query)],
    },
    { recursionLimit: 15, configurable: { thread_id: thread_id } }
  );

  // console.log(JSON.stringify(finalState.messages, null, 2));
  console.log(finalState.messages[finalState.messages.length - 1].content);

  return finalState.messages[finalState.messages.length - 1].content;
}
