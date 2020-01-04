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

import { Guild, Message, User } from "discord.js";

class Command {

    _message: Message;
    _redis: any;

    constructor(message: Message, redis: any) {
        this._message = message;
        this._redis = redis;
    }

    /**
     * Default handler
     */
    handle = (): void => {
        // nothing
    };

    /**
     * Reply to the current message
     * @param message
     * @private
     */
    _reply = async (message: string): Promise<any> => {
        await this._message.channel.send(message);
    };

    /**
     * DM the current user
     * @param message
     * @private
     */
    _DM = async (message: string): Promise<any> => {
      await this._message.author.send(message);
    };

    /**
     * Returns the author of the message
     * @private
     */
    get _user(): User {
        return this._message.author;
    }

    /**
     * Returns current guild
     * @private
     */
    get _guild(): Guild {
        return this._message.guild;
    }
}

export default Command;
