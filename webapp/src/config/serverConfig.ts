// Server configuration for webapp
// When loaded via file:// (Electron production), fall back to http://localhost
const isFileProtocol = window.location.protocol === "file:";

const serverConfig = {
  protocol: isFileProtocol ? "http:" : window.location.protocol,
  hostname: isFileProtocol ? "localhost" : window.location.hostname,
  port: 3031,
};

export default serverConfig;
