const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let logs = [];

const PORT = process.env.PORT || 3000; 
const host = process.env.HOST_IP || "172.20.10.12" //Your IP here
const uri = `http://${host}:${PORT}`

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
    uri
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

    let totalSize = logs.reduce((sum, log) => sum + log.size, 0);
    while (totalSize > 100000 && logs.length > 0) {
      io.emit('remove-log', logs[0].id);
      const removed = logs.shift();
      totalSize -= removed.size;
    }

    io.emit('new-log', newLog);
  });

  socket.on('clear', () => {
    logs = [];
    io.emit('clear-all-logs');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT,()=>{
  console.log(`Connection URI => ${uri}`)
});
