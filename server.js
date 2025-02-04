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

		let message;
		try {
			message = JSON.parse(data);
		} catch (error) {
			ws.send(JSON.stringify({ error: 'Invalid JSON format.' }));
			return;
		}

		if (ws.protocol === 'esp') {
			console.log('Sending message to webapps');
			webSockets.forEach((webSocket) => {
				webSocket.send(JSON.stringify(message));
			});
		}

		if (ws.protocol === 'webapp') {
			console.log('Sending message to esp');
			if (espSocket) {
				espSocket.send(JSON.stringify(message));
			}
		}
	});
});

console.log('WebSocketServer listening on address: ', wss.address());