const amqp = require('amqplib');

async function monitorQueue() {
  try {
    console.log('🔍 Connecting to RabbitMQ...');
    const conn = await amqp.connect('amqp://localhost:5672');
    const channel = await conn.createChannel();
    
    const queueInfo = await channel.checkQueue('article_queue');
    
    console.log('\n🔍 RABBITMQ QUEUE MONITOR');
    console.log('========================');
    console.log(`Queue Name: article_queue`);
    console.log(`Messages Ready: ${queueInfo.messageCount}`);
    console.log(`Active Consumers: ${queueInfo.consumerCount}`);
    console.log(`Last Check: ${new Date().toLocaleString()}`);
    
    if (queueInfo.messageCount === 0 && queueInfo.consumerCount === 0) {
      console.log('⚠️  Queue is empty and no consumers are running');
    } else if (queueInfo.messageCount > 0 && queueInfo.consumerCount === 0) {
      console.log('⚠️  Messages waiting but no consumers running!');
    } else if (queueInfo.messageCount === 0 && queueInfo.consumerCount > 0) {
      console.log('✅ All messages processed, consumer is waiting for storyline articles');
    } else {
      console.log('🔄 Storyline articles being processed');
    }
    
    await channel.close();
    await conn.close();
    
  } catch (error) {
    console.error('❌ Error monitoring queue:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure RabbitMQ is running: docker-compose up -d');
    }
  }
}

monitorQueue();
