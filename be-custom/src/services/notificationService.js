let clients = [];

/**
 * Registers an HTTP response object as an SSE client.
 */
function registerClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Send a connection confirmation event
  res.write(`data: ${JSON.stringify({ message: 'Connected to blockchain real-time events.' })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
}

/**
 * Broadcasts an event to all connected clients.
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(payload);
    } catch (err) {
      // Clean up failed connections silently
    }
  });
}

module.exports = {
  registerClient,
  broadcast,
};
