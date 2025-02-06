import { WebSocketServer } from 'ws';

const port = process.env.PORT || 8090;
const wss = new WebSocketServer({ port });

let espSocket = null;
let webSockets = [];

wss.on('connection', (ws) => {
	if (ws.protocol === 'webapp') {
		console.log('Webapp connected');
		webSockets.push(ws);

		ws.on('close', () => {
			webSockets = webSockets.filter((client) => client !== ws);
			console.log('Webapp disconnected');
		});
	}

	if (ws.protocol === 'esp') {
		console.log('Esp connected');
		espSocket = ws;

		ws.on('close', () => {
			espSocket = null;
			console.log('Esp disconnected');
		});
	}

	ws.on('message', (data) => {
		console.log('Message received');

		if (ws.protocol === 'esp') {
			console.log('Sending message to webapps');
			webSockets.forEach((webSocket) => {
				webSocket.send(data);
			});
		}

		if (ws.protocol === 'webapp') {
			console.log('Sending message to esp');
			if (espSocket) {
				espSocket.send(data);
			}
		}
	});
});

console.log('WebSocketServer listening on address: ', wss.address());