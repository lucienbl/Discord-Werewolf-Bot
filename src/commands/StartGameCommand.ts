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

import { Command } from "./index";
import { Message } from "discord.js";
import GameManager from "../game/GameManager";

class StartGameCommand extends Command {

    constructor(message: Message, redis: any) {
        super(message, redis);
    }

    handle = async (): Promise<any> => {
        await this._reply("Starting game...");
        const gameEventDispatcher = new GameManager(this._redis, this._message.id); // TODO generate game ID
        await gameEventDispatcher.initialize(this._message);
    }
}

export default StartGameCommand;
