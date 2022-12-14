import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import { MsgToClient, MsgToServer } from './chat.class';
import { CreateGroupDto, ChatDto, UpdateGroupDto, ProfileGroupDto, CardGroupDto, GroupInviteDto, GroupProtectedJoinDto } from './dto/chat.dto';
import { Direct } from './entities/direct.entity';
import { Group } from './entities/group.entity';
import { Message } from './entities/message.entity';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { Notify } from 'src/notification/entities/notify.entity';
import { GroupRelations } from './entities/groupRelations.entity';
import { getAssetsPath } from 'src/utils/utils';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Direct) private directRepository: Repository<Direct>,
    @InjectRepository(Group) private groupRepository: Repository<Group>,
    private userService: UserService,
  ) { }

  async findDirectById(id: string): Promise<Direct> {
    const direct: Direct | null = await this.directRepository.findOne({
      where: { id: id },
      relations: [
        'users',
        'messages',
        'messages.direct',
        'messages.sender',
      ], order: {
        messages: {
          date: 'asc'
        }
      }
    });
    if (!direct)
      throw new NotFoundException('Direct not found');
    return direct;
  }

  async findGroupById(id: string): Promise<Group> {
    const group: Group | null = await this.groupRepository.findOne({
      where: { id: id },
      relations: [
        'users',
        'owner',
        'relations',
        'relations.user_target',
        'messages',
        'messages.group',
        'messages.sender',
      ], order: {
        messages: {
          date: 'asc'
        }
      }
    });
    if (!group)
      throw new NotFoundException('Group not found');
    return group;
  }

  async findGroupInfosById(id: string) {
    return await this.groupRepository.findOne({
      where: {
        id
      },
      relations: [
        'users',
        'owner',
        'relations',
        'relations.user_target',
      ], order: {
        relations: {
          date: 'desc'
        }
      }
    });
  }

  async deleteDirectById(user_email: string, friend_login: string) {
    const user = await this.userService.findUserDirectByEmail(user_email);
    const friend = await this.userService.findUserDirectByNick(friend_login);

    if (!user || !friend)
      throw new InternalServerErrorException('User Not Found deleteDirectById');

    const direct = user.directs.filter((key: Direct) => {
      if (key.users.map((u) => u.nick).indexOf(friend.nick) >= 0)
        return key;
      return;
    }).at(0);

    if (!direct)
      return;

    user.directs = user.directs.filter((key) => {
      if (key.id === direct.id)
        return;
      return key;
    });

    friend.directs = friend.directs.filter((key) => {
      if (key.id === direct.id)
        return;
      return key;
    });

    try {
      await user.save();
      await friend.save();
      await this.directRepository.delete(direct.id);
    } catch (err) {
      throw new InternalServerErrorException('Error saving data in db DeleteDirectById', err);
    }

  }

  async saveMessage(msgServer: MsgToServer, type: string): Promise<MsgToClient | undefined> {
    const user: User = await this.userService.findUserByNick(msgServer.user) as User;
    const chat: Direct | Group = type === 'direct' ?
      await this.findDirectById(msgServer.chat) :
      await this.findGroupById(msgServer.chat);

    if (!user || !chat)
      throw new BadRequestException('Invalid Request saveMessage');

    if (chat.users.map(e => e.email).indexOf(user.email) < 0)
      return undefined;

    if (type !== 'direct' && this.getRelation(chat as Group, user.nick, 'mutated'))
      return undefined;

    const msgDb = new Message();

    msgDb.sender = user;
    msgDb.date = new Date(Date.now());
    msgDb.msg = msgServer.msg;
    msgDb.type = 'message';

    chat.messages.push(msgDb);
    chat.date = msgDb.date;

    try {
      if (type === 'direct')
        await this.directRepository.save(chat);
      else
        await this.groupRepository.save(chat);
      await this.setBreakpoint(user, chat, type);
      const msgClient: MsgToClient = {
        id: msgDb.id,
        chat: chat.id,
        user: { login: user.nick, image: user.imgUrl },
        date: msgDb.date,
        msg: msgDb.msg,
        type: msgDb.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('Error saving message in db');
    }
  }

  async getBreakpoint(messages: MsgToClient[] | undefined): Promise<number> {

    let newMessages = 0;
    const breakpoint: Date | undefined = messages?.filter((msg) => msg.type === 'breakpoint').at(0)?.date;
    if (breakpoint) {
      messages?.forEach(msg => {
        if (msg.date > breakpoint)
          newMessages++;
      });
    }
    return newMessages;
  }

  async setBreakpointController(email: string, chatId: string, type: string) {
    const user = await this.userService.findUserDirectByEmail(email);
    if (!user)
      throw new BadRequestException('User Not Found setBreakpoints');

    const chat: Direct | Group = type === 'direct' ?
      await this.findDirectById(chatId) :
      await this.findGroupById(chatId);
    if (!chat)
      return;
    this.setBreakpoint(user, chat, type);
  }

  async setBreakpoint(user: User, chat: Direct | Group, type: string) {
    let index = 0;
    chat.messages.forEach((msg, i) => {
      if (msg.type === 'breakpoint' && msg.sender.nick === user.nick)
        index = i;
    });

    if (index === chat.messages.length
      || chat.messages[index].type !== 'breakpoint'
      || chat.messages[index].sender.nick !== user.nick)
      return;
    chat.messages[index].date = new Date(Date.now());

    try {
      if (type === 'direct')
        await this.directRepository.save(chat);
      else
        await this.groupRepository.save(chat);
    } catch (err) {
      throw new InternalServerErrorException(err);
    }

  }

  async getAllChatsId(login: string) {
    const user = await this.userService.findAllChats(login);
    if (!user)
      throw new BadRequestException('User Not Found getDirects');
    const chats = [...user.directs, ...user.groups];
    return chats.map((chat) => chat.id);
  }

  async getAllDirects(user_email: string) {
    const owner = await this.userService.findUserDirectByEmail(user_email);
    if (!owner)
      throw new BadRequestException('User Not Found getDirects');
    const directs: ChatDto[] = await Promise.all(owner.directs.map(async (direct) => {
      const friend = direct.users.filter((key) => key.nick !== owner.nick).at(0);
      return await this.createDirectDto(direct, owner, friend, 'cardDirect');
    }));
    return directs;
  }

  async getAllGroups(user_email: string) {
    const owner = await this.userService.findUserGroupByEmail(user_email);
    if (!owner)
      throw new BadRequestException('User Not Found getDirects');
    const groups: ChatDto[] = await Promise.all(owner.groups.map(async (group) => {
      return await this.createGroupDto(group, owner, 'cardGroup');
    }));
    return groups;
  }

  async createDirectDto(direct: Direct, owner: User | undefined, friend: User | undefined, type: string): Promise<ChatDto> {
    const directDto: ChatDto = {
      id: direct.id,
      type: 'direct',
      name: friend?.nick,
      image: friend?.imgUrl,
      date: direct.date,
      newMessages: 0
    };

    const messages: MsgToClient[] = direct.messages
      .filter(msg => msg.type !== 'breakpoint'
        || (msg.type === 'breakpoint' && msg.sender.nick === owner?.nick))
      .map((message: Message) => {
        return {
          id: message.id,
          chat: direct.id,
          user: {
            login: message.sender.nick,
            image: message.sender.imgUrl,
          },
          date: message.date,
          msg: message.msg,
          type: message.type,
        };
      });

    if (type === 'activeDirect')
      directDto.messages = messages;

    directDto.newMessages = await this.getBreakpoint(messages);

    return directDto;
  }

  async createGroupDto(group: Group, owner: User | undefined, type: string) {
    const groupDto: ChatDto = {
      id: group.id,
      type: group.type,
      name: group.name,
      image: group.image,
      date: group.date,
      newMessages: 0
    };

    const messages: MsgToClient[] = group.messages
      .filter(msg => msg.type !== 'breakpoint'
        || (msg.type === 'breakpoint' && msg.sender.nick === owner?.nick))
      .map((message: Message) => {
        return {
          id: message.id,
          chat: group.id,
          user: {
            login: message.sender.nick,
            image: message.sender.imgUrl,
          },
          date: message.date,
          msg: message.msg,
          type: message.type,
        };
      });

    if (type === 'activeGroup')
      groupDto.messages = messages;

    groupDto.newMessages = await this.getBreakpoint(messages);

    return groupDto;
  }

  async getDirect(owner_email: string, id: string): Promise<ChatDto> {
    const direct = await this.findDirectById(id);
    if (!direct)
      throw new BadRequestException('Invalid direct GetDirect');
    const owner = direct.users.filter((key: User) => key.email === owner_email).at(0);
    const friend = direct.users.filter((key: User) => key.email !== owner_email).at(0);
    if (!owner && !friend)
      throw new BadRequestException('Invalid user GetDirect');
    return this.createDirectDto(direct, owner, friend, 'activeDirect');
  }

  async getFriendDirect(owner_email: string, friend_login: string) {

    const owner = await this.userService.findUserDirectByEmail(owner_email);
    const friend = await this.userService.findUserDirectByNick(friend_login);

    if (!owner || !friend)
      throw new BadRequestException('User Not Found getFriendDirect');

    if (owner.nick === friend.nick)
      throw new UnauthorizedException('You cant talk with you getFriendDirect');

    if (this.userService.isBlocked(owner, friend) || this.userService.isBlocked(friend, owner))
      return;

    const directs: Direct[] = owner.directs.filter((key: Direct) => {
      if (key.users.map((u: User) => u.nick).indexOf(friend.nick) >= 0)
        return key;
      return;
    });

    let direct;
    let created: boolean;

    if (directs.length < 1) {
      created = true;
      const newDirect = new Direct();
      newDirect.users = [owner, friend];
      newDirect.date = new Date(Date.now());

      const ownerBreakpoint = new Message();
      ownerBreakpoint.sender = owner;
      ownerBreakpoint.date = new Date(Date.now());
      ownerBreakpoint.msg = '';
      ownerBreakpoint.type = 'breakpoint';

      const friendBreakpoint = new Message();
      friendBreakpoint.sender = friend;
      friendBreakpoint.date = new Date(Date.now());
      friendBreakpoint.msg = '';
      friendBreakpoint.type = 'breakpoint';

      newDirect.messages = [friendBreakpoint, ownerBreakpoint];
      try {
        await this.directRepository.save(newDirect);
        direct = newDirect;
      } catch (err) {

        throw new InternalServerErrorException('Error saving direct in db');
      }
    } else {
      created = false;
      direct = await this.findDirectById(directs[0].id);
    }

    return {
      directDto: await this.createDirectDto(direct, owner, friend, 'activeDirect'),
      created: created,
    };

  }

  async getGroup(owner_email: string, id: string) {
    const group = await this.findGroupById(id);
    if (!group)
      throw new BadRequestException('Invalid group GetGroup');
    const owner = group.users.filter((key: User) => key.email === owner_email).at(0);
    if (!owner)
      throw new BadRequestException('Invalid user GetGroup');
    return this.createGroupDto(group, owner, 'activeGroup');
  }

  async createGroup(group: CreateGroupDto) {
    const owner = await this.userService.findUserGroupByNick(group.owner);

    if (!owner)
      throw new BadRequestException('User Not Found createGroup');

    const newGroup = new Group();

    newGroup.type = group.type;
    newGroup.name = group.name;
    newGroup.password = group.password ? bcrypt.hashSync(group.password, 8) : null;
    newGroup.image = group.image ? group.image : 'userDefault.12345678.png';
    newGroup.owner = owner;
    newGroup.users = [];
    newGroup.messages = [];
    newGroup.date = new Date(Date.now());

    const breakpoint = new Message();
    breakpoint.sender = owner;
    breakpoint.date = new Date(Date.now() + 1);
    breakpoint.msg = '';
    breakpoint.type = 'breakpoint';

    newGroup.users.push(owner);

    try {
      await this.groupRepository.save(newGroup);
      return newGroup.id;
    } catch (err) {
      throw new InternalServerErrorException('Error saving group in db');
    }
  }

  async updateGroup(user_email: string, updateGroupDto: UpdateGroupDto) {
    const group = await this.findGroupById(updateGroupDto.id);
    if (!group)
      throw new BadRequestException('Group not Found updateGroup');

    const user = await this.userService.findUserByEmail(user_email);
    if (!user || (user.nick !== group.owner.nick && !this.getRelation(group, user.nick, 'admin')))
      throw new UnauthorizedException('Permission denied');

    const {
      image,
      name,
      type,
      password
    } = updateGroupDto;

    group.name = name ? name : group.name;
    if (image) {
      if (group.image !== 'userDefault.12345678.png') {
        fs.rm(
          `${getAssetsPath()}${group.image}`,
          function (err) {
            if (err)
              group.image = 'userDefault.12345678.png';
          }
        );
      }
      group.image = image;
    }

    if (user.nick === group.owner.nick) {
      group.type = type ? type : group.type;
      group.password = password ? bcrypt.hashSync(password, 8) : group.password;
    }

    try {
      await group.save();
    } catch (error) {
      throw new InternalServerErrorException('Error saving user update');
    }
  }

  getRole(group: Group, nick: string): string {
    if (group.owner.nick === nick)
      return 'owner';
    if (this.getRelation(group, nick, 'admin'))
      return 'admin';
    if (group.users.map(e => e.nick).indexOf(nick) >= 0)
      return 'member';
    if (this.getRelation(group, nick, 'banned'))
      return 'banned';
    return 'outside';
  }

  getRelation(group: Group, nick: string, relation: string): boolean {
    const relations = group.relations.filter(key => key.type === relation)
      .map(key => key.user_target.nick);
    if (!relations)
      return false;
    const index = relations.indexOf(nick);
    if (relation === 'mutated' && index >= 0) {
      const mutatedTime = group.relations[index].date.getTime();
      if (((Date.now() - mutatedTime) / 1000 / 60) < 15)
        return true;
      this.removeRelation(group, nick, relation);
      return false;
    }
    return index >= 0;
  }

  removeRelation(group: Group, nick: string, relation: string): void {
    group.relations = group.relations.filter((key) => {
      if (key.type === relation
        && key.user_target.nick === nick)
        return;
      return key;
    });
  }

  async getAllCardGroup(user_email: string): Promise<CardGroupDto[] | void> {
    const user = await this.userService.findUserGroupByEmail(user_email);
    if (!user)
      throw new BadRequestException('User Not Found getAllCardGroup');
    let groups = await this.groupRepository.find({
      relations: [
        'users',
        'owner',
        'relations',
        'relations.user_target',
      ]
    });

    groups = groups.filter(group =>
      !this.getRelation(group, user.nick, 'banned')
      && (group.type !== 'private'
        || (group.type === 'private' && this.getRole(group, user.nick) !== 'outside')));

    if (!groups)
      return;

    const groupsDto: CardGroupDto[] = groups.map((group) => {
      return {
        id: group.id,
        type: group.type,
        name: group.name,
        image: group.image,
        date: group.date,
        member: group.users.map(e => e.email).indexOf(user_email) >= 0,
        size: group.users.length,
      };
    }).sort((a, b) => a.size < b.size ? 1 : -1);
    return groupsDto;
  }

  async getProfileGroupById(user_email: string, id: string) {
    const user = await this.userService.findUserGroupByEmail(user_email);
    const group = await this.findGroupInfosById(id);
    if (!user || !group)
      throw new BadRequestException('Invalid Request GetProfileGroup');

    const profileGroup: ProfileGroupDto = {
      id: group.id,
      name: group.name,
      image: group.image,
      type: group.type,
      role: this.getRole(group, user.nick),
      members: group.users.map((user: User) => {
        return {
          status: user.status,
          login: user.nick,
          image_url: user.imgUrl,
          role: this.getRole(group, user.nick),
          mutated: this.getRelation(group, user.nick, 'mutated'),
        };
      }),
      banned: group.relations.filter((relation) => {
        if (relation.type === 'banned')
          return relation;
        return;
      }).map((relation) => {
        return {
          login: relation.user_target.nick,
          image_url: relation.user_target.imgUrl,
          role: 'banned',
          mutated: false,
        };
      })
    };

    profileGroup.members = profileGroup.members.sort((a, b) => {
      if (a.role !== b.role) {
        if (a.role === 'owner')
          return -1;
        if (b.role === 'owner')
          return 1;
        if (a.role === 'admin')
          return -1;
        if (b.role === 'admin')
          return 1;
      }
      return a.login.toLowerCase() < b.login.toLowerCase() ? -1 : 1;
    });

    return profileGroup;
  }

  async joinNewGroup(user_email: string, id: string): Promise<boolean> {
    const group = await this.findGroupById(id);
    if (!group)
      throw new BadRequestException('Invalid Request joinGroup');

    if (group.owner.email === user_email)
      return true;
    return false;
  }

  async joinGroup(user_email: string, id: string): Promise<MsgToClient | null | undefined> {
    const user = await this.userService.findUserGroupByEmail(user_email);
    const group = await this.findGroupById(id);
    if (!user || !group)
      throw new BadRequestException('Invalid Request joinGroup');

    if (group.users.map(e => e.email).indexOf(user_email) >= 0
      || this.getRelation(group, user.nick, 'banned'))
      return undefined;

    if (group.type === 'protected'
      && !this.getRelation(group, user.nick, 'join allowed'))
      return undefined;

    const join = new Message();
    join.sender = user;
    join.date = new Date(Date.now());
    join.msg = 'joined the group';
    join.type = 'action';

    const breakpoint = new Message();
    breakpoint.sender = user;
    breakpoint.date = new Date(Date.now() + 1);
    breakpoint.msg = '';
    breakpoint.type = 'breakpoint';

    group.users.push(user);
    group.messages.push(join);
    group.messages.push(breakpoint);

    if (group.type === 'protected')
      this.removeRelation(group, user.nick, 'join allowed');

    try {
      await group.save();
      const msgClient: MsgToClient = {
        id: join.id,
        chat: id,
        user: { login: user.nick, image: user.imgUrl },
        date: join.date,
        msg: join.msg,
        type: join.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('Error saving group joinGroup');
    }
  }

  async leaveGroup(user_email: string, id: string): Promise<MsgToClient | null | undefined> {
    const user = await this.userService.findUserGroupByEmail(user_email);
    const group = await this.findGroupById(id);
    if (!user || !group)
      throw new BadRequestException('Invalid Request joinGroup');

    if (group.users.map(e => e.email).indexOf(user_email) < 0)
      return undefined;

    const lastUser: boolean = group.users.length === 1;

    if (!lastUser && user.email == group.owner.email) {
      let newOwner: User | undefined = group.relations.filter(key => key.type === 'admin').at(0)?.user_target;
      if (newOwner) {
        this.removeRelation(group, newOwner.nick, 'admin');
        group.owner = newOwner;
      } else {
        newOwner = group.users.filter((key) => key.email !== group.owner.email).at(0);
        if (newOwner)
          group.owner = newOwner;
      }
    }
    if (this.getRelation(group, user.nick, 'admin'))
      this.removeRelation(group, user.nick, 'admin');

    const leave = new Message();
    leave.sender = user;
    leave.date = new Date(Date.now());
    leave.msg = 'leaved the group';
    leave.type = 'action';

    group.users = group.users.filter((key) => key.email !== user.email);
    group.messages = group.messages.filter(key =>
      !(key.type === 'breakpoint' && key.sender.email === user_email));

    if (!lastUser)
      group.messages.push(leave);

    try {
      await group.save();
      if (lastUser) {
        await this.groupRepository.delete(group.id);
        return null;
      }
      const msgClient: MsgToClient = {
        id: leave.id,
        chat: id,
        user: { login: user.nick, image: user.imgUrl },
        date: leave.date,
        msg: leave.msg,
        type: leave.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('Error saving group leaveGroup');
    }
  }

  async sendGroupInvite(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const friend = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);

    if (!friend || !user || !group)
      throw new InternalServerErrorException('User not found');

    if (this.getRole(group, user.nick) === 'outside')
      throw new UnauthorizedException('You are not in group');

    if (group.type !== 'public' && this.getRole(group, user.nick) === 'member')
      throw new UnauthorizedException('Permission denied');

    if (this.getRole(group, friend.nick) !== 'outside')
      throw new BadRequestException('User already in group');

    if (this.getRelation(group, friend.nick, 'banned'))
      throw new BadRequestException('User has been banned');

    if (this.userService.isBlocked(user, friend) || this.userService.isBlocked(friend, user))
      return;

    const newNotify = new Notify();
    newNotify.type = 'group';
    newNotify.user_source = user;
    newNotify.date = new Date(Date.now());
    newNotify.additional_info = group.id;

    if (friend.notify?.length === 0) {
      friend.notify = [];
    }

    const duplicated = friend.notify.filter((friendNotify) => {
      if (friendNotify.type == newNotify.type && friendNotify.user_source.nick == newNotify.user_source.nick)
        return friendNotify;
      return;
    });

    if (duplicated.length > 0)
      throw new BadRequestException('User already your order');


    const joined = new GroupRelations();
    joined.date = new Date(Date.now());
    joined.group = group;
    joined.type = 'join allowed';
    joined.user_target = friend;

    group.relations.push(joined);
    friend.notify?.push(newNotify);
    try {
      await group.save();
      await friend.save();
    } catch (err) {
      console.log(err);
    }
  }

  async kickMember(user_email: string, removed_login: string, chat: string): Promise<MsgToClient | null> {
    const user = await this.userService.findUserGroupByEmail(user_email);
    const removed = await this.userService.findUserGroupByNick(removed_login);
    const group = await this.findGroupById(chat);
    if (!group || !user || !removed)
      throw new InternalServerErrorException('Infos not found kickMember');
    if (user.nick !== group.owner.nick && !this.getRelation(group, user.nick, 'admin'))
      return null;
    if (this.getRole(group, removed.nick) === 'outside'
      || this.getRole(group, removed.nick) === 'owner')
      return null;
    if (this.getRelation(group, removed.nick, 'admin') && user.nick !== group.owner.nick)
      return null;
    if (this.getRelation(group, removed.nick, 'admin')) {
      this.removeRelation(group, removed.nick, 'admin');
    }
    const kick = new Message();
    kick.sender = removed;
    kick.date = new Date(Date.now());
    kick.msg = 'has been kicked the group';
    kick.type = 'action';
    group.users = group.users.filter((key) => key.nick !== removed.nick);
    group.messages = group.messages.filter(key =>
      !(key.type === 'breakpoint' && key.sender.nick === removed.nick));
    group.messages.push(kick);
    try {
      await group.save();
      const msgClient: MsgToClient = {
        id: kick.id,
        chat: chat,
        user: { login: removed.nick, image: removed.imgUrl },
        date: kick.date,
        msg: kick.msg,
        type: kick.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('Error saving group joinGroup');
    }
  }

  async addAdmin(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const friend = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);
    if (!friend || !user || !group)
      throw new InternalServerErrorException('User not found');
    if (user.nick !== group.owner.nick)
      throw new UnauthorizedException('Permission denied');
    if (this.getRole(group, friend.nick) !== 'member')
      throw new BadRequestException('Position unavailable');
    const relation = new GroupRelations();
    relation.date = new Date(Date.now());
    relation.user_target = friend;
    relation.type = 'admin';
    group.relations.push(relation);
    try {
      await group.save();
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async removeAdmin(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const friend = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);
    if (!friend || !user || !group)
      throw new InternalServerErrorException('User not found');
    if (user.nick !== group.owner.nick)
      throw new UnauthorizedException('Permission denied');
    if (this.getRole(group, friend.nick) !== 'admin')
      throw new BadRequestException('Position unavailable');
    this.removeRelation(group, friend.nick, 'admin');
    try {
      await group.save();
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async addBan(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const member = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);
    if (!group || !user || !member)
      throw new InternalServerErrorException('Infos not found addBan');
    if (user.nick !== group.owner.nick && !this.getRelation(group, user.nick, 'admin'))
      return null;
    if (this.getRole(group, member.nick) === 'outside'
      || this.getRole(group, member.nick) === 'owner')
      return null;
    if (this.getRelation(group, member.nick, 'admin') && user.nick !== group.owner.nick)
      return null;
    if (this.getRelation(group, member.nick, 'admin'))
      this.removeRelation(group, member.nick, 'admin');
    const relation = new GroupRelations();
    relation.date = new Date(Date.now());
    relation.user_target = member;
    relation.type = 'banned';
    group.relations.push(relation);

    const banned = new Message();
    banned.sender = member;
    banned.date = new Date(Date.now());
    banned.msg = 'has been banned from the group';
    banned.type = 'action';

    group.users = group.users.filter((key) => key.nick !== member.nick);
    group.messages = group.messages.filter(key =>
      !(key.type === 'breakpoint' && key.sender.nick === member.nick));

    group.messages.push(banned);

    try {
      group.save();
      const msgClient: MsgToClient = {
        id: banned.id,
        chat: group.id,
        user: { login: member.nick, image: member.imgUrl },
        date: banned.date,
        msg: banned.msg,
        type: banned.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async removeBan(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const member = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);

    if (!group || !user || !member)
      throw new InternalServerErrorException('Infos not found addBan');

    if (user.nick !== group.owner.nick)
      return null;

    if (!this.getRelation(group, member.nick, 'banned'))
      return null;

    this.removeRelation(group, member.nick, 'banned');

    const unbanned = new Message();
    unbanned.sender = member;
    unbanned.date = new Date(Date.now());
    unbanned.msg = 'has been unbanned from the group';
    unbanned.type = 'action';
    group.messages.push(unbanned);

    try {
      group.save();
      const msgClient: MsgToClient = {
        id: unbanned.id,
        chat: group.id,
        user: { login: member.nick, image: member.imgUrl },
        date: unbanned.date,
        msg: unbanned.msg,
        type: unbanned.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async addMutated(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const member = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);

    if (!member || !user || !group)
      return null;

    if (user.nick !== group.owner.nick && !this.getRelation(group, user.nick, 'admin'))
      return null;

    if (this.getRole(group, member.nick) === 'outside'
      || this.getRole(group, member.nick) === 'owner')
      return null;

    if (this.getRelation(group, member.nick, 'admin') && user.nick !== group.owner.nick)
      return null;

    if (this.getRelation(group, member.nick, 'mutated'))
      return null;

    const relation = new GroupRelations();
    relation.date = new Date(Date.now());
    relation.user_target = member;
    relation.type = 'mutated';
    group.relations.push(relation);

    const mutated = new Message();
    mutated.sender = member;
    mutated.date = new Date(Date.now());
    mutated.msg = 'was mutated';
    mutated.type = 'action';

    group.messages.push(mutated);

    try {
      await group.save();
      const msgClient: MsgToClient = {
        id: mutated.id,
        chat: group.id,
        user: { login: member.nick, image: member.imgUrl },
        date: mutated.date,
        msg: mutated.msg,
        type: mutated.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async removeMutated(user_email: string, groupInviteDto: GroupInviteDto) {
    const user = await this.userService.findUserByEmail(user_email);
    const member = await this.userService.findUserByNick(groupInviteDto.name);
    const group = await this.findGroupById(groupInviteDto.groupId);

    if (!member || !user || !group)
      return null;

    if (user.nick !== group.owner.nick && !this.getRelation(group, user.nick, 'admin'))
      return null;

    if (this.getRole(group, member.nick) === 'outside'
      || this.getRole(group, member.nick) === 'owner')
      return null;

    if (this.getRelation(group, member.nick, 'admin') && user.nick !== group.owner.nick)
      return null;

    if (!this.getRelation(group, member.nick, 'mutated'))
      return null;

    this.removeRelation(group, member.nick, 'mutated');

    const mutated = new Message();
    mutated.sender = member;
    mutated.date = new Date(Date.now());
    mutated.msg = 'was unmuted';
    mutated.type = 'action';

    group.messages.push(mutated);

    try {
      await group.save();
      const msgClient: MsgToClient = {
        id: mutated.id,
        chat: group.id,
        user: { login: member.nick, image: member.imgUrl },
        date: mutated.date,
        msg: mutated.msg,
        type: mutated.type,
      };
      return msgClient;
    } catch (err) {
      throw new InternalServerErrorException('error saving admin');
    }
  }

  async confirmPassword(user_email: string, groupProtectedJoinDto: GroupProtectedJoinDto) {
    const group = await this.findGroupById(groupProtectedJoinDto.groupId);
    if (!group)
      throw new BadRequestException('Group not found confirmPassword');

    if (group.type !== 'protected')
      return;

    if (!bcrypt.compareSync(groupProtectedJoinDto.password as string, group.password as string))
      throw new UnauthorizedException('Invalid Password');

    const user = await this.userService.findUserByEmail(user_email);
    if (!user)
      throw new UnauthorizedException('User Not Found confirmPassword');

    if (this.getRelation(group, user.nick, 'join allowed'))
      return;

    const joined = new GroupRelations();
    joined.date = new Date(Date.now());
    joined.group = group;
    joined.type = 'join allowed';
    joined.user_target = user;

    group.relations.push(joined);
    try {
      await group.save();
    } catch (err) {
      throw new InternalServerErrorException('Error saving group confirmPassword');
    }
  }
}