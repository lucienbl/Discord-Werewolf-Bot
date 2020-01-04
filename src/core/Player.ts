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

import Role from "./Role";

class Player {

    _userId: string;
    _emoji: string;
    _role: Role;
    _isDead: boolean;

    constructor(userId: string, emoji: string, role: Role, isDead: boolean) {
        this._userId = userId;
        this._emoji = emoji;
        this._role = role;
        this._isDead = isDead;
    }

    get userId(): string {
        return this._userId;
    }

    get emoji(): string {
        return this._emoji;
    }

    get role(): Role {
        return this._role;
    }

    get isDead(): boolean {
        return this._isDead;
    }

    kill() {
        this._isDead = true;
    }

    toObject() {
        return {
            userId: this._userId,
            emoji: this._emoji,
            role: {
                name: this._role.name,
                title: this._role.title,
                icon: this._role.icon
            },
            isDead: this._isDead,
        };
    }

    static fromObject(data: any): Player {
        const { userId, emoji, role, isDead } = data;
        return new Player(userId, emoji, role, isDead);
    }

    toString(): string {
        return JSON.stringify(this.toObject());
    }

    static fromString(json: string): Player {
        return Player.fromObject(JSON.parse(json));
    }
}

export default Player;
