/*
 * Copyright (c) 2020 Lucien Blunk-Lallet
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
import EventEmitter = require("events");
import { Guild, User as DiscordUser } from "discord.js";
import { Logger } from '../utils';
import {createRedisInstance, RedisAction, redisActionKeys} from '../db';
import GameStateSocketHandler from './GameStateSocketHandler';
import GameStateDb from './GameStateDb';
import { Player, User } from "../core";
import SocketHandler from "./SocketHandler";
import ChatSocketHandler from "./ChatSocketHandler";


class GameSocketDispatcher {

    _gameId: string;
    _user: User;
    _guild: Guild;
    _redis: Redis;
    _redisSubscriber: any;
    _socketHandlers: [SocketHandler?];
    _localEmitter: EventEmitter;
    _gameStateDb: GameStateDb;

    constructor(user: DiscordUser, player: Player, guild: Guild, redis: Redis, gameId: string) {
        this._gameId = gameId;
        this._user = new User(user, player, gameId);
        this._guild = guild;
        this._redis = redis;
        this._socketHandlers = [];
        this._localEmitter = new EventEmitter();
        this._gameStateDb = new GameStateDb(redis, gameId);
    }

    // @ts-ignore
    _handleRedisMessage = (channel: string, json: string) => {
        const { action, payload } = RedisAction.fromString(json);

        if (action === redisActionKeys.GAME_OVER) {
            this._cleanupRedis().then(() => {
                this._socketHandlers = undefined;
                this._localEmitter = undefined;
            });
        } else {
            this._socketHandlers.forEach((handler: SocketHandler) => handler.handleRedisMessage(action, payload));
        }
    };

    setupClientStack = async (): Promise<void> => {
        Logger.info(`Player ${this._user.username} (${this._user.id}) joining game ${this._gameId}`);

        // subscribe to redis updates
        this._redisSubscriber = createRedisInstance();
        await this._redisSubscriber.subscribe(this._gameId);
        this._redisSubscriber.on('message', this._handleRedisMessage);

        // temp disable listener warnings
        this._localEmitter.setMaxListeners(0);

        // create child handlers
        this._socketHandlers.push(new GameStateSocketHandler(this._redis, this._guild, this._user, this._localEmitter));
        this._socketHandlers.push(new ChatSocketHandler(this._redis, this._guild, this._user, this._localEmitter));

        // handle max listener warnings
        let localEmitterListeners = 0;
        this._socketHandlers.forEach((handler: SocketHandler) => {
            localEmitterListeners += handler.getNumberOfLocalListeners();
        });
        this._localEmitter.setMaxListeners(localEmitterListeners);
    };

    _cleanupRedis = async (): Promise<void> => {
        if (!this._redisSubscriber) return;
        await this._redisSubscriber.unsubscribe();
        this._redisSubscriber.disconnect();
        this._redisSubscriber = undefined;
    };

}

export default GameSocketDispatcher;
