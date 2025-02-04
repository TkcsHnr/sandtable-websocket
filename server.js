import { WebSocketServer } from 'ws';

const port = process.env.PORT || 8090;
const wss = new WebSocketServer({ port });

let espSocket = null;
let webSockets = [];

wss.on('connection', (ws) => {
	ws.on('message', (data) => {
		const message = JSON.parse(data);

		if (ws.protocol === 'esp32') {
			webSockets.forEach((webSocket) => {
				webSocket.send(JSON.stringify(message));
			});
		}

		if (ws.protocol === 'webapp') {
			if (espSocket) {
				espSocket.send(JSON.stringify(message));
			}
		}
	});

	if (ws.protocol === 'webapp') {
		webSockets.push(ws);

		ws.on('close', () => {
			webSockets = webSockets.filter((client) => client !== ws);
		});
	}

	if (ws.protocol === 'esp32') {
		espSocket = ws;

		ws.on('close', () => {
			espSocket = null;
		});
	}
});
