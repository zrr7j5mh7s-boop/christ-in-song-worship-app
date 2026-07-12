(function () {
  "use strict";

  const OPCODE = {
    HELLO: 0,
    IDENTIFY: 1,
    IDENTIFIED: 2,
    EVENT: 5,
    REQUEST: 6,
    REQUEST_RESPONSE: 7,
  };

  async function sha256Base64(parts) {
    const chunks = parts.map((part) => new TextEncoder().encode(String(part)));
    const totalLength = chunks.reduce((sum, item) => sum + item.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((item) => {
      merged.set(item, offset);
      offset += item.length;
    });
    const digest = await window.crypto.subtle.digest("SHA-256", merged);
    return btoa(String.fromCharCode(...new Uint8Array(digest)));
  }

  async function buildAuthString(password, auth) {
    if (!auth || !password) return null;
    const secret = await sha256Base64([password, auth.salt]);
    return sha256Base64([secret, auth.challenge]);
  }

  function createMessageId() {
    return `cis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createClient() {
    let socket = null;
    let identified = false;
    let pending = new Map();
    let eventHandlers = new Set();
    let lastPassword = "";

    function closeSocket() {
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
          socket.close();
        } catch (error) {}
        socket = null;
      }
      identified = false;
      pending.forEach((entry) => entry.reject(new Error("OBS connection closed")));
      pending.clear();
    }

    function handleMessage(raw) {
      let message;
      try {
        message = JSON.parse(raw.data);
      } catch (error) {
        return;
      }

      if (message.op === OPCODE.EVENT) {
        eventHandlers.forEach((handler) => handler(message.d));
        return;
      }

      if (message.op === OPCODE.REQUEST_RESPONSE) {
        const entry = pending.get(message.d?.requestId);
        if (!entry) return;
        pending.delete(message.d.requestId);
        if (message.d.requestStatus?.result) entry.resolve(message.d.responseData || {});
        else entry.reject(new Error(message.d.requestStatus?.comment || "OBS request failed"));
      }
    }

    function waitForMessage(filter, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          socket.removeEventListener("message", onMessage);
          reject(new Error("OBS protocol timeout"));
        }, timeoutMs || 8000);

        function onMessage(event) {
          let message;
          try {
            message = JSON.parse(event.data);
          } catch (error) {
            return;
          }
          if (filter(message)) {
            window.clearTimeout(timer);
            socket.removeEventListener("message", onMessage);
            resolve(message);
          }
        }

        socket.addEventListener("message", onMessage);
      });
    }

    async function connect(url, password, connectionTimeoutMs) {
      closeSocket();
      lastPassword = String(password || "");
      const timeoutMs = Math.max(3000, Number(connectionTimeoutMs) || 10000);

      return new Promise((resolve, reject) => {
        const connectTimer = window.setTimeout(() => {
          closeSocket();
          reject(new Error(`OBS connection timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        socket = new WebSocket(url);
        socket.onmessage = handleMessage;
        socket.onerror = () => {
          window.clearTimeout(connectTimer);
          closeSocket();
          reject(new Error("OBS WebSocket connection failed"));
        };
        socket.onclose = () => {
          identified = false;
        };
        socket.onopen = async () => {
          try {
            const helloMessage = await waitForMessage((message) => message.op === OPCODE.HELLO, timeoutMs);
            const identifyPayload = {
              rpcVersion: 1,
              eventSubscriptions: 0,
            };
            const requiresAuth = Boolean(helloMessage.d?.authentication);
            if (requiresAuth) {
              if (!lastPassword) {
                throw new Error("OBS requires a WebSocket password. Enter the password from OBS (Tools → WebSocket Server Settings) in Settings → OBS Studio.");
              }
              const authString = await buildAuthString(lastPassword, helloMessage.d.authentication);
              if (!authString) {
                throw new Error("OBS WebSocket authentication could not be prepared. Re-enter the password in Settings → OBS Studio.");
              }
              identifyPayload.authentication = authString;
            }
            socket.send(JSON.stringify({ op: OPCODE.IDENTIFY, d: identifyPayload }));
            const identifiedMessage = await waitForMessage((message) => message.op === OPCODE.IDENTIFIED, timeoutMs);
            identified = true;
            window.clearTimeout(connectTimer);
            resolve(identifiedMessage.d || {});
          } catch (error) {
            window.clearTimeout(connectTimer);
            closeSocket();
            const message = error && error.message ? error.message : "OBS authentication failed";
            if (/password required|authentication/i.test(message)) {
              reject(new Error(`OBS authentication failed: ${message}`));
            } else {
              reject(error);
            }
          }
        };
      });
    }

    function disconnect() {
      closeSocket();
      return Promise.resolve();
    }

    function call(requestType, requestData) {
      if (!socket || !identified) return Promise.reject(new Error("OBS is not connected"));
      const requestId = createMessageId();
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({
          op: OPCODE.REQUEST,
          d: {
            requestType,
            requestId,
            requestData: requestData || {},
          },
        }));
        window.setTimeout(() => {
          if (pending.has(requestId)) {
            pending.delete(requestId);
            reject(new Error(`OBS request timed out: ${requestType}`));
          }
        }, 10000);
      });
    }

    function onEvent(handler) {
      if (typeof handler !== "function") return () => {};
      eventHandlers.add(handler);
      return () => eventHandlers.delete(handler);
    }

    function isConnected() {
      return identified;
    }

    return {
      connect,
      disconnect,
      call,
      onEvent,
      isConnected,
    };
  }

  window.CISObsWsClient = {
    createClient,
  };
})();
