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

import { User as DiscordUser } from "discord.js";
import Player from "./Player";

class User extends DiscordUser {

    _gameId: string;
    _player: Player;

    constructor(user: DiscordUser, player: Player, gameId: string) {
        super(user.client, user);

        this._gameId = gameId;
        this._player = player;
    }

    get gameId(): string {
        return this._gameId;
    }

    get player(): Player {
        return this._player;
    }
}

export default User;
