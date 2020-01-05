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

class VotingResult {

    _targetPlayerId: string;
    _voteCount: number;

    constructor(targetPlayerId: string, voteCount: number) {
        this._targetPlayerId = targetPlayerId;
        this._voteCount = voteCount;
    }

    get targetPlayerId(): string {
        return this._targetPlayerId;
    }

    get voteCount(): number {
        return this._voteCount;
    }

}

export class Vote {

    _playerId: string;
    _targetPlayerId: string;

    constructor(playerId: string, targetPlayerId: string) {
        this._playerId = playerId;
        this._targetPlayerId = targetPlayerId;
    }

    get playerId(): string {
        return this._playerId;
    }

    get targetPlayerId(): string {
        return this._targetPlayerId;
    }

}


class Voting {

    _id: string;
    _votes: Object;

    constructor({ id, votes }) {
        this._votes = votes;
        this._id = id;
    }

    getVotes(): [Vote?] {
        const result: [Vote?] = [];
        Object.keys(this._votes).forEach((playerId: string) => {
            this._votes[playerId].forEach((targetPlayerId: string) => {
                result.push(new Vote(playerId, targetPlayerId));
            });
        });
        return result;
    }

    getIdsOfPlayerThatVoted(): string[] {
        return Object.keys(this._votes);
    }

    get id(): string {
        return this._id;
    }

    addVote(playerId: string, targetPlayerId: string): void {
        this._votes[playerId].push(targetPlayerId);
    }

    removeVote(playerId: string): void {
        const result = {};
        Object.keys(this._votes).forEach((votePlayerId: string) => {
            if (playerId !== votePlayerId) {
                result[votePlayerId] = this._votes[votePlayerId];
            }
        });
        this._votes = result;
    }

    removeSingleVote(playerId: string, targetPlayerId: string): void {
        const result = [];
        this._votes[playerId].forEach((voteTargetPlayerId: string) => {
            if (targetPlayerId !== voteTargetPlayerId) {
                result.push(voteTargetPlayerId);
            }
        });
        this._votes[playerId] = result;
    }

    setVote(playerId: string, targetPlayerId: string): void {
        if (this._votes[playerId]) {
            if (this._votes[playerId][0] === targetPlayerId) return this.removeVote(playerId);
        }

        this._votes[playerId] = [];
        this._votes[playerId].push(targetPlayerId);
    }

    getVotingCount(targetPlayerId: string): number {
        let result = 0;
        Object.keys(this._votes).forEach((playerId: string) => {
            this._votes[playerId].forEach((voteTargetPlayerId: string) => {
                if (voteTargetPlayerId === targetPlayerId) result++;
            });
        });
        return result;
    }

    getVotesByPlayer(playerId: string): string[] {
        return this._votes[playerId] || [];
    }

    getResults(): VotingResult[] {
        const voteCounts = new Map();
        Object.keys(this._votes).forEach((playerId: string) => {
            const targetIds = this._votes[playerId] || [];
            targetIds.forEach((targetId: string) => {
                const voteCount = (voteCounts.get(targetId) || 0) + 1;
                voteCounts.set(targetId, voteCount);
            });
        });

        const result = [];
        Array.from(voteCounts.keys()).forEach((targetId:string) => {
            result.push(new VotingResult(targetId, voteCounts.get(targetId)));
        });
        result.sort((a: any, b: any) => a.voteCount - b.voteCount);
        result.reverse();
        return result;
    }

    clear(): void {
        this._votes = {};
    }

    toObject(): Object {
        return {
            id: this._id,
            votes: this._votes
        };
    }

    static fromObject(data: any): Voting {
        return new Voting(data);
    }

    toString(): string {
        return JSON.stringify(this.toObject());
    }

    static fromString(json: string): Voting {
        return Voting.fromObject(JSON.parse(json));
    }

}

export default Voting;
