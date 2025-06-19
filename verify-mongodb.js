const mongoose = require('mongoose');

// Same schema as consumer
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

async function verifyMongoDB() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/articles_db');
    console.log('✅ Connected to MongoDB');
    
    // Get database info
    const db = mongoose.connection.db;
    const admin = db.admin();
    const dbStats = await db.stats();
    
    console.log('\n📊 DATABASE INFO:');
    console.log(`   Database: ${db.databaseName}`);
    console.log(`   Collections: ${dbStats.collections}`);
    console.log(`   Data Size: ${Math.round(dbStats.dataSize / 1024)} KB`);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📁 COLLECTIONS:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check articles collection specifically
    const articleCount = await Article.countDocuments();
    console.log(`\n📄 ARTICLES COLLECTION:`);
    console.log(`   Total articles: ${articleCount}`);
    
    if (articleCount > 0) {
      console.log('\n📝 SAMPLE ARTICLES:');
      const sampleArticles = await Article.find().limit(10);
      sampleArticles.forEach((article, index) => {
        console.log(`   ${index + 1}. ID: ${article.id}`);
        console.log(`      Title: ${article.title}`);
        console.log(`      Processed: ${article.processedAt}`);
        console.log('');
      });
      
      // Show articles by processing date
      console.log('📅 ARTICLES BY DATE:');
      const articlesByDate = await Article.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$processedAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": -1 } }
      ]);
      
      articlesByDate.forEach(group => {
        console.log(`   ${group._id}: ${group.count} articles`);
      });
    } else {
      console.log('   ⚠️  No articles found in database');
    }
    
  } catch (error) {
    console.error('❌ Error verifying MongoDB:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Verification complete');
  }
}

verifyMongoDB();
