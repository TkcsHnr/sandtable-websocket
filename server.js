import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config';

const password = process.env.WEBSOCKET_PASSWORD;
const port = process.env.PORT || 8090;
const wss = new WebSocketServer({ port, maxPayload: 10000 });

let espSocket = null;
let webSockets = [];

const WSCmdType_ESP_STATE = 0x0f;
const HEARTBEAT_INTERVAL_MS = 10000;

let espLastSeen = null;
let heartbeatInterval = null;

function espHereYouAre(ws) {
	espLastSeen = Date.now();
	espSocket = ws;
}

function startESPHeartbeat() {
	if (heartbeatInterval) clearInterval(heartbeatInterval);

	heartbeatInterval = setInterval(() => {
		const now = Date.now();

		if (espSocket && espSocket.readyState === WebSocket.OPEN) {
			espSocket.ping();
		}

		if (now - espLastSeen > 2 * HEARTBEAT_INTERVAL_MS) {
			console.log('Esp missed 2 consecutive pings. Terminating.');
			espSocket.terminate();
			espSocket = null;

			clearInterval(heartbeatInterval);
			heartbeatInterval = null;

			webSockets.forEach((webSocket) => {
				webSocket.send(Buffer.from([WSCmdType_ESP_STATE, 0]));
			});
		}
	}, HEARTBEAT_INTERVAL_MS);
}

wss.on('connection', (ws, req) => {
	console.log('somebody wants to join...');
	let protocols = (req.headers['sec-websocket-protocol'] || '')
		.split(',')
		.map((p) => p.trim());

	if (protocols.length < 2 || protocols[1] != password) {
		console.log('Unauthorized connection: ', protocols);
		ws.close(1008, 'Unauthorized connection');
		return;
	}

	ws.on('error', (err) => {
		console.error('WebSocket error, terminating:', err);
		ws.terminate();
	});

	if (protocols[0] === 'webapp') {
		console.log('Webapp connected');
		webSockets.push(ws);
		ws.send(Buffer.from([WSCmdType_ESP_STATE, espSocket == null ? 0 : 1]));

		ws.on('close', () => {
			webSockets = webSockets.filter((client) => client !== ws);
			console.log('Webapp disconnected');
		});

		ws.on('message', (data) => {
			if (espSocket) {
				console.log('Sending message to esp');
				espSocket.send(data);
			} else {
				console.log('Esp not connected, message not sent');
			}
		});
	}

	if (protocols[0] === 'esp') {
		console.log('Esp connected');
		espHereYouAre(ws);
		startESPHeartbeat();

		webSockets.forEach((webSocket) => {
			webSocket.send(Buffer.from([WSCmdType_ESP_STATE, 1]));
		});

		ws.on('pong', () => {
			espHereYouAre(ws);
		});

		ws.on('close', () => {
			espSocket = null;
			console.log('Esp disconnected');
			webSockets.forEach((webSocket) => {
				webSocket.send(Buffer.from([WSCmdType_ESP_STATE, 0]));
			});
			if (heartbeatInterval) {
				clearInterval(heartbeatInterval);
				heartbeatInterval = null;
			}
		});

		ws.on('message', (data) => {
			espHereYouAre(ws);
			console.log('Sending message to webapps');
			webSockets.forEach((webSocket) => {
				webSocket.send(data);
			});
		});
	}
});

console.log('WebSocketServer listening on address: ', wss.address());
