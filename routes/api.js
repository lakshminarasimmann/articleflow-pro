const express = require('express');
const amqp = require('amqplib');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Article Schema
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

// Connect to MongoDB with retry
async function connectMongoDB() {
  const maxRetries = 5;
  const delay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoose.connect('mongodb://localhost:27017/articles_db', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ API connected to MongoDB');
      return;
    } catch (error) {
      console.log(`❌ MongoDB connection attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Initialize MongoDB connection
connectMongoDB().catch(console.error);

// RabbitMQ connection with retry
async function connectRabbitMQ() {
  const maxRetries = 5;
  const delay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const conn = await amqp.connect('amqp://guest:guest@localhost:5672');
      return conn;
    } catch (error) {
      console.log(`❌ RabbitMQ connection attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get system status
router.get('/status', async (req, res) => {
  try {
    // Check MongoDB
    const mongoStatus = mongoose.connection.readyState === 1;
    const articleCount = mongoStatus ? await Article.countDocuments() : 0;
    const storylineCount = mongoStatus ? await Article.countDocuments({ type: 'storyline' }) : 0;
    
    // Check RabbitMQ
    let rabbitStatus = false;
    let queueInfo = { messageCount: 0, consumerCount: 0 };
    
    try {
      const conn = await connectRabbitMQ();
      const channel = await conn.createChannel();
      await channel.assertQueue('article_queue', { durable: true });
      queueInfo = await channel.checkQueue('article_queue');
      rabbitStatus = true;
      await channel.close();
      await conn.close();
    } catch (error) {
      console.error('RabbitMQ status check failed:', error.message);
    }
    
    res.json({
      mongodb: {
        connected: mongoStatus,
        totalArticles: articleCount,
        storylineArticles: storylineCount
      },
      rabbitmq: {
        connected: rabbitStatus,
        messagesInQueue: queueInfo.messageCount,
        activeConsumers: queueInfo.consumerCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get articles with pagination
router.get('/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const articles = await Article.find()
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Article.countDocuments();
    
    res.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add single article
router.post('/article', async (req, res) => {
  try {
    const articleData = req.body;
    
    // Validate required fields
    if (!articleData.id || !articleData.title || !articleData.type) {
      return res.status(400).json({ error: 'Missing required fields: id, title, type' });
    }
    
    // Check if storyline type
    if (articleData.type.toLowerCase() !== 'storyline') {
      return res.status(400).json({ error: 'Only storyline articles are accepted' });
    }
    
    // Send to RabbitMQ
    const conn = await connectRabbitMQ();
    const channel = await conn.createChannel();
    await channel.assertQueue('article_queue', { durable: true });
    
    const message = JSON.stringify(articleData);
    channel.sendToQueue('article_queue', Buffer.from(message), { persistent: true });
    
    await channel.close();
    await conn.close();
    
    // Emit real-time update
    req.io.emit('articleQueued', {
      id: articleData.id,
      title: articleData.title,
      type: articleData.type,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Article queued for processing' });
    
  } catch (error) {
    console.error('Add article error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload JSON file
router.post('/upload', upload.single('jsonFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    // Connect to RabbitMQ
    const conn = await connectRabbitMQ();
    const channel = await conn.createChannel();
    await channel.assertQueue('article_queue', { durable: true });
    
    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles) {
        if (article.type && article.type.toLowerCase() === 'storyline') {
          const message = JSON.stringify(article);
          channel.sendToQueue('article_queue', Buffer.from(message), { persistent: true });
          processedCount++;
          
          // Emit real-time update
          req.io.emit('articleQueued', {
            id: article.id,
            title: article.title,
            type: article.type,
            timestamp: new Date().toISOString()
          });
        } else {
          skippedCount++;
        }
      }
    }
    
    await channel.close();
    await conn.close();
    
    // Clean up uploaded file
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      message: `${processedCount} storyline articles queued, ${skippedCount} non-storyline articles skipped`
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get article statistics
router.get('/stats', async (req, res) => {
  try {
    const totalArticles = await Article.countDocuments();
    const storylineArticles = await Article.countDocuments({ type: 'storyline' });
    
    const typeStats = await Article.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const dailyStats = await Article.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$processedAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": -1 } },
      { $limit: 7 }
    ]);
    
    res.json({
      total: totalArticles,
      storyline: storylineArticles,
      typeDistribution: typeStats,
      dailyProcessing: dailyStats
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
