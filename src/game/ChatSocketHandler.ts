/*
 * Copyright (c) 2019 Lucien Blunk-Lallet
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import Redis from 'ioredis';
import EventEmitter from 'events';
import { User } from '../core';
import { redisStoreKeys, redisActionKeys, RedisAction } from '../db';
import SocketHandler from './SocketHandler';
import { Message, RichEmbed } from "discord.js";
import Player from "../core/Player";

class ChatSocketHandler extends SocketHandler {

    constructor(redis: Redis, socket: any, user: User, localEmitter: EventEmitter) {
        super(redis, socket, user, localEmitter);

        this._user.client.on("message", this._handleSaveChatMsg);
    }

    _handleRedisMessage = async (action: string, payload: any): Promise<void> => {
        switch (action) {
            case redisActionKeys.CHAT_MESSAGE_ADDED: {
                const { message, authorId, authorUsername } = payload;
                if (authorId == this._user.id) return;
                await this._dmChannel.send(`**${authorUsername}:** ${message}`);
                break;
            }

            case redisActionKeys.CHAT_GLOBAL_SYSTEM_MESSAGE_ADDED: {
                let { embed } = payload;
                embed = new RichEmbed(embed);
                await this._dmChannel.send(embed);
                break;
            }
        }
    };

    _handleSaveChatMsg = async (message: Message): Promise<void> => {
        const { gameId } = this._user;
        if (message.author.bot || message.author.id !== this._user.id || message.channel.type !== "dm") return;
        const player: Player = await this._playerDb.getById(message.author.id);
        if (player) {
            this._redis.zadd(redisStoreKeys.gameChatMessages(gameId), message.createdTimestamp, message.content);
            this._redis.publish(gameId, new RedisAction({
                action: redisActionKeys.CHAT_MESSAGE_ADDED,
                payload: {
                    authorId: message.author.id,
                    authorUsername: message.author.username,
                    message: message.content
                },
            }).toString());
        }
    };

}

export default ChatSocketHandler;
