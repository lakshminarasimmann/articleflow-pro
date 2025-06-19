const amqp = require('amqplib');
const mongoose = require('mongoose');

const QUEUE = 'article_queue';
const articleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  url: String,
  title: String,
  leadText: String,
  type: String,
  publishedDate: String,
  updatedDate: String,
  homeSection: String,
  homeSectionUrl: String,
  isPaywall: String,
  isSitemapCreated: Boolean,
  tags: [{ name: String, url: String }],
  keywords: [String],
  pushnotificationtitle: String,
  image: [{}],
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Article = mongoose.model('Article', articleSchema);

async function connectMongoDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/articles_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function verifyArticleStorage(articleId, title) {
  try {
    const savedArticle = await Article.findOne({ id: articleId });
    if (savedArticle) {
      console.log(`✅ VERIFIED: Article ${articleId} is stored in MongoDB`);
      console.log(`   Title: ${savedArticle.title}`);
      console.log(`   Saved at: ${savedArticle.processedAt}`);
      return true;
    } else {
      console.log(`❌ VERIFICATION FAILED: Article ${articleId} NOT found in MongoDB`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error verifying article ${articleId}:`, error.message);
    return false;
  }
}

async function getStorageStats() {
  try {
    const totalCount = await Article.countDocuments();
    const recentArticles = await Article.find().sort({ processedAt: -1 }).limit(5);
    
    console.log('\n📊 MONGODB STORAGE STATS:');
    console.log(`   Total articles stored: ${totalCount}`);
    console.log('   Recent articles:');
    
    recentArticles.forEach((article, index) => {
      console.log(`   ${index + 1}. ID: ${article.id} - ${article.title}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Error getting storage stats:', error.message);
  }
}

async function main() {
  // Connect to MongoDB with verification
  await connectMongoDB();
  
  // Show initial stats
  await getStorageStats();

  // Connect to RabbitMQ
  const conn = await amqp.connect('amqp://localhost:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(1);

  console.log('🚀 Consumer started. Waiting for articles...\n');

  let processedCount = 0;

  channel.consume(QUEUE, async (msg) => {
    if (msg !== null) {
      const article = JSON.parse(msg.content.toString());
      
      try {
        console.log(`📨 Processing article: ${article.id} - ${article.title}`);
        
        // Check if article already exists
        const existingArticle = await Article.findOne({ id: article.id });
        
        if (existingArticle) {
          console.log(`⏭️  Article ${article.id} already exists, skipping...`);
          channel.ack(msg);
          return;
        }
        
        // Save to MongoDB
        const newArticle = new Article(article);
        const savedArticle = await newArticle.save();
        
        processedCount++;
        console.log(`✅ Saved to MongoDB: ${article.id} - ${article.title}`);
        
        // Verify the save operation
        await verifyArticleStorage(article.id, article.title);
        
        // Show stats every 5 articles
        if (processedCount % 5 === 0) {
          await getStorageStats();
        }
        
        channel.ack(msg);
        
      } catch (error) {
        console.error(`❌ Error processing article ${article.id}:`, error.message);
        console.error('Full error:', error);
        
        // Don't requeue on error
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down consumer...');
  await getStorageStats();
  await mongoose.disconnect();
  process.exit(0);
});

main().catch(err => {
  console.error('❌ Consumer startup error:', err);
  process.exit(1);
});
