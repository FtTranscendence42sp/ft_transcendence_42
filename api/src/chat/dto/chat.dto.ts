/* eslint-disable indent */
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { MsgToClient } from '../chat.class';

export class UserInfoDto {
  status?: string;
  login: string;
  image_url: string;
  role: string;
  mutated: boolean;
  ratio?: string;
}

export class ProfileGroupDto {
  id: string;
  type: string;
  name: string;
  image: string;
  role: string;
  members: UserInfoDto[];
  banned: UserInfoDto[];
}

export class CardGroupDto {
  id: string;
  type: string;
  name: string;
  image: string;
  date: Date;
  member: boolean;
  size: number;
}

export class ChatDto {
  id: string;
  type: string;
  name?: string;
  image?: string;
  messages?: MsgToClient[];
  date: Date;
  newMessages: number;
}

export class UpdateGroupDto {
  @IsNotEmpty({ message: 'Insert an valid id' })
  id: string;
  @IsOptional()
  type?: string;
  @IsOptional()
  name?: string;
  @IsOptional()
  image?: string;

  @IsOptional()
  password?: string;
}

export class GetDirectDto {
  @IsNotEmpty({ message: 'Insert an valid id' })
  id: string;
}

export class GetGroupDto {
  @IsNotEmpty({ message: 'Insert an valid id' })
  id: string;
}

export class RemoveMemberDto {
  @IsNotEmpty({ message: 'Insert an valid id' })
  id: string;
  @IsNotEmpty({ message: 'Insert an valid name' })
  name: string;
}

export class DeleteDirectDto {
  @IsNotEmpty({ message: 'Insert an valid id' })
  friend_login: string;
}

export class GroupInviteDto {
  @IsNotEmpty({ message: 'Insert an valid name' })
  name: string;
  @IsNotEmpty({ message: 'Insert an valid group' })
  groupId: string;
}

export class GroupProtectedJoinDto {
  @IsNotEmpty({ message: 'Insert an valid password' })
  password: string;
  @IsNotEmpty({ message: 'Insert an valid group' })
  groupId: string;
}

export class CreateGroupDto {
  @IsNotEmpty({ message: 'Insert an valid type' })
  type: string;
  @IsNotEmpty({ message: 'Insert an valid name' })
  @MaxLength(20, { message: 'Group Name need have only 20 characters' })
  name: string;
  @IsOptional()
  password?: string;
  @IsOptional()
  confirmPassword?: string;
  @IsOptional()
  image?: string;
  @IsNotEmpty({ message: 'Insert an valid owner' })
  owner: string;
}