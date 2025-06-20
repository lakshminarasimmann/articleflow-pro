const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');

const QUEUE = 'article_queue';
const ARTICLES_DIR = path.join(__dirname, 'articles');

async function checkQueueStatus(channel) {
  try {
    const queueInfo = await channel.checkQueue(QUEUE);
    console.log(`📊 QUEUE STATUS:`);
    console.log(`   Queue: ${QUEUE}`);
    console.log(`   Messages in queue: ${queueInfo.messageCount}`);
    console.log(`   Consumers: ${queueInfo.consumerCount}`);
    return queueInfo;
  } catch (error) {
    console.error('❌ Error checking queue:', error.message);
    return null;
  }
}

function isStorylineArticle(article) {
  return article.type && article.type.toLowerCase() === 'storyline';
}

async function main() {
  // Connect to RabbitMQ
  const conn = await amqp.connect('amqp://localhost:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  // Check initial queue status
  console.log('🔍 Initial queue status:');
  await checkQueueStatus(channel);

  // Get all JSON files in sorted order for FIFO
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`\n📁 Found ${files.length} JSON files to process...`);

  let totalArticles = 0;
  let storylineArticles = 0;
  let skippedArticles = 0;
  let processedFiles = 0;

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    
    try {
      console.log(`\n📖 Processing file: ${file}`);
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);

      if (data.articles && Array.isArray(data.articles)) {
        console.log(`   Found ${data.articles.length} articles in ${file}`);
        
        for (const article of data.articles) {
          totalArticles++;
          
          // Check if article type is "storyline"
          if (isStorylineArticle(article)) {
            const message = JSON.stringify(article);
            channel.sendToQueue(QUEUE, Buffer.from(message), { persistent: true });
            storylineArticles++;
            console.log(`   ✅ QUEUED: ${article.id} - ${article.title} (type: ${article.type})`);
          } else {
            skippedArticles++;
            console.log(`   ⏭️  SKIPPED: ${article.id} - ${article.title} (type: ${article.type || 'undefined'}) - Not storyline`);
          }
          
          // Small delay to maintain FIFO order
          await new Promise(res => setTimeout(res, 50));
        }
      } else {
        console.log(`   ⚠️  No articles array found in ${file}`);
      }
      
      processedFiles++;
      
      // Show progress every 5 files
      if (processedFiles % 5 === 0) {
        console.log(`\n📊 PROGRESS UPDATE:`);
        console.log(`   Files processed: ${processedFiles}/${files.length}`);
        console.log(`   Total articles found: ${totalArticles}`);
        console.log(`   Storyline articles queued: ${storylineArticles}`);
        console.log(`   Non-storyline articles skipped: ${skippedArticles}`);
        await checkQueueStatus(channel);
      }
      
    } catch (error) {
      console.error(`❌ Error processing file ${file}:`, error.message);
    }
  }

  // Final summary
  console.log(`\n🎉 PROCESSING COMPLETE!`);
  console.log(`📊 FINAL SUMMARY:`);
  console.log(`   Files processed: ${processedFiles}`);
  console.log(`   Total articles found: ${totalArticles}`);
  console.log(`   ✅ Storyline articles queued: ${storylineArticles}`);
  console.log(`   ⏭️  Non-storyline articles skipped: ${skippedArticles}`);
  console.log(`   📈 Success rate: ${totalArticles > 0 ? ((storylineArticles / totalArticles) * 100).toFixed(1) : 0}% storyline articles`);

  // Final queue status
  console.log('\n🔍 Final queue status:');
  await checkQueueStatus(channel);

  await channel.close();
  await conn.close();
}

main().catch(err => {
  console.error('❌ Producer error:', err);
  process.exit(1);
});
