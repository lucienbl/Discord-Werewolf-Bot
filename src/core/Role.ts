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

class Role {

    _name: string;
    _title: string;
    _team: string;
    _icon: string;

    constructor(name: string, title: string, team: string, icon: string) {
        this._name = name;
        this._title = title;
        this._team = team;
        this._icon = icon;
    }

    get name(): string {
        return this._name;
    }

    get title(): string {
        return this._title;
    }

    get team(): string {
        return this._team;
    }

    get icon(): string {
        return this._icon;
    }
}

export default Role;
