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

class RedisAction {

    _action: string;
    _payload: any;

    constructor({ action, payload }: any) {
        this._action = action;
        this._payload = payload;
    }

    get action(): string {
        return this._action;
    }

    get payload(): any {
        return this._payload;
    }

    toObject() {
        return {
            action: this._action,
            payload: this._payload,
        };
    }

    static fromObject(data: Object): RedisAction {
        return new RedisAction({
            ...data,
        });
    }

    toString(): string {
        return JSON.stringify(this.toObject());
    }

    static fromString(json: string): RedisAction {
        return RedisAction.fromObject(JSON.parse(json));
    }

}

export default RedisAction;
