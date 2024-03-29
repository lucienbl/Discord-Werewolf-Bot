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

import { Guild, GuildMember, Message, RichEmbed, User } from "discord.js";
import { Embed, Player, Roles } from "../core";
import { Handler } from "../handlers";
import { Logger, TimeUtils } from "../utils";
import GameSocketDispatcher from "./GameSocketDispatcher";
import { createRedisInstance, RedisAction, redisActionKeys } from "../db";
import PlayerDb from "./PlayerDb";
import * as gamePhases from "./gamePhases";
import * as Config from "../config";
import { Teams } from "../core";
import GameStateDb from "./GameStateDb";
import * as votingIds from './votingIds';
import Voting from "./Voting";

class GameManager {

    _handlers: Handler[];
    _redis: any;
    _gameId: string;
    _redisSubscriber: any;
    _playerDb: PlayerDb;
    _gameStateDb: GameStateDb;
    _guild: Guild;

    constructor(redis: any, gameId: string) {
        this._handlers = [];
        this._redis = redis;
        this._gameId = gameId;
        this._playerDb = new PlayerDb(redis, gameId);
        this._gameStateDb = new GameStateDb(redis, gameId);
    }

    public initialize = async (message: Message): Promise<void> => {
        const msg: Message = <Message>await message.channel.send(`React with an emoji of your choice to participate! The chosen emoji will be your avatar. Game starts in ${Config.GAME_LOBBY_TIMEOUT_DURATION / 1000} seconds...`);

        let timeout = (Config.GAME_LOBBY_TIMEOUT_DURATION / 1000) - 5;
        const lobbyTimeoutInterval = setInterval(async () => {
            await msg.edit(`React with an emoji of your choice to participate! The chosen emoji will be your avatar. Game starts in ${timeout} seconds...`);
            timeout -= 5;
        }, 5000);
        await TimeUtils.timeout(Config.GAME_LOBBY_TIMEOUT_DURATION);
        clearInterval(lobbyTimeoutInterval);
        await msg.delete();

        if (msg.reactions.size < Config.GAME_MINIMAL_PLAYERS) {
            await message.channel.send("Not enough players to start a game, aborting.... :x:");
            return;
        }

        this._guild = msg.guild;

        const addedPlayerIds = [];

        for (const reaction of msg.reactions.array()) {
            for (const user of reaction.users.array()) {
                if (!user.bot && !addedPlayerIds.includes(user.id)) {
                    let role = Roles.WEREWOLF;
                    if ((addedPlayerIds.length + 1) % 2 === 0) role = Roles.SEER;
                    const player = new Player(user.id, reaction.emoji.toString(), role, false);
                    addedPlayerIds.push(player.userId);
                    await new GameSocketDispatcher(user, player, msg.guild, this._redis, this._gameId).setupClientStack();
                    await this._playerDb.set(player);
                }
            }
        }

        await TimeUtils.timeout(2000);

        this.startGame();

        Logger.info("Game stack successfully initialized!");
        await message.channel.send("The game started, go to your channel..!");
    };

    public startGame = async () => {

        if (this._redisSubscriber) await this._cleanupRedis();
        this._redisSubscriber = createRedisInstance();
        await this._redisSubscriber.subscribe(this._gameId);
        this._redisSubscriber.on('message', this._handleRedisMessage);

        this._sendRedisAction(new RedisAction({
            action: redisActionKeys.START_GAME_COUNTDOWN,
            payload: { duration: Config.GAME_START_COUNTDOWN },
        }));
        await TimeUtils.timeout(Config.GAME_START_COUNTDOWN);

        for (let i = 0; i < 10; i++) {
            // NIGHT
            await this._handleNightStart();
            if (await this._checkForWinners()) break;
            this._sendRedisAction(new RedisAction({
                action: redisActionKeys.GAME_PHASE_CHANGED,
                payload: { gamePhase: gamePhases.GAME_NIGHT, duration: Config.GAME_NIGHT_DURATION },
            }));
            await TimeUtils.timeout(Config.GAME_NIGHT_DURATION);
            if (await this._checkForWinners()) break;

            // DAY DISCUSSION
            await this._handleDayDiscussionStart();
            if (await this._checkForWinners()) break;
            this._sendRedisAction(new RedisAction({
                action: redisActionKeys.GAME_PHASE_CHANGED,
                payload: { gamePhase: gamePhases.GAME_DAY_DISCUSSION, duration: Config.GAME_DAY_DISCUSSION_DURATION },
            }));
            await TimeUtils.timeout(Config.GAME_DAY_DISCUSSION_DURATION);
            if (await this._checkForWinners()) break;

            // DAY VOTING
            await this._handleDayVotingStart();
            if (await this._checkForWinners()) break;
            this._sendRedisAction(new RedisAction({
                action: redisActionKeys.GAME_PHASE_CHANGED,
                payload: { gamePhase: gamePhases.GAME_DAY_VOTING, duration: Config.GAME_DAY_VOTING_DURATION },
            }));
            await TimeUtils.timeout(Config.GAME_DAY_VOTING_DURATION);
            await this._handleGameDayVotingFinished();
            if (await this._checkForWinners()) break;
        }

        this._cleanupRedis();
    };

