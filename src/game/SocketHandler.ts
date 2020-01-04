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
import EventEmitter from 'events';
import { User } from '../core';
import { EventListener, Logger } from '../utils';
import GameStateDb from './GameStateDb';
import { DMChannel, Guild, GuildMember } from "discord.js";
import PlayerDb from "./PlayerDb";

class SocketHandler {

    _redis: Redis;
    _guild: Guild;
    _user: User;
    _localEmitter: EventEmitter;
    _playerDb: PlayerDb;
    _gameStateDb: GameStateDb;
    _localEmitterListeners: [EventListener?];

    _dmChannel: DMChannel;

    constructor(redis: Redis, guild: Guild, user: User, localEmitter: EventEmitter) {
        this._redis = redis;
        this._guild = guild;
        this._user = user;
        this._localEmitter = localEmitter;
        this._playerDb = new PlayerDb(redis, this._user.gameId);
        this._gameStateDb = new GameStateDb(redis, this._user.gameId);
        this._localEmitterListeners = [];

        guild.members.find((_member: GuildMember, id: string) => id == user.id).createDM().then((dmChannel: DMChannel) => this._dmChannel = dmChannel).catch((e: any) => Logger.error(e));
    }

    _addLocalListener = (eventName: string, listener: any): void => {
        this._localEmitterListeners.push(new EventListener(eventName, listener));
        this._localEmitter.addListener(eventName, listener);
    };

    async handleRedisMessage(action: string, payload: any): Promise<any> {
        this._handleRedisMessage(action, payload);
    }

    // @ts-ignore
    _handleRedisMessage = (action: string, payload: any): any => {
        // nothing
    };

    _removeListeners = (): void => {
        this._localEmitterListeners.forEach((eventListener: EventListener) => {
            this._localEmitter.removeListener(eventListener.eventName, eventListener.listener);
        });
        this._localEmitter.removeAllListeners();
    };

    getNumberOfLocalListeners = () => this._localEmitterListeners.length;
}

export default SocketHandler;
