import { Dispatch, SetStateAction } from 'react';
import { Socket } from 'socket.io-client';
import { proxy, ref } from 'valtio';
import { IntraData } from '../../others/Interfaces/interfaces';
import { getUserInDb } from '../../others/utils/utils';
import { actionsChat } from '../chat/chatState';
import { MsgToClient } from '../../../../api/dist/chat/chat.class';
import {
  createSocketStatus,
  CreateSocketStatusOptions,
  socketStatusIOUrl,
} from './status.socket-io';

export interface UserData {
  status: string;
  login: string;
  image_url: string;
}

export interface AppStateStatus {
  socket?: Socket;
  setIntraData?: Dispatch<SetStateAction<IntraData>> | null;
}

const stateStatus = proxy<AppStateStatus>({});

const actionsStatus = {

  initializeSocketStatus: (setIntraData: Dispatch<SetStateAction<IntraData>>): void => {
    if (!stateStatus.socket) {
      const createSocketOptions: CreateSocketStatusOptions = {
        socketStatusIOUrl: socketStatusIOUrl,
        actionsStatus: actionsStatus,
        stateStatus: stateStatus,
      };
      stateStatus.socket = ref(createSocketStatus(createSocketOptions));
      stateStatus.setIntraData = ref(setIntraData);
      return;
    }

    if (!stateStatus.socket.connected) {
      stateStatus.socket.connect();
      stateStatus.setIntraData = ref(setIntraData);
      return;
    }
  },

  disconnectSocketStatus() {
    if (stateStatus.socket?.connected) {
      stateStatus.socket?.disconnect();
    }
  },

  async iAmOnline() {
    const user = await getUserInDb();
    stateStatus.socket?.emit('iAmOnline', {
      login: user.login,
      image_url: user.image_url
    });
  },

  whoIsOnline() {
    stateStatus.socket?.emit('whoIsOnline');
  },

  changeLogin(login: string) {
    stateStatus.socket?.emit('changeLogin', login);
  },

  changeImage(image_url: string | undefined) {
    stateStatus.socket?.emit('changeImage', image_url);
  },

  newFriend(userSource: string) {
    stateStatus.socket?.emit('newFriend', userSource);
  },

  newBlocked() {
    stateStatus.socket?.emit('newBlocked');
  },

  newNotify(userTarget: string) {
    stateStatus.socket?.emit('newNotify', userTarget);
  },

  removeFriend(friend: string) {
    stateStatus.socket?.emit('deleteFriend', friend);
  },

  removeBlocked(blocked: string) {
    stateStatus.socket?.emit('removeBlocked', blocked);
  },

  blockFriend(friend: string) {
    stateStatus.socket?.emit('blockFriend', friend);
  },




  async newDirect(name: string, chat: string) {
    stateStatus.socket?.emit('newDirect', { name: name, chat: chat });
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          directs: user.directs,
        };
      });
    }
  },

  sortFriends() {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData, friends: prevIntraData.friends.sort((a, b) => {
            if (a.status !== b.status) {
              if (a.status === 'offline')
                return 1;
              if (b.status === 'offline')
                return -1;
            }
            return a.login.toLowerCase() < b.login.toLowerCase() ? -1 : 1;
          })
        };
      });
    }
  },

  onlineUsers(onlineUsers: UserData[]) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData, friends: prevIntraData.friends.map(friend => {
            if (onlineUsers.map(e => e.login).indexOf(friend.login) >= 0) {
              const updateFriend = onlineUsers.find(e => e.login === friend.login);
              if (updateFriend)
                return updateFriend;
            }
            return friend;
          }),
        };
      });
      this.sortFriends();
    }
  },

  updateYourSelf(user: UserData) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return { ...prevIntraData, login: user.login, image_url: user.image_url };
      });
    }
  },

  updateUserStatus(user: UserData) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          friends: prevIntraData.friends.map(friend =>
            user.login === friend.login ? user : friend)
        };
      });
      this.sortFriends();
    }
  },

  updateUserLogin(oldUser: UserData, newUser: UserData) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          friends: prevIntraData.friends.map(friend =>
            oldUser.login === friend.login ? newUser : friend),
          blockeds: prevIntraData.blockeds.map(blocked =>
            oldUser.login === blocked.login ? newUser : blocked),
          directs: prevIntraData.directs.map(direct =>
            oldUser.login === direct.name ? { ...direct, name: newUser.login } : direct)
        };
      });
      this.sortFriends();
    }
  },

  updateUserImage(user: UserData) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          friends: prevIntraData.friends.map(friend =>
            user.login === friend.login ? user : friend),
          directs: prevIntraData.directs.map(direct =>
            user.login === direct.name ? { ...direct, image: user.image_url } : direct)
        };
      });
    }
  },

  async updateNotify() {
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return { ...prevIntraData, notify: user.notify };
      });
    }
  },

  async updateFriend() {
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          friends: user.friends.map((obj) => {
            if (prevIntraData.friends.map(e => e.login).indexOf(obj.login) >= 0) {
              const updateFriend = prevIntraData.friends.find(e => e.login === obj.login);
              if (updateFriend)
                return updateFriend;
            }
            return obj;
          })
        };
      });
      this.whoIsOnline();
    }
  },

  async updateBlocked() {
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return { ...prevIntraData, blockeds: user.blockeds };
      });
    }
  },

  async updateFriendBlocked() {
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          friends: user.friends.map((obj) => {
            if (prevIntraData.friends.map(e => e.login).indexOf(obj.login) >= 0) {
              const updateFriend = prevIntraData.friends.find(e => e.login === obj.login);
              if (updateFriend)
                return updateFriend;
            }
            return obj;
          }),
          blockeds: user.blockeds
        };
      });
      this.sortFriends();
    }
  },

  async updateDirects(chat: string) {
    actionsChat.joinChat(chat);
    if (stateStatus.setIntraData) {
      const user = await getUserInDb();
      stateStatus.setIntraData((prevIntraData) => {
        return { ...prevIntraData, directs: user.directs };
      });
    }
  },

  updateDirectInfos(message: MsgToClient) {
    if (stateStatus.setIntraData) {
      stateStatus.setIntraData((prevIntraData) => {
        return {
          ...prevIntraData,
          directs: prevIntraData.directs.map((key) => {
            if (key.id === message.chat) {
              return {
                ...key,
                date: message.date,
                newMessages: key.newMessages + 1 };
            }
            return key;
          }),
        };
      });
    }
  },

};

export type AppActionsStatus = typeof actionsStatus;

export { stateStatus, actionsStatus };