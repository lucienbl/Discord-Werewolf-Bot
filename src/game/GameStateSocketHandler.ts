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
import { Player, Roles, User } from '../core';
import { RedisAction, redisActionKeys } from '../db';
import SocketHandler from './SocketHandler';
import { Guild, GuildMember, Message, MessageEmbed, MessageReaction, RichEmbed } from "discord.js";
import * as gamePhases from "./gamePhases";
import * as votingIds from './votingIds';
import Voting from "./Voting";

class GameStateSocketHandler extends SocketHandler {

    _actionMessage: Message;

    constructor(redis: Redis, guild: Guild, user: User, localEmitter: EventEmitter) {
        super(redis, guild, user, localEmitter);
    }

    _handleRedisMessage = async (action: string, payload: any): Promise<void> => {
        switch (action) {
            case redisActionKeys.GAME_PHASE_CHANGED: {
                const { gamePhase, duration } = payload;

                switch (gamePhase) {
                    case gamePhases.GAME_NIGHT: this._handleNightStart();
                    break;

                    case gamePhases.GAME_DAY_VOTING: this._handleDayVotingStart();
                    break;
                }

                await this._generateSeparator();
                await this._dmChannel.send(`__**The ${gamePhase.toLowerCase()} started. ${duration / 1000} seconds...**__`);

                break;
            }

            case redisActionKeys.START_GAME_COUNTDOWN: {
                const { duration } = payload;

                this._generateSeparator();

                let embed = new RichEmbed()
                    .setAuthor("Discord Werewolf")
                    .setDescription(`The game starts in ${duration / 1000} seconds... You are a ${this._user.player.role.title}!`)
                    .setThumbnail(this._user.player.role.icon);

                embed = await this._addPlayerMap(embed);

                await this._dmChannel.send(embed);
                break;
            }

            case redisActionKeys.CHANGE_VOTING: {
                const { voting } = payload;
                const messageEmbed: MessageEmbed = this._actionMessage.embeds[0];
                messageEmbed.fields = [];
                let embed = new RichEmbed(messageEmbed);
                embed = await this._addPlayerMap(embed, voting);
                await this._actionMessage.edit(embed);
                break;
            }
        }
    };

    _addPlayerMap = async (embed: RichEmbed, voting?: any): Promise<RichEmbed> => {
        const players = await this._playerDb.getAll();

        if (voting) {
            const votingObj = Voting.fromString(voting);
            players.forEach((player: Player) => {
                embed.addField(
                    player.isDead ? ":skull:" : player.emoji,
                    `**(${votingObj.getVotingCount(player.userId)})** ${this._getDiscordUserById(player.userId).username} ${player.isDead ? `*${player.role.title}*` : ""}`,
                    true
                );
            });
        } else {
            players.forEach((player: Player) => {
                embed.addField(
                    player.isDead ? ":skull:" : player.emoji,
                    `${this._getDiscordUserById(player.userId).username} ${player.isDead ? `*${player.role.title}*` : ""}`,
                    true
                );
            });
        }

        return embed;
    };

    _generateSeparator = async () => await this._dmChannel.send("—————————————————————————");

    _getDiscordUserById = (userId: string): User => <User>this._guild.members.find((_member: GuildMember, id: string) => id == userId).user;

    _sendActionMessage = async (embed: RichEmbed) => {
        const message = <Message>await this._dmChannel.send(embed);
        this._actionMessage = message;
        return message;
    };

    _getSelectedPlayerList = async (messageReaction?: MessageReaction) => {
        const players = await this._playerDb.getAll();

        const selectedPlayers = [];

        if (messageReaction) {
            players.forEach((player: Player) => {
                if (player.emoji == messageReaction.emoji.toString() && messageReaction.count > 1) {
                    selectedPlayers.push(player);
                }
            })
        } else {
            this._actionMessage.reactions.forEach((reaction: MessageReaction) => {
                players.forEach((player: Player) => {
                    if (player.emoji == reaction.emoji.toString() && reaction.count > 1) {
                        selectedPlayers.push(player);
                    }
                })
            });
        }

        return selectedPlayers;
    };

    _handleAwaitPlayerReactionAndStore = async (embed: RichEmbed, callback: any) => {
        embed = await this._addPlayerMap(embed);

        const players = await this._playerDb.getAll();
        const msg: Message = await this._sendActionMessage(embed);
        for (const player of players) {
            if (!player.isDead && player.userId !== this._user.id) {
                await msg.react(player.emoji);
            }
        }

        this._guild.client.on("messageReactionAdd", (async (messageReaction: MessageReaction) => {
            if (messageReaction.users.find((user: User) => user.id === this._user.id)) {
                const selectedPlayerList = await this._getSelectedPlayerList(messageReaction);
                const discordUser = this._getDiscordUserById(selectedPlayerList[0].userId);
                const player = await this._playerDb.getById(selectedPlayerList[0].userId);
                const user = new User(discordUser, player, this._user.gameId);
                // await this._actionMessage.delete();
                this._generateSeparator();
                callback(user);
            }
        }));
    };

    _handleNightStart = async () => {
        switch (this._user.player.role) {
            // WEREWOLF
            case Roles.WEREWOLF: {
                let embed = new RichEmbed()
                    .setAuthor("Night Has Started", this._user.player.role.icon)
                    .setDescription(`Select a player to kill.`);

                this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
                    await this._playerDb.setPlayerSelectedPlayerIds(this._user.id, [user.id]);
                    await this._dmChannel.send(`__**You voted ${user.username}!**__`);
                });
            }
            break;

            // SEER
            case Roles.SEER: {
                let embed = new RichEmbed()
                    .setAuthor("Night Has Started", this._user.player.role.icon)
                    .setDescription(`Select a player to see his role.`);

                this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
                    await this._actionMessage.delete();
                    await this._dmChannel.send(`__**${user.username} is a ${user.player.role.title}!**__`);
                });
            }
            break;
        }
    };

    _handleDayVotingStart = async () => {
        let embed = new RichEmbed()
            .setAuthor("Day Voting Has Started", this._user.player.role.icon)
            .setDescription(`Select a player to kill today!`);

        this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
            // await this._dmChannel.send(`__**You voted ${user.username}!**__`);
            this._handleChangeVoting({
               votingId: votingIds.VOTING_DAY_VILLAGE,
               targetPlayerId: user.id
            });
        });
    };

    _handleChangeVoting = async ({ votingId, targetPlayerId }) => {
        const player = await this._playerDb.getById(this._user.id);
        if (player.isDead) return;
        const voting = await this._gameStateDb.getVoting(votingId);
        voting.setVote(this._user.id, targetPlayerId);
        await this._gameStateDb.setVoting(voting);
        this._redis.publish(this._user.gameId, new RedisAction({
            action: redisActionKeys.CHANGE_VOTING,
            payload: { voting: voting.toString() }
        }));
    };
}

export default GameStateSocketHandler;
