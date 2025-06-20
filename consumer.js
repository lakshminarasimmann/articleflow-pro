const amqp = require('amqplib');
const mongoose = require('mongoose');

const QUEUE = 'article_queue';

// Define Article schema - only for storyline articles
const articleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  url: String,
  title: String,
  leadText: String,
  type: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return v && v.toLowerCase() === 'storyline';
      },
      message: 'Article type must be "storyline"'
    }
  },
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

async function verifyArticleStorage(articleId, title, type) {
  try {
    const savedArticle = await Article.findOne({ id: articleId });
    if (savedArticle) {
      console.log(`✅ VERIFIED: Article ${articleId} stored in MongoDB`);
      console.log(`   Title: ${savedArticle.title}`);
      console.log(`   Type: ${savedArticle.type}`);
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
    const storylineCount = await Article.countDocuments({ type: 'storyline' });
    const recentArticles = await Article.find().sort({ processedAt: -1 }).limit(5);
    
    console.log('\n📊 MONGODB STORAGE STATS:');
    console.log(`   Total articles stored: ${totalCount}`);
    console.log(`   Storyline articles: ${storylineCount}`);
    console.log('   Recent articles:');
    
    recentArticles.forEach((article, index) => {
      console.log(`   ${index + 1}. ID: ${article.id} - ${article.title} (${article.type})`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Error getting storage stats:', error.message);
  }
}

function isValidStorylineArticle(article) {
  return article.type && article.type.toLowerCase() === 'storyline';
}

async function main() {
  await connectMongoDB();
  await getStorageStats();

  // Connect to RabbitMQ
  const conn = await amqp.connect('amqp://localhost:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(1);

  console.log('🚀 Consumer started. Waiting for STORYLINE articles only...\n');

  let processedCount = 0;
  let skippedCount = 0;

  channel.consume(QUEUE, async (msg) => {
    if (msg !== null) {
      const article = JSON.parse(msg.content.toString());
      
      try {
        console.log(`📨 Received: ${article.id} - ${article.title} (type: ${article.type})`);
        
        // Double-check article type (safety measure)
        if (!isValidStorylineArticle(article)) {
          console.log(`❌ REJECTED: Article ${article.id} is not storyline type`);
          skippedCount++;
          channel.ack(msg); // Acknowledge but don't process
          return;
        }
        
        // Check if article already exists
        const existingArticle = await Article.findOne({ id: article.id });
        
        if (existingArticle) {
          console.log(`⏭️  Article ${article.id} already exists, skipping...`);
          channel.ack(msg);
          return;
        }
        
        // Save storyline article to MongoDB
        const newArticle = new Article(article);
        const savedArticle = await newArticle.save();
        
        processedCount++;
        console.log(`✅ SAVED: ${article.id} - ${article.title} (storyline)`);
        
        // Verify the save operation
        await verifyArticleStorage(article.id, article.title, article.type);
        
        // Show stats every 5 articles
        if (processedCount % 5 === 0) {
          console.log(`📊 PROCESSING STATS: ${processedCount} storyline articles processed, ${skippedCount} non-storyline skipped`);
          await getStorageStats();
        }
        
        channel.ack(msg);
        
      } catch (error) {
        console.error(`❌ Error processing article ${article.id}:`, error.message);
        
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
