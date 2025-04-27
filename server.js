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

function cleanupESP() {
	clearInterval(heartbeatInterval);
	heartbeatInterval = null;

	if (isSocketOpen(espSocket)) {
		espSocket.terminate();
	}
	espSocket = null;

	webSockets.forEach((webSocket) => {
		if (isSocketOpen(webSocket)) {
			webSocket.send(Buffer.from([WSCmdType_ESP_STATE, 0]));
		}
	});
}

function isSocketOpen(socket) {
	return socket && socket.readyState === WebSocket.OPEN;
}

function startESPHeartbeat() {
	if (heartbeatInterval !== null) clearInterval(heartbeatInterval);

	espLastSeen = Date.now();

	heartbeatInterval = setInterval(() => {
		if (!isSocketOpen(espSocket)) {
			console.log('Esp is not connected during heartbeat');
			cleanupESP();
			return;
		}

		const now = Date.now();
		if (now - espLastSeen > 2 * HEARTBEAT_INTERVAL_MS) {
			console.log('Esp missed 2 consecutive pings. Terminating.');
			cleanupESP();
			return;
		}

		try {
			espSocket.ping();
		} catch (err) {
			console.error('Error sending ping to ESP:', err);
			cleanupESP();
		}
	}, HEARTBEAT_INTERVAL_MS);
}

wss.on('connection', (ws, req) => {
	let protocols = (req.headers['sec-websocket-protocol'] || '')
		.split(',')
		.map((p) => p.trim());

	if (protocols.length < 2 || protocols[1] != password) {
		console.log('Unauthorized connection: ', protocols);
		ws.close(1008, 'Unauthorized connection');
		return;
	}

	if (protocols[0] === 'webapp') {
		console.log('Webapp connected');
		webSockets.push(ws);

		ws.send(Buffer.from([WSCmdType_ESP_STATE, isSocketOpen(espSocket) ? 1 : 0]));

		ws.on('close', () => {
			console.log('Webapp disconnected');
			webSockets = webSockets.filter((client) => client !== ws);
		});

		ws.on('message', (data) => {
			if (isSocketOpen(espSocket)) {
				console.log('Forwarding message to esp');
				espSocket.send(data);
			} else {
				console.log('Esp not connected, message not sent');
			}
		});

		ws.on('error', (err) => {
			console.error('Webapp error, terminating:', err);
			webSockets = webSockets.filter((client) => client !== ws);
			ws.terminate();
		});
	}

	if (protocols[0] === 'esp') {
		console.log('Esp connected');
		espSocket = ws;
		startESPHeartbeat();

		webSockets.forEach((webSocket) => {
			if (isSocketOpen(webSocket)) {
				webSocket.send(Buffer.from([WSCmdType_ESP_STATE, 1]));
			}
		});

		ws.on('pong', () => {
			if (isSocketOpen(espSocket)) {
				console.log('Received pong from esp');
				espLastSeen = Date.now();
			}
		});

		ws.on('message', (data) => {
			console.log('Forwarding message to webapps');
			webSockets.forEach((webSocket) => {
				if (isSocketOpen(webSocket)) {
					webSocket.send(data);
				}
			});
		});

		ws.on('close', () => {
			console.log('Esp disconnected');
			cleanupESP();
		});

		ws.on('error', (err) => {
			console.error('ESP error:', err);
			cleanupESP();
		});
	}
});

console.log('WebSocketServer listening on address: ', wss.address());
