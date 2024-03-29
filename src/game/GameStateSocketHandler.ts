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
import { Embed, Player, Roles, User } from '../core';
import { RedisAction, redisActionKeys } from '../db';
import SocketHandler from './SocketHandler';
import { Guild, GuildMember, Message, MessageEmbed, MessageReaction, RichEmbed, TextChannel, User as DiscordUser } from "discord.js";
import * as gamePhases from "./gamePhases";
import * as votingIds from './votingIds';
import Voting from "./Voting";

class GameStateSocketHandler extends SocketHandler {

    _actionMessage: Message;

    constructor(redis: Redis, guild: Guild, user: User, channel: TextChannel, localEmitter: EventEmitter) {
        super(redis, guild, user, channel, localEmitter);
    }

    _handleRedisMessage = async (action: string, payload: any): Promise<void> => {
        switch (action) {
            case redisActionKeys.GAME_PHASE_CHANGED: {
                const { gamePhase, duration } = payload;

                switch (gamePhase) {
                    case gamePhases.GAME_NIGHT: this._handleNightStart(duration);
                    break;

                    case gamePhases.GAME_DAY_DISCUSSION: this._handleDayDiscussionStart(duration);
                    break;

                    case gamePhases.GAME_DAY_VOTING: this._handleDayVotingStart(duration);
                    break;
                }

                break;
            }

            case redisActionKeys.START_GAME_COUNTDOWN: {
                const { duration } = payload;

                // this._generateSeparator();

                let embed = new RichEmbed()
                    .setAuthor("Welcome to a new game!")
                    .setDescription(`The game starts in ${duration / 1000} seconds... You are a ${this._user.player.role.title}!`)
                    .setThumbnail(this._user.player.role.icon);

                embed = await this._addPlayerMap(embed);

                await this._channel.send(embed);
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

            case redisActionKeys.GAME_OVER: {
                this._closeChannel();
            }
        }
    };

    _addPlayerMap = async (embed: RichEmbed, voting?: any): Promise<RichEmbed> => {
        const players = await this._playerDb.getAll();

        if (voting) {
            const votingObj = Voting.fromString(voting);
            players.forEach((player: Player) => {
                const username: string = this._getDiscordUserById(player.userId).username;
                embed.addField(
                    player.isDead ? ":skull:" : player.emoji,
                    `**(${votingObj.getVotingCount(player.userId)})** ${username.length > 8 ? `${username.substr(0, 8)}...` : username} ${player.isDead ? `*(${player.role.title})*` : ""}`,
                    true
                );
            });
        } else {
            players.forEach((player: Player) => {
                const username: string = this._getDiscordUserById(player.userId).username;
                embed.addField(
                    player.isDead ? ":skull:" : player.emoji,
                    `${username.length > 8 ? `${username.substr(0, 8)}...` : username} ${player.isDead ? `*(${player.role.title})*` : ""}`,
                    true
                );
            });
        }

        return embed;
    };

    _getDiscordUserById = (userId: string): User => <User>this._guild.members.find((_member: GuildMember, id: string) => id == userId).user;

    _sendActionMessage = async (embed: RichEmbed) => {
        const message = <Message>await this._channel.send(embed);
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
            if (messageReaction.users.find((user: DiscordUser) => user.id === this._user.id)) {
                const selectedPlayerList = await this._getSelectedPlayerList(messageReaction);
                const discordUser = this._getDiscordUserById(selectedPlayerList[0].userId);
                const player = await this._playerDb.getById(selectedPlayerList[0].userId);
                const user = new User(discordUser, player, this._user.gameId);
                msg.reactions.forEach((msgReaction: MessageReaction) => {
                    const user: DiscordUser = msgReaction.users.find((user: DiscordUser) => user.id === this._user.id);
                    if (user) {
                       if (msgReaction.emoji !== messageReaction.emoji) msgReaction.remove(user);
                    }
                });
                callback(user);
            }
        }));
    };

    _handleNightStart = async (duration: number) => {
        let embed = new RichEmbed()
            .setAuthor(`Night Has Started... ${duration / 1000} seconds!`, this._user.player.role.icon);

        switch (this._user.player.role) {
            // WEREWOLF
            case Roles.WEREWOLF: {
                embed.setDescription(`Select a player to kill.`);

                this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
                    await this._playerDb.setPlayerSelectedPlayerIds(this._user.id, [user.id]);
                    await this._channel.send(`__**You voted ${user.username}!**__`);
                });
            }
            break;

            // SEER
            case Roles.SEER: {
                this._closeChannel();
                embed.setDescription(`Select a player to see his role.`);

                this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
                    await this._actionMessage.delete();
                    await this._channel.send(`__**${user.username} is a ${user.player.role.title}!**__`);
                });
            }
            break;
        }

        this._scheduleTimeoutMessage(duration);
    };

    _handleDayVotingStart = async (duration: number) => {
        let embed = new RichEmbed()
            .setAuthor(`Day Voting Has Started... ${duration / 1000} seconds!`)
            .setDescription(`Select a player to kill today!`);

        this._handleAwaitPlayerReactionAndStore(embed, async (user: User) => {
            // await this._dmChannel.send(`__**You voted ${user.username}!**__`);
            this._handleChangeVoting({
               votingId: votingIds.VOTING_DAY_VILLAGE,
               targetPlayerId: user.id
            });
        });

        this._scheduleTimeoutMessage(duration);
    };

    _handleDayDiscussionStart = async (duration: number) => {
        const players: [Player] = await this._playerDb.getAll();

        const killedByWerewolves = [];

        // Check for werewolf victims
        for (const player of players) {
            if (player.role.name === Roles.WEREWOLF.name) {
                const playerSelectedPlayerIds = await this._playerDb.getPlayerSelectedPlayerIds(player.userId);
                if (playerSelectedPlayerIds.length > 0) {
                    const playerSelectedPlayer = await this._playerDb.getById(playerSelectedPlayerIds[0]);
                    playerSelectedPlayer.kill();
                    await this._playerDb.set(playerSelectedPlayer);
                    killedByWerewolves.push(playerSelectedPlayer);
                    await this._playerDb.deletePlayerSelectedPlayerIds(player.userId);
                }
            }
        }

        let embed = new Embed()
            .setAuthor(`Day Discussion started for ${duration / 1000} seconds!`)
            .setDescription(`Discuss and try to find the werewolves..`);

        // List players killed by werewolf
        if (killedByWerewolves.length > 0) embed.addField(
            "The werewolves killed the following players this night :",
            killedByWerewolves.map((player: Player, index: number) => `~~${this._getDiscordUserById(player.userId).username}~~ ${index !== (killedByWerewolves.length - 1) ? "• " : ""}`, false),
            false);


        embed.addBlankField(false);

        embed = <Embed>await this._addPlayerMap(embed);

        await this._channel.send(embed);
        this._scheduleTimeoutMessage(duration);
        await this._openChannel();
    };

    _formatMessage = (message: string, values: any) => {
        const placeholderRegex = /(\{\{[\w]+\}\})/;

        return message
            .split(placeholderRegex)
            .filter((textPart: string) => !!textPart)
            .map((textPart: string) => {
                if (textPart.match(placeholderRegex)) {
                    const matchedKey = textPart.slice(2, -2);
                    return values[Object.keys(values).find((val: string) => val === matchedKey)];
                }
                return textPart;
            }).join("");
    };

    _scheduleTimeoutMessage = async (duration: number) => {
        setTimeout(async () => {
            this._channel.send(`5 seconds left!`).then(async (msg: Message) => {
                await msg.delete(5000);
            });
        }, duration - 5000);
    };

    _handleChangeVoting = async ({ votingId, targetPlayerId }: any) => {
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

    _closeChannel = async () => {
        await this._channel.overwritePermissions(this._user, {
            SEND_MESSAGES: false
        });
    };

    _openChannel = async () => {
        await this._channel.overwritePermissions(this._user, {
            SEND_MESSAGES: true
        });
    };
}

export default GameStateSocketHandler;
