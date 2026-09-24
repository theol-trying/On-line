// Mini-serveur WebSocket (RFC 6455) — modules natifs Node uniquement, zéro dépendance.
import crypto from 'crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Plafond d'une trame ENTRANTE. Le plus gros message légitime est l'avatar (data URL refusée
// au-delà de ~19 Ko par app.js · avFromFile) : 64 Ko laisse une large marge.
// Sans ce plafond, une trame annonçant une taille énorme faisait accumuler au serveur TOUT ce
// qu'on lui envoyait ensuite, jusqu'à saturer la mémoire de l'unique instance Render — un seul
// visiteur pouvait couper le site pour tout le monde. Au-delà : connexion coupée net.
export const MAX_FRAME = 64 * 1024;
const MAX_ENTETE = 14;                     // 2 + 8 (longueur étendue) + 4 (masque)

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
  if (len > MAX_FRAME) return { trop: true };   // refusé dès l'en-tête, AVANT d'attendre (et de stocker) la suite
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

/** Trame prête à l'emploi, à écrire telle quelle sur PLUSIEURS sockets.
 *  Le hub diffuse le même instantané à tout le monde : on l'encode UNE fois au lieu d'une fois
 *  par client (à 10 joueurs × 60 Hz, ça évitait 600 encodages de ~3 Ko par seconde). */
export function wsFrame(str) { return encodeFrame(str); }

/* BATTEMENT DE CŒUR (24/09). Un téléphone qui perd le réseau (tunnel, bascule 4G/Wi-Fi, iOS verrouillé) ne
   ferme pas sa socket : côté serveur elle restait « ouverte » tant que TCP n'abandonnait pas, souvent plusieurs
   minutes. Le fantôme gardait son siège, bloquait le « Prêt » de toute la salle (et le rôle d'hôte s'il l'avait),
   et le serveur continuait de lui écrire en mémoire. Toutes les 15 s, chaque connexion reçoit un ping (trame
   0x89 — le navigateur répond tout seul, même onglet en arrière-plan) ; muette depuis 45 s, elle est coupée.
   Même sort pour un client si lent que plus de 512 Ko attendent dans sa file : il se reconnectera et recevra un
   instantané complet. Ce n'est PAS un réveil de Render : rien ne part vers un client qui n'est pas déjà connecté. */
const BATTEMENT_MS = 15000, MUET_MS = 45000, FILE_MAX = 512 * 1024;
// Journal limité (une ligne toutes les 5 s, comme incident() du hub) : un client qui enverrait 40 messages
// fautifs par seconde ne doit pas noyer les journaux Render sous les piles d'erreur.
let journalT = 0, journalTus = 0;
function journal(txt) { const now = Date.now(); if (now - journalT < 5000) { journalTus++; return; } journalT = now; console.error(txt + (journalTus ? '\n(' + journalTus + ' autre(s) depuis le précédent)' : '')); journalTus = 0; }
const PING = Buffer.from([0x89, 0x00]);
const vivantes = new Set();
setInterval(() => {
  const now = Date.now();
  for (const c of vivantes) {
    if (now - c.lastRx > MUET_MS || c.socket.writableLength > FILE_MAX) { try { c.socket.destroy(); } catch {} continue; }
    try { c.socket.write(PING); } catch {}
  }
}, BATTEMENT_MS).unref();

function makeConn(socket) {
  socket.setNoDelay(true);                 // Nagle désactivé : les petites trames partent tout de suite (ping)
  const conn = {
    socket, readyState: 1, _msg: null, _close: null, lastRx: Date.now(),
    // File d'écriture contrôlée À CHAQUE écriture (pas seulement au battement) : un client qui ne lit jamais ne peut
    // pas faire grossir la mémoire du serveur pendant 15 s.
    send(str) { if (this.readyState === 1) { if (socket.writableLength > FILE_MAX) { socket.destroy(); return; } try { socket.write(encodeFrame(str)); } catch {} } },
    sendRaw(buf) { if (this.readyState === 1) { if (socket.writableLength > FILE_MAX) { socket.destroy(); return; } try { socket.write(buf); } catch {} } },   // trame déjà encodée (cf. wsFrame)
    onMessage(fn) { this._msg = fn; },
    onClose(fn) { this._close = fn; },
  };
  let buf = Buffer.alloc(0);
  socket.on('data', d => {
    conn.lastRx = Date.now();              // toute trame reçue (texte, ping, pong 0xA) prouve que le client est là
    buf = Buffer.concat([buf, d]);
    let r, ping = false;
    while ((r = decodeFrame(buf))) {
      if (r.trop) { buf = Buffer.alloc(0); socket.destroy(); return; }
      buf = r.rest;
      if (r.opcode === 0x8) { socket.end(); break; }
      // Ping reçu : UN seul pong par salve et au plus un par seconde. Répondre ping par ping (hors seau de débit)
      // laissait une rafale de 512 Ko de pings geler la boucle ~2 s pour toute la salle (revue du 24/09).
      if (r.opcode === 0x9) { ping = true; continue; }
      if (r.opcode === 0x1 && conn._msg) {
        // Dernier rempart : une exception du hub ne doit jamais remonter jusqu'au processus (site entier à terre).
        try { conn._msg(r.payload); } catch (e) { journal('[ws] message non traité : ' + ((e && e.stack) || e)); }
      }
    }
    if (ping) { const now = Date.now(); if (now - (conn.pongT || 0) >= 1000) { conn.pongT = now; try { socket.write(Buffer.from([0x8a, 0])); } catch {} } }
    // Défense en profondeur : une fois les trames complètes consommées, le reliquat est au plus UNE
    // trame en cours de réception, donc jamais plus grand que le plafond + son en-tête.
    if (buf.length > MAX_FRAME + MAX_ENTETE) { buf = Buffer.alloc(0); socket.destroy(); }
  });
  const close = () => {
    vivantes.delete(conn);
    if (conn.readyState !== 3) {
      conn.readyState = 3;
      try { if (conn._close) conn._close(); } catch (e) { journal('[ws] fermeture non traitée : ' + ((e && e.stack) || e)); }
    }
  };
  socket.on('close', close);
  socket.on('error', close);
  vivantes.add(conn);
  return conn;
}

/** Branche la gestion WebSocket sur un serveur HTTP ; appelle onConnection(conn) à chaque client. */
export function attachWebSocket(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    // Origine : un navigateur l'envoie toujours ; elle doit désigner CE site (même hôte que la requête). Une page
    // tierce ne peut donc pas ouvrir de connexions chez nous avec les visiteurs d'un lien partagé. Sans en-tête
    // (client non navigateur, test de fumée), on accepte : ce contrôle ne vise que les pages web étrangères.
    const origine = req.headers.origin;
    if (origine) {
      let h = null; try { h = new URL(origine).host; } catch {}
      if (!h || (h !== req.headers.host && h !== req.headers['x-forwarded-host'])) { socket.destroy(); return; }
    }
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
