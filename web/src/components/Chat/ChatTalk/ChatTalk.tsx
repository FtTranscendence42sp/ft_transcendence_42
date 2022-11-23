import './ChatTalk.scss';
import { MsgToClient, MsgToServer } from '../../../others/Interfaces/interfaces';
import { useContext, useEffect, useRef, useState } from 'react';
import { ArrowBendUpLeft, PaperPlaneRight } from 'phosphor-react';
import { ChatMessage } from '../ChatMessage/ChatMessage';
import { actionsChat } from '../../../adapters/chat/chatState';
import { IntraDataContext } from '../../../contexts/IntraDataContext';
import { ProfileFriendModal } from '../../ProfileFriendsModal/ProfileFriendsModal';
import ReactTooltip from 'react-tooltip';
import { ChatContext } from '../../../contexts/ChatContext';
import { actionsStatus } from '../../../adapters/status/statusState';
import { randomUUID } from 'crypto';

// interface ChatTalkProps {

// }

export function ChatTalk(
  // { }: ChatTalkProps
) {
  const {
    activeChat, setActiveChat,
    friendsChat, setFriendsChat,
    directsChat, setDirectsChat,
    groupsChat, setGroupsChat
  } = useContext(ChatContext);

  const { intraData, setIntraData, api, config } = useContext(IntraDataContext);
  const [friendProfileVisible, setFriendProfileVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return () => {
      if (activeChat)
        api.patch('/chat/setBreakpoint', { chatId: activeChat.id, type: activeChat.type }, config);
    };
  }, []);

  async function exitActiveChat() {
    api.patch('/chat/setBreakpoint', { chatId: activeChat?.id, type: activeChat?.type }, config);
    setIntraData(prev => {
      return {
        ...prev,
        directs: prev.directs.map(key => {
          if (key.id === activeChat?.id) {
            return { ...key, newMessages: 0 };
          }
          return key;
        })
      };
    });
    setActiveChat(null);
    setDirectsChat(null);
    setFriendsChat(null);
    setGroupsChat(null);
  }

  async function setActiveChatWithDirect(id: string) {
    const response = await api.patch('/chat/getDirect', { id: id }, config);
    if (activeChat) {
      exitActiveChat();
    }
    setActiveChat(response.data);
  }

  async function setActiveChatWithFriend(id: string) {
    const response = await api.patch('/chat/getFriendDirect', { id: id }, config);
    if (activeChat) {
      exitActiveChat();
    }
    setActiveChat(response.data.directDto);
    if (response.data.created) {
      actionsChat.joinChat(response.data.directDto.id);
      await actionsStatus.newDirect(response.data.directDto.name, response.data.directDto.id);
    }
  }

  useEffect(() => {
    if (directsChat)
      setActiveChatWithDirect(directsChat);
  }, [directsChat]);

  useEffect(() => {
    if (friendsChat)
      setActiveChatWithFriend(friendsChat.login);
  }, [friendsChat]);


  /**
   * The function takes an event as an argument, and then calls the preventDefault() method on the
   * event
   * @param event - React.FormEvent<HTMLFormElement>
   */
  function handleKeyEnter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  /**
   * It sends a message to the server if the message is not empty
   */
  function submitMessage() {
    if (message.trim() && activeChat) {
      const newMessage: MsgToServer = {
        chat: activeChat?.id,
        user: intraData.login,
        msg: message,
      };
      setActiveChat(prev => {
        if (prev) {
          return {
            ...prev,
            messages: prev.messages.filter(msg => msg.breakpoint !== true)
          };
        }
        return prev;
      });
      actionsChat.msgToServer(newMessage, activeChat.type);
    }
    setMessage('');
  }

  const refBody: React.RefObject<HTMLDivElement> = useRef(null);
  useEffect(() => {
    if (
      refBody.current &&
      refBody.current.scrollHeight > refBody.current.offsetHeight
    ) {
      refBody.current.scrollTop =
        refBody.current.scrollHeight - refBody.current.offsetHeight;
    }
  }, [activeChat]);

  return (
    <div className='chat__talk'>
      {activeChat != null &&
        <>
          <div className='chat__talk__header'>
            <ArrowBendUpLeft size={32} onClick={exitActiveChat} />
            <div
              className='chat__talk__header__user'
              onClick={() => setFriendProfileVisible(true)}
              data-html={true}
              data-tip={`${activeChat.name} profile`}
            >
              <div
                className='chat__talk__header__user__icon'
                style={{ backgroundImage: `url(${activeChat.image})` }}
              />
              <div className='chat__talk__header__user__name'>
                {activeChat.name}
              </div>
            </div>
          </div>
          <div className='chat__talk__body'
            ref={refBody}
          >
            {activeChat.messages.sort((a, b) => a.date < b.date ? -1 : 1)
            .map((msg: MsgToClient, index: number) => {
              if (msg.breakpoint) {
                const len = activeChat.messages?.length - 1;
                return (
                  <div className='chat__talk__unread__message'
                        style={{ display: index !== len ? '' : 'none' }}
                        key={crypto.randomUUID()}
                  >
                    <div/><p>unread message: {len - index}</p><div/>
                  </div>);
                }
              return <ChatMessage key={crypto.randomUUID()}
                                  user={intraData.login}
                                  message={msg} />;
            }
            )}
          </div>
          {friendProfileVisible &&
            <ProfileFriendModal
              login={activeChat.name}
              setFriendProfileVisible={setFriendProfileVisible} />
          }
          <form className='chat__talk__footer' onSubmit={handleKeyEnter}>
            <input
              className='chat__talk__footer__input'
              value={message}
              onChange={(msg) => setMessage(msg.target.value)}
              ref={e => { if (activeChat) e?.focus(); }}
            />
            <button className='chat__talk__footer__button' type='submit'>
              <PaperPlaneRight size={30} />
            </button>
          </form>
          <ReactTooltip className='chat__friends__header__icon__tip' delayShow={50} />
        </>
      }
    </div >
  );
}
