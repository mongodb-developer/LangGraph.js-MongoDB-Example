import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import "dotenv/config";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

// All blog post URLs from itsthatlady.dev
const BLOG_POSTS = [
  { slug: "10-vibecoding-apps", title: "10 Vibe Coding Apps You've Never Heard Of (But Need To Try!)" },
  { slug: "free-ai-cert-courses", title: "5 FREE AI Courses to Level Up Your Skills" },
  { slug: "10-ai-projects-for-beginners", title: "10 Beginner AI Projects You Can Build" },
  { slug: "create-your-own-ai-animation", title: "How to Create your Own AI Animation" },
  { slug: "ai-agents-explained", title: "What are AI Agents?" },
  { slug: "learn-ml-from-scratch", title: "3 Steps to Learn Machine Learning in 2025" },
  { slug: "build-your-custom-linktree", title: "Build Your Own Custom Linktree with AI (FREE!)" },
  { slug: "what-is-a-prompt", title: "What is a Prompt (Really)? And Why It Matters for AI" },
  { slug: "ai-vs-ml", title: "AI versus Machine Learning: The Simplest Explanation" },
  { slug: "migrate-from-wordpress-to-astro", title: "How I Migrated from WordPress to Astro" },
  { slug: "free-ai-courses", title: "5 FREE Courses to Master AI & ML Skills" },
  { slug: "how-to-train-chatgpt-to-write-like-you", title: "How to Train ChatGPT to write like you" },
  { slug: "ruby-for-beginners-a-complete-schedule-and-installation-guide", title: "Ruby for Beginners: Your Complete Study And Installation Guide" },
  { slug: "best-programming-language", title: "What's the best Programming Language to Learn?" },
  { slug: "how-to-install-mongodb-on-m1-macs", title: "How to Install & Run MongoDB on M1 Macs" },
  { slug: "automate-macos-setup-with-a-brewfile", title: "Automate macOS setup with a brewfile" },
  { slug: "from-social-worker-to-software-engineer", title: "From Social Worker to Software Engineer 💃" },
  { slug: "coding-bootcamp", title: "My First Three Weeks at Coding Bootcamp as a PT Student" },
];

interface BlogPost {
  slug: string;
  title: string;
  url: string;
  excerpt: string;
  content: string;
  tags: string[];
  publishedDate: string;
}

async function fetchBlogPost(slug: string, title: string): Promise<BlogPost | null> {
  const url = `https://www.itsthatlady.dev/blog/${slug}/`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract content from HTML (basic extraction)
    // Remove script and style tags
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    
    // Extract text content from article/main content
    const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                         cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    
    let textContent = articleMatch ? articleMatch[1] : cleanHtml;
    
    // Remove HTML tags and clean up
    textContent = textContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract tags from the HTML
    const tagMatches = html.matchAll(/\/tags\/([^/"]+)/g);
    const tags = [...new Set([...tagMatches].map(m => m[1]))];
    
    // Extract date
    const dateMatch = html.match(/(\w{3}\s+\d{1,2},\s+\d{4})/);
    const publishedDate = dateMatch ? dateMatch[1] : "Unknown";
    
    // Extract meta description for excerpt
    const excerptMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) ||
                         html.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"/i);
    const excerpt = excerptMatch ? excerptMatch[1] : textContent.substring(0, 200) + "...";
    
    return {
      slug,
      title,
      url,
      excerpt,
      content: textContent.substring(0, 8000), // Limit content length
      tags,
      publishedDate,
    };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function fetchAllBlogPosts(): Promise<BlogPost[]> {
  console.log("Fetching blog posts from itsthatlady.dev...");
  
  const posts: BlogPost[] = [];
  
  for (const { slug, title } of BLOG_POSTS) {
    console.log(`Fetching: ${title}...`);
    const post = await fetchBlogPost(slug, title);
    if (post) {
      posts.push(post);
    }
    // Small delay to be respectful to the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`Successfully fetched ${posts.length} blog posts`);
  return posts;
}

function createBlogPostSummary(post: BlogPost): string {
  const basicInfo = `"${post.title}" by Kedasha Kerr`;
  const tags = post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : "";
  const date = `Published: ${post.publishedDate}`;
  
  return `${basicInfo}. ${date}. ${tags}. ${post.excerpt} Content: ${post.content}`;
}

async function seedDatabase(): Promise<void> {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("blog_database");
    const collection = db.collection("posts");

    await collection.deleteMany({});
    
    const blogPosts = await fetchAllBlogPosts();

    const recordsWithSummaries = blogPosts.map((post) => ({
      pageContent: createBlogPostSummary(post),
      metadata: {...post},
    }));
    
    for (const record of recordsWithSummaries) {
      await MongoDBAtlasVectorSearch.fromDocuments(
        [record],
        new OpenAIEmbeddings(),
        {
          collection,
          indexName: "vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
        }
      );

      console.log("Successfully processed & saved record:", record.metadata.slug);
    }

    console.log("Database seeding completed");

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.close();
  }
}

seedDatabase().catch(console.error);
