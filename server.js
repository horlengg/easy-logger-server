const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { randomUUID } = require('crypto');
const fs = require('fs');
const FileUtil = require('./file-util');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let logs = [
  {
    id: randomUUID(),
    tag : "API", 
    type : 0, 
    message : "Hello World", 
    timestamp: new Date().toLocaleTimeString(),
    size: 10
  }
];

const PORT = process.env.PORT || 3000; 
const host = process.env.HOST_IP || "172.20.10.12" //Your IP here
const uri = `http://${host}:${PORT}`
var logSizeLimit = FileUtil.readLogSizeFromFile() //MB

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  html = html.replace('</head>', `
    <script>
      window.__SERVER_URI__ = ${uri};
    </script>
  </head>`);
  res.send(html);
});

app.get('/logs', (req, res) => {
  res.status(200).json(logs);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.emit('initial-logs', {
    logs,
    uri,
    logSizeLimit
  });

  socket.on('send-logs', (data) => {
    
    const { tag, type, message } = data;
    const newLog = { 
      id: randomUUID(),
      tag, 
      type, 
      message, 
      timestamp: new Date().toLocaleTimeString(),
      size: message.length
    };
    
    logs.push(newLog);

    monitorLogSize()

    io.emit('new-log', newLog);
  });

  socket.on('clear', () => {
    logs = [];
    io.emit('clear-all-logs');
  });

  socket.on('log-size-limit-change', (size) => {
    console.log(`Change log limit size from ${logSizeLimit} => ${size}`);
    logSizeLimit = size
    FileUtil.writeLogSizeToFile(size)
    monitorLogSize()
    io.emit("log-size-limit-changed",logSizeLimit)
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  const monitorLogSize = ()=>{
    let totalSize = logs.reduce((sum, log) => sum + log.size, 0);
    while (totalSize > logSizeLimit * 1000 && logs.length > 0) {
      io.emit('remove-log', logs[0].id);
      const removed = logs.shift();
      totalSize -= removed.size;
    }
  }

});

server.listen(PORT,()=>{
  console.log(`Connection URI => ${uri}`)
});

