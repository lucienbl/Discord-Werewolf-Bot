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

export const openGames = (gameMode: string) => `d-games-open:${gameMode}`;
export const openGamesLock = 'd-games-open-lock';

export const gamePlayerOnlineTimestamps = (gameId: string) => `d-game:${gameId}:online-timestamps`;
export const gameCreationTimestamp = (gameId: string) => `d-game:${gameId}:creation-timestamp`;
export const gamePhase = (gameId: string) => `d-game:${gameId}:phase`;
export const gamePlayers = (gameId: string) => `d-game:${gameId}:players`;
export const gameChatMessages = (gameId: string) => `d-game:${gameId}:chat`;
export const gameFinishedAwards = (gameId: string) => `d-game:${gameId}:game-finished-awards`;
export const gameTotalCityMoney = (gameId: string) => `d-game:${gameId}:total-city-money`;
export const gameVoting = (gameId: string, votingId: string) => `d-game:${gameId}:voting:${votingId}`;
export const playerSelectedPlayerIds = (playerId: string) => `d-player:${playerId}:selected-player-ids`;
