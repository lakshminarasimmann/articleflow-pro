const mongoose = require('mongoose');

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
    await mongoose.connect('mongodb://localhost:27017/articles_db');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const dbStats = await db.stats();
    
    console.log('\n📊 DATABASE INFO:');
    console.log(`   Database: ${db.databaseName}`);
    console.log(`   Collections: ${dbStats.collections}`);
    console.log(`   Data Size: ${Math.round(dbStats.dataSize / 1024)} KB`);
    
    const collections = await db.listCollections().toArray();
    console.log('\n📁 COLLECTIONS:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check articles with type breakdown
    const totalCount = await Article.countDocuments();
    const storylineCount = await Article.countDocuments({ type: 'storyline' });
    const otherTypesCount = await Article.countDocuments({ type: { $ne: 'storyline' } });
    
    console.log(`\n📄 ARTICLES ANALYSIS:`);
    console.log(`   Total articles: ${totalCount}`);
    console.log(`   ✅ Storyline articles: ${storylineCount}`);
    console.log(`   ❌ Other type articles: ${otherTypesCount}`);
    
    if (totalCount > 0) {
      // Show type distribution
      const typeStats = await Article.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\n📊 ARTICLE TYPES:');
      typeStats.forEach(stat => {
        console.log(`   ${stat._id || 'undefined'}: ${stat.count} articles`);
      });
      
      // Show recent storyline articles
      console.log('\n📝 RECENT STORYLINE ARTICLES:');
      const recentStoryline = await Article.find({ type: 'storyline' })
        .sort({ processedAt: -1 })
        .limit(10);
      
      recentStoryline.forEach((article, index) => {
        console.log(`   ${index + 1}. ID: ${article.id}`);
        console.log(`      Title: ${article.title}`);
        console.log(`      Type: ${article.type}`);
        console.log(`      Processed: ${article.processedAt}`);
        console.log('');
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
