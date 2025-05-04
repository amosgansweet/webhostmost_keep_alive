const os = require('os');
const http = require('http');
const { Buffer } = require('buffer');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const net = require('net');
const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');

const UUID = process.env.UUID || 'b28f60af-d0b9-4ddf-baaa-7e49c93c380b';
const uuid = UUID.replace(/-/g, '');
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezha.gvkoyeb.eu.org';
const NEZHA_PORT = process.env.NEZHA_PORT || '443';
const NEZHA_KEY = process.env.NEZHA_KEY || '';
const DOMAIN = process.env.DOMAIN || '';
const NAME = process.env.NAME || 'JP-webhostmost-GCP';
const port = process.env.PORT || 3000;

// 清除请求头中敏感信息
function sanitizeHeaders(req) {
  const headersToRemove = [
    'x-forwarded-for',
    'x-real-ip',
    'forwarded',
    'via',
    'client-ip'
  ];
  headersToRemove.forEach(header => {
    if (req.headers[header]) {
      delete req.headers[header];
    }
  });
}

// HTTP 路由服务
const httpServer = http.createServer((req, res) => {
  sanitizeHeaders(req);

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World\n');
  } else if (req.url === '/sub') {
    const vlessURL = `vless://${UUID}@skk.moe:443?encryption=none&security=tls&sni=${DOMAIN}&type=ws&host=${DOMAIN}&path=%2F#${NAME}`;
    const base64Content = Buffer.from(vlessURL).toString('base64');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(base64Content + '\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

httpServer.listen(port, () => {
  console.log(`HTTP Server is running on port ${port}`);
});

// 系统架构识别
function getSystemArchitecture() {
  const arch = os.arch();
  return arch === 'arm' || arch === 'arm64' ? 'arm' : 'amd';
}

// 文件下载与运行
function downloadFile(fileName, fileUrl, callback) {
  const filePath = path.join("./", fileName);
  const writer = fs.createWriteStream(filePath);
  axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  })
    .then(response => {
      response.data.pipe(writer);
      writer.on('finish', () => {
        writer.close();
        callback(null, fileName);
      });
    })
    .catch(error => {
      callback(`Download ${fileName} failed: ${error.message}`);
    });
}

function getFilesForArchitecture(architecture) {
  if (architecture === 'arm') {
    return [{ fileName: "npm", fileUrl: "https://github.com/eooce/test/releases/download/ARM/swith" }];
  } else if (architecture === 'amd') {
    return [{ fileName: "npm", fileUrl: "https://github.com/eooce/test/releases/download/bulid/swith" }];
  }
  return [];
}

function authorizeFiles() {
  const filePath = './npm';
  const newPermissions = 0o775;
  fs.chmod(filePath, newPermissions, (err) => {
    if (err) {
      console.error(`Empowerment failed: ${err}`);
    } else {
      console.log(`Empowerment success: ${newPermissions.toString(8)}`);
      if (NEZHA_SERVER && NEZHA_PORT && NEZHA_KEY) {
        const tlsFlag = NEZHA_PORT === '443' ? '--tls' : '';
        const cmd = `./npm -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tlsFlag} --skip-conn --disable-auto-update --skip-procs --report-delay 4 >/dev/null 2>&1 &`;
        exec(cmd);
      } else {
        console.log('NEZHA variable is empty, skip running');
      }
    }
  });
}

function downloadFiles() {
  const arch = getSystemArchitecture();
  const files = getFilesForArchitecture(arch);
  let downloaded = 0;

  files.forEach(file => {
    downloadFile(file.fileName, file.fileUrl, (err) => {
      if (err) {
        console.log(`Download failed: ${err}`);
      } else {
        console.log(`Downloaded: ${file.fileName}`);
        downloaded++;
        if (downloaded === files.length) {
          setTimeout(() => authorizeFiles(), 3000);
        }
      }
    });
  });
}

downloadFiles();

// WebSocket 正向代理服务
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', ws => {
  ws.on('message', msg => {
    if (msg.length < 18) return;

    try {
      const [VERSION] = msg;
      const id = msg.slice(1, 17);

      if (!id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16))) {
        console.error("UUID 验证失败");
        return;
      }

      let i = msg.slice(17, 18).readUInt8() + 19;
      const port = msg.slice(i, i += 2).readUInt16BE(0);
      const ATYP = msg.slice(i, i += 1).readUInt8();

      const host = (
        ATYP === 1 ? msg.slice(i, i += 4).join('.') :
        ATYP === 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
        ATYP === 3 ? msg.slice(i, i += 16).reduce((s, b, j, a) => j % 2 ? s.concat(a.slice(j - 1, j + 1)) : s, []).map(b => b.readUInt16BE(0).toString(16)).join(':') :
        ''
      );

      ws.send(new Uint8Array([VERSION, 0]));
      const duplex = createWebSocketStream(ws);

      net.connect({ host, port }, function () {
        this.write(msg.slice(i));
        duplex.pipe(this).pipe(duplex);
      }).on('error', err => console.error("连接错误:", err.message));

    } catch (err) {
      console.error("处理消息时出错:", err.message);
    }
  }).on('error', err => console.error("WebSocket 错误:", err.message));
});
