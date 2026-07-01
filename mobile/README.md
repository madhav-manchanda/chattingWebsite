# ChatWeb Mobile (Android)

This is the native Kotlin Android client for the ChatWeb application, built to be 100% compatible with the custom Node.js + Socket.io backend.

## Architecture
- **Language**: Kotlin
- **UI Toolkit**: Jetpack Compose (Modern, declarative UI).
- **Networking**: Retrofit & OkHttp for REST APIs.
- **Real-Time**: Socket.io-client for live messaging.

## Getting Started

### Prerequisites
- **Android Studio** (Flamingo or newer recommended).
- **Java 17** (Included with modern Android Studio).

### Setup Instructions
1. Open **Android Studio**.
2. Select **Open** and choose this `mobile` folder.
3. Wait for the initial **Gradle Sync** to finish downloading dependencies.
4. If you have modified the backend URL, open `app/src/main/java/com/chatweb/mobile/network/SocketManager.kt` and `ApiClient.kt` to update the `BASE_URL`.
5. Connect an Android emulator or physical device.
6. Click the **Run** button (green play icon) in Android Studio to build and launch the app.

## Features
- **Signal-Inspired UI**: Clean, premium interfaces built with Jetpack Compose.
- **Real-Time Sync**: Instant message delivery using the same WebSockets as the web version.
- **Cross-Compatible**: Messages sent from the web instantly appear here, and vice versa.
