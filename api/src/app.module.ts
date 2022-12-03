import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GameEntity } from './game/entities/game.entity';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/entities/user.entity';
import { GameModule } from './game/game.module';
import { Notify } from './notification/entities/notify.entity';
import { StatusModule } from './status/status.module';
import { Relations } from './relations/entity/relations.entity';
import { Direct } from './chat/entities/direct.entity';
import { ChatModule } from './chat/chat.module';
import { Message } from './chat/entities/message.entity';
import { Group } from './chat/entities/group.entity';
import { GroupRelations } from './chat/entities/groupRelations.entity';
// import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env['DATABASE_HOST'],
      port: 5432,
      username: process.env['DATABASE_USERNAME'],
      password: process.env['DATABASE_PASSWORD'],
      database: process.env['DATABASE'],
      entities: [
        User,
        Notify,
        Relations,
        Direct,
        Group,
        GroupRelations,
        GameEntity,
        Message,
      ],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    UserModule,
    GameModule,
    ChatModule,
    StatusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule { }
