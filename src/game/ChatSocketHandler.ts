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
import { Roles, User } from '../core';
import { redisStoreKeys, redisActionKeys, RedisAction } from '../db';
import SocketHandler from './SocketHandler';
import { Message, MessageEmbed, RichEmbed, TextChannel } from "discord.js";
import Player from "../core/Player";
import * as gamePhases from './gamePhases';

class ChatSocketHandler extends SocketHandler {

    _message: Message;
    _gamePhase: string;

    constructor(redis: Redis, socket: any, user: User, channel: TextChannel, localEmitter: EventEmitter) {
        super(redis, socket, user, channel, localEmitter);

        this._user.client.on("message", this._handleSaveChatMsg);
    }

    _handleRedisMessage = async (action: string, payload: any): Promise<void> => {
        switch (action) {
            case redisActionKeys.CHAT_MESSAGE_ADDED: {
                const { message, authorId, authorUsername } = payload;

                const gamePhase: string = await this._gameStateDb.getGamePhase();
                const author: Player = await this._playerDb.getById(authorId);

                // if dead
                if (author.isDead && this._user.player.isDead) {
                    await this._sendMessage(`*(Dead)* **${authorUsername}:** ${message}`);
                    return;
                } else if (author.isDead) {
                    return;
                }

                // if ww chat
                if (this._user.player.role.name === Roles.WEREWOLF.name && author.role.name === Roles.WEREWOLF.name && gamePhase === gamePhases.GAME_NIGHT) {
                    await this._sendMessage(`*(Werewolf)* **${authorUsername}:** ${message}`);
                    return;
                }

                // handle other cases
                if (gamePhase === gamePhases.GAME_NIGHT) {
                    return;
                } else {
                    await this._sendMessage(`**${authorUsername}:** ${message}`);
                    return;
                }
            }

            case redisActionKeys.CHAT_GLOBAL_SYSTEM_MESSAGE_ADDED: {
                let { embed } = payload;
                embed = new RichEmbed(embed);
                await this._channel.send(embed);
                break;
            }
        }
    };

    _sendMessage = async (message: string) => {
        const gamePhase: string = await this._gameStateDb.getGamePhase();

        if (this._message && gamePhase === this._gamePhase) {
            const messageEmbed: MessageEmbed = this._message.embeds[0];
            messageEmbed.description += `\n${message}`;
            let embed = new RichEmbed(messageEmbed);
            await this._message.edit(embed);
        } else {
            const embed = new RichEmbed()
                .setAuthor(`${gamePhase} Chat`)
                .setDescription(`\n${message}`);
            this._message = <Message>await this._channel.send(embed);
            this._gamePhase = gamePhase;
        }
    };

    _handleSaveChatMsg = async (message: Message): Promise<void> => {
        const { gameId } = this._user;
        if (message.author.bot || message.author.id !== this._user.id || message.channel.id !== this._channel.id) return;
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
        await message.delete();
    };

}

export default ChatSocketHandler;
