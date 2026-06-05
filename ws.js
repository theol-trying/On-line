// Mini-serveur WebSocket (RFC 6455) — modules natifs Node uniquement, zéro dépendance.
import crypto from 'crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(str) {
  const data = Buffer.from(str, 'utf8');
  const len = data.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, data]);
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  let mask;
  if (masked) { if (buf.length < off + 4) return null; mask = buf.subarray(off, off + 4); off += 4; }
  if (buf.length < off + len) return null;
  let payload = buf.subarray(off, off + len);
  if (masked) {
    const out = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
    payload = out;
  }
  return { opcode, payload: payload.toString('utf8'), rest: buf.subarray(off + len) };
}

function makeConn(socket) {
  socket.setNoDelay(true);
  const conn = {
    socket, readyState: 1, _msg: null, _close: null,
    send(str) { if (this.readyState === 1) { try { socket.write(encodeFrame(str)); } catch {} } },
    onMessage(fn) { this._msg = fn; },
    onClose(fn) { this._close = fn; },
  };
  let buf = Buffer.alloc(0);
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    let r;
    while ((r = decodeFrame(buf))) {
      buf = r.rest;
      if (r.opcode === 0x8) { socket.end(); break; }
      if (r.opcode === 0x9) { socket.write(Buffer.from([0x8a, 0])); continue; }
      if (r.opcode === 0x1 && conn._msg) conn._msg(r.payload);
    }
  });
  const close = () => { if (conn.readyState !== 3) { conn.readyState = 3; conn._close && conn._close(); } };
  socket.on('close', close);
  socket.on('error', close);
  return conn;
}

/** Branche la gestion WebSocket sur un serveur HTTP ; appelle onConnection(conn) à chaque client. */
export function attachWebSocket(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    let token = null;
    try { token = new URL(req.url, 'http://x').searchParams.get('t'); } catch {}
    onConnection(makeConn(socket), token);
  });
}
