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

import { RichEmbed } from "discord.js";

class Embed extends RichEmbed {

    constructor() {
        super();
    }

    toObject() {
        return {
            color: this.color,
            title: this.title,
            description: this.description,
            url: this.url,
            author: {
                name: this.author.name,
                icon_url: this.author.icon_url,
                url: this.author.url
            },
            thumbnail: this.thumbnail,
            fields: this.fields,
            image: this.image,
            timestamp: this.timestamp,
            footer: this.footer
        }
    }

}

export default Embed;
