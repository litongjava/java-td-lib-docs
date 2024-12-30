# java-td-lib

## 简介

**TDLib（Telegram Database Library）** 是由 Telegram 官方开发的一个高性能、跨平台的客户端库，旨在帮助开发者快速构建 Telegram 客户端应用。TDLib 处理了与 Telegram 服务器的所有底层通信，包括网络连接、数据同步、加密等复杂任务，使开发者能够专注于应用的业务逻辑。

**TDLib 的主要特点：**

- **高性能和稳定性**：采用 C++ 编写，具备卓越的性能和可靠性。
- **跨平台支持**：支持多种平台，包括 iOS、Android、Windows、macOS、Linux 等。
- **自动处理更新**：自动处理消息同步、连接恢复等，简化开发过程。
- **多语言绑定**：提供多种语言的绑定（如 Java、Swift、Kotlin 等），方便在不同语言环境中使用。

**java-td-lib** 是 TDLib 的 Java 绑定实现，开源地址：[https://github.com/litongjava/java-td-lib](https://github.com/litongjava/java-td-lib)

## 添加依赖

在项目的 `pom.xml` 文件中添加以下依赖：

```xml
<dependency>
  <groupId>com.litongjava</groupId>
  <artifactId>java-td-lib</artifactId>
  <version>1.0.0</version>
</dependency>
```

## 添加库文件

从 [java-td-lib 的发布页面](https://github.com/litongjava/java-td-lib/releases) 下载适用于不同平台的库文件。将下载的库文件添加到 `java.library.path` 中，以确保 Java 应用能够正确加载本地库。

## 编写代码

以下是一个使用 java-td-lib 的示例代码，展示了如何与 Telegram 进行基本的交互。

```java
package org.drinkless.tdlib.example;

import java.io.BufferedReader;
import java.io.IOError;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.NavigableSet;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import org.drinkless.tdlib.Client;
import org.drinkless.tdlib.TdApi;

/**
 * Example class for TDLib usage from Java.
 */
public final class Example {
  private static Client client = null;

  private static TdApi.AuthorizationState authorizationState = null;
  private static volatile boolean haveAuthorization = false;
  private static volatile boolean needQuit = false;
  private static volatile boolean canQuit = false;

  private static final Client.ResultHandler defaultHandler = new DefaultHandler();

  private static final Lock authorizationLock = new ReentrantLock();
  private static final Condition gotAuthorization = authorizationLock.newCondition();

  private static final ConcurrentMap<Long, TdApi.User> users = new ConcurrentHashMap<Long, TdApi.User>();
  private static final ConcurrentMap<Long, TdApi.BasicGroup> basicGroups = new ConcurrentHashMap<Long, TdApi.BasicGroup>();
  private static final ConcurrentMap<Long, TdApi.Supergroup> supergroups = new ConcurrentHashMap<Long, TdApi.Supergroup>();
  private static final ConcurrentMap<Integer, TdApi.SecretChat> secretChats = new ConcurrentHashMap<Integer, TdApi.SecretChat>();

  private static final ConcurrentMap<Long, TdApi.Chat> chats = new ConcurrentHashMap<Long, TdApi.Chat>();
  private static final NavigableSet<OrderedChat> mainChatList = new TreeSet<OrderedChat>();
  private static boolean haveFullMainChatList = false;

  private static final ConcurrentMap<Long, TdApi.UserFullInfo> usersFullInfo = new ConcurrentHashMap<Long, TdApi.UserFullInfo>();
  private static final ConcurrentMap<Long, TdApi.BasicGroupFullInfo> basicGroupsFullInfo = new ConcurrentHashMap<Long, TdApi.BasicGroupFullInfo>();
  private static final ConcurrentMap<Long, TdApi.SupergroupFullInfo> supergroupsFullInfo = new ConcurrentHashMap<Long, TdApi.SupergroupFullInfo>();

  private static final String newLine = System.getProperty("line.separator");
  private static final String commandsLine = "Enter command (gcs - GetChats, gc <chatId> - GetChat, me - GetMe, sm <chatId> <message> - SendMessage, lo - LogOut, q - Quit): ";
  private static volatile String currentPrompt = null;

  private static void print(String str) {
    if (currentPrompt != null) {
      System.out.println("");
    }
    System.out.println(str);
    if (currentPrompt != null) {
      System.out.print(currentPrompt);
    }
  }

  private static void setChatPositions(TdApi.Chat chat, TdApi.ChatPosition[] positions) {
    synchronized (mainChatList) {
      synchronized (chat) {
        for (TdApi.ChatPosition position : chat.positions) {
          if (position.list.getConstructor() == TdApi.ChatListMain.CONSTRUCTOR) {
            boolean isRemoved = mainChatList.remove(new OrderedChat(chat.id, position));
            assert isRemoved;
          }
        }

        chat.positions = positions;

        for (TdApi.ChatPosition position : chat.positions) {
          if (position.list.getConstructor() == TdApi.ChatListMain.CONSTRUCTOR) {
            boolean isAdded = mainChatList.add(new OrderedChat(chat.id, position));
            assert isAdded;
          }
        }
      }
    }
  }

  private static void onAuthorizationStateUpdated(TdApi.AuthorizationState authorizationState) {
    if (authorizationState != null) {
      Example.authorizationState = authorizationState;
    }
    switch (Example.authorizationState.getConstructor()) {
    case TdApi.AuthorizationStateWaitTdlibParameters.CONSTRUCTOR:
      TdApi.SetTdlibParameters request = new TdApi.SetTdlibParameters();
      request.databaseDirectory = "tdlib";
      request.useMessageDatabase = true;
      request.useSecretChats = true;
      request.apiId = 94575;
      request.apiHash = "a3406de8d171bb422bb6ddf3bbd800e2";
      request.systemLanguageCode = "en";
      request.deviceModel = "Desktop";
      request.applicationVersion = "1.0";

      client.send(request, new AuthorizationRequestHandler());
      break;
    case TdApi.AuthorizationStateWaitPhoneNumber.CONSTRUCTOR: {
      String phoneNumber = promptString("Please enter phone number: ");
      client.send(new TdApi.SetAuthenticationPhoneNumber(phoneNumber, null), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateWaitOtherDeviceConfirmation.CONSTRUCTOR: {
      String link = ((TdApi.AuthorizationStateWaitOtherDeviceConfirmation) Example.authorizationState).link;
      System.out.println("Please confirm this login link on another device: " + link);
      break;
    }
    case TdApi.AuthorizationStateWaitEmailAddress.CONSTRUCTOR: {
      String emailAddress = promptString("Please enter email address: ");
      client.send(new TdApi.SetAuthenticationEmailAddress(emailAddress), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateWaitEmailCode.CONSTRUCTOR: {
      String code = promptString("Please enter email authentication code: ");
      client.send(new TdApi.CheckAuthenticationEmailCode(new TdApi.EmailAddressAuthenticationCode(code)), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateWaitCode.CONSTRUCTOR: {
      String code = promptString("Please enter authentication code: ");
      client.send(new TdApi.CheckAuthenticationCode(code), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateWaitRegistration.CONSTRUCTOR: {
      String firstName = promptString("Please enter your first name: ");
      String lastName = promptString("Please enter your last name: ");
      client.send(new TdApi.RegisterUser(firstName, lastName, false), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateWaitPassword.CONSTRUCTOR: {
      String password = promptString("Please enter password: ");
      client.send(new TdApi.CheckAuthenticationPassword(password), new AuthorizationRequestHandler());
      break;
    }
    case TdApi.AuthorizationStateReady.CONSTRUCTOR:
      haveAuthorization = true;
      authorizationLock.lock();
      try {
        gotAuthorization.signal();
      } finally {
        authorizationLock.unlock();
      }
      break;
    case TdApi.AuthorizationStateLoggingOut.CONSTRUCTOR:
      haveAuthorization = false;
      print("Logging out");
      break;
    case TdApi.AuthorizationStateClosing.CONSTRUCTOR:
      haveAuthorization = false;
      print("Closing");
      break;
    case TdApi.AuthorizationStateClosed.CONSTRUCTOR:
      print("Closed");
      if (!needQuit) {
        client = Client.create(new UpdateHandler(), null, null); // recreate client after previous has closed
      } else {
        canQuit = true;
      }
      break;
    default:
      System.err.println("Unsupported authorization state:" + newLine + Example.authorizationState);
    }
  }

  private static int toInt(String arg) {
    int result = 0;
    try {
      result = Integer.parseInt(arg);
    } catch (NumberFormatException ignored) {
    }
    return result;
  }

  private static long getChatId(String arg) {
    long chatId = 0;
    try {
      chatId = Long.parseLong(arg);
    } catch (NumberFormatException ignored) {
    }
    return chatId;
  }

  private static String promptString(String prompt) {
    System.out.print(prompt);
    currentPrompt = prompt;
    BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
    String str = "";
    try {
      str = reader.readLine();
    } catch (IOException e) {
      e.printStackTrace();
    }
    currentPrompt = null;
    return str;
  }

  private static void getCommand() {
    String command = promptString(commandsLine);
    String[] commands = command.split(" ", 2);
    try {
      switch (commands[0]) {
      case "gcs": {
        int limit = 20;
        if (commands.length > 1) {
          limit = toInt(commands[1]);
        }
        getMainChatList(limit);
        break;
      }
      case "gc":
        client.send(new TdApi.GetChat(getChatId(commands[1])), defaultHandler);
        break;
      case "me":
        client.send(new TdApi.GetMe(), defaultHandler);
        break;
      case "sm": {
        String[] args = commands[1].split(" ", 2);
        sendMessage(getChatId(args[0]), args[1]);
        break;
      }
      case "lo":
        haveAuthorization = false;
        client.send(new TdApi.LogOut(), defaultHandler);
        break;
      case "q":
        needQuit = true;
        haveAuthorization = false;
        client.send(new TdApi.Close(), defaultHandler);
        break;
      default:
        System.err.println("Unsupported command: " + command);
      }
    } catch (ArrayIndexOutOfBoundsException e) {
      print("Not enough arguments");
    }
  }

  private static void getMainChatList(final int limit) {
    synchronized (mainChatList) {
      if (!haveFullMainChatList && limit > mainChatList.size()) {
        // send LoadChats request if there are some unknown chats and have not enough known chats
        client.send(new TdApi.LoadChats(new TdApi.ChatListMain(), limit - mainChatList.size()), new Client.ResultHandler() {
          @Override
          public void onResult(TdApi.Object object) {
            switch (object.getConstructor()) {
            case TdApi.Error.CONSTRUCTOR:
              if (((TdApi.Error) object).code == 404) {
                synchronized (mainChatList) {
                  haveFullMainChatList = true;
                }
              } else {
                System.err.println("Receive an error for LoadChats:" + newLine + object);
              }
              break;
            case TdApi.Ok.CONSTRUCTOR:
              // chats had already been received through updates, let's retry request
              getMainChatList(limit);
              break;
            default:
              System.err.println("Receive wrong response from TDLib:" + newLine + object);
            }
          }
        });
        return;
      }

      java.util.Iterator<OrderedChat> iter = mainChatList.iterator();
      System.out.println();
      System.out.println("First " + limit + " chat(s) out of " + mainChatList.size() + " known chat(s):");
      for (int i = 0; i < limit && i < mainChatList.size(); i++) {
        long chatId = iter.next().chatId;
        TdApi.Chat chat = chats.get(chatId);
        synchronized (chat) {
          System.out.println(chatId + ": " + chat.title);
        }
      }
      print("");
    }
  }

  private static void sendMessage(long chatId, String message) {
    // initialize reply markup just for testing
    TdApi.InlineKeyboardButton[] row = { new TdApi.InlineKeyboardButton("https://telegram.org?1", new TdApi.InlineKeyboardButtonTypeUrl()),
        new TdApi.InlineKeyboardButton("https://telegram.org?2", new TdApi.InlineKeyboardButtonTypeUrl()),
        new TdApi.InlineKeyboardButton("https://telegram.org?3", new TdApi.InlineKeyboardButtonTypeUrl()) };
    TdApi.ReplyMarkup replyMarkup = new TdApi.ReplyMarkupInlineKeyboard(new TdApi.InlineKeyboardButton[][] { row, row, row });

    TdApi.InputMessageContent content = new TdApi.InputMessageText(new TdApi.FormattedText(message, null), null, true);
    client.send(new TdApi.SendMessage(chatId, 0, null, null, replyMarkup, content), defaultHandler);
  }

  public static void main(String[] args) throws InterruptedException {
    // set log message handler to handle only fatal errors (0) and plain log messages (-1)
    Client.setLogMessageHandler(0, new LogMessageHandler());

    // disable TDLib log and redirect fatal errors and plain log messages to a file
    try {
      Client.execute(new TdApi.SetLogVerbosityLevel(0));
      Client.execute(new TdApi.SetLogStream(new TdApi.LogStreamFile("tdlib.log", 1 << 27, false)));
    } catch (Client.ExecutionException error) {
      throw new IOError(new IOException("Write access to the current directory is required"));
    }

    // create client
    client = Client.create(new UpdateHandler(), null, null);

    // main loop
    while (!needQuit) {
      // await authorization
      authorizationLock.lock();
      try {
        while (!haveAuthorization) {
          gotAuthorization.await();
        }
      } finally {
        authorizationLock.unlock();
      }

      while (haveAuthorization) {
        getCommand();
      }
    }
    while (!canQuit) {
      Thread.sleep(1);
    }
  }

  private static class OrderedChat implements Comparable<OrderedChat> {
    final long chatId;
    final TdApi.ChatPosition position;

    OrderedChat(long chatId, TdApi.ChatPosition position) {
      this.chatId = chatId;
      this.position = position;
    }

    @Override
    public int compareTo(OrderedChat o) {
      if (this.position.order != o.position.order) {
        return o.position.order < this.position.order ? -1 : 1;
      }
      if (this.chatId != o.chatId) {
        return o.chatId < this.chatId ? -1 : 1;
      }
      return 0;
    }

    @Override
    public boolean equals(Object obj) {
      OrderedChat o = (OrderedChat) obj;
      return this.chatId == o.chatId && this.position.order == o.position.order;
    }
  }

  private static class DefaultHandler implements Client.ResultHandler {
    @Override
    public void onResult(TdApi.Object object) {
      print(object.toString());
    }
  }

  private static class UpdateHandler implements Client.ResultHandler {
    @Override
    public void onResult(TdApi.Object object) {
      switch (object.getConstructor()) {
      case TdApi.UpdateAuthorizationState.CONSTRUCTOR:
        onAuthorizationStateUpdated(((TdApi.UpdateAuthorizationState) object).authorizationState);
        break;

      case TdApi.UpdateUser.CONSTRUCTOR:
        TdApi.UpdateUser updateUser = (TdApi.UpdateUser) object;
        users.put(updateUser.user.id, updateUser.user);
        break;
      case TdApi.UpdateUserStatus.CONSTRUCTOR: {
        TdApi.UpdateUserStatus updateUserStatus = (TdApi.UpdateUserStatus) object;
        TdApi.User user = users.get(updateUserStatus.userId);
        synchronized (user) {
          user.status = updateUserStatus.status;
        }
        break;
      }
      case TdApi.UpdateBasicGroup.CONSTRUCTOR:
        TdApi.UpdateBasicGroup updateBasicGroup = (TdApi.UpdateBasicGroup) object;
        basicGroups.put(updateBasicGroup.basicGroup.id, updateBasicGroup.basicGroup);
        break;
      case TdApi.UpdateSupergroup.CONSTRUCTOR:
        TdApi.UpdateSupergroup updateSupergroup = (TdApi.UpdateSupergroup) object;
        supergroups.put(updateSupergroup.supergroup.id, updateSupergroup.supergroup);
        break;
      case TdApi.UpdateSecretChat.CONSTRUCTOR:
        TdApi.UpdateSecretChat updateSecretChat = (TdApi.UpdateSecretChat) object;
        secretChats.put(updateSecretChat.secretChat.id, updateSecretChat.secretChat);
        break;

      case TdApi.UpdateNewChat.CONSTRUCTOR: {
        TdApi.UpdateNewChat updateNewChat = (TdApi.UpdateNewChat) object;
        TdApi.Chat chat = updateNewChat.chat;
        synchronized (chat) {
          chats.put(chat.id, chat);

          TdApi.ChatPosition[] positions = chat.positions;
          chat.positions = new TdApi.ChatPosition[0];
          setChatPositions(chat, positions);
        }
        break;
      }
      case TdApi.UpdateChatTitle.CONSTRUCTOR: {
        TdApi.UpdateChatTitle updateChat = (TdApi.UpdateChatTitle) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.title = updateChat.title;
        }
        break;
      }
      case TdApi.UpdateChatPhoto.CONSTRUCTOR: {
        TdApi.UpdateChatPhoto updateChat = (TdApi.UpdateChatPhoto) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.photo = updateChat.photo;
        }
        break;
      }
      case TdApi.UpdateChatPermissions.CONSTRUCTOR: {
        TdApi.UpdateChatPermissions update = (TdApi.UpdateChatPermissions) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.permissions = update.permissions;
        }
        break;
      }
      case TdApi.UpdateChatLastMessage.CONSTRUCTOR: {
        TdApi.UpdateChatLastMessage updateChat = (TdApi.UpdateChatLastMessage) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.lastMessage = updateChat.lastMessage;
          setChatPositions(chat, updateChat.positions);
        }
        break;
      }
      case TdApi.UpdateChatPosition.CONSTRUCTOR: {
        TdApi.UpdateChatPosition updateChat = (TdApi.UpdateChatPosition) object;
        if (updateChat.position.list.getConstructor() != TdApi.ChatListMain.CONSTRUCTOR) {
          break;
        }

        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          int i;
          for (i = 0; i < chat.positions.length; i++) {
            if (chat.positions[i].list.getConstructor() == TdApi.ChatListMain.CONSTRUCTOR) {
              break;
            }
          }
          TdApi.ChatPosition[] new_positions = new TdApi.ChatPosition[chat.positions.length + (updateChat.position.order == 0 ? 0 : 1) - (i < chat.positions.length ? 1 : 0)];
          int pos = 0;
          if (updateChat.position.order != 0) {
            new_positions[pos++] = updateChat.position;
          }
          for (int j = 0; j < chat.positions.length; j++) {
            if (j != i) {
              new_positions[pos++] = chat.positions[j];
            }
          }
          assert pos == new_positions.length;

          setChatPositions(chat, new_positions);
        }
        break;
      }
      case TdApi.UpdateChatReadInbox.CONSTRUCTOR: {
        TdApi.UpdateChatReadInbox updateChat = (TdApi.UpdateChatReadInbox) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.lastReadInboxMessageId = updateChat.lastReadInboxMessageId;
          chat.unreadCount = updateChat.unreadCount;
        }
        break;
      }
      case TdApi.UpdateChatReadOutbox.CONSTRUCTOR: {
        TdApi.UpdateChatReadOutbox updateChat = (TdApi.UpdateChatReadOutbox) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.lastReadOutboxMessageId = updateChat.lastReadOutboxMessageId;
        }
        break;
      }
      case TdApi.UpdateChatActionBar.CONSTRUCTOR: {
        TdApi.UpdateChatActionBar updateChat = (TdApi.UpdateChatActionBar) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.actionBar = updateChat.actionBar;
        }
        break;
      }
      case TdApi.UpdateChatAvailableReactions.CONSTRUCTOR: {
        TdApi.UpdateChatAvailableReactions updateChat = (TdApi.UpdateChatAvailableReactions) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.availableReactions = updateChat.availableReactions;
        }
        break;
      }
      case TdApi.UpdateChatDraftMessage.CONSTRUCTOR: {
        TdApi.UpdateChatDraftMessage updateChat = (TdApi.UpdateChatDraftMessage) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.draftMessage = updateChat.draftMessage;
          setChatPositions(chat, updateChat.positions);
        }
        break;
      }
      case TdApi.UpdateChatMessageSender.CONSTRUCTOR: {
        TdApi.UpdateChatMessageSender updateChat = (TdApi.UpdateChatMessageSender) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.messageSenderId = updateChat.messageSenderId;
        }
        break;
      }
      case TdApi.UpdateChatMessageAutoDeleteTime.CONSTRUCTOR: {
        TdApi.UpdateChatMessageAutoDeleteTime updateChat = (TdApi.UpdateChatMessageAutoDeleteTime) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.messageAutoDeleteTime = updateChat.messageAutoDeleteTime;
        }
        break;
      }
      case TdApi.UpdateChatNotificationSettings.CONSTRUCTOR: {
        TdApi.UpdateChatNotificationSettings update = (TdApi.UpdateChatNotificationSettings) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.notificationSettings = update.notificationSettings;
        }
        break;
      }
      case TdApi.UpdateChatPendingJoinRequests.CONSTRUCTOR: {
        TdApi.UpdateChatPendingJoinRequests update = (TdApi.UpdateChatPendingJoinRequests) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.pendingJoinRequests = update.pendingJoinRequests;
        }
        break;
      }
      case TdApi.UpdateChatReplyMarkup.CONSTRUCTOR: {
        TdApi.UpdateChatReplyMarkup updateChat = (TdApi.UpdateChatReplyMarkup) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.replyMarkupMessageId = updateChat.replyMarkupMessageId;
        }
        break;
      }
      case TdApi.UpdateChatBackground.CONSTRUCTOR: {
        TdApi.UpdateChatBackground updateChat = (TdApi.UpdateChatBackground) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.background = updateChat.background;
        }
        break;
      }
      case TdApi.UpdateChatTheme.CONSTRUCTOR: {
        TdApi.UpdateChatTheme updateChat = (TdApi.UpdateChatTheme) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.themeName = updateChat.themeName;
        }
        break;
      }
      case TdApi.UpdateChatUnreadMentionCount.CONSTRUCTOR: {
        TdApi.UpdateChatUnreadMentionCount updateChat = (TdApi.UpdateChatUnreadMentionCount) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.unreadMentionCount = updateChat.unreadMentionCount;
        }
        break;
      }
      case TdApi.UpdateChatUnreadReactionCount.CONSTRUCTOR: {
        TdApi.UpdateChatUnreadReactionCount updateChat = (TdApi.UpdateChatUnreadReactionCount) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.unreadReactionCount = updateChat.unreadReactionCount;
        }
        break;
      }
      case TdApi.UpdateChatVideoChat.CONSTRUCTOR: {
        TdApi.UpdateChatVideoChat updateChat = (TdApi.UpdateChatVideoChat) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.videoChat = updateChat.videoChat;
        }
        break;
      }
      case TdApi.UpdateChatDefaultDisableNotification.CONSTRUCTOR: {
        TdApi.UpdateChatDefaultDisableNotification update = (TdApi.UpdateChatDefaultDisableNotification) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.defaultDisableNotification = update.defaultDisableNotification;
        }
        break;
      }
      case TdApi.UpdateChatHasProtectedContent.CONSTRUCTOR: {
        TdApi.UpdateChatHasProtectedContent updateChat = (TdApi.UpdateChatHasProtectedContent) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.hasProtectedContent = updateChat.hasProtectedContent;
        }
        break;
      }
      case TdApi.UpdateChatIsTranslatable.CONSTRUCTOR: {
        TdApi.UpdateChatIsTranslatable update = (TdApi.UpdateChatIsTranslatable) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.isTranslatable = update.isTranslatable;
        }
        break;
      }
      case TdApi.UpdateChatIsMarkedAsUnread.CONSTRUCTOR: {
        TdApi.UpdateChatIsMarkedAsUnread update = (TdApi.UpdateChatIsMarkedAsUnread) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.isMarkedAsUnread = update.isMarkedAsUnread;
        }
        break;
      }
      case TdApi.UpdateChatBlockList.CONSTRUCTOR: {
        TdApi.UpdateChatBlockList update = (TdApi.UpdateChatBlockList) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.blockList = update.blockList;
        }
        break;
      }
      case TdApi.UpdateChatHasScheduledMessages.CONSTRUCTOR: {
        TdApi.UpdateChatHasScheduledMessages update = (TdApi.UpdateChatHasScheduledMessages) object;
        TdApi.Chat chat = chats.get(update.chatId);
        synchronized (chat) {
          chat.hasScheduledMessages = update.hasScheduledMessages;
        }
        break;
      }

      case TdApi.UpdateMessageMentionRead.CONSTRUCTOR: {
        TdApi.UpdateMessageMentionRead updateChat = (TdApi.UpdateMessageMentionRead) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.unreadMentionCount = updateChat.unreadMentionCount;
        }
        break;
      }
      case TdApi.UpdateMessageUnreadReactions.CONSTRUCTOR: {
        TdApi.UpdateMessageUnreadReactions updateChat = (TdApi.UpdateMessageUnreadReactions) object;
        TdApi.Chat chat = chats.get(updateChat.chatId);
        synchronized (chat) {
          chat.unreadReactionCount = updateChat.unreadReactionCount;
        }
        break;
      }

      case TdApi.UpdateUserFullInfo.CONSTRUCTOR:
        TdApi.UpdateUserFullInfo updateUserFullInfo = (TdApi.UpdateUserFullInfo) object;
        usersFullInfo.put(updateUserFullInfo.userId, updateUserFullInfo.userFullInfo);
        break;
      case TdApi.UpdateBasicGroupFullInfo.CONSTRUCTOR:
        TdApi.UpdateBasicGroupFullInfo updateBasicGroupFullInfo = (TdApi.UpdateBasicGroupFullInfo) object;
        basicGroupsFullInfo.put(updateBasicGroupFullInfo.basicGroupId, updateBasicGroupFullInfo.basicGroupFullInfo);
        break;
      case TdApi.UpdateSupergroupFullInfo.CONSTRUCTOR:
        TdApi.UpdateSupergroupFullInfo updateSupergroupFullInfo = (TdApi.UpdateSupergroupFullInfo) object;
        supergroupsFullInfo.put(updateSupergroupFullInfo.supergroupId, updateSupergroupFullInfo.supergroupFullInfo);
        break;
      default:
        // print("Unsupported update:" + newLine + object);
      }
    }
  }

  private static class AuthorizationRequestHandler implements Client.ResultHandler {
    @Override
    public void onResult(TdApi.Object object) {
      switch (object.getConstructor()) {
      case TdApi.Error.CONSTRUCTOR:
        System.err.println("Receive an error:" + newLine + object);
        onAuthorizationStateUpdated(null); // repeat last action
        break;
      case TdApi.Ok.CONSTRUCTOR:
        // result is already received through UpdateAuthorizationState, nothing to do
        break;
      default:
        System.err.println("Receive wrong response from TDLib:" + newLine + object);
      }
    }
  }

  private static class LogMessageHandler implements Client.LogMessageHandler {
    @Override
    public void onLogMessage(int verbosityLevel, String message) {
      if (verbosityLevel == 0) {
        onFatalError(message);
        return;
      }
      System.err.println(message);
    }
  }

  private static void onFatalError(String errorMessage) {
    final class ThrowError implements Runnable {
      private final String errorMessage;
      private final AtomicLong errorThrowTime;

      private ThrowError(String errorMessage, AtomicLong errorThrowTime) {
        this.errorMessage = errorMessage;
        this.errorThrowTime = errorThrowTime;
      }

      @Override
      public void run() {
        if (isDatabaseBrokenError(errorMessage) || isDiskFullError(errorMessage) || isDiskError(errorMessage)) {
          processExternalError();
          return;
        }

        errorThrowTime.set(System.currentTimeMillis());
        throw new ClientError("TDLib fatal error: " + errorMessage);
      }

      private void processExternalError() {
        errorThrowTime.set(System.currentTimeMillis());
        throw new ExternalClientError("Fatal error: " + errorMessage);
      }

      final class ClientError extends Error {
        private ClientError(String message) {
          super(message);
        }
      }

      final class ExternalClientError extends Error {
        public ExternalClientError(String message) {
          super(message);
        }
      }

      private boolean isDatabaseBrokenError(String message) {
        return message.contains("Wrong key or database is corrupted") || message.contains("SQL logic error or missing database") || message.contains("database disk image is malformed")
            || message.contains("file is encrypted or is not a database") || message.contains("unsupported file format")
            || message.contains("Database was corrupted and deleted during execution and can't be recreated");
      }

      private boolean isDiskFullError(String message) {
        return message.contains("PosixError : No space left on device") || message.contains("database or disk is full");
      }

      private boolean isDiskError(String message) {
        return message.contains("I/O error") || message.contains("Structure needs cleaning");
      }
    }

    final AtomicLong errorThrowTime = new AtomicLong(Long.MAX_VALUE);
    new Thread(new ThrowError(errorMessage, errorThrowTime), "TDLib fatal error thread").start();

    // wait at least 10 seconds after the error is thrown
    while (errorThrowTime.get() >= System.currentTimeMillis() - 10000) {
      try {
        Thread.sleep(1000 /* milliseconds */);
      } catch (InterruptedException ignore) {
        Thread.currentThread().interrupt();
      }
    }
  }
}
```

## 代码解释

该示例代码展示了如何使用 **java-td-lib** 与 Telegram 进行交互，涵盖了授权流程、处理更新、发送消息等基本操作。以下是对代码各部分的详细解释：

### 1. 导入必要的包

```java
import java.io.BufferedReader;
import java.io.IOError;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.NavigableSet;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import org.drinkless.tdlib.Client;
import org.drinkless.tdlib.TdApi;
```

- **Java 标准库**：用于输入输出、数据结构、并发控制等。
- **TDLib 库**：`Client` 和 `TdApi` 是与 Telegram 服务器通信的核心类。

### 2. 定义类和变量

```java
public final class Example {
  private static Client client = null;

  private static TdApi.AuthorizationState authorizationState = null;
  private static volatile boolean haveAuthorization = false;
  private static volatile boolean needQuit = false;
  private static volatile boolean canQuit = false;

  private static final Client.ResultHandler defaultHandler = new DefaultHandler();

  private static final Lock authorizationLock = new ReentrantLock();
  private static final Condition gotAuthorization = authorizationLock.newCondition();

  private static final ConcurrentMap<Long, TdApi.User> users = new ConcurrentHashMap<>();
  // ... 其他映射表和变量
}
```

- **`client`**：TDLib 客户端实例。
- **授权相关变量**：跟踪授权状态和控制应用退出流程。
- **并发数据结构**：用于存储用户、群组、聊天等信息，确保线程安全。
- **锁和条件变量**：用于在多线程环境下控制授权流程。

### 3. 打印辅助方法

```java
private static void print(String str) {
  if (currentPrompt != null) {
    System.out.println("");
  }
  System.out.println(str);
  if (currentPrompt != null) {
    System.out.print(currentPrompt);
  }
}
```

- **`print` 方法**：用于在控制台输出信息，确保在提示输入时格式正确。

### 4. 设置聊天位置

```java
private static void setChatPositions(TdApi.Chat chat, TdApi.ChatPosition[] positions) {
  synchronized (mainChatList) {
    synchronized (chat) {
      for (TdApi.ChatPosition position : chat.positions) {
        if (position.list.getConstructor() == TdApi.ChatListMain.CONSTRUCTOR) {
          mainChatList.remove(new OrderedChat(chat.id, position));
        }
      }

      chat.positions = positions;

      for (TdApi.ChatPosition position : chat.positions) {
        if (position.list.getConstructor() == TdApi.ChatListMain.CONSTRUCTOR) {
          mainChatList.add(new OrderedChat(chat.id, position));
        }
      }
    }
  }
}
```

- **`setChatPositions` 方法**：更新聊天在主聊天列表中的位置，确保聊天按照指定顺序排列。

### 5. 处理授权状态更新

```java
private static void onAuthorizationStateUpdated(TdApi.AuthorizationState authorizationState) {
  // 更新当前授权状态
  if (authorizationState != null) {
    Example.authorizationState = authorizationState;
  }
  switch (Example.authorizationState.getConstructor()) {
    case TdApi.AuthorizationStateWaitTdlibParameters.CONSTRUCTOR:
      // 设置 TDLib 参数
      TdApi.SetTdlibParameters request = new TdApi.SetTdlibParameters();
      request.databaseDirectory = "tdlib";
      request.useMessageDatabase = true;
      request.useSecretChats = true;
      request.apiId = 94575;
      request.apiHash = "a3406de8d171bb422bb6ddf3bbd800e2";
      request.systemLanguageCode = "en";
      request.deviceModel = "Desktop";
      request.applicationVersion = "1.0";

      client.send(request, new AuthorizationRequestHandler());
      break;
    // 处理其他授权状态，如等待手机号、验证码、注册等
    // ...
    case TdApi.AuthorizationStateReady.CONSTRUCTOR:
      haveAuthorization = true;
      authorizationLock.lock();
      try {
        gotAuthorization.signal();
      } finally {
        authorizationLock.unlock();
      }
      break;
    // 处理登出、关闭等状态
    // ...
    default:
      System.err.println("不支持的授权状态:" + newLine + Example.authorizationState);
  }
}
```

- **授权流程**：根据不同的授权状态，发送相应的请求，如设置参数、输入手机号、验证码、注册信息等。
- **状态转换**：当授权完成 (`AuthorizationStateReady`) 时，更新标志并通知主线程。

### 6. 辅助方法

```java
private static int toInt(String arg) {
  int result = 0;
  try {
    result = Integer.parseInt(arg);
  } catch (NumberFormatException ignored) {
  }
  return result;
}

private static long getChatId(String arg) {
  long chatId = 0;
  try {
    chatId = Long.parseLong(arg);
  } catch (NumberFormatException ignored) {
  }
  return chatId;
}

private static String promptString(String prompt) {
  System.out.print(prompt);
  currentPrompt = prompt;
  BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
  String str = "";
  try {
    str = reader.readLine();
  } catch (IOException e) {
    e.printStackTrace();
  }
  currentPrompt = null;
  return str;
}
```

- **`toInt` 和 `getChatId` 方法**：将字符串转换为整数和长整数，用于解析命令参数。
- **`promptString` 方法**：在控制台提示用户输入信息，并读取输入。

### 7. 处理用户命令

```java
private static void getCommand() {
  String command = promptString(commandsLine);
  String[] commands = command.split(" ", 2);
  try {
    switch (commands[0]) {
      case "gcs": {
        int limit = 20;
        if (commands.length > 1) {
          limit = toInt(commands[1]);
        }
        getMainChatList(limit);
        break;
      }
      case "gc":
        client.send(new TdApi.GetChat(getChatId(commands[1])), defaultHandler);
        break;
      case "me":
        client.send(new TdApi.GetMe(), defaultHandler);
        break;
      case "sm": {
        String[] args = commands[1].split(" ", 2);
        sendMessage(getChatId(args[0]), args[1]);
        break;
      }
      case "lo":
        haveAuthorization = false;
        client.send(new TdApi.LogOut(), defaultHandler);
        break;
      case "q":
        needQuit = true;
        haveAuthorization = false;
        client.send(new TdApi.Close(), defaultHandler);
        break;
      default:
        System.err.println("不支持的命令: " + command);
    }
  } catch (ArrayIndexOutOfBoundsException e) {
    print("参数不足");
  }
}
```

- **命令解析**：根据用户输入的命令执行相应操作，如获取聊天列表、获取聊天详情、获取当前用户信息、发送消息、登出和退出应用。

### 8. 获取主聊天列表

```java
private static void getMainChatList(final int limit) {
  synchronized (mainChatList) {
    if (!haveFullMainChatList && limit > mainChatList.size()) {
      // 如果有未知聊天且已知聊天数量不足，发送 LoadChats 请求
      client.send(new TdApi.LoadChats(new TdApi.ChatListMain(), limit - mainChatList.size()), new Client.ResultHandler() {
        @Override
        public void onResult(TdApi.Object object) {
          switch (object.getConstructor()) {
            case TdApi.Error.CONSTRUCTOR:
              if (((TdApi.Error) object).code == 404) {
                synchronized (mainChatList) {
                  haveFullMainChatList = true;
                }
              } else {
                System.err.println("接收 LoadChats 错误:" + newLine + object);
              }
              break;
            case TdApi.Ok.CONSTRUCTOR:
              // 通过更新接收聊天信息，重新尝试请求
              getMainChatList(limit);
              break;
            default:
              System.err.println("从 TDLib 接收错误响应:" + newLine + object);
          }
        }
      });
      return;
    }

    java.util.Iterator<OrderedChat> iter = mainChatList.iterator();
    System.out.println();
    System.out.println("前 " + limit + " 个聊天，共 " + mainChatList.size() + " 个已知聊天:");
    for (int i = 0; i < limit && i < mainChatList.size(); i++) {
      long chatId = iter.next().chatId;
      TdApi.Chat chat = chats.get(chatId);
      synchronized (chat) {
        System.out.println(chatId + ": " + chat.title);
      }
    }
    print("");
  }
}
```

- **`getMainChatList` 方法**：获取主聊天列表，若已知聊天数量不足则请求更多聊天信息。
- **同步处理**：确保在多线程环境下对聊天列表的操作是安全的。

### 9. 发送消息

```java
private static void sendMessage(long chatId, String message) {
  // 初始化回复标记，仅用于测试
  TdApi.InlineKeyboardButton[] row = { 
    new TdApi.InlineKeyboardButton("https://telegram.org?1", new TdApi.InlineKeyboardButtonTypeUrl()),
    new TdApi.InlineKeyboardButton("https://telegram.org?2", new TdApi.InlineKeyboardButtonTypeUrl()),
    new TdApi.InlineKeyboardButton("https://telegram.org?3", new TdApi.InlineKeyboardButtonTypeUrl()) 
  };
  TdApi.ReplyMarkup replyMarkup = new TdApi.ReplyMarkupInlineKeyboard(new TdApi.InlineKeyboardButton[][] { row, row, row });

  TdApi.InputMessageContent content = new TdApi.InputMessageText(new TdApi.FormattedText(message, null), null, true);
  client.send(new TdApi.SendMessage(chatId, 0, null, null, replyMarkup, content), defaultHandler);
}
```

- **`sendMessage` 方法**：向指定聊天发送消息，并附带内联键盘作为回复标记。
- **内联键盘**：用于在消息中嵌入按钮，用户可以点击这些按钮执行特定操作。

### 10. 主方法

```java
public static void main(String[] args) throws InterruptedException {
  // 设置日志消息处理器，仅处理致命错误（0）和普通日志消息（-1）
  Client.setLogMessageHandler(0, new LogMessageHandler());

  // 禁用 TDLib 日志并将致命错误和普通日志消息重定向到文件
  try {
    Client.execute(new TdApi.SetLogVerbosityLevel(0));
    Client.execute(new TdApi.SetLogStream(new TdApi.LogStreamFile("tdlib.log", 1 << 27, false)));
  } catch (Client.ExecutionException error) {
    throw new IOError(new IOException("当前目录需要写权限"));
  }

  // 创建客户端
  client = Client.create(new UpdateHandler(), null, null);

  // 主循环
  while (!needQuit) {
    // 等待授权
    authorizationLock.lock();
    try {
      while (!haveAuthorization) {
        gotAuthorization.await();
      }
    } finally {
      authorizationLock.unlock();
    }

    while (haveAuthorization) {
      getCommand();
    }
  }
  while (!canQuit) {
    Thread.sleep(1);
  }
}
```

- **日志配置**：设置日志级别和日志输出流，将日志写入文件 `tdlib.log`。
- **客户端创建**：通过 `Client.create` 创建 TDLib 客户端，并指定更新处理器 `UpdateHandler`。
- **主循环**：等待授权完成后，持续获取并执行用户输入的命令，直到用户选择退出。

### 11. 处理更新

```java
private static class UpdateHandler implements Client.ResultHandler {
  @Override
  public void onResult(TdApi.Object object) {
    switch (object.getConstructor()) {
      case TdApi.UpdateAuthorizationState.CONSTRUCTOR:
        onAuthorizationStateUpdated(((TdApi.UpdateAuthorizationState) object).authorizationState);
        break;
      // 处理用户、群组、聊天等的更新
      // ...
      default:
        // 其他更新不处理
    }
  }
}
```

- **`UpdateHandler` 类**：实现 `Client.ResultHandler` 接口，用于处理来自 TDLib 的各种更新，如授权状态变化、用户信息更新、聊天信息更新等。
- **更新类型**：根据更新的构造函数 (`getConstructor`)，区分不同类型的更新，并进行相应处理。

### 12. 授权请求处理器

```java
private static class AuthorizationRequestHandler implements Client.ResultHandler {
  @Override
  public void onResult(TdApi.Object object) {
    switch (object.getConstructor()) {
      case TdApi.Error.CONSTRUCTOR:
        System.err.println("接收错误:" + newLine + object);
        onAuthorizationStateUpdated(null); // 重复上一个操作
        break;
      case TdApi.Ok.CONSTRUCTOR:
        // 结果已通过 UpdateAuthorizationState 接收，无需处理
        break;
      default:
        System.err.println("从 TDLib 接收错误响应:" + newLine + object);
    }
  }
}
```

- **`AuthorizationRequestHandler` 类**：处理授权请求的结果，主要处理错误情况。
- **错误处理**：如果接收到错误响应，输出错误信息并重复上一个授权操作。

### 13. 日志消息处理器

```java
private static class LogMessageHandler implements Client.LogMessageHandler {
  @Override
  public void onLogMessage(int verbosityLevel, String message) {
    if (verbosityLevel == 0) {
      onFatalError(message);
      return;
    }
    System.err.println(message);
  }
}
```

- **`LogMessageHandler` 类**：实现 `Client.LogMessageHandler` 接口，用于处理 TDLib 的日志消息。
- **致命错误**：如果日志级别为 0，表示致命错误，调用 `onFatalError` 方法处理。

### 14. 处理致命错误

```java
private static void onFatalError(String errorMessage) {
  final class ThrowError implements Runnable {
    private final String errorMessage;
    private final AtomicLong errorThrowTime;

    private ThrowError(String errorMessage, AtomicLong errorThrowTime) {
      this.errorMessage = errorMessage;
      this.errorThrowTime = errorThrowTime;
    }

    @Override
    public void run() {
      if (isDatabaseBrokenError(errorMessage) || isDiskFullError(errorMessage) || isDiskError(errorMessage)) {
        processExternalError();
        return;
      }

      errorThrowTime.set(System.currentTimeMillis());
      throw new ClientError("TDLib 致命错误: " + errorMessage);
    }

    private void processExternalError() {
      errorThrowTime.set(System.currentTimeMillis());
      throw new ExternalClientError("致命错误: " + errorMessage);
    }

    final class ClientError extends Error {
      private ClientError(String message) {
        super(message);
      }
    }

    final class ExternalClientError extends Error {
      public ExternalClientError(String message) {
        super(message);
      }
    }

    private boolean isDatabaseBrokenError(String message) {
      return message.contains("Wrong key or database is corrupted") ||
             message.contains("SQL logic error or missing database") ||
             message.contains("database disk image is malformed") ||
             message.contains("file is encrypted or is not a database") ||
             message.contains("unsupported file format") ||
             message.contains("Database was corrupted and deleted during execution and can't be recreated");
    }

    private boolean isDiskFullError(String message) {
      return message.contains("PosixError : No space left on device") ||
             message.contains("database or disk is full");
    }

    private boolean isDiskError(String message) {
      return message.contains("I/O error") ||
             message.contains("Structure needs cleaning");
    }
  }

  final AtomicLong errorThrowTime = new AtomicLong(Long.MAX_VALUE);
  new Thread(new ThrowError(errorMessage, errorThrowTime), "TDLib 致命错误线程").start();

  // 等待至少 10 秒后错误抛出
  while (errorThrowTime.get() >= System.currentTimeMillis() - 10000) {
    try {
      Thread.sleep(1000 /* 毫秒 */);
    } catch (InterruptedException ignore) {
      Thread.currentThread().interrupt();
    }
  }
}
```

- **`onFatalError` 方法**：处理 TDLib 抛出的致命错误。
- **错误分类**：根据错误信息判断是数据库损坏、磁盘空间不足还是其他磁盘错误，并抛出相应的异常。
- **线程处理**：在新线程中抛出错误，主线程等待错误抛出后进行相应处理。

### 15. 有序聊天类

```java
private static class OrderedChat implements Comparable<OrderedChat> {
  final long chatId;
  final TdApi.ChatPosition position;

  OrderedChat(long chatId, TdApi.ChatPosition position) {
    this.chatId = chatId;
    this.position = position;
  }

  @Override
  public int compareTo(OrderedChat o) {
    if (this.position.order != o.position.order) {
      return o.position.order < this.position.order ? -1 : 1;
    }
    if (this.chatId != o.chatId) {
      return o.chatId < this.chatId ? -1 : 1;
    }
    return 0;
  }

  @Override
  public boolean equals(Object obj) {
    if (!(obj instanceof OrderedChat)) return false;
    OrderedChat o = (OrderedChat) obj;
    return this.chatId == o.chatId && this.position.order == o.position.order;
  }

  @Override
  public int hashCode() {
    return Long.hashCode(chatId) * 31 + Integer.hashCode(position.order);
  }
}
```

- **`OrderedChat` 类**：用于在 `NavigableSet` 中按顺序存储聊天信息，确保聊天按照指定顺序排列。
- **`compareTo` 方法**：定义了聊天的排序规则，首先按位置顺序排序，如果顺序相同，则按 `chatId` 排序。

### 16. 默认结果处理器

```java
private static class DefaultHandler implements Client.ResultHandler {
  @Override
  public void onResult(TdApi.Object object) {
    print(object.toString());
  }
}
```

- **`DefaultHandler` 类**：实现 `Client.ResultHandler` 接口，用于处理默认的结果响应，直接打印响应内容。

## 总结

该示例展示了如何使用 **java-td-lib** 库与 Telegram 进行基本的交互，包括授权流程、处理各种更新、发送消息等。通过合理使用并发数据结构和同步机制，确保了多线程环境下的数据一致性和安全性。同时，示例代码还包含了错误处理机制，能够应对潜在的致命错误，保证应用的稳定运行。

开发者可以基于该示例进一步扩展功能，实现更复杂的 Telegram 客户端应用。

## JsonExample
```java
package org.drinkless.tdlib.example;

import org.drinkless.tdlib.JsonClient;

/**
 * Example class for TDLib usage from Java using JSON interface.
 */
public final class JsonExample {
  public static void main(String[] args) throws InterruptedException {
    // set log message handler to handle only fatal errors (0) and plain log messages (-1)
    JsonClient.setLogMessageHandler(0, new LogMessageHandler());

    // disable TDLib log and redirect fatal errors and plain log messages to a file
    JsonClient.execute("{\"@type\":\"setLogVerbosityLevel\",\"new_verbosity_level\":0}");
    JsonClient.execute("{\"@type\":\"setLogStream\",\"log_stream\":{\"@type\":\"logStreamFile\",\"path\":\"tdlib.log\",\"max_file_size\":128000000}}");

    // create client identifier
    int clientId = JsonClient.createClientId();

    // send first request to activate the client
    JsonClient.send(clientId, "{\"@type\":\"getOption\",\"name\":\"version\"}");

    // main loop
    while (true) {
      String result = JsonClient.receive(100.0);
      if (result != null) {
        System.out.println(result);
      }
    }
  }

  private static class LogMessageHandler implements JsonClient.LogMessageHandler {
    @Override
    public void onLogMessage(int verbosityLevel, String message) {
      System.err.print(message);
      if (verbosityLevel == 0) {
        System.err.println("Receive fatal error; the process will crash now");
      }
    }
  }
}

```