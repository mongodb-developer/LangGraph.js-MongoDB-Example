
# TLD Blog Agent

This repository demonstrates how to use LangGraph with MongoDB for building the TLD Blog Agent. It showcases the integration of language models, graph-based conversation management, and MongoDB for data persistence.

## Features

- Utilizes LangGraph for managing agentic conversational flows in TypeScript
- Integrates with MongoDB Atlas for storing and retrieving blog content
- Implements a RESTful API using Express.js for chat interactions
- Uses Anthropic's Claude for generating responses
- Includes a tool for blog post search using MongoDB Atlas vector search
- **Web-based chat interface** for easy interaction with the TLD Blog Agent

## Prerequisites

- [Node.js and npm](https://nodejs.org/)
- [MongoDB Atlas account](https://www.mongodb.com/cloud/atlas)
- [OpenAI API key](https://platform.openai.com/account/api-keys) (for embeddings)
- [Anthropic API key](https://www.anthropic.com/claude) (for chat)

## Installation

1. Clone this repository:

```bash
git clone https://github.com/mongodb-developer/LangGraph-MongoDB-Example.git 
cd LangGraph-MongoDB-Example
```

2. Install the required dependencies:

```bash
npm install
```

3. Set up your environment variables:
- Create a `.env` file in the root directory
- Add your API keys and MongoDB URI:
  
  ```
  OPENAI_API_KEY=your_openai_api_key_here
  ANTHROPIC_API_KEY=your_anthropic_api_key_here
  MONGODB_ATLAS_URI=your_mongodb_atlas_uri_here
  ```

## Seed the Database

1. Run the seed script to fetch blog posts and populate the database:

```bash
npm run seed
```

## Create Vector Search Index

After seeding the database, create a vector search index in MongoDB Atlas:

1. Go to **Database → Browse Collections → blog_database.posts**
2. Click **Search Indexes → Create Index**
3. Choose **JSON Editor** and use:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

4. Name the index `vector_index`

## Usage

1. Start the server:

```bash
npm run dev
```

2. Open the chat interface at **http://localhost:3000**

3. Or use the API endpoints directly:

- Start a new conversation:
  ```
  curl -X POST -H "Content-Type: application/json" -d '{"message": "What posts do you have about AI?"}' http://localhost:3000/chat
  ```
- Continue an existing conversation:
  ```
  curl -X POST -H "Content-Type: application/json" -d '{"message": "Tell me more about that"}' http://localhost:3000/chat/{threadId}
  ```

## Project Structure

- `index.ts`: Entry point of the application, sets up the Express server and API routes
- `agent.ts`: Defines the LangGraph agent, tools, and conversation flow
- `seed-database.ts`: Script for fetching blog posts and seeding them into MongoDB
- `public/index.html`: Web-based chat interface

## How it works

1. The seed script in `seed-database.ts` fetches blog posts from itsthatlady.dev and populates the MongoDB database with embeddings.
2. The LangGraph agent is defined in `agent.ts`, including the conversation graph structure and blog search tool.
3. MongoDB operations are integrated directly into the agent for storing and retrieving conversation data.
4. The Express server in `index.ts` provides API endpoints for starting and continuing conversations.
5. User inputs are processed through the LangGraph agent, which searches blog content and generates appropriate responses.
6. Conversation data is persisted in MongoDB Atlas, allowing for continuity across sessions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
