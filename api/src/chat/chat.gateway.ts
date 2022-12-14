import { Logger, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Socket, Namespace } from 'socket.io';
import { WsCatchAllFilter } from 'src/socket/exceptions/ws-catch-all-filter';
import { MsgToClient, MsgToServer } from './chat.class';
import { ChatService } from './chat.service';

@UseFilters(new WsCatchAllFilter())
@WebSocketGateway({ namespace: 'chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {

  @WebSocketServer() server: Namespace;

  constructor(private readonly chatService: ChatService) { }


  private logger: Logger = new Logger(ChatGateway.name);

  afterInit() {
    this.logger.log('Chat Websocket Gateway initialized.');
  }

  handleConnection(client: Socket) {
    const sockets = this.server.sockets;
    this.logger.log(`WS client with id: ${client.id} connected of chatSocket!`);
    this.logger.debug(`Number of connected chatSockets: ${sockets.size}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const sockets = this.server.sockets;
    this.logger.log(`Disconnected of chatSocket the socket id: ${client.id}`);
    this.logger.debug(`Number of connected chatSockets: ${sockets.size}`);
  }

  @SubscribeMessage('joinAll')
  async handleJoinAll(@ConnectedSocket() client: Socket, @MessageBody() login: string) {
    (await this.chatService.getAllChatsId(login))
      .forEach((socketId) => client.join(socketId));
    this.logger.debug(`Client ${client.id} join all chats: |${login}|`);
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(@ConnectedSocket() client: Socket, @MessageBody() chat: string) {

    client.join(chat);

    this.logger.debug(`Client ${client.id} join a chat: |${chat}|`);
  }

  @SubscribeMessage('leaveChat')
  async handleLeaveChat(@ConnectedSocket() client: Socket, @MessageBody() chat: string) {

    client.leave(chat);
    this.logger.debug(`Client ${client.id} leave a chat: |${chat}|`);
  }

  @SubscribeMessage('joinNewGroup')
  async handleJoinNewGroup(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email }: { id: string, email: string }) {

    const permission = await this.chatService.joinNewGroup(email, id);
    if (!permission)
      return;
    client.join(id);
    client.emit('updateGroupChat');
    this.server.emit('updateGroupCommunity');

    this.logger.debug(`Client ${client.id} join a group: |${id}|`);
  }

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email }: { id: string, email: string }) {
    const msgToClient: MsgToClient | null | undefined = await this.chatService.joinGroup(email, id);
    if (typeof msgToClient === 'undefined')
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    client.join(id);
    client.emit('updateGroupChat');
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} join a group: |${id}|`);
  }

  @SubscribeMessage('leaveGroup')
  async handleLeaveGroup(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email }: { id: string, email: string }) {
    const msgToClient: MsgToClient | null | undefined = await this.chatService.leaveGroup(email, id);
    if (typeof msgToClient === 'undefined')
      return;
    if (msgToClient) {
      client.emit('updateGroupCommunity');
      this.server.to(id).emit('msgToClient', msgToClient);
    }
    else {
      this.server.emit('updateGroupCommunity');
      this.server.emit('closeGroupProfile', id);
    }
    client.leave(id);
    client.emit('updateGroupChat');
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} leave a group: |${id}|`);
  }

  @SubscribeMessage('kickMember')
  async handleKickMember(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email, login }: { id: string, email: string, login: string }) {
    const msgToClient: MsgToClient | null = await this.chatService.kickMember(email, login, id);
    if (!msgToClient)
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    this.server.to(id).emit('removeGroup', id, login);
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} login: |${login}| has been kicked the group: |${id}|`);
  }

  @SubscribeMessage('removeBanMember')
  async handleRemoveBanMember(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email, login }: { id: string, email: string, login: string }) {
    const msgToClient: MsgToClient | null = await this.chatService.removeBan(email, { name: login, groupId: id });
    if (!msgToClient)
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} login: |${login}| has been banned the group: |${id}|`);
  }

  @SubscribeMessage('banMember')
  async handleBanMember(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email, login }: { id: string, email: string, login: string }) {
    const msgToClient: MsgToClient | null = await this.chatService.addBan(email, { name: login, groupId: id });
    if (!msgToClient)
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    this.server.to(id).emit('removeGroup', id, login);
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} login: |${login}| has been banned the group: |${id}|`);
  }

  @SubscribeMessage('muteMember')
  async handleMuteMember(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email, login }: { id: string, email: string, login: string }) {
    const msgToClient: MsgToClient | null = await this.chatService.addMutated(email, { name: login, groupId: id });
    if (!msgToClient)
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} login: |${login}| has been mutated the group: |${id}|`);
  }

  @SubscribeMessage('unmuteMember')
  async handleUnmuteMember(@ConnectedSocket() client: Socket,
    @MessageBody() { id, email, login }: { id: string, email: string, login: string }) {
    const msgToClient: MsgToClient | null = await this.chatService.removeMutated(email, { name: login, groupId: id });
    if (!msgToClient)
      return;
    this.server.to(id).emit('msgToClient', msgToClient);
    this.server.emit('updateGroupProfile', id);
    this.logger.debug(`Client ${client.id} login: |${login}| has been unmuted the group: |${id}|`);
  }

  @SubscribeMessage('msgToServer')
  async handleMsgToServer(@ConnectedSocket() client: Socket,
    @MessageBody() { message, type }: { message: MsgToServer, type: string }) {
    const msgToClient: MsgToClient | undefined = await this.chatService.saveMessage(message, type);
    if (msgToClient) {
      this.server.to(message.chat).emit('msgToClient', msgToClient, type);
      this.logger.debug(`Client ${client.id} send message : |${msgToClient}|`);
    }
  }
}
