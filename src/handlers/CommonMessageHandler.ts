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

import { Message } from "discord.js";
import { EventEmitter } from "events";
import Handler from "./Handler";
import { Commands, LocalEvents } from "../core";
import { StartGameCommand, HelpCommand } from "../commands";

class CommonMessageHandler extends Handler {

    constructor(localEmitter: EventEmitter, redis: any) {
        super(localEmitter, redis);

        this._addLocalListener(LocalEvents.NEW_MESSAGE_COMMON, this._handleNewCommonMessage);
    }

    _handleNewCommonMessage = async (message: Message): Promise<any> => {
        const text = message.content;

        // commands handling
        if (!text.startsWith(process.env.PREFIX)) return;
        switch (text.toLowerCase().substr(1)) {
            case Commands.HELP: return new HelpCommand(message, this._redis).handle();
            case Commands.START_GAME: return new StartGameCommand(message, this._redis).handle();

            default: return;
        }
    };
}

export default CommonMessageHandler;
