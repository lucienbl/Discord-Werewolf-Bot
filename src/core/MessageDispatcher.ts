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
import { LocalEvents, EventEmitter } from "./index";
import { DirectMessageHandler, Handler, CommonMessageHandler } from "../handlers";
import { Logger } from "../utils";

class MessageDispatcher {

    _localEmitter: EventEmitter;
    _handlers: Handler[];
    _redis: any;

    constructor(redis: any) {
        this._localEmitter = new EventEmitter();
        this._handlers = [];
        this._redis = redis;
    }

    public initializeClientStack = (): void => {
        this._handlers.push(new DirectMessageHandler(this._localEmitter, this._redis));
        this._handlers.push(new CommonMessageHandler(this._localEmitter, this._redis));

        Logger.info("Client stack successfully initialized!");
    };

    public dispatch = async (message: Message): Promise<any> => {
        const isDM = message.channel.type === "dm";
        const isBot = message.author.bot;

        if (isBot) return;

        if (isDM) {
            this._localEmitter._emitLocalEvent(LocalEvents.NEW_MESSAGE_DM, message);
        } else {
            this._localEmitter._emitLocalEvent(LocalEvents.NEW_MESSAGE_COMMON, message);
        }
    };
}

export default MessageDispatcher;
