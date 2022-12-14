/* eslint-disable indent */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class GetFriendDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Inform a valid nick!' })
  nick: string;
}