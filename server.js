// server.js
import { createServer } from 'https';
import next from 'next';
import fs from 'fs';
import express from 'express';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./192.168.18.3-key.pem'),
  cert: fs.readFileSync('./192.168.18.3.pem'),
};

app.prepare().then(() => {
  const server = express();

  // This handles all requests
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  createServer(httpsOptions, server).listen(3001, '0.0.0.0', err => {
    if (err) throw err;
    console.log('> Ready on https://192.168.18.3:3001');
  });
});
