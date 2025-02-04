import WebSocket from 'ws';
import http from 'http';

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new client connected!');
  
  ws.send('Hello from the WebSocket server!');

  ws.on('message', (message) => {
    console.log(`Received: ${message}`);

    ws.send(`Server received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
