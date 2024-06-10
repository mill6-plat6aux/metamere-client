/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

const EventEmitter = require("events");

const ReadyStates = {
    Connecting: 0,	
    Open: 1,
    Closing: 2,
    Closed: 3,
};

class WebSocketClient {

    /**
     * @param {string} url 
     * @param {string} request 
     * @param {boolean} closeWhenSent 
     * @param {boolean} closeWhenReceived 
     * @returns {Promise<object>}
     */
    static async send(url, request, closeWhenSent, closeWhenReceived) {
        return new Promise((resolve, reject) => {
            let socket = new WebSocket(url);
    
            socket.on("open", () => {
                if(socket.readyState != ReadyStates.Open) return;
                socket.send(request, (error) => {
                    if(error != null) {
                        this.emit("error", new Error("failed to send a message. " + commandName + " " + error.message));
                    }
                    if(closeWhenSent) {
                        socket.terminate();
                        resolve(null);
                    }
                });
            });
    
            socket.on("error", error => {
                socket.terminate();
                reject(error);
            });
    
            socket.on("message", data => {
                if(closeWhenReceived) {
                    socket.terminate();
                }
                resolve(data);
            });
        });
    }
}
module.exports = WebSocketClient;