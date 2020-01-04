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
import { redisStoreKeys } from '../db';
import { Player } from '../core';


class PlayerDb {

    _redis: Redis;
    _gameId: string;

    constructor(redis: Redis, gameId: string) {
        this._redis = redis;
        this._gameId = gameId;
    }

    async getAll(): Promise<any> {
        const data = await this._redis.hgetall(redisStoreKeys.gamePlayers(this._gameId));
        return Object.values(data).map((json: string) => Player.fromString(json));
    }

    async getPlayerCount(): Promise<number> {
        return this._redis.hlen(redisStoreKeys.gamePlayers(this._gameId));
    }

    async getAlivePlayers(): Promise<any> {
        const players = await this._redis.hgetall(redisStoreKeys.gamePlayers(this._gameId));
        return Object.values(players)
            .map((player: string) => Player.fromString(player))
            .filter((player: Player) => !player.isDead);
    }

    async getById(playerId: string): Promise<Player> {
        const player = await this.findById(playerId);
        if (!player) throw new Error(`No player for id ${playerId}`);
        return player;
    }

    async findById(playerId: string): Promise<Player> {
        const json = await this._redis.hget(
            redisStoreKeys.gamePlayers(this._gameId),
            playerId,
        );
        if (!json) return undefined;
        return Player.fromString(json);
    }

    async setAll(players: []): Promise<void> {
        const update = [];
        players.forEach((player: Player) => {
            update.push(player.userId);
            update.push(player.toString());
        });
        return this._redis.hmset(redisStoreKeys.gamePlayers(this._gameId), update);
    }

    async set(player: Player): Promise<void> {
        await this._redis.hset(redisStoreKeys.gamePlayers(this._gameId), player.userId, player.toString());
    }

    async setPlayerSelectedPlayerIds(playerId: string, targetPlayerIds: [string]): Promise<void> {
        await this._redis.del(redisStoreKeys.playerSelectedPlayerIds(playerId));

        targetPlayerIds.forEach(async (targetPlayerId: never, index: number) => {
            await this._redis.hset(redisStoreKeys.playerSelectedPlayerIds(playerId), index, targetPlayerId);
        });
    }

    async deletePlayerSelectedPlayerIds(playerId: string): Promise<void> {
        await this._redis.del(redisStoreKeys.playerSelectedPlayerIds(playerId));
    }

    async getPlayerSelectedPlayerIds(playerId: string): Promise<any> {
        const data = await this._redis.hgetall(redisStoreKeys.playerSelectedPlayerIds(playerId));
        return Object.values(data);
    }

    async del(playerIds: []): Promise<void> {
        if (playerIds.length === 0) return;
        await this._redis.hdel(redisStoreKeys.gamePlayers(this._gameId), playerIds);
    }

}

export default PlayerDb;
