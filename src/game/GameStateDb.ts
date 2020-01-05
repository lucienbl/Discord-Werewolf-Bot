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
import Redlock = require("redlock");
import { redisStoreKeys, } from '../db';
import * as gamePhases from './gamePhases';

const MAX_LOCK_ATTEMPTS = 10;

class GameStateDb {

    _redis: Redis;
    _redlock: Redlock;
    _gameId: string;

    constructor(redis: Redis, gameId: string) {
        this._redis = redis;
        this._redlock = new Redlock(
            [redis],
            {
                driftFactor: 0.01,
                retryCount: MAX_LOCK_ATTEMPTS,
                retryDelay: 150,
                retryJitter: 200,
            }
        );
        this._gameId = gameId;
    }

    async getCreationTimestamp(): Promise<number> {
        return (await this._redis.get(redisStoreKeys.gameCreationTimestamp(this._gameId))) || 0;
    }

    async setCreationTimestamp(creationTimestamp: number): Promise<void> {
        return this._redis.set(redisStoreKeys.gameCreationTimestamp(this._gameId), creationTimestamp);
    }

    async getAllPlayerOnlineTimestamps(): Promise<Object> {
        return this._redis.hgetall(redisStoreKeys.gamePlayerOnlineTimestamps(this._gameId));
    }

    async setPlayerOnlineTimestamp(playerId: string, timestamp: number): Promise<void> {
        return this._redis.hset(redisStoreKeys.gamePlayerOnlineTimestamps(this._gameId), playerId, timestamp);
    }

    async getGamePhase(): Promise<string> {
        const phase = await this._redis.get(redisStoreKeys.gamePhase(this._gameId));
        return phase || gamePhases.LOBBY;
    }

    async setGamePhase(gamePhase: string): Promise<void> {
        this._redis.set(redisStoreKeys.gamePhase(this._gameId), gamePhase);
    }

    /*async setVoting(voting: Voting): Promise<void> {
        this._redis.set(redisStoreKeys.gameVoting(this._gameId, voting.id), voting.toString());
    }

    async getVoting(votingId: string): Promise<void> {
        const voting = await this._redis.get(redisStoreKeys.gameVoting(this._gameId, votingId));
        if (!voting || voting.length === 0) return new Voting({ id: votingId, votes: {} });
        return Voting.fromString(voting);
    }*/

    async clearVoting(votingId: string): Promise<void> {
        this._redis.del(redisStoreKeys.gameVoting(this._gameId, votingId));
    }

}

export default GameStateDb;
