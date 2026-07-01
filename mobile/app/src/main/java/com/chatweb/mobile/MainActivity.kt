package com.chatweb.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.chatweb.mobile.ui.ChatListScreen
import com.chatweb.mobile.ui.ChatRoomScreen
import com.chatweb.mobile.ui.LoginScreen
import com.chatweb.mobile.ui.MainViewModel

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val user by viewModel.currentUser.collectAsState()
                    var currentScreen by remember { mutableStateOf("auth") }
                    var activeChatId by remember { mutableStateOf<String?>(null) }

                    if (user == null) {
                        LoginScreen(viewModel = viewModel)
                    } else if (currentScreen == "chats") {
                        ChatListScreen(
                            viewModel = viewModel,
                            onChatClick = { chatId ->
                                activeChatId = chatId
                                currentScreen = "chatRoom"
                            }
                        )
                    } else if (currentScreen == "chatRoom" && activeChatId != null) {
                        ChatRoomScreen(
                            chatId = activeChatId!!,
                            viewModel = viewModel,
                            onBack = { currentScreen = "chats" }
                        )
                    } else {
                        currentScreen = "chats"
                    }
                }
            }
        }
    }
}

