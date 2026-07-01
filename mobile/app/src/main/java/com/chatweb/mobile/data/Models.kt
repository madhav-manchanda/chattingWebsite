package com.chatweb.mobile.data

data class User(
    val id: String,
    val email: String,
    val name: String,
    val username: String,
    val avatar: String?,
    val status: String = "offline"
)

data class Message(
    val id: String,
    val senderId: String,
    val receiverId: String?,
    val groupId: String?,
    val text: String,
    val type: String = "text",
    val status: String = "sent",
    val createdAt: String
)

data class Chat(
    val id: String,
    val name: String,
    val avatar: String?,
    val lastMessage: String?,
    val isGroup: Boolean,
    val unreadCount: Int = 0
)
