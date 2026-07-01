package com.chatweb.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chatweb.mobile.data.Chat
import com.chatweb.mobile.data.Message
import com.chatweb.mobile.data.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MainViewModel : ViewModel() {
    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _chats = MutableStateFlow<List<Chat>>(emptyList())
    val chats: StateFlow<List<Chat>> = _chats.asStateFlow()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    fun login(email: String) {
        // Mock login
        _currentUser.value = User(
            id = "user1",
            email = email,
            name = email.substringBefore("@"),
            username = "@${email.substringBefore("@")}",
            avatar = null
        )
        loadMockChats()
    }

    fun logout() {
        _currentUser.value = null
        _chats.value = emptyList()
        _messages.value = emptyList()
    }

    private fun loadMockChats() {
        _chats.value = listOf(
            Chat("1", "John Doe", null, "Hey, how are you?", false, 2),
            Chat("2", "Project Group", null, "Let's meet tomorrow.", true, 0)
        )
    }

    fun loadMessagesForChat(chatId: String) {
        _messages.value = listOf(
            Message("m1", "user1", chatId, null, "Hello!", "text", "read", "10:00 AM"),
            Message("m2", chatId, "user1", null, "Hi there, what's up?", "text", "read", "10:05 AM")
        )
    }

    fun sendMessage(chatId: String, text: String) {
        val currentMsgs = _messages.value.toMutableList()
        currentMsgs.add(
            Message(
                id = System.currentTimeMillis().toString(),
                senderId = _currentUser.value?.id ?: "",
                receiverId = chatId,
                groupId = null,
                text = text,
                type = "text",
                status = "sent",
                createdAt = "Just now"
            )
        )
        _messages.value = currentMsgs
    }
}
