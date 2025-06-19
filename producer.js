const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');

const QUEUE = 'article_queue';
const ARTICLES_DIR = path.join(__dirname, 'articles');

async function main() {
  const conn = await amqp.connect('amqp://localhost:5672');
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });


  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles) {
        const message = JSON.stringify(article);
        channel.sendToQueue(QUEUE, Buffer.from(message), { persistent: true });
        console.log(`Published: ${article.id} - ${article.title}`);
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }

  await channel.close();
  await conn.close();
  console.log('All articles published.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