    _handleDayDiscussionStart = async () => {
        this._guild.client.removeAllListeners("messageReactionAdd");

        await this._gameStateDb.setGamePhase(gamePhases.GAME_DAY_DISCUSSION);
    };

    _handleDayVotingStart = async () => {
        await this._gameStateDb.setGamePhase(gamePhases.GAME_DAY_VOTING);
    };

    _handleGameDayVotingFinished = async () => {
        const voting = await this._gameStateDb.getVoting(votingIds.VOTING_DAY_VILLAGE);
        const results = voting.getResults();
        if (!results || !results[0]) return;
        const targetPlayer = await this._playerDb.getById(results[0].targetPlayerId);
        targetPlayer.kill();
        await this._playerDb.set(targetPlayer);
        await this._gameStateDb.clearVoting(votingIds.VOTING_DAY_VILLAGE);

        let embed = new Embed()
            .setAuthor("Day Finished!")
            .setDescription(`The village killed ${this._getUserById(targetPlayer.userId).username} *(${targetPlayer.role.title})*`);

        embed = <Embed>await this._addPlayerMap(embed);

        this._sendSystemEmbed(embed.toObject());

        this._sendRedisAction(new RedisAction({
            action: redisActionKeys.CHANGE_VOTING,
            payload: { voting: new Voting({ id: votingIds.VOTING_DAY_VILLAGE, votes: {} }).toString() }
        }));
    };

    _handleNightStart = async () => {
        this._guild.client.removeAllListeners("messageReactionAdd");
        await this._gameStateDb.setGamePhase(gamePhases.GAME_NIGHT);
    };

    _checkForWinners = async () => {
        const players: [Player] = await this._playerDb.getAll();

        const alivePlayers = [];
        const aliveWerewolves = [];
        const aliveVillagers = [];

        players.forEach((player: Player) => {
           if (!player.isDead) {
               alivePlayers.push(player);
               if (player.role.team === Teams.WEREWOLVES) aliveWerewolves.push(player);
               if (player.role.team === Teams.VILLAGERS) aliveVillagers.push(player);
           }
        });

        // werewolves win ?
        if (aliveWerewolves.length > 0 && aliveVillagers.length === 0) {
            return this._handleEndGame(Teams.WEREWOLVES);
        }

        // villagers win ?
        if (aliveWerewolves.length === 0 && aliveVillagers.length > 0) {
            return this._handleEndGame(Teams.VILLAGERS);
        }

        // continue game ?
        if (alivePlayers.length <= 0) {
            return this._handleEndGame();
        } else {
            return false;
        }
    };

    _getUserById = (userId: string): User => <User>this._guild.members.find((_member: GuildMember, id: string) => id == userId).user;

    _addPlayerMap = async (embed: RichEmbed): Promise<RichEmbed> => {
        const players = await this._playerDb.getAll();
        players.forEach((player: Player) => {
            const username: string = this._getUserById(player.userId).username;
            embed.addField(
                player.isDead ? ":skull:" : player.emoji,
                `${username.length > 8 ? `${username.substr(0, 8)}...` : username} ${player.isDead ? `*(${player.role.title})*` : ""}`,
                true
            );
        });

        return embed;
    };

    _handleEndGame = async (winner?: string) => {
        const description = winner === Teams.WEREWOLVES ? "The winners are the Werewolves!" : (winner === Teams.VILLAGERS ? "The winners are the villagers!" : "Tie!");

        let embed = new Embed()
            .setAuthor("Game Over! This channel will automatically close in " + Config.GAME_OVER_TIMEOUT_DURATION / 1000 + " seconds.")
            .setDescription(description)
            .setThumbnail("https://vignette.wikia.nocookie.net/werewolfonlinebr/images/b/ba/D3F2E3AD-75A5-44B6-ADD8-842283EF1C87.png/revision/latest?cb=20190404203706&path-prefix=pt-br")
            .setImage("https://lh3.googleusercontent.com/AEum6GhOj11KXX9w1R2LIiVODHLGLGib-EUncl_89R8hFxXIVvmavibRCsVjXaudRw");

        embed = <Embed>await this._addPlayerMap(embed);

        this._sendSystemEmbed(embed.toObject());

        this._sendRedisAction(new RedisAction({
            action: redisActionKeys.GAME_OVER,
            payload: { },
        }));

        await this._cleanupRedis();

        return true;
    };

    _sendSystemEmbed = (embed: any) => {
        this._redis.publish(this._gameId, new RedisAction({
            action: redisActionKeys.CHAT_GLOBAL_SYSTEM_MESSAGE_ADDED,
            payload: { embed },
        }).toString());
    };

    _sendRedisAction = (redisAction: RedisAction) => {
        this._redis.publish(this._gameId, redisAction.toString());
    };

    // @ts-ignore
    _handleRedisMessage = async (channel: string, json: string) => {
        // const { action } = RedisAction.fromString(json);
        // Logger.info(action);
    };

    _cleanupRedis = async (): Promise<void> => {
        if (!this._redisSubscriber) return;
        await this._redisSubscriber.unsubscribe();
        this._redisSubscriber.disconnect();
        this._redisSubscriber = undefined;
    };
}

export default GameManager;
