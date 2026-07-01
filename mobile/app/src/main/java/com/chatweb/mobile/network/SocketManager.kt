package com.chatweb.mobile.network

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URISyntaxException

object SocketManager {
    private var socket: Socket? = null
    // Replace with actual VPS URL (no trailing slash)
    private const val URL = "https://sticky-raises-also-msgstr.trycloudflare.com"

    fun connect(token: String) {
        try {
            val options = IO.Options.builder()
                .setPath("/socket.io")
                .setTransports(arrayOf("websocket"))
                .setAuth(mapOf("token" to token))
                .build()
            
            socket = IO.socket(URL, options)
            
            socket?.on(Socket.EVENT_CONNECT) {
                println("Socket connected!")
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                println("Socket disconnected!")
            }
            
            socket?.connect()
        } catch (e: URISyntaxException) {
            e.printStackTrace()
        }
    }

    fun disconnect() {
        socket?.disconnect()
    }

    fun getSocket(): Socket? = socket
}
