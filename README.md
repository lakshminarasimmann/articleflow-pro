 📰 Article Processing System

A simple yet powerful FIFO (First In, First Out) article processing system that reads JSON articles, queues them through RabbitMQ, and stores them in MongoDB. Built with love using Node.js for developers who need reliable article data processing[1][2].

 What This Does:

Imagine you have hundreds of article JSON files sitting in a folder, and you need to process them one by one in the exact order they were created, then store them safely in a database. That's exactly what this system does!

**The Journey of an Article:**
1. 📁 **JSON files** containing article data sit in the `articles/` folder
2. 🚀 **Producer** reads these files and sends each article to a message queue
3. 📬 **RabbitMQ** ensures articles are processed in perfect FIFO order
4. 🔄 **Consumer** picks up each article one by one
5. 💾 **MongoDB** stores the processed articles safely
6. ✅ **Verification** confirms everything worked perfectly

## 🛠️ Technology Stack

### **Node.js** - The Heart of Our System
We chose Node.js because it's perfect for I/O intensive operations like reading files and handling database connections. Its asynchronous nature means we can handle multiple articles efficiently without blocking operations.

### **RabbitMQ** - The Traffic Controller
Think of RabbitMQ as a smart postal service. It takes our articles and delivers them to the consumer in the exact order they were sent. No article gets lost, and if something goes wrong, it can retry delivery. The management UI at `http://localhost:15672` lets you peek into what's happening.

### **MongoDB** - The Safe Storage
MongoDB stores our articles as documents, which is perfect since our articles are already in JSON format. No complex table relationships needed - just simple, fast document storage that scales beautifully.

### **Docker** - The Easy Setup
Instead of installing RabbitMQ and MongoDB manually (which can be a nightmare), we use Docker containers. One command and everything is running perfectly.

## 📁 Project Structure

```
article-processor/
├── 📄 package.json          # Project dependencies and scripts
├── 🐳 docker-compose.yml    # Container setup for RabbitMQ & MongoDB
├── 🚀 producer.js           # Reads JSON files and queues articles
├── 🔄 consumer.js           # Processes queued articles to MongoDB
├── 🔍 verify-mongodb.js     # Checks if articles are stored correctly
├── 📊 queue-monitor.js      # Monitors RabbitMQ queue status
├── 📁 articles/             # Drop your JSON files here
│   ├── 60895087.json
│   ├── 60946141.json
│   └── ... (all your article files)
└── 📖 README.md             # You're reading this!
```

## 🚀 Quick Start Guide

### **Step 1: Get Everything Ready**
```bash
# Clone or create the project folder
mkdir article-processor && cd article-processor

# Install the magic
npm install
```

### **Step 2: Start the Infrastructure**
```bash
# This starts RabbitMQ and MongoDB in Docker containers
docker-compose up -d

# Check if they're running (you should see 2 containers)
docker ps
```

### **Step 3: Add Your Articles**
Drop all your JSON article files into the `articles/` folder. The system will process them in alphabetical order (which maintains FIFO if your files are named chronologically).

### **Step 4: Start Processing**

**Terminal 1 - Start the Consumer (the worker):**
```bash
npm run consumer
```
You'll see: `🚀 Consumer started. Waiting for articles...`

**Terminal 2 - Start the Producer (the feeder):**
```bash
npm run producer
```
Watch as it reads your files and sends articles to the queue!

### **Step 5: Verify Everything Worked**
```bash
# Check MongoDB storage
npm run verify

# Monitor RabbitMQ queue
npm run monitor
```

## 🔧 Available Commands

| Command | What It Does |
|---------|-------------|
| `npm run producer` | Reads JSON files and queues articles |
| `npm run consumer` | Processes queued articles to MongoDB |
| `npm run verify` | Shows what's stored in MongoDB |
| `npm run monitor` | Checks RabbitMQ queue status |

## 🌐 Web Interfaces

- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
  - See your queues, messages, and consumers in real-time
- **MongoDB**: mongodb://localhost:27017/articles_db
  - Connect with MongoDB Compass or any MongoDB client

## 🔍 How to Know It's Working

### **Good Signs:**
- ✅ Consumer shows: `✅ Saved to MongoDB: [article-id] - [title]`
- ✅ Producer shows: `✅ Published: [article-id] - [title]`
- ✅ RabbitMQ UI shows your queue with 1 consumer
- ✅ MongoDB verification shows your articles

### **If Something's Wrong:**
- ❌ Check Docker containers: `docker ps`
- ❌ Check RabbitMQ: http://localhost:15672
- ❌ Run verification: `npm run verify`
- ❌ Monitor queue: `npm run monitor`

## 🎯 FIFO Processing Explained

**Why FIFO Matters:**
If you have articles from different time periods, you want to process them in chronological order. Our system ensures:

1. **Producer** reads files in sorted order
2. **RabbitMQ** maintains message order with `prefetch(1)`
3. **Consumer** processes one article at a time
4. **MongoDB** stores them with processing timestamps

## 🛡️ Error Handling

The system is built to be robust:
- **Duplicate Prevention**: Won't store the same article twice
- **Connection Recovery**: Handles database/queue disconnections
- **Message Persistence**: Articles survive system restarts
- **Graceful Shutdown**: Clean exit with Ctrl+C

## 🔧 Customization

### **Change Database Name:**
Edit the MongoDB URL in `consumer.js`:
```javascript
await mongoose.connect('mongodb://localhost:27017/your_database_name');
```

### **Modify Article Schema:**
Update the schema in `consumer.js` to match your article structure.

### **Adjust Processing Speed:**
Add delays in the consumer for slower processing:
```javascript
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
```

## 🐛 Troubleshooting

### **"Queue is Empty" but Articles are in MongoDB**
This is actually **good news**! It means your system is working perfectly. The consumer is processing articles faster than they accumulate in the queue.

### **No Articles in MongoDB**
1. Check if consumer is running
2. Verify MongoDB connection
3. Run `npm run verify` to check database

### **RabbitMQ Connection Issues**
1. Ensure Docker containers are running: `docker ps`
2. Check RabbitMQ logs: `docker logs rabbitmq`

## 🎉 Success Story

When everything works, you'll see a beautiful flow:
1. 📁 JSON files → 🚀 Producer → 📬 RabbitMQ → 🔄 Consumer → 💾 MongoDB
2. Your articles processed in perfect order
3. Zero data loss
4. Complete audit trail

Built with ❤️ for reliable article processing. Happy coding! 🚀

---